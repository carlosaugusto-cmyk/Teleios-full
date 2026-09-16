# Mapeamento de Funcionalidades - Projeto Teleios (AutoHub Platform)

Este documento reflete a **verdadeira** arquitetura em uso no projeto, baseada no Cloudflare Worker (`cloudflare-worker/src/index.ts`) e nos SPAs Frontend (`src/` e `teleios-admin/`), descartando o código legado Node.js (`server.ts`).

## 1. Arquitetura Geral (Serverless Edge)
A plataforma abandonou o servidor Node.js/Express clássico em favor de uma arquitetura 100% Serverless no Edge da Cloudflare:
- **Backend Central:** Cloudflare Worker rodando `Hono`.
- **Armazenamento de Dados:** Cloudflare KV (`TELEIOS_KV`) no lugar de banco SQL (Prisma). Tudo é salvo em JSON nativamente (usuários, estudos, vídeos, fila de backup).
- **Armazenamento de Mídia:** Cloudflare R2 (`TELEIOS_MEDIA`) para assets estáticos e mídias pesadas.
- **Frontend Público:** SPA React/Vite (`src/`) servido pelo Cloudflare Pages, consumindo as rotas `/api/`.
- **Frontend Admin:** SPA React/Vite isolado na pasta `teleios-admin/`.

## 2. Autenticação e Gestão de Sessões
- **Login via KV:** Verificação de senhas (hash SHA-256) contra o array de usuários armazenado no Cloudflare KV.
- **JWT Próprio:** Geração e assinatura de JWT criptográfico diretamente no Worker (sem dependências externas) usando a Web Crypto API.
- **Middleware:** `authMiddleware` protege as rotas de criação e edição.

## 3. Gestão de Conteúdos (CRUD Serverless)
Os conteúdos não usam mais tabelas relacionais, mas sim arrays serializados no KV:
- **Estudos e Devocionais:** Permite criar rascunhos, agendar e publicar estudos.
- **Vídeos e Mídias:** Permite salvar URLs externas (como YouTube) ou fazer upload direto para o R2.
- **Upload Centralizado:** O endpoint `/api/upload` recebe `FormData`, salva o binário no **Cloudflare R2** e, assincronamente, repassa uma cópia para o **Google Drive**.

## 4. Integrações Inteligentes (Configuráveis no KV)
Todas as integrações agora leem suas chaves diretamente da chave `teleios:config` no KV, não dependendo de `.env` estáticos:
- **Google Drive Backup:** Utilizado como espelho para armazenamento seguro. A Service Account é validada diretamente na rota `/api/integrations/drive/test`.
- **Gemini AI:** Permite processar textos para resumir ou classificar.
- **Agent Coordinator (Durable Objects):** O Worker implementa um `Durable Object` (WebSocket) para coordenar instâncias externas de disparo de mensagens, substituindo sistemas antigos de webhook HTTP.

## 5. Webhooks e Jobs (Fila de Backup)
O Worker implementa um sistema rudimentar de fila em memória e no KV (`teleios:backup_queue`) para sincronizar ou processar tarefas (como salvar backups de dados sensíveis periodicamente) sem bloquear as respostas HTTP aos usuários.
