import { BaseAudit, AuditResult } from '../base-audit';
import { GA4Client, GA4Credentials } from '../../integrations/ga4-client';

export class GA4ConfigAudit extends BaseAudit {
  getAuditType(): string {
    return 'ga4_config';
  }

  async collect(): Promise<AuditResult> {
    this.logger.info('Starting GA4 configuration audit');

    const integration = await this.getIntegration('google_analytics');
    if (!integration) throw new Error('Google Analytics integration not found');

    const ga4 = new GA4Client(integration.credentials as GA4Credentials);

    const [property, dataStreams, conversionEvents, customDimensions, customMetrics, topEvents, userMetrics] =
      await Promise.allSettled([
        ga4.getPropertyDetails(),
        ga4.getDataStreams(),
        ga4.getConversionEvents(),
        ga4.getCustomDimensions(),
        ga4.getCustomMetrics(),
        ga4.getTopEvents(30, 25),
        ga4.getUserMetrics(30),
      ]);

    const convEvents = conversionEvents.status === 'fulfilled' ? conversionEvents.value : [];
    const events = topEvents.status === 'fulfilled' ? topEvents.value : [];

    const rawData = {
      property: property.status === 'fulfilled' ? property.value : null,
      data_streams: dataStreams.status === 'fulfilled' ? dataStreams.value : [],
      conversion_events: convEvents,
      custom_dimensions: customDimensions.status === 'fulfilled' ? customDimensions.value : [],
      custom_metrics: customMetrics.status === 'fulfilled' ? customMetrics.value : [],
      top_events: events,
      user_metrics: userMetrics.status === 'fulfilled' ? userMetrics.value : null,
      audit_timestamp: new Date().toISOString(),
    };

    const metrics: Record<string, number> = {
      data_streams_count: rawData.data_streams.length,
      conversion_events_count: convEvents.length,
      custom_dimensions_count: rawData.custom_dimensions.length,
      custom_metrics_count: rawData.custom_metrics.length,
      total_events_tracked: events.length,
    };

    return { rawData, metrics };
  }
}
