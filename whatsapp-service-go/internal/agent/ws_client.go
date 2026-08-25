package agent

import (
	"crypto/rand"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

func randomID() string {
	b := make([]byte, 8)
	rand.Read(b)
	return fmt.Sprintf("req_%x", b)
}

type WSClient struct {
	url       string
	secret    string
	agentID   string
	conn      *websocket.Conn
	connMutex sync.Mutex
	reconnect chan struct{}

	OnMessage func(msg []byte)
}

func NewWSClient(url, secret, agentID string) *WSClient {
	return &WSClient{
		url:       url,
		secret:    secret,
		agentID:   agentID,
		reconnect: make(chan struct{}, 1),
	}
}

func (c *WSClient) Start() {
	go c.connectLoop()
}

func (c *WSClient) connectLoop() {
	backoff := 1 * time.Second
	maxBackoff := 60 * time.Second

	for {
		// Monta a URL garantindo que o token e agentId vão na Query String
		targetURL := c.url
		delimiter := "?"
		if strings.Contains(targetURL, "?") {
			delimiter = "&"
		}
		
		// Injeta os parâmetros na URL para bypassar bloqueio de headers no Cloudflare Worker
		fullURL := fmt.Sprintf("%s%stoken=%s&secret=%s&agentId=%s", targetURL, delimiter, c.secret, c.secret, c.agentID)

		log.Printf("Connecting to DO at %s...", c.url)

		headers := http.Header{}
		headers.Add("X-Agent-Secret", c.secret)
		headers.Add("Authorization", fmt.Sprintf("Bearer %s", c.secret))

		// Capturamos resp para investigar o erro de handshake
		conn, resp, err := websocket.DefaultDialer.Dial(fullURL, headers)
		if err != nil {
			if resp != nil {
				log.Printf("Failed to connect | HTTP Status Code: %d (%s)", resp.StatusCode, resp.Status)
			} else {
				log.Printf("Failed to connect: %v", err)
			}

			time.Sleep(backoff)
			backoff *= 2
			if backoff > maxBackoff {
				backoff = maxBackoff
			}
			continue
		}

		log.Println("Connected to DO!")
		backoff = 1 * time.Second // reset backoff

		c.connMutex.Lock()
		c.conn = conn
		c.connMutex.Unlock()

		// Send REGISTER_AGENT
		regMsg := RegisterAgentMsg{
			BaseMessage:  fillBase("REGISTER_AGENT", randomID),
			AgentID:      c.agentID,
			AgentVersion: "1.0.0",
			Capabilities: []string{"whatsapp_send"},
		}
		c.Send(regMsg)

		// Block and read messages
		c.readLoop(conn)

		// If readLoop exits, connection is closed
		c.connMutex.Lock()
		c.conn = nil
		c.connMutex.Unlock()
	}
}

func (c *WSClient) readLoop(conn *websocket.Conn) {
	defer conn.Close()
	for {
		_, msg, err := conn.ReadMessage()
		if err != nil {
			log.Printf("WebSocket read error: %v", err)
			break
		}
		if c.OnMessage != nil {
			c.OnMessage(msg)
		}
	}
}

func (c *WSClient) Send(msg interface{}) error {
	c.connMutex.Lock()
	defer c.connMutex.Unlock()

	if c.conn == nil {
		return fmt.Errorf("websocket not connected")
	}

	data, err := json.Marshal(msg)
	if err != nil {
		return err
	}

	err = c.conn.WriteMessage(websocket.TextMessage, data)
	if err != nil {
		log.Printf("Failed to send message: %v", err)
		return err
	}
	return nil
}