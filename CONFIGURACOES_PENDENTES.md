# Configurações Pendentes - Ministério Teleios

## 🔧 Resumo do Estado Atual (21/08/2026)

### ✅ Já Funcionando
- **Cloudflare Worker:** https://teleios-api-worker.ca88321499.workers.dev
- **Cloudflare Pages:** https://teleios-platform.pages.dev  
- **Servidor Local (Node/Express):** http://localhost:3000 (rodando em background)
- **PWA Completo:** Manifest, Service Worker, Icons (múltiplos tamanhos), vite-plugin-pwa
- **Landing Page Reformulada:** Responsiva (mobile/tablet/desktop), conteúdo baseado na Missão/Propósito
- **Sidebar Melhorada:** Largura aumentada (w-72 sm:w-80), fontes maiores, icons maiores
- **Build:** Compilando sem erros, PWA precache funcionando (25 entries)

---

## ⚠️ O que Precisa Configurar

### WhatsApp Agent via Durable Object (obrigatório para o fluxo novo)

O Worker e o painel já usam o coordenador WebSocket. Antes do deploy, configure o
mesmo segredo nos dois lados; ele não deve ser incluído no repositório:

```bash
cd cloudflare-worker
npx wrangler secret put AGENT_SECRET --name teleios-api-worker
```

No computador/VPS que executa `whatsapp-service-go`, defina:

```env
AGENT_DO_URL=wss://teleios-api-worker.ca88321499.workers.dev/api/agent/ws?mode=agent
AGENT_SECRET=<o-mesmo-valor-configurado-no-worker>
AGENT_ID=agent_local_001
# Em Docker, use /app/data/store.db para preservar a sessão no volume.
STORE_DB_PATH=store.db
```

Depois, faça o deploy do Worker para aplicar a migration do Durable Object:

```bash
cd cloudflare-worker
npx wrangler deploy
```

### 1. Banco de Dados (CRÍTICO)
**Problema:** Cloudflare D1 atingiu limite de 13 databases no plano Free.

**Opções:**
| Opção | Status | Ação Necessária |
|-------|--------|-----------------|
| PostgreSQL Local | ✅ Recomendado | Instalar PostgreSQL local, criar schema via Prisma, configurar `DATABASE_URL` |
| SQLite Local | Alternativa | Menos recursos, mas funciona para dev |
| Neon/PlanetScale/External | Produção | Configurar conexão externa |
| Upgrade Cloudflare | Não imediato | Pagar plano Workers Paid |

**Schema Prisma já existe:** `/prisma/schema.prisma`
```bash
# Para configurar PostgreSQL local:
cd /c/Users/Carlos/Documents/Teleios-main
# 1. Instalar PostgreSQL
# 2. Criar database: createdb teleios
# 3. Configurar .env com DATABASE_URL
# 4. npx prisma migrate dev
# 5. npx prisma db seed (se houver seed)
```

---

### 2. Whastmeo (WhatsApp VPS) - TESTE LOCAL
**Status:** Código pronto, precisa configurar credenciais reais.

**Onde configurar:**
- **Arquivo:** `.env` (raiz do projeto)
- **Worker secrets:** `npx wrangler secret put WHASTMEO_*` 

**Variáveis necessárias:**
```env
# .env local
WHASTMEO_BASE_URL=http://localhost:8080  # ou URL do VPS
WHASTMEO_API_KEY=sua_chave_api_aqui
WHASTMEO_INSTANCE_ID=teleios-instance
WHASTMEO_WEBHOOK_SECRET=seu_webhook_secret

# Para Cloudflare Worker (já tem RUST_GATEWAY_SECRET)
npx wrangler secret put WHASTMEO_BASE_URL --name teleios-api-worker
npx wrangler secret put WHASTMEO_API_KEY --name teleios-api-worker
npx wrangler secret put WHASTMEO_INSTANCE_ID --name teleios-api-worker
npx wrangler secret put WHASTMEO_WEBHOOK_SECRET --name teleios-api-worker
```

**O que o código já faz (ver `src/services/whastmeo.service.ts`):**
- ✅ Envio de mensagens de texto/imagem/documento
- ✅ Webhook receiver para mensagens recebidas
- ✅ Status de conexão
- ✅ Formatação de números brasileiros

