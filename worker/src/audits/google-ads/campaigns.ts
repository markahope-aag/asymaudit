import { BaseAudit, AuditResult } from '../base-audit';

export class GoogleAdsCampaignsAudit extends BaseAudit {
  getAuditType(): string {
    return 'google_ads_campaigns';
  }

  async collect(): Promise<AuditResult> {
    this.logger.info('Starting Google Ads campaigns audit');

    const integration = await this.getIntegration('google_ads');
    if (!integration) throw new Error('Google Ads integration not found');

    const { credentials, config } = integration;

    const rawData = {
      account_id: credentials['customer_id'] || null,
      has_credentials: !!(credentials['developer_token'] && credentials['client_id'] && credentials['refresh_token']),
      config,
      note: 'Full Google Ads campaign data requires google-ads-api package. Current audit captures credential status.',
      audit_timestamp: new Date().toISOString(),
    };

    const metrics: Record<string, number> = {
      has_credentials: rawData.has_credentials ? 1 : 0,
    };

    return { rawData, metrics };
  }
}
