# TrafficBoard — PRD v1.0

**Documento de Requisitos de Produto**
100% integrado ao EasyTracker via MCP • Deploy no Railway
Junho 2026

---

## 1. Contexto e Problema

O gestor de tráfego hoje opera com um fluxo fragmentado:

- Métricas de campanhas (ROAS, CPA, lucro) estão no EasyTracker
- Resultados por criativo são copiados manualmente para uma planilha Excel/Google Sheets
- O time de edição acessa a planilha — que nem sempre está atualizada — para ver a performance dos seus criativos

Isso gera três problemas concretos:

- Tempo desperdiçado preenchendo planilha manualmente após cada análise
- Risco de dados desatualizados ou incorretos chegando ao time de edição
- Falta de uma interface pensada para o editor — que precisa ver Hook Rate, Hold Rate, CTR, não ROAS e margem

O EasyTracker possui um MCP Server oficial (`https://api.easytracker.digital/api/mcp/v1`) com OAuth 2.1 + PKCE que expõe todas as métricas de campanhas, anúncios, UTMs e eventos de conversão. O objetivo é construir um dashboard que consuma esse MCP como **única fonte de dados**, sem nenhuma outra integração.

> ⚠️ A Utmify foi usada apenas como referência visual de template. Todos os dados virão exclusivamente do EasyTracker MCP.

---

## 2. Solução Proposta

Um dashboard web próprio, hospedado no Railway, que:

1. Conecta ao MCP do EasyTracker via OAuth 2.1 com PKCE
2. Consome os tools expostos pelo MCP para buscar campanhas, anúncios, relatórios e métricas
3. Apresenta três abas: Dashboard Geral, Relatório de Anúncios/UTMs, Controle de Criativos
4. Substitui completamente a planilha manual do time de edição

### 2.1 Fora do escopo do MVP

- Escrita/mutação de dados no EasyTracker via tools destrutivos (`create`, `update`, `delete`, `duplicate`) — dashboard **somente leitura** no MVP
- Multi-usuário com papéis diferenciados (v2)
- Alertas automáticos via WhatsApp/Slack (v2)
- Análise preditiva com IA (v3)

---

## 3. Integração com o EasyTracker MCP

### 3.1 Endpoint e Autenticação

| Campo | Valor |
|---|---|
| URL | `https://api.easytracker.digital/api/mcp/v1` |
| Protocolo | Streamable HTTP (MCP 2024-11) |
| Autenticação | OAuth 2.1 com PKCE |
| Escopos MVP | `tracker:read`, `ads_manager:read` |

### 3.2 Tools Disponíveis (confirmados via MCP)

Os tools abaixo foram confirmados na página MCP do EasyTracker. Os prefixados com `easytracker_` são os nomes exatos expostos pelo servidor.

#### Tools de Leitura — usados no dashboard

| Tool MCP (nome exato) | Scope | Uso no Dashboard |
|---|---|---|
| `easytracker_list_ad_accounts` | `ads_manager:read` | Popular filtro de contas de anúncio |
| `easytracker_list_campaigns` | `ads_manager:read` | Listar campanhas com status, budget, spend, impressões |
| `easytracker_list_ad_sets` | `ads_manager:read` | Listar conjuntos de anúncios por campanha |
| `easytracker_list_ads` | `ads_manager:read` | **Principal fonte para Controle de Criativos** |
| `easytracker_get_campaign_details` | `tracker:read` | Detalhes de uma campanha específica |
| `easytracker_list_offers` | `tracker:read` | Listar produtos/ofertas para filtro |
| `easytracker_get_offer_details` | `tracker:read` | Detalhe de uma oferta |
| `easytracker_list_landings` | `tracker:read` | Landing pages associadas às campanhas |
| `easytracker_get_landing_details` | `tracker:read` | Detalhe de uma landing page |
| `easytracker_list_domains` | `tracker:read` | Domínios cadastrados |
| `easytracker_list_traffic_channels` | `tracker:read` | Canais de tráfego (Meta, TikTok, Google, etc.) |
| `easytracker_get_traffic_channel_details` | `tracker:read` | Detalhe de um canal de tráfego |
| `easytracker_list_traffic_channel_presets` | `tracker:read` | Presets de canais de tráfego |
| `easytracker_list_checkout_settings` | `tracker:read` | Configurações de checkout |
| `easytracker_list_checkout_setting_presets` | `tracker:read` | Presets de checkout |
| `easytracker_list_custom_event_types` | `tracker:read` | Tipos de eventos customizados |
| `easytracker_list_dashboards` | `tracker:read` | Dashboards salvos no EasyTracker |
| `easytracker_get_dashboard_report` | `tracker:read` | **KPIs principais do Dashboard Geral** |
| `easytracker_get_campaign_report` | `tracker:read` | **Relatório detalhado por campanha** |
| `easytracker_verify_installation` | `tracker:read` | Verificar instalação do tracker |

