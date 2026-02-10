import axios from 'axios';
import { logger } from '../utils/logger';
import { withRetry } from '../utils/retry';
import { env } from '../config/env';

export interface PageSpeedResult {
  url: string;
  strategy: 'mobile' | 'desktop';
  scores: {
    performance: number;
    accessibility: number;
    bestPractices: number;
    seo: number;
  };
  webVitals: {
    fcp: number;  // First Contentful Paint (ms)
    lcp: number;  // Largest Contentful Paint (ms)
    tbt: number;  // Total Blocking Time (ms)
    cls: number;  // Cumulative Layout Shift
    si: number;   // Speed Index (ms)
  };
  diagnostics: Array<{
    id: string;
    title: string;
    description: string;
    score: number | null;
    displayValue?: string;
  }>;
}

export class PageSpeedClient {
  private apiKey: string;
  private log = logger.child({ module: 'pagespeed-client' });

  constructor() {
    this.apiKey = env.PAGESPEED_API_KEY || '';
  }

  async analyze(url: string, strategy: 'mobile' | 'desktop' = 'mobile'): Promise<PageSpeedResult> {
    return withRetry(async () => {
      const params: Record<string, string | string[]> = {
        url,
        strategy,
        category: 'PERFORMANCE',
      };

      if (this.apiKey) {
        params['key'] = this.apiKey;
      }

      // Add all categories
      const categories = ['PERFORMANCE', 'ACCESSIBILITY', 'BEST_PRACTICES', 'SEO'];

      const res = await axios.get('https://www.googleapis.com/pagespeedonline/v5/runPagespeed', {
        params: {
          ...params,
          category: categories,
        },
        timeout: 120000, // PageSpeed can be slow
        paramsSerializer: (p) => {
          // Handle array params (category repeated)
          const parts: string[] = [];
          for (const [key, value] of Object.entries(p)) {
            if (Array.isArray(value)) {
              value.forEach(v => parts.push(`${key}=${encodeURIComponent(v)}`));
            } else {
              parts.push(`${key}=${encodeURIComponent(value as string)}`);
            }
          }
          return parts.join('&');
        },
      });

      const { lighthouseResult } = res.data;
      const cats = lighthouseResult.categories;
      const audits = lighthouseResult.audits;

      return {
        url,
        strategy,
        scores: {
          performance: Math.round((cats.performance?.score ?? 0) * 100),
          accessibility: Math.round((cats.accessibility?.score ?? 0) * 100),
          bestPractices: Math.round((cats['best-practices']?.score ?? 0) * 100),
          seo: Math.round((cats.seo?.score ?? 0) * 100),
        },
        webVitals: {
          fcp: audits['first-contentful-paint']?.numericValue ?? 0,
          lcp: audits['largest-contentful-paint']?.numericValue ?? 0,
          tbt: audits['total-blocking-time']?.numericValue ?? 0,
          cls: audits['cumulative-layout-shift']?.numericValue ?? 0,
          si: audits['speed-index']?.numericValue ?? 0,
        },
        diagnostics: Object.values(audits)
          .filter((a: any) => a.score !== null && a.score < 1)
          .map((a: any) => ({
            id: a.id,
            title: a.title,
            description: a.description,
            score: a.score,
            displayValue: a.displayValue,
          }))
          .slice(0, 20),
      };
    }, { maxAttempts: 2, baseDelay: 5000 }, `pagespeed ${strategy}`);
  }
}
