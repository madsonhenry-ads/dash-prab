import { v4 as uuidv4 } from 'uuid';
import type {
  DashboardKpis, FunnelStep, SalesByHour, SalesByDay,
  SalesByCountry, SalesByPayment, Campaign, AdSet, AdCreative,
  TrafficChannel, McpTool,
} from '../types';

class McpMockService {
  private toolsCache: McpTool[] = [];

  constructor() {
    this.toolsCache = [
      { name: 'easytracker_get_dashboard_report', description: 'Main dashboard KPIs and report data' },
      { name: 'easytracker_list_ad_accounts', description: 'List ad accounts' },
      { name: 'easytracker_list_campaigns', description: 'List campaigns' },
      { name: 'easytracker_list_ad_sets', description: 'List ad sets per campaign' },
      { name: 'easytracker_list_ads', description: 'List ads/creatives' },
      { name: 'easytracker_get_campaign_details', description: 'Get campaign details' },
      { name: 'easytracker_list_offers', description: 'List offers/products' },
      { name: 'easytracker_get_offer_details', description: 'Get offer details' },
      { name: 'easytracker_list_landings', description: 'List landing pages' },
      { name: 'easytracker_list_domains', description: 'List domains' },
      { name: 'easytracker_list_traffic_channels', description: 'List traffic channels' },
      { name: 'easytracker_list_custom_event_types', description: 'List custom events' },
      { name: 'easytracker_list_dashboards', description: 'List saved dashboards' },
      { name: 'easytracker_verify_installation', description: 'Verify tracker installation' },
    ];
  }

  async connect(): Promise<void> {
    // Mock always connects
  }

  async callTool(name: string, args?: Record<string, any>): Promise<any> {
    // Simulate network latency
    await new Promise(r => setTimeout(r, 200 + Math.random() * 400));

    switch (name) {
      case 'easytracker_get_dashboard_report': return this.getDashboardReport(args);
      case 'easytracker_list_ad_accounts': return this.getAdAccounts();
      case 'easytracker_list_campaigns': return this.getCampaigns();
      case 'easytracker_list_ad_sets': return this.getAdSets(args);
      case 'easytracker_list_ads': return this.getAds(args);
      case 'easytracker_get_campaign_details': return this.getCampaignDetails(args);
      case 'easytracker_list_offers': return this.getOffers();
      case 'easytracker_get_offer_details': return this.getOfferDetails(args);
      case 'easytracker_list_traffic_channels': return this.getTrafficChannels();
      case 'easytracker_list_dashboards': return [{ id: 'db_1', name: 'Dashboard Principal', type: 'main' }];
      case 'easytracker_verify_installation': return { verified: true, trackerId: 'trk_mock_001' };
      default: return this.getDashboardReport(args);
    }
  }

  isConnected(): boolean {
    return true;
  }

  getTools(): McpTool[] {
    return this.toolsCache;
  }