#### Tools de Escrita — **NÃO usados no MVP** (somente leitura)

> Os tools abaixo existem no MCP mas estão fora do escopo do MVP. Listados para referência futura (v2).

`easytracker_duplicate_ad_entities`, `easytracker_delete_ad_entities`, `easytracker_pause_ad_entities`, `easytracker_activate_ad_entities`, `easytracker_update_ad_entity_budget`, `easytracker_update_ad_entity_name`, `easytracker_create_campaign`, `easytracker_update_campaign`, `easytracker_delete_campaign`, `easytracker_create_offer`, `easytracker_update_offer`, `easytracker_delete_offer`, `easytracker_create_landing`, `easytracker_update_landing`, `easytracker_delete_landing`, `easytracker_create_domain`, `easytracker_delete_domain`, `easytracker_create_traffic_channel`, `easytracker_update_traffic_channel`, `easytracker_delete_traffic_channel`, `easytracker_create_checkout_setting`, `easytracker_update_checkout_setting`, `easytracker_delete_checkout_setting`, `easytracker_create_custom_event_type`, `easytracker_update_custom_event_type`, `easytracker_delete_custom_event_type`

### 3.3 Mapeamento Tool → Componente do Dashboard

| Componente | Tool(s) MCP |
|---|---|
| KPIs principais (gastos, ROAS, lucro, CPA) | `easytracker_get_dashboard_report` |
| Funil de conversão | `easytracker_get_dashboard_report` ou `easytracker_get_campaign_report` |
| Tabela de campanhas | `easytracker_list_campaigns` + `easytracker_get_campaign_report` |
| Tabela de anúncios / UTMs | `easytracker_list_ads` + `easytracker_get_campaign_report` |
| Controle de Criativos | `easytracker_list_ads` (nome, status, data) + `easytracker_get_campaign_report` (métricas) |
| Filtro de contas de anúncio | `easytracker_list_ad_accounts` |
| Filtro de produtos/ofertas | `easytracker_list_offers` |
| Filtro de canais de tráfego | `easytracker_list_traffic_channels` |

### 3.4 Fluxo de Autenticação OAuth 2.1

1. Admin acessa o dashboard pela primeira vez
2. Backend redireciona para o endpoint OAuth do EasyTracker com PKCE
3. Browser abre a tela de autorização do EasyTracker (escopos: `tracker:read`, `ads_manager:read`)
4. Owner autoriza o acesso
5. EasyTracker retorna authorization code
6. Backend troca por access token + refresh token (armazenados como variáveis de ambiente no Railway)
7. Refresh automático antes da expiração do token

### 3.5 Cache e Performance

| Tipo de dado | Tool | TTL |
|---|---|---|
| KPIs / relatório do dia | `get_dashboard_report` | 5 minutos |
| Relatório por campanha | `get_campaign_report` | 5 minutos |
| Lista de anúncios | `list_ads` | 5 minutos |
| Lista de campanhas | `list_campaigns` | 5 minutos |
| Contas, ofertas, canais | `list_ad_accounts`, `list_offers`, `list_traffic_channels` | 30 minutos |
| Dashboards salvos | `list_dashboards` | 30 minutos |
| Dados históricos (períodos fechados) | qualquer | 1 hora |

---

## 4. Arquitetura Técnica

### 4.1 Stack

| Camada | Tecnologia | Justificativa |
|---|---|---|
| Frontend | React 18 + Vite + TailwindCSS | Dark mode nativo, componentes reativos, bundle leve |
| Gráficos | Recharts | Leve, customizável, suporte a dark mode |
| Backend | Node.js + Express | Leve, baixo custo no Railway, fácil de manter |
| MCP Client | SDK oficial MCP (TypeScript) | Suporte nativo a Streamable HTTP + OAuth 2.1 |
| Cache | Redis (Railway plugin) ou node-cache | Redis se disponível; fallback em memória |
| Deploy | Railway | CI/CD nativo via GitHub, variáveis de ambiente seguras |
| Auth (dashboard) | JWT assinado por variável de ambiente | Simples para MVP; senha única para o time |

