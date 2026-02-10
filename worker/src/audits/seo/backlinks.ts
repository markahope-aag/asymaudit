import { BaseAudit, AuditResult } from '../base-audit';
import axios from 'axios';
import { env } from '../../config/env';

export class BacklinksAudit extends BaseAudit {
  getAuditType(): string {
    return 'seo_backlinks';
  }

  async collect(): Promise<AuditResult> {
    this.logger.info('Starting backlinks audit');

    // Get client's website URL
    const { data: client } = await this.supabase
      .from('clients')
      .select('website_url')
      .eq('id', this.clientId)
      .single();

    if (!client?.website_url) throw new Error('Client website URL not found');
    const domain = new URL(client.website_url).hostname;

    // Try available backlink providers
    const [mozData, spyfuData] = await Promise.allSettled([
      this.getMozData(domain),
      this.getSpyFuData(domain),
    ]);

    const rawData = {
      domain,
      moz: mozData.status === 'fulfilled' ? mozData.value : null,
      spyfu: spyfuData.status === 'fulfilled' ? spyfuData.value : null,
      audit_timestamp: new Date().toISOString(),
    };

    const metrics: Record<string, number> = {};
    if (rawData.moz) {
      metrics['domain_authority'] = rawData.moz.domainAuthority || 0;
      metrics['page_authority'] = rawData.moz.pageAuthority || 0;
      metrics['linking_domains'] = rawData.moz.linkingDomains || 0;
      metrics['total_backlinks'] = rawData.moz.totalBacklinks || 0;
    }

    return { rawData, metrics };
  }

  private async getMozData(domain: string) {
    if (!env.MOZ_ACCESS_ID || !env.MOZ_SECRET_KEY) {
      this.logger.info('Moz credentials not configured, skipping');
      return null;
    }

    try {
      const res = await axios.post(
        'https://lsapi.seomoz.com/v2/url_metrics',
        { targets: [domain] },
        {
          auth: { username: env.MOZ_ACCESS_ID, password: env.MOZ_SECRET_KEY },
          timeout: 30000,
        }
      );

      const data = res.data?.results?.[0];
      return {
        domainAuthority: data?.domain_authority || 0,
        pageAuthority: data?.page_authority || 0,
        linkingDomains: data?.root_domains_to_root_domain || 0,
        totalBacklinks: data?.external_pages_to_root_domain || 0,
        spamScore: data?.spam_score || 0,
      };
    } catch (err) {
      this.logger.warn('Moz API call failed');
      return null;
    }
  }

  private async getSpyFuData(domain: string) {
    if (!env.SPYFU_API_KEY) {
      this.logger.info('SpyFu credentials not configured, skipping');
      return null;
    }

    try {
      const res = await axios.get('https://www.spyfu.com/apis/domain_stats_api/v2/getDomainStatsForExactDate', {
        params: {
          domain,
          api_key: env.SPYFU_API_KEY,
        },
        timeout: 30000,
      });

      return res.data;
    } catch (err) {
      this.logger.warn('SpyFu API call failed');
      return null;
    }
  }
}
