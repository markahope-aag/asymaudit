import { BaseAudit, AuditResult } from '../base-audit';
import { GSCClient, GSCCredentials } from '../../integrations/gsc-client';

export class GSCCoverageAudit extends BaseAudit {
  getAuditType(): string {
    return 'gsc_coverage';
  }

  async collect(): Promise<AuditResult> {
    this.logger.info('Starting Google Search Console coverage audit');

    const integration = await this.getIntegration('google_search_console');
    if (!integration) throw new Error('Google Search Console integration not found');

    const gsc = new GSCClient(integration.credentials as GSCCredentials);

    const [siteInfo, topQueries, topPages, devices, countries, sitemaps] = await Promise.allSettled([
      gsc.getSiteInfo(),
      gsc.getTopQueries(30, 25),
      gsc.getTopPages(30, 25),
      gsc.getDeviceBreakdown(30),
      gsc.getCountryBreakdown(30),
      gsc.getSitemaps(),
    ]);

    const queries = topQueries.status === 'fulfilled' ? topQueries.value : [];
    const pages = topPages.status === 'fulfilled' ? topPages.value : [];
    const deviceData = devices.status === 'fulfilled' ? devices.value : [];

    // Calculate totals
    const totalClicks = queries.reduce((sum: number, r: any) => sum + (r.clicks || 0), 0);
    const totalImpressions = queries.reduce((sum: number, r: any) => sum + (r.impressions || 0), 0);
    const avgPosition = queries.length > 0
      ? queries.reduce((sum: number, r: any) => sum + (r.position || 0), 0) / queries.length
      : 0;

    const rawData = {
      site_info: siteInfo.status === 'fulfilled' ? siteInfo.value : null,
      top_queries: queries.map((r: any) => ({
        query: r.keys?.[0],
        clicks: r.clicks,
        impressions: r.impressions,
        ctr: r.ctr,
        position: r.position,
      })),
      top_pages: pages.map((r: any) => ({
        page: r.keys?.[0],
        clicks: r.clicks,
        impressions: r.impressions,
        ctr: r.ctr,
        position: r.position,
      })),
      device_breakdown: deviceData.map((r: any) => ({
        device: r.keys?.[0],
        clicks: r.clicks,
        impressions: r.impressions,
      })),
      countries: countries.status === 'fulfilled' ? countries.value.slice(0, 10).map((r: any) => ({
        country: r.keys?.[0],
        clicks: r.clicks,
        impressions: r.impressions,
      })) : [],
      sitemaps: sitemaps.status === 'fulfilled' ? sitemaps.value : [],
      totals: { clicks: totalClicks, impressions: totalImpressions, avg_position: Math.round(avgPosition * 10) / 10 },
      audit_timestamp: new Date().toISOString(),
    };

    const metrics: Record<string, number> = {
      total_clicks: totalClicks,
      total_impressions: totalImpressions,
      avg_position: Math.round(avgPosition * 10) / 10,
      top_queries_count: queries.length,
      indexed_pages: pages.length,
      sitemaps_count: rawData.sitemaps.length,
    };

    return { rawData, metrics };
  }
}