### 4.2 Variáveis de Ambiente (Railway)

| Variável | Descrição | Sensível? |
|---|---|---|
| `EASYTRACKER_MCP_URL` | `https://api.easytracker.digital/api/mcp/v1` | Não |
| `EASYTRACKER_ACCESS_TOKEN` | Token OAuth obtido na autorização | Sim ✓ |
| `EASYTRACKER_REFRESH_TOKEN` | Refresh token para renovação automática | Sim ✓ |
| `EASYTRACKER_CLIENT_ID` | Client ID do OAuth App registrado no EasyTracker | Não |
| `EASYTRACKER_CLIENT_SECRET` | Secret do OAuth App | Sim ✓ |
| `DASHBOARD_PASSWORD` | Senha de acesso ao dashboard (MVP) | Sim ✓ |
| `JWT_SECRET` | Segredo para assinar tokens de sessão | Sim ✓ |
| `REDIS_URL` | URL Redis do Railway (opcional) | Sim ✓ |
| `PORT` | Porta (Railway define automaticamente) | Não |

---

## 5. Especificação das Telas

### 5.1 Layout Global

Tema escuro como padrão. Sidebar esquerda com navegação entre abas. Header superior com:

- Seletor de período (Hoje / Ontem / Últimos 7 dias / Últimos 30 dias / Personalizado)
- Seletor de conta de anúncio (via `easytracker_list_ad_accounts`)
- Seletor de canal de tráfego (via `easytracker_list_traffic_channels` — Meta, TikTok, Google, etc.)
- Seletor de produto/oferta (via `easytracker_list_offers`)
- Botão **Atualizar** (invalida cache, força nova chamada ao MCP)
- Indicador de status da conexão MCP (verde = token válido, vermelho = expirado)

---

### 5.2 Aba 1 — Dashboard Geral

**Tool principal:** `easytracker_get_dashboard_report`

#### KPIs Principais

| Métrica | Lógica | Alerta Visual |
|---|---|---|
| Gastos com Anúncios | `spend` do relatório | Neutro |
| Faturamento Líquido | `revenue` − reembolsos | Azul |
| Lucro | Faturamento − gastos − impostos | Vermelho se < 0 |
| ROAS | Faturamento ÷ gastos | Vermelho se < meta configurada |
| CPA | Gastos ÷ vendas aprovadas | Neutro |
| Margem | (Lucro ÷ faturamento) × 100 | Vermelho se < 0% |
| ROI | (Lucro ÷ gastos) × 100 | Vermelho se < 0 |
| ARPU | Faturamento ÷ compradores únicos | Neutro |
| Vendas Aprovadas | `sales_count` | Neutro |
| Faturamento Bruto | `gross_revenue` | Neutro |

#### Gráficos

| Componente | Tool | Tipo |
|---|---|---|
| Funil de Conversão | `get_dashboard_report` / `get_campaign_report` | Funil horizontal com % de queda |
| Vendas por Hora | `get_dashboard_report` | Barras 00h–23h com % acima |
| Faturamento × Investimento × Lucro (acumulado) | `get_dashboard_report` | Área empilhada por hora |
| Vendas por Dia da Semana | `get_dashboard_report` | Barras com % de participação |
| Vendas por País | `get_dashboard_report` | Mapa de calor + tabela de ranking |
| Vendas por Pagamento | `get_dashboard_report` | Donut chart (Apple Pay / Card / Google Pay / Paypal) |

#### Breakdowns

- Top Campanhas: nome, gastos, faturamento, ROAS — via `easytracker_list_campaigns`
- Vendas por Canal de Tráfego — via `easytracker_list_traffic_channels`
- Vendas por Oferta/Produto — via `easytracker_list_offers`
- Taxa de Aprovação por método de pagamento

---

### 5.3 Aba 2 — Relatório de Campanhas e Anúncios

**Tools:** `easytracker_list_campaigns`, `easytracker_list_ad_sets`, `easytracker_list_ads`, `easytracker_get_campaign_report`

#### Estrutura em abas internas (espelhando o Ads Manager do EasyTracker)

| Aba Interna | Tool | O que exibe |
|---|---|---|
| Campanhas | `list_campaigns` + `get_campaign_report` | Todas as campanhas com métricas agregadas |
| Conjuntos de Anúncios | `list_ad_sets` | Breakdowns por ad set |
| Anúncios | `list_ads` | Todos os anúncios (criativos) com métricas individuais |

