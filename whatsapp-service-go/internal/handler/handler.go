package handler

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	"go.mau.fi/whatsmeow"
	waProto "go.mau.fi/whatsmeow/binary/proto"
	"go.mau.fi/whatsmeow/types"
	"google.golang.org/protobuf/proto"
)

type Handler struct {
	client         *whatsmeow.Client
	clientProvider func() *whatsmeow.Client
	apiSecret      string
}

func NewHandler(client *whatsmeow.Client, secret string) *Handler {
	return &Handler{client: client, apiSecret: secret}
}

func NewHandlerWithProvider(clientProvider func() *whatsmeow.Client, secret string) *Handler {
	return &Handler{clientProvider: clientProvider, apiSecret: secret}
}

func (h *Handler) getClient() *whatsmeow.Client {
	if h.clientProvider != nil {
		return h.clientProvider()
	}
	return h.client
}

func (h *Handler) RequireAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		auth := r.Header.Get("Authorization")
		if h.apiSecret != "" && auth != "" && auth != "Bearer "+h.apiSecret {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}
		next.ServeHTTP(w, r)
	}
}

type SendRequest struct {
	Phone       string `json:"phone"`
	Text        string `json:"text"`
	ImageUrl    string `json:"imageUrl,omitempty"`
	AudioUrl    string `json:"audioUrl,omitempty"`
	MediaBase64 string `json:"mediaBase64,omitempty"`
	MediaType   string `json:"mediaType,omitempty"`
}

func fetchMediaBytes(urlOrBase64 string) ([]byte, string, error) {
	s := strings.TrimSpace(urlOrBase64)
	if s == "" {
		return nil, "", errors.New("empty media url")
	}

	if strings.HasPrefix(s, "http://") || strings.HasPrefix(s, "https://") {
		client := &http.Client{Timeout: 20 * time.Second}
		resp, err := client.Get(s)
		if err != nil {
			return nil, "", err
		}
		defer resp.Body.Close()
		if resp.StatusCode < 200 || resp.StatusCode >= 300 {
			return nil, "", fmt.Errorf("HTTP %d ao baixar mídia", resp.StatusCode)
		}
		data, err := io.ReadAll(resp.Body)
		if err != nil {
			return nil, "", err
		}
		mime := resp.Header.Get("Content-Type")
		if mime == "" || mime == "application/octet-stream" {
			mime = http.DetectContentType(data)
		}
		return data, mime, nil
	}

	if strings.HasPrefix(s, "data:") {
		parts := strings.SplitN(s, ",", 2)
		if len(parts) == 2 {
			meta := parts[0]
			dataStr := parts[1]
			mime := "application/octet-stream"
			if idx := strings.Index(meta, ";"); idx != -1 {
				mime = strings.TrimPrefix(meta[:idx], "data:")
			}
			data, err := base64.StdEncoding.DecodeString(dataStr)
			return data, mime, err
		}
	}

	data, err := base64.StdEncoding.DecodeString(s)
	if err == nil && len(data) > 0 {
		return data, http.DetectContentType(data), nil
	}

	return nil, "", fmt.Errorf("formato de mídia não suportado")
}

