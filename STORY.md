# TrafficBoard + EasyTracker — Historia do Projeto

## O Problema

O TrafficBoard (dashboard de trafego pago) precisa de dados do **EasyTracker** via MCP (Model Context Protocol). O EasyTracker usa **OAuth 2.1 com PKCE** e so aceita redirect URIs para `localhost:PORTA/callback` — nao aceita URLs de producao como Railway.

Isso significa que o servidor no Railway **nunca consegue se autenticar diretamente** com o EasyTracker.

---

## Tentativas Falhas

### 1. OAuth Manual no Railway ❌
Criamos rota `/api/auth/easytracker/login` que redirecionava para o authorize do EasyTracker. Resultado: `invalid_redirect_uri` porque o Railway nao e `localhost`.

### 2. Client ID fixo no Railway ❌
Tentamos usar o `EASYTRACKER_ACCESS_TOKEN` (UUID) como token de acesso. Resultado: `invalid_token` porque UUID nao e um token OAuth valido.

### 3. Client Secret no token exchange ❌
Adicionamos `client_secret` ao OAuth flow. Nao resolveu — o problema nao era o secret, era o redirect URI.

### 4. Script OAuth local com client_id fixo ❌
Criamos script que abre servidor local e tenta OAuth. Resultado: `invalid_client` porque o EasyTracker exige **registro dinamico de client** (cada sessao MCP SDK gera um client_id unico).

### 5. Varias versoes de script sync ❌
- `get-token.ts` — falhou, redirect URI invalido
- `get-token-v2.ts` — timeout, usuario nao abriu URL
- `mcp-auth.ts` — SDK sem token, `MODULE_NOT_FOUND`
- `oauth-token.ts` — `invalid_redirect_uri`
- `sync-all.mjs` / `sync-all-v2.mjs` / `sync-now.mjs` — `invalid_client` (client_id aleatorio nao registrado)
- `sync.cjs` / `sync.js` — SDK nao compartilha token entre processos

---

## A Solucao: Arquitetura Sync Local → Railway ✅

O **MCP SDK** faz o OAuth corretamente, mas o token fica armazenado no **DPAPI** (cofre seguro do Windows) — inacessivel de outro processo.

A unica arquitetura que funciona:

```
Seu PC (onde OAuth funciona)
    |
    |── MCP SDK → EasyTracker API (autenticado via localhost)
    |
    ├── Busca dados: dashboard, campanhas, criativos, etc.
    |
    └── POST /api/sync ──→ Railway (dados no cache)
                                |
                                └── Dashboard (le do cache)
```

### O que foi implementado no Railway (ja no ar)

1. **`POST /api/sync`** — endpoint que recebe dados e popula o cache
   - Protegido por `SYNC_SECRET` (Bearer token)
   - Aceita: kpis, funnel, salesByHour/Day/Country/Payment, campaigns, adSets, ads/creatives, adAccounts, products, trafficChannels

2. **Fallback MCP/Cache** — todas as rotas (`/api/dashboard`, `/api/campaigns-report`, `/api/creatives`, `/api/filters`) agora:
   - Tentam MCP primeiro (se conectado)
   - Se MCP falhar ou nao conectado, usam cache
   - Se nao tiver cache nem MCP, retornam erro claro

### O que precisa rodar no PC local

**Script final:** `server/scripts/sync.js`

```bash
cd C:\Dash-Prab\trafficboard\server
node scripts/sync.js
```

Este script usa o **MCP SDK** que:
1. Faz registro dinamico de client (o EasyTracker aceita)
2. Abre navegador para OAuth (localhost:PORTA)
3. O token e armazenado pelo SDK
4. Busca todos os dados do EasyTracker
5. Envia pro Railway via POST /api/sync

---

## Arquivos Relevantes

| Arquivo | Descricao |
|---------|-----------|
| `server/src/routes/sync.ts` | Endpoint POST /api/sync no Railway |
| `server/src/services/SyncHelper.ts` | Helpers mcpOrCache / fromCacheOrMCP |
| `server/src/routes/dashboard.ts` | Dashboard routes com fallback |
| `server/src/routes/utm.ts` | Campaigns routes com fallback |
| `server/src/routes/creatives.ts` | Creatives routes com fallback |
| `server/src/routes/filters.ts` | Filters routes com fallback |
| `server/src/services/CacheService.ts` | Cache com topCampaigns |
| `server/scripts/sync.js` | Script sync local (MCP SDK → Railway) |
| `STORY.md` | Este arquivo |

## Variaveis Railway

```env

# Ja configuradas:
EASYTRACKER_CLIENT_ID=e145f0b5-0bbc-44b8-ac1b-9125f38abc29
EASYTRACKER_MCP_URL=https://api.easytracker.digital/api/mcp/v1
MCP_MOCK=true                              # ← USAR MOCK ENQUANTO NAO RODA SYNC
DASHBOARD_PASSWORD=admin123
JWT_SECRET=8L9317CuheQ4812djswQC2KdXO1L2JXVxUR2JdhlXnR
EASYTRACKER_REDIRECT_URI=                  # ← VAZIO (usa RAILWAY_PUBLIC_URL)

# Removidas (nao funcionam):
# EASYTRACKER_ACCESS_TOKEN=                # UUID não é token valido
# EASYTRACKER_REFRESH_TOKEN=               # UUID não é token valido

# Adicionadas no codigo:
SYNC_SECRET=73c18ce56186e5d221b59e1f559dfaf5f92f7b5030b342511c0f45b5ac863310
```

## Proximos Passos

1. **Curto prazo:** Manter `MCP_MOCK=true` no Railway para o dashboard funcionar com dados de exemplo
2. **Sync real:** Rodar `node scripts/sync.js` no PC local para buscar dados reais do EasyTracker
3. **Automatizacao (futuro):** Configurar scheduler (Windows Task Scheduler) para rodar o sync periodica-mente
4. **Tokens persistentes:** Quando o sync.js funcionar, ele vai printar o token — ai sim salvar como `EASYTRACKER_ACCESS_TOKEN` no Railway

---

## Notas Tecnicas

- EasyTracker OAuth 2.1 com PKCE — exige **dynamic client registration** via MCP SDK
- Redirect URI sempre `localhost:PORTA/callback` — nao tem como mudar
- Tokens ficam no DPAPI (Windows) — so o mesmo processo que criou consegue usar
- `mcp__easytracker__authenticate` funciona dentro desta sessao do Claude Code, mas o token nao e compartilhado com processos filhos