  private getDashboardReport(args?: any) {
    return {
      kpis: {
        adSpend: 12543.78,
        profit: 28765.42,
        roas: 3.62,
        netRevenue: 45234.56,
        cpa: 42.15,
        margin: 38.9,
        roi: 229.3,
        arpu: 89.45,
        approvedSales: 312,
        grossRevenue: 48987.34,
      },
      funnel: [
        { label: 'Cliques', value: 52341 },
        { label: 'Visualizações de Página', value: 38729, percentage: 74 },
        { label: 'Add to Cart', value: 8934, percentage: 23.1 },
        { label: 'ICs (Checkout)', value: 4567, percentage: 51.1 },
        { label: 'Vendas Iniciadas', value: 2890, percentage: 63.3 },
        { label: 'Vendas Aprovadas', value: 1234, percentage: 42.7 },
      ],
      salesByHour: Array.from({ length: 24 }, (_, h) => {
        const factor = h >= 8 && h <= 22 ? (h >= 10 && h <= 17 ? 3 : 1.5) : 0.3;
        const noise = 0.5 + Math.random();
        const m = factor * noise;
        return { hour: h, investment: Math.round(100 * m * 100) / 100, revenue: Math.round(400 * m * 100) / 100, profit: Math.round(280 * m * 100) / 100 };
      }),
      salesByDay: ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'].map((d, i) => ({
        day: d, sales: Math.round(150 + Math.random() * 200), percentage: 0, isBest: i === 5,
      })),
      salesByCountry: [
        { country: 'Brasil', sales: 856, revenue: 32450, flag: '🇧🇷' },
        { country: 'Portugal', sales: 189, revenue: 7890, flag: '🇵🇹' },
        { country: 'Angola', sales: 67, revenue: 2340, flag: '🇦🇴' },
        { country: 'Moçambique', sales: 45, revenue: 1567, flag: '🇲🇿' },
        { country: 'Cabo Verde', sales: 23, revenue: 890, flag: '🇨🇻' },
      ],
      salesByPayment: [
        { method: 'Pix', sales: 567, revenue: 21345, percentage: 45.9, approvalRate: 97.2 },
        { method: 'Cartão de Crédito', sales: 423, revenue: 16780, percentage: 34.3, approvalRate: 88.5 },
        { method: 'Boleto', sales: 178, revenue: 6789, percentage: 14.4, approvalRate: 62.1 },
        { method: 'Outros', sales: 66, revenue: 2340, percentage: 5.4, approvalRate: 91.3 },
      ],
      topCampaigns: [
        { name: 'LANÇAMENTO Q2 - ABERTURA', spend: 3450, revenue: 15670, roas: 4.54 },
        { name: 'PERMANENTE - TOPO FUNIL', spend: 2890, revenue: 12340, roas: 4.27 },
        { name: 'WEBINAR MAIO - PROSPECÇÃO', spend: 2100, revenue: 8450, roas: 4.02 },
        { name: 'LANÇAMENTO Q2 - AQUECIMENTO', spend: 1870, revenue: 6780, roas: 3.63 },
      ],
    };
  }

  private getAdAccounts() {
    return [
      { id: 'act_1', name: 'Ads Manager Principal', platform: 'Meta Ads' },
      { id: 'act_2', name: 'Google Ads Brasil', platform: 'Google Ads' },
      { id: 'act_3', name: 'TikTok Ads BR', platform: 'TikTok Ads' },
    ];
  }

  private getCampaigns(): Campaign[] {
    return [
      { id: 'camp_1', name: 'LANÇAMENTO Q2 - AQUECIMENTO', status: 'ACTIVE', budget: 5000, spend: 1870, impressions: 45600, clicks: 2340, revenue: 6780, profit: 4230, roas: 3.63, cpa: 31.17, ctr: 5.13, sales: 60 },
      { id: 'camp_2', name: 'LANÇAMENTO Q2 - ABERTURA', status: 'ACTIVE', budget: 8000, spend: 3450, impressions: 89200, clicks: 4450, revenue: 15670, profit: 9890, roas: 4.54, cpa: 28.75, ctr: 4.99, sales: 120 },
      { id: 'camp_3', name: 'LANÇAMENTO Q2 - ESGOTO', status: 'ACTIVE', budget: 3000, spend: 1200, impressions: 23400, clicks: 980, revenue: 3450, profit: 1720, roas: 2.88, cpa: 37.50, ctr: 4.19, sales: 32 },
      { id: 'camp_4', name: 'WEBINAR MAIO - PROSPECÇÃO', status: 'ACTIVE', budget: 4000, spend: 2100, impressions: 56700, clicks: 2890, revenue: 8450, profit: 5270, roas: 4.02, cpa: 35.00, ctr: 5.10, sales: 60 },
      { id: 'camp_5', name: 'WEBINAR MAIO - RETARGET', status: 'PAUSED', budget: 2500, spend: 890, impressions: 12300, clicks: 670, revenue: 2340, profit: 1100, roas: 2.63, cpa: 29.67, ctr: 5.45, sales: 30 },
      { id: 'camp_6', name: 'PERMANENTE - TOPO FUNIL', status: 'ACTIVE', budget: 6000, spend: 2890, impressions: 78900, clicks: 3980, revenue: 12340, profit: 8120, roas: 4.27, cpa: 32.11, ctr: 5.04, sales: 90 },
      { id: 'camp_7', name: 'PERMANENTE - MEIO FUNIL', status: 'PAUSED', budget: 3500, spend: 1500, impressions: 34500, clicks: 1560, revenue: 4560, profit: 2480, roas: 3.04, cpa: 34.09, ctr: 4.52, sales: 44 },
      { id: 'camp_8', name: 'PERMANENTE - BASF FUNIL', status: 'ACTIVE', budget: 4500, spend: 2340, impressions: 67800, clicks: 3120, revenue: 8900, profit: 5430, roas: 3.80, cpa: 33.43, ctr: 4.60, sales: 70 },
    ];
  }

  private getAdSets(args?: any): AdSet[] {
    const campaigns = this.getCampaigns();
    const result: AdSet[] = [];
    campaigns.forEach(c => {
      const count = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < count; i++) {
        const spend = Math.round(c.spend / count * (0.7 + Math.random() * 0.6) * 100) / 100;
        const roas = c.roas * (0.8 + Math.random() * 0.4);
        const revenue = spend * roas;
        result.push({
          id: `adset_${c.id}_${i + 1}`,
          name: `${c.name} - Ad Set ${i + 1}`,
          campaignId: c.id,
          campaignName: c.name,
          status: c.status === 'ACTIVE' ? (i === 0 ? 'ACTIVE' : i === 1 ? 'ACTIVE' : 'PAUSED') : 'PAUSED',
          spend,
          revenue: Math.round(revenue * 100) / 100,
          profit: Math.round((revenue - spend) * 100) / 100,
          roas: Math.round(roas * 100) / 100,
          impressions: Math.floor(c.impressions / count),
          clicks: Math.floor(c.clicks / count),
          ctr: 0,
          sales: Math.floor(c.sales / count),
        });
      }
    });
    result.forEach(r => { r.ctr = Math.round((r.clicks / (r.impressions || 1)) * 10000) / 100; });
    return result;
  }

  private getAds(args?: any): AdCreative[] {
    const adSets = this.getAdSets();
    const names = [
      'Vídeo_Aquecimento_01', 'Vídeo_Aquecimento_02', 'Vídeo_Abertura_01',
      'Card_Pesquisa_01', 'Vídeo_Webinar_01', 'Vídeo_Webinar_02',
      'Vídeo_Retarget_01', 'Vídeo_Topo_01', 'Vídeo_Topo_02',
      'Card_Topo_01', 'Vídeo_Meio_01', 'Card_Meio_01',
      'Vídeo_Base_01', 'Card_Base_01', 'Vídeo_Aquecimento_03',
      'Vídeo_Live_01', 'Card_Promo_01', 'Vídeo_Promo_01',
      'Vídeo_Depoimento_01', 'Vídeo_Depoimento_02', 'Card_Depoimento_01',
      'Vídeo_Prova_01', 'Card_Oferta_01', 'Vídeo_Oferta_01',
      'Vídeo_Urgência_01', 'Card_Urgência_01',
    ];
    const statuses: AdCreative['status'][] = ['active', 'active', 'paused', 'active', 'rejected', 'active', 'under_review', 'active', 'paused', 'active', 'no_data'];

    return names.map((name, i) => {
      const adSet = adSets[i % adSets.length];
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
        id: `ad_${i + 1}`,
        name,
        campaignId: adSet.campaignId,
        campaignName: adSet.campaignName,
        adSetId: adSet.id,
        status,
        startDate: new Date(Date.now() - daysRunning * 86400000).toISOString().split('T')[0],
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
  }

  private getCampaignDetails(args?: any) {
    return this.getCampaigns().find(c => c.id === args?.campaign_id) || this.getCampaigns()[0];
  }

  private getOffers() {
    return [
      { id: 'offer_1', name: 'Curso Marketing Digital Completo', price: 297 },
      { id: 'offer_2', name: 'Mentoria Tráfego Pago', price: 997 },
      { id: 'offer_3', name: 'Fórmula de Lançamentos', price: 497 },
      { id: 'offer_4', name: 'Comunidade Tráfego 360', price: 97 },
    ];
  }

  private getOfferDetails(args?: any) {
    return this.getOffers().find(o => o.id === args?.offer_id) || this.getOffers()[0];
  }

  private getTrafficChannels(): TrafficChannel[] {
    return [
      { id: 'tc_1', name: 'Meta Ads', platform: 'Facebook/Instagram' },
      { id: 'tc_2', name: 'Google Ads', platform: 'Google' },
      { id: 'tc_3', name: 'TikTok Ads', platform: 'TikTok' },
      { id: 'tc_4', name: 'YouTube Ads', platform: 'YouTube' },
    ];
  }
}

export { McpMockService };
