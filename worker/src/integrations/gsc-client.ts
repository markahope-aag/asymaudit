import { google } from 'googleapis';
import { logger } from '../utils/logger';
import { withRetry } from '../utils/retry';

export interface GSCCredentials {
  site_url: string;
  service_account_email?: string;
  service_account_key?: string;
}

export class GSCClient {
  private searchconsole: ReturnType<typeof google.searchconsole>;
  private siteUrl: string;
  private log = logger.child({ module: 'gsc-client' });

  constructor(credentials: GSCCredentials) {
    this.siteUrl = credentials.site_url;

    const auth = credentials.service_account_key
      ? new google.auth.GoogleAuth({
          credentials: JSON.parse(credentials.service_account_key),
          scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
        })
      : new google.auth.GoogleAuth({
          scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
        });

    this.searchconsole = google.searchconsole({ version: 'v1', auth });
  }

  async getSiteInfo() {
    return withRetry(async () => {
      const res = await this.searchconsole.sites.get({ siteUrl: this.siteUrl });
      return res.data;
    }, {}, 'get GSC site info');
  }

  async getSearchAnalytics(days = 30, dimensions: string[] = ['query'], rowLimit = 50) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return withRetry(async () => {
      const res = await this.searchconsole.searchanalytics.query({
        siteUrl: this.siteUrl,
        requestBody: {
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          dimensions,
          rowLimit,
        },
      });
      return res.data.rows || [];
    }, {}, 'get GSC search analytics');
  }

  async getTopQueries(days = 30, limit = 25) {
    return this.getSearchAnalytics(days, ['query'], limit);
  }

  async getTopPages(days = 30, limit = 25) {
    return this.getSearchAnalytics(days, ['page'], limit);
  }

  async getDeviceBreakdown(days = 30) {
    return this.getSearchAnalytics(days, ['device'], 10);
  }

  async getCountryBreakdown(days = 30) {
    return this.getSearchAnalytics(days, ['country'], 20);
  }

  async getIndexStatus() {
    try {
      const res = await this.searchconsole.urlInspection.index.inspect({
        requestBody: {
          inspectionUrl: this.siteUrl,
          siteUrl: this.siteUrl,
        },
      });
      return res.data;
    } catch (err) {
      this.log.warn('URL inspection not available');
      return null;
    }
  }

  async getSitemaps() {
    return withRetry(async () => {
      const res = await this.searchconsole.sitemaps.list({ siteUrl: this.siteUrl });
      return res.data.sitemap || [];
    }, {}, 'get GSC sitemaps');
  }
}
