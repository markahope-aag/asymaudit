import { BaseAudit, AuditResult } from '../base-audit';
import { logger } from '../../utils/logger';

export class GoogleAdsAccountAudit extends BaseAudit {
  getAuditType(): string {
    return 'google_ads_account';
  }

  async collect(): Promise<AuditResult> {
    this.logger.info('Starting Google Ads account audit');

    const integration = await this.getIntegration('google_ads');
    if (!integration) throw new Error('Google Ads integration not found');

    // Google Ads API requires OAuth2 credentials and google-ads-api package
    // For now, collect what we can from the integration config
    const { credentials, config } = integration;

    const rawData = {
      account_id: credentials['customer_id'] || null,
      login_customer_id: credentials['login_customer_id'] || null,
      has_credentials: !!(credentials['developer_token'] && credentials['client_id'] && credentials['refresh_token']),
      config,
      note: 'Full Google Ads API integration requires google-ads-api package. Current audit captures credential status.',
      audit_timestamp: new Date().toISOString(),
    };

    const metrics: Record<string, number> = {
      has_credentials: rawData.has_credentials ? 1 : 0,
      has_account_id: rawData.account_id ? 1 : 0,
    };

    return { rawData, metrics };
  }
}
