import { google } from 'googleapis';
import { logger } from '../utils/logger';
import { withRetry } from '../utils/retry';

export interface GA4Credentials {
  property_id: string;
  service_account_email?: string;
  service_account_key?: string;  // JSON string of service account key
}

export class GA4Client {
  private analyticsAdmin: ReturnType<typeof google.analyticsadmin>;
  private analyticsData: ReturnType<typeof google.analyticsdata>;
  private propertyId: string;
  private log = logger.child({ module: 'ga4-client' });

  constructor(credentials: GA4Credentials) {
    this.propertyId = credentials.property_id;

    const auth = credentials.service_account_key
      ? new google.auth.GoogleAuth({
          credentials: JSON.parse(credentials.service_account_key),
          scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
        })
      : new google.auth.GoogleAuth({
          scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
        });

    this.analyticsAdmin = google.analyticsadmin({ version: 'v1beta', auth });
    this.analyticsData = google.analyticsdata({ version: 'v1beta', auth });
  }

  async getPropertyDetails() {
    return withRetry(async () => {
      const res = await this.analyticsAdmin.properties.get({
        name: `properties/${this.propertyId}`,
      });
      return res.data;
    }, {}, 'get GA4 property');
  }

  async getDataStreams() {
    return withRetry(async () => {
      const res = await this.analyticsAdmin.properties.dataStreams.list({
        parent: `properties/${this.propertyId}`,
      });
      return res.data.dataStreams || [];
    }, {}, 'get GA4 data streams');
  }

  async getConversionEvents() {
    return withRetry(async () => {
      const res = await this.analyticsAdmin.properties.conversionEvents.list({
        parent: `properties/${this.propertyId}`,
      });
      return res.data.conversionEvents || [];
    }, {}, 'get GA4 conversion events');
  }

  async getCustomDimensions() {
    return withRetry(async () => {
      const res = await this.analyticsAdmin.properties.customDimensions.list({
        parent: `properties/${this.propertyId}`,
      });
      return res.data.customDimensions || [];
    }, {}, 'get GA4 custom dimensions');
  }

  async getCustomMetrics() {
    return withRetry(async () => {
      const res = await this.analyticsAdmin.properties.customMetrics.list({
        parent: `properties/${this.propertyId}`,
      });
      return res.data.customMetrics || [];
    }, {}, 'get GA4 custom metrics');
  }

  async getTopEvents(days = 30, limit = 20) {
    return withRetry(async () => {
      const res = await this.analyticsData.properties.runReport({
        property: `properties/${this.propertyId}`,
        requestBody: {
          dateRanges: [{ startDate: `${days}daysAgo`, endDate: 'today' }],
          dimensions: [{ name: 'eventName' }],
          metrics: [{ name: 'eventCount' }],
          orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
          limit: String(limit),
        },
      });
      return (res as any).data?.rows || [];
    }, {}, 'get GA4 top events');
  }

  async getRealtimeReport() {
    try {
      const res = await this.analyticsData.properties.runRealtimeReport({
        property: `properties/${this.propertyId}`,
        requestBody: {
          dimensions: [{ name: 'eventName' }],
          metrics: [{ name: 'eventCount' }],
          limit: '10',
        },
      });
      return (res as any).data?.rows || [];
    } catch (err) {
      this.log.warn('Realtime report not available');
      return [];
    }
  }

  async getUserMetrics(days = 30) {
    return withRetry(async () => {
      const res = await this.analyticsData.properties.runReport({
        property: `properties/${this.propertyId}`,
        requestBody: {
          dateRanges: [{ startDate: `${days}daysAgo`, endDate: 'today' }],
          metrics: [
            { name: 'activeUsers' },
            { name: 'sessions' },
            { name: 'engagedSessions' },
            { name: 'averageSessionDuration' },
            { name: 'bounceRate' },
          ],
        },
      });
      return res.data.rows?.[0] || null;
    }, {}, 'get GA4 user metrics');
  }
}
