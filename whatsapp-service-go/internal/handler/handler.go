package handler

import (
	"encoding/json"
	"net/http"
	"strings"

	"go.mau.fi/whatsmeow"
	waProto "go.mau.fi/whatsmeow/binary/proto"
	"go.mau.fi/whatsmeow/types"
	"google.golang.org/protobuf/proto"
)

type Handler struct {
	client    *whatsmeow.Client
	apiSecret string
}

func NewHandler(client *whatsmeow.Client, secret string) *Handler {
	return &Handler{client: client, apiSecret: secret}
}

func (h *Handler) RequireAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		auth := r.Header.Get("Authorization")
		if auth != "Bearer "+h.apiSecret {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}
		next.ServeHTTP(w, r)
	}
}

type SendRequest struct {
	Phone string `json:"phone"`
	Text  string `json:"text"`
}

func (h *Handler) SendText(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	var req SendRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Bad Request", http.StatusBadRequest)
		return
	}

	if req.Phone == "" || req.Text == "" {
		http.Error(w, "Missing phone or text", http.StatusBadRequest)
		return
	}

	// Format JID
	if !strings.Contains(req.Phone, "@s.whatsapp.net") {
		req.Phone = req.Phone + "@s.whatsapp.net"
	}
	jid, err := types.ParseJID(req.Phone)
	if err != nil {
		http.Error(w, "Invalid JID format", http.StatusBadRequest)
		return
	}

	msg := &waProto.Message{
		Conversation: proto.String(req.Text),
	}

	resp, err := h.client.SendMessage(r.Context(), jid, msg)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":   true,
		"messageID": resp.ID,
		"timestamp": resp.Timestamp.String(),
	})
}

func (h *Handler) GetQR(w http.ResponseWriter, r *http.Request) {
	// Not implemented completely, but would provide QR code if disconnected
	json.NewEncoder(w).Encode(map[string]string{
		"status": "Check server logs for QR if not connected",
	})
}
