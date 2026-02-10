import { Job } from 'bullmq';
import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';
import { analyzeAuditResults } from '../analysis/ai-analyzer';
import { computeDiff } from '../analysis/differ';
import { notifyAuditFailure, notifyAuditRegression } from '../utils/notifications';
import { AuditJobData } from './setup';

// Import audit classes
import { WordPressHealthAudit } from '../audits/wordpress/health';
import { WordPressSEOAudit } from '../audits/wordpress/seo';
import { WordPressPerformanceAudit } from '../audits/wordpress/performance';
import { WordPressSecurityAudit } from '../audits/wordpress/security';
import { WordPressFormsAudit } from '../audits/wordpress/forms';
import { GA4ConfigAudit } from '../audits/google-analytics/config';
import { GA4DataQualityAudit } from '../audits/google-analytics/data-quality';
import { GoogleAdsAccountAudit } from '../audits/google-ads/account';
import { GoogleAdsCampaignsAudit } from '../audits/google-ads/campaigns';
import { GTMContainerAudit } from '../audits/google-tag-manager/container';
import { GSCCoverageAudit } from '../audits/google-search-console/coverage';
import { CloudFlareConfigAudit } from '../audits/cloudflare/config';
import { TechnicalSEOAudit } from '../audits/seo/technical';
import { BacklinksAudit } from '../audits/seo/backlinks';

// Audit class registry
const AUDIT_MAP: Record<string, any> = {
  wordpress_health: WordPressHealthAudit,
  wordpress_seo: WordPressSEOAudit,
  wordpress_performance: WordPressPerformanceAudit,
  wordpress_security: WordPressSecurityAudit,
  wordpress_forms: WordPressFormsAudit,
  ga4_config: GA4ConfigAudit,
  ga4_data_quality: GA4DataQualityAudit,
  google_ads_account: GoogleAdsAccountAudit,
  google_ads_campaigns: GoogleAdsCampaignsAudit,
  gtm_container: GTMContainerAudit,
  gsc_coverage: GSCCoverageAudit,
  cloudflare_config: CloudFlareConfigAudit,
  seo_technical: TechnicalSEOAudit,
  seo_backlinks: BacklinksAudit,
};

export async function processAuditJob(job: Job<AuditJobData>): Promise<void> {
  const { clientId, auditType, runId } = job.data;
  const jobLogger = logger.child({ 
    jobId: job.id,
    clientId, 
    auditType, 
    runId 
  });

  jobLogger.info('Processing audit job');

  try {
    // Update job progress
    await job.updateProgress(10);

    // Check if audit class exists
    const AuditClass = AUDIT_MAP[auditType];
    if (!AuditClass) {
      throw new Error(`Unknown audit type: ${auditType}`);
    }

    // Update job progress
    await job.updateProgress(20);

    // 1. Create audit instance and run collection
    jobLogger.info('Starting audit collection');
    const audit = new AuditClass(supabase, clientId, runId);
    await audit.execute();

    // Update job progress
    await job.updateProgress(50);

    // 2. Fetch the raw data we just stored
    const { data: run, error: runError } = await supabase
      .from('audit_runs')
      .select('raw_data')
      .eq('id', runId)
      .single();

    if (runError || !run) {
      throw new Error(`Failed to fetch audit run data: ${runError?.message}`);
    }

    // Update job progress
    await job.updateProgress(60);

    // 3. Get previous run for comparison
    const previousRun = await audit.getPreviousRun();
    jobLogger.debug({ 
      hasPreviousRun: !!previousRun 
    }, 'Previous run data retrieved');

    // Update job progress
    await job.updateProgress(70);

    // 4. Run AI analysis
    jobLogger.info('Starting AI analysis');
    const analysis = await analyzeAuditResults(
      auditType,
      run.raw_data,
      previousRun?.raw_data
    );

    // Update job progress
    await job.updateProgress(80);

    // 5. Compute diff if previous run exists
    let diffId: string | null = null;
    if (previousRun) {
      jobLogger.info('Computing audit diff');
      
      // Define metric definitions for this audit type
      const metricDefinitions = getMetricDefinitions(auditType);
      
      const diff = computeDiff(run.raw_data, previousRun.raw_data, metricDefinitions);
      
      const { data: diffData, error: diffError } = await supabase
        .from('audit_diffs')
        .insert({
          client_id: clientId,
          audit_type: auditType,
          current_run_id: runId,
          previous_run_id: previousRun.id,
          changes: diff.changes,
          severity: diff.severity,
          summary: analysis.trendAnalysis || diff.summary,
        })
        .select('id')
        .single();

      if (diffError) {
        jobLogger.error({ error: diffError }, 'Failed to store audit diff');
      } else {
        diffId = diffData.id;
        jobLogger.debug({ diffId }, 'Audit diff stored');
      }
    }

    // Update job progress
    await job.updateProgress(90);

    // 6. Store AI analysis and mark complete
    const { error: updateError } = await supabase
      .from('audit_runs')
      .update({
        status: 'complete',
        completed_at: new Date().toISOString(),
        ai_analysis: analysis,
        overall_score: analysis.overallScore,
        scores: analysis.scores,
        issues: analysis.issues,
        recommendations: analysis.recommendations,
      })
      .eq('id', runId);

    if (updateError) {
      throw new Error(`Failed to update audit run: ${updateError.message}`);
    }

    // Update job progress
    await job.updateProgress(95);

    // 7. Check for regressions and send notifications
    if (previousRun?.overall_score && analysis.overallScore) {
      const scoreDrop = previousRun.overall_score - analysis.overallScore;
      
      // Notify if score dropped significantly
      if (scoreDrop > 10) {
        await notifyAuditRegression(
          clientId,
          auditType,
          runId,
          previousRun.overall_score,
          analysis.overallScore
        );
      }
    }

    // Complete job
    await job.updateProgress(100);

    jobLogger.info({ 
      overallScore: analysis.overallScore,
      issueCount: analysis.issues.length,
      recommendationCount: analysis.recommendations.length,
      diffId
    }, 'Audit job completed successfully');

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    jobLogger.error({ error }, 'Audit job failed');

    // Update audit run status to failed
    try {
      await supabase
        .from('audit_runs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: errorMessage,
        })
        .eq('id', runId);
    } catch (updateError) {
      jobLogger.error({ error: updateError }, 'Failed to update audit run status to failed');
    }

    // Send failure notification
    await notifyAuditFailure(clientId, auditType, runId, error as Error);

    // Re-throw error to mark job as failed
    throw error;
  }
}

