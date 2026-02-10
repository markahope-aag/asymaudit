import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';
import { withRetry } from '../utils/retry';

export interface CloudFlareCredentials {
  api_token: string;
  zone_id: string;
}

export class CloudFlareClient {
  private client: AxiosInstance;
  private zoneId: string;
  private log = logger.child({ module: 'cloudflare-client' });

  constructor(credentials: CloudFlareCredentials) {
    this.zoneId = credentials.zone_id;

    this.client = axios.create({
      baseURL: 'https://api.cloudflare.com/client/v4',
      headers: {
        Authorization: `Bearer ${credentials.api_token}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });
  }

  async getZoneSettings() {
    return withRetry(async () => {
      const res = await this.client.get(`/zones/${this.zoneId}/settings`);
      return res.data.result || [];
    }, {}, 'get CloudFlare zone settings');
  }

  async getSSLSettings() {
    return withRetry(async () => {
      const res = await this.client.get(`/zones/${this.zoneId}/settings/ssl`);
      return res.data.result;
    }, {}, 'get CloudFlare SSL');
  }

  async getSecurityLevel() {
    return withRetry(async () => {
      const res = await this.client.get(`/zones/${this.zoneId}/settings/security_level`);
      return res.data.result;
    }, {}, 'get CloudFlare security level');
  }

  async getMinTLSVersion() {
    return withRetry(async () => {
      const res = await this.client.get(`/zones/${this.zoneId}/settings/min_tls_version`);
      return res.data.result;
    }, {}, 'get CloudFlare min TLS');
  }

  async getCachingLevel() {
    return withRetry(async () => {
      const res = await this.client.get(`/zones/${this.zoneId}/settings/cache_level`);
      return res.data.result;
    }, {}, 'get CloudFlare caching');
  }

  async getBrowserCacheTTL() {
    return withRetry(async () => {
      const res = await this.client.get(`/zones/${this.zoneId}/settings/browser_cache_ttl`);
      return res.data.result;
    }, {}, 'get CloudFlare browser cache');
  }

  async getFirewallRules() {
    return withRetry(async () => {
      const res = await this.client.get(`/zones/${this.zoneId}/firewall/rules`);
      return res.data.result || [];
    }, {}, 'get CloudFlare firewall rules');
  }

  async getPageRules() {
    return withRetry(async () => {
      const res = await this.client.get(`/zones/${this.zoneId}/pagerules`);
      return res.data.result || [];
    }, {}, 'get CloudFlare page rules');
  }

  async getDNSRecords() {
    return withRetry(async () => {
      const res = await this.client.get(`/zones/${this.zoneId}/dns_records`, {
        params: { per_page: 100 },
      });
      return res.data.result || [];
    }, {}, 'get CloudFlare DNS');
  }

  async getTransformRules() {
    try {
      const res = await this.client.get(`/zones/${this.zoneId}/rulesets`, {
        params: { phase: 'http_response_headers_transform' },
      });
      return res.data.result || [];
    } catch {
      this.log.warn('Transform rules not accessible');
      return [];
    }
  }

  async getZoneAnalytics(days = 7) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    try {
      const res = await this.client.get(`/zones/${this.zoneId}/analytics/dashboard`, {
        params: { since: since.toISOString(), continuous: true },
      });
      return res.data.result;
    } catch {
      this.log.warn('Analytics dashboard not accessible');
      return null;
    }
  }
}
