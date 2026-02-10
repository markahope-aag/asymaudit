import { BaseAudit, AuditResult } from '../base-audit';
import { GA4Client, GA4Credentials } from '../../integrations/ga4-client';

export class GA4DataQualityAudit extends BaseAudit {
  getAuditType(): string {
    return 'ga4_data_quality';
  }

  async collect(): Promise<AuditResult> {
    this.logger.info('Starting GA4 data quality audit');

    const integration = await this.getIntegration('google_analytics');
    if (!integration) throw new Error('Google Analytics integration not found');

    const ga4 = new GA4Client(integration.credentials as GA4Credentials);

    // Compare 30-day vs 90-day data
    const [events30d, events90d, userMetrics30d, realtimeData] = await Promise.allSettled([
      ga4.getTopEvents(30, 30),
      ga4.getTopEvents(90, 30),
      ga4.getUserMetrics(30),
      ga4.getRealtimeReport(),
    ]);

    const rawData = {
      events_30d: events30d.status === 'fulfilled' ? events30d.value : [],
      events_90d: events90d.status === 'fulfilled' ? events90d.value : [],
      user_metrics_30d: userMetrics30d.status === 'fulfilled' ? userMetrics30d.value : null,
      realtime: realtimeData.status === 'fulfilled' ? realtimeData.value : [],
      has_realtime_data: (realtimeData.status === 'fulfilled' && realtimeData.value.length > 0),
      audit_timestamp: new Date().toISOString(),
    };

    const e30 = rawData.events_30d;
    const e90 = rawData.events_90d;

    const metrics: Record<string, number> = {
      events_30d_count: e30.length,
      events_90d_count: e90.length,
      has_realtime_data: rawData.has_realtime_data ? 1 : 0,
    };

    return { rawData, metrics };
  }
}