**O que falta definir (configuração de negócio):**
| Configuração | Onde definir | Exemplo |
|-------------|--------------|---------|
| Canal/Numero WhatsApp principal | `.env` | `WHASTMEO_DEFAULT_TO=5511999998888` |
| Horários de disparo (cron) | `src/config/scheduler.ts` | `12:00` e `18:00` diários |
| Tipos de arquivo permitidos | `src/config/whatsapp.ts` | `pdf,jpg,png,mp4,docx` (max 16MB) |
| Tipos de arquivo BLOQUEADOS | `src/config/whatsapp.ts` | `exe,apk,zip,scr` |
| Templates de mensagem aprovados | Meta Business Manager | Pré-aprovar no WhatsApp Business API |
| Rate limiting (msg/min) | `src/services/whastmeo.service.ts` | `20 msg/min` por segurança |

---

### 3. Google Drive API
**Status:** Código pronto em `src/services/google-drive.service.ts`, precisa credenciais.

**O que configurar:**
```env
# .env local
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":...}  # JSON completo
GOOGLE_DRIVE_FOLDER_ID=1AbC_root_folder_id
GOOGLE_DRIVE_SHARED_DRIVE_ID=0ADr_shared_drive_id  # opcional
```

**O que o código já faz:**
- ✅ Upload de arquivos (multipart)
- ✅ Criação de pasta hierárquica `/Ano/Mês/Categoria`
- ✅ Permissões de visualização
- ✅ Download/stream de arquivos
- ✅ Listagem de arquivos por pasta

**Estrutura de pastas esperada:**
```
/2026/08/ESTUDO/
/2026/08/GALERIA/
/2026/08/VIDEO/
/2026/08/PROJETO/
/2026/08/APOIO/
```

---

### 4. Gemini AI (Google AI Studio)
**Status:** Código pronto em `src/services/gemini.service.ts`

**Configurar:**
```env
GEMINI_API_KEY=sua_chave_do_google_ai_studio
GEMINI_MODEL=gemini-1.5-flash  # ou gemini-1.5-pro
```

**O que o código faz:**
- ✅ Síntese de estudos (rawContent → summary)
- ✅ Geração de prompts de imagem para IA
- ✅ Extração de temas/entidades
- ✅ Classificação automática de categoria

---

### 5. YouTube API
**Status:** Código pronto em `src/services/youtube.service.ts`

**Configurar:**
```env
YOUTUBE_API_KEY=sua_chave_youtube_data_api_v3
YOUTUBE_CLIENT_ID=xxx.apps.googleusercontent.com
YOUTUBE_CLIENT_SECRET=xxx
YOUTUBE_REFRESH_TOKEN=xxx  # para upload
YOUTUBE_CHANNEL_ID=UCxxx
```

**O que o código faz:**
- ✅ Upload de vídeos (unlisted/private/public)
- ✅ Atualização de metadados
- ✅ Thumbnails
- ✅ Playlists

---

### 6. Autenticação & JWT
**Já configurado no Worker (secrets):**
- `JWT_SECRET` ✅
- `CF_WORKER_SECRET` ✅  
- `RUST_GATEWAY_SECRET` ✅

**Falta no `.env` local:**
```env
JWT_SECRET=mesmo_valor_do_worker
JWT_EXPIRES_IN=7d
BCRYPT_ROUNDS=12
```

---

### 7. Variáveis de Ambiente Completas (.env.example já existe)

Copie `.env.example` para `.env` e preencha:
```bash
cp .env.example .env
# Editar .env com valores reais
```

---

## 📋 Plano de Implementação Completa

### Fase 1: Banco de Dados Local (Imediato - 30 min)
- [ ] Instalar PostgreSQL 16+ no Windows
- [ ] Criar database `teleios`
- [ ] Configurar `DATABASE_URL` no `.env`
- [ ] `npx prisma migrate dev --name init`
- [ ] Verificar: `npx prisma studio`

### Fase 2: Whastmeo Local (1-2 horas)
- [ ] Subir Whastmeo local (Docker: `docker run -p 8080:8080 whastmeo/whastmeo`)
- [ ] Conectar WhatsApp real (QR code)
- [ ] Configurar `.env` com credenciais
- [ ] Testar envio: `curl -X POST localhost:3000/api/whatsapp/send`
- [ ] Testar webhook: `ngrok http 3000` → configurar webhook no Whastmeo
- [ ] Definir: horários de disparo, tipos de arquivo, rate limits