func (h *Handler) SendText(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	if r.Method == http.MethodOptions {
		w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
		w.WriteHeader(http.StatusNoContent)
		return
	}

	if r.Method != http.MethodPost {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	var req SendRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Bad Request", http.StatusBadRequest)
		return
	}

	if req.Phone == "" {
		http.Error(w, "Missing phone", http.StatusBadRequest)
		return
	}

	// Format JID properly: preserves @g.us, @newsletter, @s.whatsapp.net
	phone := strings.TrimSpace(req.Phone)
	if !strings.Contains(phone, "@") {
		phone = phone + "@s.whatsapp.net"
	}
	jid, err := types.ParseJID(phone)
	if err != nil {
		http.Error(w, "Invalid JID format: "+err.Error(), http.StatusBadRequest)
		return
	}

	var sentMessageIDs []string
	ctx := r.Context()

	client := h.getClient()
	if client == nil {
		http.Error(w, "Cliente WhatsApp não inicializado", http.StatusServiceUnavailable)
		return
	}

	// ── 1. ENVIAR IMAGEM (se houver) ─────────────────────────────────────────
	imageSrc := req.ImageUrl
	if imageSrc == "" && req.MediaType == "image" && req.MediaBase64 != "" {
		imageSrc = req.MediaBase64
	}

	if imageSrc != "" {
		imgBytes, mimeType, err := fetchMediaBytes(imageSrc)
		if err != nil {
			log.Printf("[WA SEND] Erro ao obter bytes da imagem: %v", err)
		} else {
			if !strings.HasPrefix(mimeType, "image/") {
				mimeType = "image/jpeg"
			}
			uploaded, err := client.Upload(ctx, imgBytes, whatsmeow.MediaImage)
			if err != nil {
				log.Printf("[WA SEND] Erro ao fazer upload da imagem no WhatsApp: %v", err)
			} else {
				imageMsg := &waProto.ImageMessage{
					Caption:       proto.String(req.Text),
					Mimetype:      proto.String(mimeType),
					URL:           &uploaded.URL,
					DirectPath:    &uploaded.DirectPath,
					MediaKey:      uploaded.MediaKey,
					FileEncSHA256: uploaded.FileEncSHA256,
					FileSHA256:    uploaded.FileSHA256,
					FileLength:    &uploaded.FileLength,
				}
				resp, err := client.SendMessage(ctx, jid, &waProto.Message{
					ImageMessage: imageMsg,
				})
				if err != nil {
					http.Error(w, "Erro ao enviar imagem pelo WhatsApp: "+err.Error(), http.StatusInternalServerError)
					return
				}
				sentMessageIDs = append(sentMessageIDs, resp.ID)
				log.Printf("[WA SEND] Imagem enviada com sucesso para %s (MsgID: %s)", jid.String(), resp.ID)
			}
		}
	}

	// ── 2. ENVIAR TEXTO ISOLADO (se não houve imagem enviada com caption) ───
	if len(sentMessageIDs) == 0 && req.Text != "" {
		msg := &waProto.Message{
			Conversation: proto.String(req.Text),
		}
		resp, err := client.SendMessage(ctx, jid, msg)
		if err != nil {
			http.Error(w, "Erro ao enviar texto pelo WhatsApp: "+err.Error(), http.StatusInternalServerError)
			return
		}
		sentMessageIDs = append(sentMessageIDs, resp.ID)
		log.Printf("[WA SEND] Texto enviado com sucesso para %s (MsgID: %s)", jid.String(), resp.ID)
	}

	// ── 3. ENVIAR ÁUDIO (se houver) ──────────────────────────────────────────
	audioSrc := req.AudioUrl
	if audioSrc == "" && req.MediaType == "audio" && req.MediaBase64 != "" {
		audioSrc = req.MediaBase64
	}

	if audioSrc != "" {
		audioBytes, mimeType, err := fetchMediaBytes(audioSrc)
		if err != nil {
			log.Printf("[WA SEND] Erro ao obter bytes do áudio: %v", err)
		} else {
			if !strings.HasPrefix(mimeType, "audio/") {
				mimeType = "audio/mp4"
			}
			uploaded, err := client.Upload(ctx, audioBytes, whatsmeow.MediaAudio)
			if err != nil {
				log.Printf("[WA SEND] Erro ao fazer upload do áudio no WhatsApp: %v", err)
			} else {
				audioMsg := &waProto.AudioMessage{
					Mimetype:      proto.String(mimeType),
					URL:           &uploaded.URL,
					DirectPath:    &uploaded.DirectPath,
					MediaKey:      uploaded.MediaKey,
					FileEncSHA256: uploaded.FileEncSHA256,
					FileSHA256:    uploaded.FileSHA256,
					FileLength:    &uploaded.FileLength,
					PTT:           proto.Bool(true),
				}
				resp, err := client.SendMessage(ctx, jid, &waProto.Message{
					AudioMessage: audioMsg,
				})
				if err != nil {
					log.Printf("[WA SEND] Erro ao enviar áudio: %v", err)
				} else {
					sentMessageIDs = append(sentMessageIDs, resp.ID)
					log.Printf("[WA SEND] Áudio enviado com sucesso para %s (MsgID: %s)", jid.String(), resp.ID)
				}
			}
		}
	}

	if len(sentMessageIDs) == 0 {
		http.Error(w, "Nenhuma mensagem pôde ser enviada. Verifique os dados fornecidos.", http.StatusBadRequest)
		return
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":    true,
		"messageIDs": sentMessageIDs,
		"messageID":  sentMessageIDs[0],
		"timestamp":  time.Now().Format(time.RFC3339),
	})
}

func (h *Handler) GetQR(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode(map[string]string{
		"status": "Check server logs for QR if not connected",
	})
}

// DestinationItem represents a WhatsApp destination (group, community or newsletter)
type DestinationItem struct {
	JID  string `json:"jid"`
	Name string `json:"name"`
	Type string `json:"type"` // "group", "community", "newsletter", "individual"
}

// GetGroups lists all joined groups, communities and subscribed newsletters.
func (h *Handler) GetGroups(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	if r.Method == http.MethodOptions {
		w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
		w.WriteHeader(http.StatusNoContent)
		return
	}

	client := h.getClient()
	if client == nil || !client.IsConnected() {
		w.WriteHeader(http.StatusServiceUnavailable)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "WhatsApp não está conectado. Conecte o WhatsApp primeiro.",
		})
		return
	}

	var destinations []DestinationItem

	// ── 1. Grupos e Comunidades ──────────────────────────────────────────────
	groups, err := client.GetJoinedGroups(r.Context())
	if err == nil {
		for _, g := range groups {
			destType := "group"
			if g.IsParent {
				destType = "community"
			}
			destinations = append(destinations, DestinationItem{
				JID:  g.JID.String(),
				Name: g.Name,
				Type: destType,
			})
		}
	}

	// ── 2. Canais / Newsletters ──────────────────────────────────────────────
	newsletters, err := client.GetSubscribedNewsletters(r.Context())
	if err == nil {
		for _, n := range newsletters {
			destinations = append(destinations, DestinationItem{
				JID:  n.ID.String(),
				Name: n.ThreadMeta.Name.Text,
				Type: "newsletter",
			})
		}
	}

	if destinations == nil {
		destinations = []DestinationItem{}
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"data":    destinations,
	})
}