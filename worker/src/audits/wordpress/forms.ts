import { BaseAudit, AuditResult } from '../base-audit';
import { WordPressClient, WordPressCredentials, WordPressConfig } from '../../integrations/wordpress-client';

export class WordPressFormsAudit extends BaseAudit {
  getAuditType(): string {
    return 'wordpress_forms';
  }

  async collect(): Promise<AuditResult> {
    this.logger.info('Starting WordPress forms (Gravity Forms) audit');

    const integration = await this.getIntegration('wordpress');
    if (!integration) throw new Error('WordPress integration not found');

    const siteUrl = integration.credentials['url'];
    const wpClient = new WordPressClient(
      { url: siteUrl, ...integration.credentials } as WordPressCredentials,
      integration.config as WordPressConfig,
    );

    // Try Gravity Forms REST API endpoints
    const [forms, plugins] = await Promise.allSettled([
      this.getGravityForms(wpClient, siteUrl, integration.credentials),
      wpClient.getPlugins(),
    ]);

    const pluginList = plugins.status === 'fulfilled' ? plugins.value : [];
    const hasGravityForms = pluginList.some(p => p.status === 'active' && p.name?.toLowerCase().includes('gravity forms'));

    const formData = forms.status === 'fulfilled' ? forms.value : [];

    const rawData = {
      has_gravity_forms: hasGravityForms,
      forms: formData,
      forms_count: formData.length,
      active_forms: formData.filter((f: any) => f.is_active !== '0').length,
      total_entries: formData.reduce((sum: number, f: any) => sum + (parseInt(f.entries || '0', 10)), 0),
      form_details: formData.map((f: any) => ({
        id: f.id,
        title: f.title,
        is_active: f.is_active,
        entries: f.entries || '0',
        date_created: f.date_created,
      })),
      audit_timestamp: new Date().toISOString(),
    };

    const metrics: Record<string, number> = {
      has_gravity_forms: hasGravityForms ? 1 : 0,
      forms_count: rawData.forms_count,
      active_forms: rawData.active_forms,
      total_entries: rawData.total_entries,
    };

    return { rawData, metrics };
  }

  private async getGravityForms(wpClient: WordPressClient, siteUrl: string, credentials: Record<string, any>): Promise<any[]> {
    // Try Gravity Forms REST API v2
    try {
      const axios = (await import('axios')).default;
      const auth = credentials['application_password']
        ? Buffer.from(`${credentials['username']}:${credentials['application_password']}`).toString('base64')
        : credentials['rest_api_key']
          ? undefined
          : undefined;

      const headers: Record<string, string> = { 'User-Agent': 'AsymAudit/1.0' };
      if (auth) headers['Authorization'] = `Basic ${auth}`;
      if (credentials['rest_api_key']) headers['Authorization'] = `Bearer ${credentials['rest_api_key']}`;

      const res = await axios.get(`${siteUrl}/wp-json/gf/v2/forms`, {
        headers,
        timeout: 15000,
      });

      return Array.isArray(res.data) ? res.data : [];
    } catch (err) {
      this.logger.warn('Gravity Forms API not accessible');
      return [];
    }
  }
}
