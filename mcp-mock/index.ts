import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

// Simula latência
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// MCP protocol simulation — returns tool list
app.post('/api/mcp/v1', async (req, res) => {
  await delay(100 + Math.random() * 200);
  const { method, params } = req.body;

  if (method === 'listTools') {
    res.json({
      jsonrpc: '2.0',
      id: params?.id || 1,
      result: {
        tools: [
          { name: 'get_dashboard_metrics', description: 'Main KPIs: spend, revenue, profit, ROAS, CPA, margin' },
          { name: 'get_conversion_funnel', description: 'Conversion funnel stages' },
          { name: 'get_sales_by_hour', description: 'Sales and profit by hour (0-23)' },
          { name: 'get_sales_by_day', description: 'Sales by day of week' },
          { name: 'get_sales_by_country', description: 'Sales breakdown by country' },
          { name: 'get_sales_by_payment', description: 'Sales by payment method' },
          { name: 'get_utm_report', description: 'Full UTM report with all metrics' },
          { name: 'get_ad_accounts', description: 'List ad accounts' },
          { name: 'get_products', description: 'List products' },
          { name: 'get_campaigns', description: 'List campaigns and ad sets' },
          { name: 'get_ad_creatives', description: 'List ad creatives with performance metrics' },
        ],
      },
    });
    return;
  }

  if (method === 'callTool') {
    const { name, arguments: args } = params || {};

    // Route to mock data handlers
    const handlers: Record<string, () => any> = {
      get_dashboard_metrics: () => ({
        adSpend: Math.round(12000 + Math.random() * 2000),
        profit: Math.round(28000 + Math.random() * 3000),
        roas: +(3.2 + Math.random() * 0.8).toFixed(2),
        netRevenue: Math.round(44000 + Math.random() * 4000),
        cpa: +(38 + Math.random() * 10).toFixed(2),
        margin: +(35 + Math.random() * 8).toFixed(1),
        roi: +(210 + Math.random() * 40).toFixed(1),
        arpu: +(82 + Math.random() * 15).toFixed(2),
        approvedSales: Math.floor(280 + Math.random() * 60),
        grossRevenue: Math.round(48000 + Math.random() * 4000),
      }),
      get_conversion_funnel: () => {
        const clicks = Math.floor(45000 + Math.random() * 15000);
        const pageViews = Math.floor(clicks * (0.7 + Math.random() * 0.1));
        const addToCart = Math.floor(pageViews * (0.2 + Math.random() * 0.05));
        const checkout = Math.floor(addToCart * (0.45 + Math.random() * 0.1));
        const started = Math.floor(checkout * (0.6 + Math.random() * 0.05));
        const approved = Math.floor(started * (0.4 + Math.random() * 0.05));
        return [
          { label: 'Cliques', value: clicks },
          { label: 'Visualizações de Página', value: pageViews },
          { label: 'Add to Cart', value: addToCart },
          { label: 'ICs (Checkout)', value: checkout },
          { label: 'Vendas Iniciadas', value: started },
          { label: 'Vendas Aprovadas', value: approved },
        ];
      },
      get_sales_by_hour: () => {
        const data = [];
        for (let h = 0; h < 24; h++) {
          const factor = h >= 8 && h <= 22 ? (h >= 10 && h <= 17 ? 3 : 1.5) : 0.3;
          const noise = 0.5 + Math.random();
          const m = factor * noise;
          data.push({
            hour: h,
            investment: Math.round(100 * m * 100) / 100,
            revenue: Math.round(400 * m * 100) / 100,
            profit: Math.round(280 * m * 100) / 100,
          });
        }
        return data;
      },
      get_sales_by_day: () => {
        const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
        const values = days.map(() => Math.floor(100 + Math.random() * 250));
        const maxIdx = values.indexOf(Math.max(...values));
        return days.map((day, i) => ({
          day,
          sales: values[i],
          percentage: 0,
          isBest: i === maxIdx,
        }));
      },
      get_sales_by_country: () => [
        { country: 'Brasil', sales: 856, revenue: 32450, flag: '🇧🇷' },
        { country: 'Portugal', sales: 189, revenue: 7890, flag: '🇵🇹' },
        { country: 'Angola', sales: 67, revenue: 2340, flag: '🇦🇴' },
        { country: 'Moçambique', sales: 45, revenue: 1567, flag: '🇲🇿' },
        { country: 'Cabo Verde', sales: 23, revenue: 890, flag: '🇨🇻' },
        { country: 'EUA', sales: 12, revenue: 456, flag: '🇺🇸' },
      ],
      get_sales_by_payment: () => [
        { method: 'Pix', sales: 567, revenue: 21345, percentage: 45.9, approvalRate: 97.2 },
        { method: 'Cartão de Crédito', sales: 423, revenue: 16780, percentage: 34.3, approvalRate: 88.5 },
        { method: 'Boleto', sales: 178, revenue: 6789, percentage: 14.4, approvalRate: 62.1 },
        { method: 'Outros', sales: 66, revenue: 2340, percentage: 5.4, approvalRate: 91.3 },
      ],
      get_ad_accounts: () => [
        { id: 'act_1', name: 'Ads Manager Principal', platform: 'Meta Ads' },
        { id: 'act_2', name: 'Google Ads Brasil', platform: 'Google Ads' },
        { id: 'act_3', name: 'TikTok Ads BR', platform: 'TikTok Ads' },
      ],
      get_products: () => [
        { id: 'prod_1', name: 'Curso Marketing Digital Completo', price: 297 },
        { id: 'prod_2', name: 'Mentoria Tráfego Pago', price: 997 },
        { id: 'prod_3', name: 'Fórmula de Lançamentos', price: 497 },
        { id: 'prod_4', name: 'Comunidade Tráfego 360', price: 97 },
      ],
      get_campaigns: () => [
        { id: 'camp_1', name: 'LANÇAMENTO Q2 - AQUECIMENTO', status: 'ACTIVE', adSetCount: 5 },
        { id: 'camp_2', name: 'LANÇAMENTO Q2 - ABERTURA', status: 'ACTIVE', adSetCount: 8 },
        { id: 'camp_3', name: 'LANÇAMENTO Q2 - ESGOTO', status: 'ACTIVE', adSetCount: 4 },
        { id: 'camp_4', name: 'WEBINAR MAIO - PROSPECÇÃO', status: 'ACTIVE', adSetCount: 6 },
        { id: 'camp_5', name: 'WEBINAR MAIO - RETARGET', status: 'PAUSED', adSetCount: 3 },
        { id: 'camp_6', name: 'PERMANENTE - TOPO FUNIL', status: 'ACTIVE', adSetCount: 10 },
        { id: 'camp_7', name: 'PERMANENTE - MEIO FUNIL', status: 'PAUSED', adSetCount: 4 },
        { id: 'camp_8', name: 'PERMANENTE - BASF FUNIL', status: 'ACTIVE', adSetCount: 6 },
      ],
      get_ad_creatives: () => {
        const names = [
          'Vídeo_Aquecimento_01', 'Vídeo_Aquecimento_02', 'Vídeo_Abertura_01',
          'Card_Pesquisa_01', 'Card_Pesquisa_02', 'Vídeo_Webinar_01',
          'Vídeo_Webinar_02', 'Card_Webinar_01', 'Vídeo_Retarget_01',
          'Vídeo_Retarget_02', 'Vídeo_Topo_01', 'Vídeo_Topo_02',
          'Card_Topo_01', 'Vídeo_Meio_01', 'Card_Meio_01',
          'Vídeo_Base_01', 'Card_Base_01', 'Vídeo_Aquecimento_03',
          'Vídeo_Abertura_02', 'Vídeo_Live_01', 'Card_Promo_01',
          'Vídeo_Promo_01', 'Vídeo_Depoimento_01', 'Vídeo_Depoimento_02',
          'Card_Depoimento_01', 'Vídeo_Prova_01', 'Vídeo_Prova_02',
          'Card_Oferta_01', 'Vídeo_Oferta_01', 'Vídeo_Oferta_02',
          'Vídeo_Urgência_01', 'Card_Urgência_01',
        ];
        const statuses = ['active', 'active', 'paused', 'active', 'rejected', 'active', 'under_review', 'active', 'paused', 'active', 'no_data'];
        const startDate = '2026-05-01';

        return names.map((name, i) => {
          const status = statuses[i % statuses.length];
          const daysRunning = Math.floor(Math.random() * 30) + 1;
          const dailySpend = 80 + Math.random() * 400;
          const spend = Math.round(dailySpend * daysRunning * 100) / 100;
          const roasVal = status === 'active' ? 2 + Math.random() * 4 : (status === 'paused' ? 0.5 + Math.random() * 1.5 : Math.random() * 0.8);
          const revenue = Math.round(spend * roasVal * 100) / 100;
          const impressions = Math.floor(spend / 100 * (3000 + Math.random() * 12000));
          const clicks = Math.floor(impressions * (0.008 + Math.random() * 0.04));
          const sales = status === 'active' ? Math.floor(revenue / (30 + Math.random() * 80)) : 0;
          return {
            id: `creative_${i + 1}`,
            name,
            status,
            startDate: new Date(new Date(startDate).getTime() - daysRunning * 86400000).toISOString().split('T')[0],
            spend,
            revenue,
            profit: Math.round((revenue - spend - revenue * 0.15) * 100) / 100,
            roas: Math.round(roasVal * 100) / 100,
            cpa: sales > 0 ? Math.round((spend / sales) * 100) / 100 : 0,
            cpc: clicks > 0 ? Math.round((spend / clicks) * 100) / 100 : 0,
            ctr: Math.round((clicks / impressions) * 10000) / 100,
            hookRate: Math.round((5 + Math.random() * 40) * 100) / 100,
            holdRate: Math.round((2 + Math.random() * 25) * 100) / 100,
            sales,
            addToCart: Math.floor(sales * (1.2 + Math.random() * 1.8)),
            impressions,
            clicks,
          };
        });
      },
    };

    const handler = handlers[name];
    if (!handler) {
      res.json({
        jsonrpc: '2.0',
        id: params?.id || 1,
        error: { code: -32601, message: `Tool not found: ${name}` },
      });
      return;
    }

    res.json({
      jsonrpc: '2.0',
      id: params?.id || 1,
      result: {
        content: [{ type: 'text', text: JSON.stringify(handler()) }],
      },
    });
    return;
  }

  res.json({
    jsonrpc: '2.0',
    id: params?.id || 1,
    error: { code: -32601, message: `Method not found: ${method}` },
  });
});

const PORT = 3099;
app.listen(PORT, () => {
  console.log(`[MCP Mock] Running on http://localhost:${PORT}/api/mcp/v1`);
});