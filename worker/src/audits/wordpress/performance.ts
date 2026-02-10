import { BaseAudit, AuditResult } from '../base-audit';
import { PageSpeedClient } from '../../integrations/pagespeed-client';

export class WordPressPerformanceAudit extends BaseAudit {
  getAuditType(): string {
    return 'wordpress_performance';
  }

  async collect(): Promise<AuditResult> {
    this.logger.info('Starting WordPress performance audit');

    const integration = await this.getIntegration('wordpress');
    if (!integration) throw new Error('WordPress integration not found');

    const siteUrl = integration.credentials['url'];
    const pagespeed = new PageSpeedClient();

    // Run both mobile and desktop audits
    const [mobile, desktop] = await Promise.allSettled([
      pagespeed.analyze(siteUrl, 'mobile'),
      pagespeed.analyze(siteUrl, 'desktop'),
    ]);

    const mobileResult = mobile.status === 'fulfilled' ? mobile.value : null;
    const desktopResult = desktop.status === 'fulfilled' ? desktop.value : null;

    const rawData = {
      mobile: mobileResult,
      desktop: desktopResult,
      url: siteUrl,
      audit_timestamp: new Date().toISOString(),
    };

    const metrics: Record<string, number> = {};

    if (mobileResult) {
      metrics['mobile_performance'] = mobileResult.scores.performance;
      metrics['mobile_accessibility'] = mobileResult.scores.accessibility;
      metrics['mobile_best_practices'] = mobileResult.scores.bestPractices;
      metrics['mobile_seo'] = mobileResult.scores.seo;
      metrics['mobile_fcp'] = Math.round(mobileResult.webVitals.fcp);
      metrics['mobile_lcp'] = Math.round(mobileResult.webVitals.lcp);
      metrics['mobile_tbt'] = Math.round(mobileResult.webVitals.tbt);
      metrics['mobile_cls'] = Math.round(mobileResult.webVitals.cls * 1000); // Scale for storage
      metrics['mobile_si'] = Math.round(mobileResult.webVitals.si);
    }

    if (desktopResult) {
      metrics['desktop_performance'] = desktopResult.scores.performance;
      metrics['desktop_accessibility'] = desktopResult.scores.accessibility;
      metrics['desktop_best_practices'] = desktopResult.scores.bestPractices;
      metrics['desktop_seo'] = desktopResult.scores.seo;
      metrics['desktop_fcp'] = Math.round(desktopResult.webVitals.fcp);
      metrics['desktop_lcp'] = Math.round(desktopResult.webVitals.lcp);
      metrics['desktop_tbt'] = Math.round(desktopResult.webVitals.tbt);
      metrics['desktop_cls'] = Math.round(desktopResult.webVitals.cls * 1000);
    }

    // Overall performance is weighted average (mobile 60%, desktop 40%)
    if (mobileResult && desktopResult) {
      metrics['overall_score'] = Math.round(
        mobileResult.scores.performance * 0.6 + desktopResult.scores.performance * 0.4
      );
    } else if (mobileResult) {
      metrics['overall_score'] = mobileResult.scores.performance;
    } else if (desktopResult) {
      metrics['overall_score'] = desktopResult.scores.performance;
    }

    return { rawData, metrics };
  }
}
