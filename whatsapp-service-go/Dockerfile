FROM golang:1.21-alpine AS builder

# Requisito para o sqlite3 usando CGO
RUN apk add --no-cache gcc musl-dev

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download

COPY . .

# Build com CGO habilitado
RUN CGO_ENABLED=1 GOOS=linux go build -a -installsuffix cgo -o whatsapp-service main.go

FROM alpine:latest
RUN apk --no-cache add ca-certificates tzdata

WORKDIR /app
COPY --from=builder /app/whatsapp-service .

# Volume para o banco de dados sqlite
VOLUME ["/app/data"]

ENV WHATSAPP_API_SECRET=""
ENV AGENT_DO_URL="wss://teleios-api-worker.ca88321499.workers.dev/api/agent/ws?mode=agent"
ENV AGENT_SECRET="3M7#kL2$vP9!xR4z"
ENV AGENT_ID="agent_vps_001"
ENV STORE_DB_PATH="/app/data/store.db"
EXPOSE 8080

# Executará no root mas no deploy usar um usuário limitado
CMD ["./whatsapp-service"]