#### Filtros

- Busca por nome
- Período de visualização
- Status: Ativo / Pausado / Rejeitado / Todos
- Canal de tráfego (Meta, TikTok, Google, etc.)
- Conta de anúncio
- Produto/oferta

#### Colunas Padrão

Campanha/Anúncio, Status, Gastos, Faturamento, Lucro, ROAS, CPA, Margem, Impressões, Cliques, CTR

#### Colunas Adicionais (ativáveis via modal)

ROI, CPM, CPC, Add to Cart, Cadastros, Custo por Cadastro, Visualizações de Página, CPV, Hook Rate, Hold Rate, Taxa de Retenção 75%, Taxa de ICs, Taxa de Conexão, ARPU, Faturamento Bruto, Vendas Pendentes, Chargeback, Conversão do Checkout

#### Comportamentos

- Ordenação por qualquer coluna
- Valores negativos em vermelho; ROAS abaixo da meta em amarelo
- Linha de totais/médias no rodapé
- Paginação server-side (50 linhas/página)
- Exportar CSV

---

### 5.4 Aba 3 — Controle de Criativos

**Tools:** `easytracker_list_ads` + `easytracker_get_campaign_report`

Esta aba **substitui completamente a planilha manual**. O time de edição acessa diretamente para ver a performance dos seus criativos em tempo real, sem depender do gestor de tráfego.

#### Conceito

Cada linha = um anúncio (criativo) retornado por `easytracker_list_ads`. As métricas de performance são cruzadas via `easytracker_get_campaign_report` filtrando pelo ID do anúncio.

#### Colunas

| Coluna | Fonte | Relevância para o Editor |
|---|---|---|
| Nome do Criativo | `ad.name` via `list_ads` | Identifica o anúncio pelo nome |
| Status | `ad.status` via `list_ads` | Ativo / Pausado / Rejeitado — badge colorido |
| Data de Veiculação | `ad.created_at` ou primeiro spend | Quando entrou no ar |
| Gastos | `spend` via `get_campaign_report` | Total investido |
| Faturamento | `revenue` | Total gerado |
| Lucro / Prejuízo | `revenue − spend − taxes` | Verde/vermelho |
| ROAS | `revenue ÷ spend` | Retorno do criativo |
| CPA | `spend ÷ sales` | Custo por venda |
| CPC | `spend ÷ clicks` | Custo por clique |
| CTR | `(clicks ÷ impressions) × 100` | Qualidade do criativo |
| Hook Rate | `(3s_views ÷ impressions) × 100` | **KPI primário do editor** |
| Hold Rate | `(75pct_views ÷ impressions) × 100` | **KPI primário do editor** |
| Vendas | `sales_count` | Conversões geradas |
| Add to Cart | `add_to_cart` | Intenção de compra |

#### Funcionalidades Exclusivas

- Filtro rápido por status: **Todos | Ativos | Rejeitados | Pausados | Sem dados**
- Busca por nome do criativo
- Filtro por período, canal de tráfego e produto
- Indicadores visuais: 🔥 ROAS acima da meta | ⚠️ Prejuízo | ❌ Rejeitado
- **Exportar CSV** — substitui o preenchimento manual da planilha
- Atualização automática a cada 10 minutos (configurável)
- Linha de totais e médias no rodapé

---

### 5.5 Configurações

- Meta de ROAS (limiar para alertas visuais)
- Meta de faturamento mensal (exibida no header)
- Intervalo de atualização automática
- Status da conexão MCP (token válido, expiração, botão reconectar)
- Colunas padrão visíveis no Relatório

---

## 6. Requisitos Não Funcionais

| Categoria | Requisito | Meta |
|---|---|---|
| Performance | Carregamento com cache quente | < 1,5 segundos |
| Performance | Chamada ao MCP sem cache | < 8 segundos + skeleton screen visível |
| Performance | Cache hit | < 300ms |
| Segurança | Tokens OAuth | Apenas em variáveis de ambiente Railway, nunca no frontend |
| Segurança | Comunicação com MCP | Sempre via backend proxy, nunca direta do browser |
| Segurança | Acesso ao dashboard | JWT com expiração de 8h |
| Disponibilidade | Uptime Railway | > 99% |
| UX | Loading states | Skeleton screens em todas tabelas e gráficos |
| UX | Erros do MCP | Mensagem clara; nunca tela em branco |
| UX | Tema | Dark mode padrão |
| Dispositivos | Prioridade | Desktop; tablet básico; mobile fora do escopo MVP |