function getMetricDefinitions(auditType: string): Record<string, any> {
  // Define metric definitions for different audit types
  // This helps the diff engine understand which direction is better
  
  const commonMetrics = {
    'overall_score': { higherIsBetter: true, criticalThreshold: 20, warningThreshold: 10 },
    'page_speed_score': { higherIsBetter: true, criticalThreshold: 20, warningThreshold: 10 },
    'security_score': { higherIsBetter: true, criticalThreshold: 15, warningThreshold: 8 },
    'seo_score': { higherIsBetter: true, criticalThreshold: 15, warningThreshold: 8 },
  };

  switch (auditType) {
    case 'wordpress_health':
      return {
        ...commonMetrics,
        'plugins_count': { higherIsBetter: false, warningThreshold: 5 },
        'outdated_plugins': { higherIsBetter: false, criticalThreshold: 3, warningThreshold: 1 },
        'security_issues': { higherIsBetter: false, criticalThreshold: 1 },
        'backup_age_days': { higherIsBetter: false, criticalThreshold: 7, warningThreshold: 3 },
      };
    
    case 'wordpress_performance':
      return {
        ...commonMetrics,
        'lcp_score': { higherIsBetter: true, criticalThreshold: 1000, warningThreshold: 500 },
        'fid_score': { higherIsBetter: true, criticalThreshold: 200, warningThreshold: 100 },
        'cls_score': { higherIsBetter: false, criticalThreshold: 0.25, warningThreshold: 0.1 },
        'load_time_ms': { higherIsBetter: false, criticalThreshold: 2000, warningThreshold: 1000 },
      };
    
    case 'ga4_config':
      return {
        ...commonMetrics,
        'events_configured': { higherIsBetter: true },
        'conversions_setup': { higherIsBetter: true },
        'audiences_count': { higherIsBetter: true },
      };
    
    case 'google_ads_account':
      return {
        ...commonMetrics,
        'quality_score': { higherIsBetter: true, criticalThreshold: 2, warningThreshold: 1 },
        'ctr': { higherIsBetter: true, criticalThreshold: 0.02, warningThreshold: 0.01 },
        'conversion_rate': { higherIsBetter: true, criticalThreshold: 0.02, warningThreshold: 0.01 },
        'cpa': { higherIsBetter: false, criticalThreshold: 50, warningThreshold: 20 },
      };
    
    default:
      return commonMetrics;
  }
}