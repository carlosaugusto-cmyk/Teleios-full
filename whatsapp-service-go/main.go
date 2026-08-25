package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/teleios/whatsapp-service-go/internal/handler"
	"github.com/teleios/whatsapp-service-go/internal/agent"

	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/store/sqlstore"
	_ "github.com/mattn/go-sqlite3"
)

func main() {
	// Secret key for Gateway and DO connection
	apiSecret := os.Getenv("WHATSAPP_API_SECRET")
	if apiSecret == "" {
		apiSecret = "dev_rust_secret_12345" // fallback
	}
	
	agentID := os.Getenv("AGENT_ID")
	if agentID == "" {
		agentID = "agent_local_001"
	}
	
	doURL := os.Getenv("AGENT_DO_URL")
	if doURL == "" {
		// Use dev Worker by default or local dev server
		doURL = "wss://teleios-api-worker.ca88321499.workers.dev/api/agent/ws?mode=agent"
	}

	storePath := os.Getenv("STORE_DB_PATH")
	if storePath == "" {
		storePath = "store.db"
	}
	container, err := sqlstore.New("sqlite3", "file:"+storePath+"?_foreign_keys=on", nil)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	deviceStore, err := container.GetFirstDevice()
	if err != nil {
		log.Fatalf("Failed to get device: %v", err)
	}

	client := whatsmeow.NewClient(deviceStore, nil)

	h := handler.NewHandler(client, apiSecret)

	// Inicia componentes do Agent
	agentSecret := os.Getenv("AGENT_SECRET")
	if agentSecret == "" {
		log.Fatal("AGENT_SECRET is required to connect to the coordinator")
	}
	wsClient := agent.NewWSClient(doURL, agentSecret, agentID)
	jobRunner := agent.NewJobRunner(client, wsClient)
	connManager := agent.NewConnectionManager(client, wsClient, jobRunner)

	log.Println("Starting Connection Manager...")
	connManager.Start()

	mux := http.NewServeMux()
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	})
	mux.HandleFunc("/send", h.RequireAuth(h.SendText))
	mux.HandleFunc("/qr", h.RequireAuth(h.GetQR)) 
	mux.HandleFunc("/status", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(connManager.Status())
	})

	server := &http.Server{
		Addr:    ":8080",
		Handler: mux,
	}

	go func() {
		log.Println("Starting Local HTTP Server on :8080 (fallback)...")
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("HTTP server error: %v", err)
		}
	}()

	// Listen for OS signals
	c := make(chan os.Signal, 1)
	signal.Notify(c, os.Interrupt, syscall.SIGTERM)
	<-c

	log.Println("Shutting down...")
	connManager.Stop()
	server.Shutdown(context.Background())
}