---

## 7. Roadmap de Entrega

| Sprint | Duração | Entregas |
|---|---|---|
| Sprint 1 | 1 semana | Setup Railway + backend Node.js + MCP Client OAuth 2.1 + chamadas a `list_ad_accounts`, `list_offers`, `list_traffic_channels` + Auth JWT + rota `/health` |
| Sprint 2 | 1 semana | Aba Dashboard Geral: KPIs via `get_dashboard_report` + todos os gráficos + breakdowns |
| Sprint 3 | 1 semana | Aba Relatório: tabelas Campanhas / Ad Sets / Anúncios + filtros + colunas customizáveis + exportação CSV |
| Sprint 4 | 1 semana | Aba Controle de Criativos: `list_ads` + métricas + badges de status + filtros + exportação CSV |
| Sprint 5 | 3–4 dias | Configurações + polish + testes + tratamento de erros MCP + deploy final |

---

## 8. Critérios de Aceitação do MVP

- Conecta ao EasyTracker MCP via OAuth 2.1 sem expor tokens no frontend
- KPIs do dia carregam em < 8s no primeiro acesso (sem cache)
- Relatório exibe: Nome, Status, Gastos, Faturamento, Lucro, ROAS, CPA, Margem para cada anúncio
- Aba Controle de Criativos exibe Hook Rate, Hold Rate, Status e Data de Veiculação de cada anúncio
- Exportação CSV funcional na aba Controle de Criativos
- Botão Atualizar invalida cache e reflete dados novos na tela
- Erros de conexão com o MCP exibem mensagem clara (não tela em branco)
- Acesso ao dashboard requer autenticação JWT
- **100% dos dados vêm exclusivamente do EasyTracker — nenhuma outra fonte**

---

## 9. Riscos e Mitigações

| Risco | Probabilidade | Mitigação |
|---|---|---|
| `get_dashboard_report` não retorna métricas horárias (vendas por hora) | Média | Agregar via múltiplas chamadas a `get_campaign_report` com filtros de hora; confirmar no Sprint 1 |
| Hook Rate e Hold Rate não disponíveis no nível de anúncio individual | Média | Verificar campos retornados por `list_ads`; se ausente, exibir N/A com tooltip e abrir issue com EasyTracker |
| Rate limit nas chamadas ao MCP ($0.001–$0.005 por call) | Baixa | Cache agressivo + botão Atualizar com cooldown de 30s para controlar custo |
| Token OAuth expira sem refresh | Baixa | Refresh automático 5 min antes da expiração; alerta visual no header se falhar |
| Performance com 200+ anúncios na tabela | Média | Paginação server-side + virtualização de lista (`react-window`) |
| Tools destrutivos chamados acidentalmente | Baixa | Backend só expõe rotas de leitura; tools de escrita nunca são registrados no cliente |

---

## 10. Próximos Passos Imediatos

1. Registrar o dashboard como OAuth App no painel do EasyTracker → obter `CLIENT_ID` e `CLIENT_SECRET`
2. Fazer primeira autenticação OAuth e chamar `easytracker_get_dashboard_report` para confirmar schema dos campos retornados
3. Chamar `easytracker_list_ads` e verificar quais campos de métricas de vídeo (Hook Rate, Hold Rate) estão disponíveis por anúncio
4. Criar repositório no GitHub + projeto no Railway com as variáveis de ambiente
5. Iniciar Sprint 1

---

## Apêndice — Scopes do EasyTracker MCP

| Scope | Descrição | Tipo |
|---|---|---|
| `tracker:read` | Ler entidades do tracker (campanhas, ofertas, domínios, traffic channels, checkouts, eventos) | Leitura |
| `tracker:write` | Criar, atualizar e excluir entidades do tracker | Escrita — fora do MVP |
| `ads_manager:read` | Ler contas de anúncio, campanhas, ad sets e anúncios das redes sociais | Leitura |
| `ads_manager:write` | Pausar, ativar, renomear, alterar budget e duplicar entidades | Escrita — fora do MVP |
| `ads_manager:destructive` | Duplicar e excluir entidades das fontes de tráfego | Destrutivo — fora do MVP |

---

*TrafficBoard PRD v1.0 • EasyTracker MCP (tools confirmados) • Junho 2026*