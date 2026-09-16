# Teleios Admin — Painel de Gestão & Operações

Aplicação React independente para gestão operacional, disparo de estudos e devocionais via WhatsApp, gestão de mídias (Google Drive, YouTube, Galeria), monitoramento do agente e controle de acesso (RBAC).

---

## 🚀 Inicialização Rápida

### 1. Pré-requisitos
- Node.js 18+ instalado
- Dependências da raiz instaladas (ou `npm install` no diretório local)

### 2. Instalação e Execução Local
A partir do diretório `teleios-admin`:

```bash
cd teleios-admin
npm run dev
```

A aplicação será iniciada em: `http://localhost:5174`

---

## 🛠️ Comandos Disponíveis

| Comando | Descrição |
|---|---|
| `npm run dev` | Inicia o servidor Vite na porta `5174` com Hot Reload |
| `npm run build` | Compila a aplicação para produção no diretório `dist/` |
| `npm run preview` | Executa o preview local da build de produção |
| `npm run lint` | Executa o typecheck rigoroso com `tsc --noEmit` |

---

## ⚙️ Variáveis de Ambiente

Crie um arquivo `.env` baseado no `.env.example`:

```env
# URL base do Cloudflare Worker / Gateway da API
VITE_API_BASE_URL=https://teleios-api-worker.ca88321499.workers.dev

# (Opcional) URL do site público para o botão "Visualizar Site" na Sidebar
VITE_PUBLIC_SITE_URL=http://localhost:5173
```

---

## ☁️ Deploy no Cloudflare Pages

Esta aplicação está 100% desacoplada do site público e pronta para deploy isolado no Cloudflare Pages:

1. No painel do **Cloudflare Dashboard** > **Workers & Pages** > **Create application** > **Pages**.
2. Conecte o repositório Git ou faça deploy direto via Wrangler/CLI.
3. Configure as propriedades de Build:
   - **Project Name:** `teleios-admin`
   - **Root directory:** `teleios-admin`
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
4. Em **Environment variables**, adicione:
   - `VITE_API_BASE_URL`: URL do seu Cloudflare Worker de produção.
5. O arquivo `public/_redirects` já está configurado com `/* /index.html 200` para garantir que o roteamento SPA funcione sem erros 404 nas rotas internas.