### Fase 3: Google Drive (30 min)
- [ ] Criar Service Account no Google Cloud Console
- [ ] Habilitar Drive API
- [ ] Compartilhar pasta raiz com service account email
- [ ] Colar JSON no `.env` (GOOGLE_SERVICE_ACCOUNT_KEY)
- [ ] Testar: upload de arquivo via API local

### Fase 4: Gemini AI (15 min)
- [ ] Pegar chave em https://aistudio.google.com
- [ ] Adicionar no `.env`
- [ ] Testar síntese de estudo via API local

### Fase 5: YouTube API (30 min)
- [ ] Google Cloud Console → YouTube Data API v3
- [ ] OAuth 2.0 credentials para upload
- [ ] Gerar refresh token (script único)
- [ ] Configurar `.env`
- [ ] Testar upload de vídeo unlisted

### Fase 6: Deploy Produção (1 hora)
- [ ] Configurar secrets no Cloudflare Worker (todos acima)
- [ ] Configurar variáveis no Cloudflare Pages (build env)
- [ ] Deploy worker: `npx wrangler deploy`
- [ ] Deploy pages: `npm run build && npx wrangler pages deploy dist --project-name teleios-platform`
- [ ] Testar URLs de produção

### Fase 7: PWA & Otimizações (30 min)
- [ ] Testar instalação PWA no mobile (Chrome → Add to Home Screen)
- [ ] Testar offline (Service Worker)
- [ ] Verificar ícones em todos os tamanhos
- [ ] Testar `manifest.json` válido
- [ ] Lighthouse audit (Performance, PWA, Accessibility)

### Fase 8: Testes Integração (1-2 horas)
- [ ] Fluxo completo: Upload → Drive → Gemini → WhatsApp → YouTube
- [ ] Cron jobs disparando nos horários (12h/18h)
- [ ] Webhook WhatsApp recebendo mensagens
- [ ] Admin panel funcional
- [ ] Auth funcionando (login/admin)

---

## 💡 Ideias para Implementar Depois

### Melhorias de Produto
1. **Dashboard de Métricas:** Visualização de alcance, engajamento, conversões
2. **Agendamento Recorrente:** UI para criar séries de estudos (semanal, mensal)
3. **Multi-idioma:** PT/EN/ES para alcance internacional
4. **Modo Escuro:** Toggle no header (já tem base no CSS)
5. **Notificações Push:** Web Push API para estudos diários
6. **Áudio dos Estudos:** TTS (text-to-speech) dos resumos
7. **Comentários/Comunidade:** Sistema de comentários nos estudos

### Técnico
1. **Code-splitting:** Reduzir bundle JS (atual 565KB) via dynamic imports
2. **React Query / TanStack Query:** Cache de dados do servidor
3. **Zod validation:** Schemas para todas as APIs
4. **Testes:** Vitest + Playwright (unit + e2e)
5. **Observabilidade:** Sentry + logs estruturados
6. **CI/CD:** GitHub Actions para deploy automático

### WhatsApp Avançado
1. **Bot de triagem:** IA para classificar pedidos de oração/acolhimento
2. **Respostas rápidas:** Menu interativo (listas, botões)
3. **Broadcast lists:** Segmentação por interesse/região
4. **Integração CRM:** Pipeline de acompanhamento pastoral

---

## 🔗 Links Úteis
- **Worker URL:** https://teleios-api-worker.ca88321499.workers.dev
- **Pages URL:** https://teleios-platform.pages.dev
- **Local Dev:** http://localhost:3000
- **Wrangler Dashboard:** https://dash.cloudflare.com
- **Google Cloud Console:** https://console.cloud.google.com
- **Google AI Studio:** https://aistudio.google.com
- **Prisma Studio:** `npx prisma studio`

---

## 📞 Próximos Passos Imediatos

1. **Você:** Instalar PostgreSQL local e configurar `.env` com `DATABASE_URL`
2. **Você:** Subir Whastmeo local (Docker) e conectar WhatsApp
3. **Eu:** Assim que você der as credenciais, configuro os secrets no Cloudflare e testo integração completa
4. **Nós:** Rodar teste end-to-end (upload → processamento → WhatsApp)

---

*Documento gerado automaticamente. Atualize conforme progresso.*
