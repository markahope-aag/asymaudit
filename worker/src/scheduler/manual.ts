import { Express, Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { addAuditJob, getQueueStats, getJobStatus } from '../queue/setup';
import { logger } from '../utils/logger';
import { env } from '../config/env';

interface TriggerAuditRequest {
  clientId: string;
  auditType: string;
  apiKey: string;
  priority?: number;
  metadata?: Record<string, any>;
}

interface TriggerAllRequest {
  clientId: string;
  apiKey: string;
  priority?: number;
}

// Platform to audit type mapping
const PLATFORM_AUDITS: Record<string, string[]> = {
  wordpress: [
    'wordpress_health',
    'wordpress_seo',
    'wordpress_performance',
    'wordpress_security'
  ],
  google_analytics: [
    'ga4_config',
    'ga4_data_quality'
  ],
  google_ads: [
    'google_ads_account',
    'google_ads_campaigns'
  ],
  google_tag_manager: [
    'gtm_container'
  ],
  google_search_console: [
    'gsc_coverage'
  ],
  moz: [
    'seo_backlinks'
  ],
  spyfu: [
    'seo_backlinks'
  ],
  semrush: [
    'seo_backlinks'
  ],
};

export function setupManualTriggers(app: Express): void {
  logger.info('Setting up manual trigger endpoints');

  // Middleware for API key authentication
  const authenticateApiKey = (req: Request, res: Response, next: Function) => {
    const apiKey = req.body.apiKey || req.headers['x-api-key'];
    
    if (!apiKey || apiKey !== env.WORKER_API_KEY) {
      return res.status(401).json({ 
        success: false,
        error: 'Unauthorized: Invalid API key' 
      });
    }
    
    next();
  };

  // Health check endpoint
  app.get('/health', (req: Request, res: Response) => {
    res.json({ 
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'asymaudit-worker'
    });
  });

  // Get queue statistics
  app.get('/api/queue/status', authenticateApiKey, async (req: Request, res: Response) => {
    try {
      const stats = await getQueueStats();
      res.json({
        success: true,
        data: stats,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error({ error }, 'Failed to get queue status');
      res.status(500).json({
        success: false,
        error: 'Failed to get queue status',
      });
    }
  });

  // Get job status
  app.get('/api/audit/status/:runId', authenticateApiKey, async (req: Request, res: Response) => {
    try {
      const { runId } = req.params;
      
      // First check the database for run status
      const { data: run, error } = await supabase
        .from('audit_runs')
        .select('*')
        .eq('id', runId)
        .single();

      if (error || !run) {
        return res.status(404).json({
          success: false,
          error: 'Audit run not found',
        });
      }

      // If run is pending or collecting, try to get job status from queue
      let jobStatus = null;
      if (['pending', 'collecting', 'analyzing'].includes(run.status)) {
        // Try to find job by ID pattern
        const jobId = `${run.client_id}-${run.audit_type}-${run.id}`;
        jobStatus = await getJobStatus(jobId);
      }

      res.json({
        success: true,
        data: {
          run,
          job: jobStatus,
        },
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      logger.error({ error }, 'Failed to get audit status');
      res.status(500).json({
        success: false,
        error: 'Failed to get audit status',
      });
    }
  });

  // Trigger a single audit
  app.post('/api/audit/trigger', authenticateApiKey, async (req: Request, res: Response) => {
    try {
      const { clientId, auditType, priority, metadata }: TriggerAuditRequest = req.body;

      // Validate required fields
      if (!clientId || !auditType) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: clientId and auditType',
        });
      }

      // Validate client exists
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .select('id, name, is_active')
        .eq('id', clientId)
        .eq('is_active', true)
        .single();

      if (clientError || !client) {
        return res.status(404).json({
          success: false,
          error: 'Client not found or inactive',
        });
      }

      // Create audit run
      const { data: run, error: runError } = await supabase
        .from('audit_runs')
        .insert({
          client_id: clientId,
          audit_type: auditType,
          status: 'pending',
          metadata: {
            triggered_by: 'manual',
            triggered_at: new Date().toISOString(),
            ...metadata,
          },
        })
        .select()
        .single();

      if (runError || !run) {
        logger.error({ error: runError }, 'Failed to create audit run');
        return res.status(500).json({
          success: false,
          error: 'Failed to create audit run',
        });
      }

      // Add job to queue
      const job = await addAuditJob(clientId, auditType, run.id, {
        priority: priority || 10, // Higher priority for manual triggers
        metadata: {
          manual: true,
          ...metadata,
        },
      });

      logger.info({ 
        clientId, 
        auditType, 
        runId: run.id,
        jobId: job.id 
      }, 'Manual audit triggered');

      res.json({
        success: true,
        data: {
          runId: run.id,
          jobId: job.id,
          client: client.name,
          auditType,
          status: 'queued',
        },
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      logger.error({ error }, 'Failed to trigger audit');
      res.status(500).json({
        success: false,
        error: 'Failed to trigger audit',
      });
    }
  });

  // Trigger full audit suite for a client
  app.post('/api/audit/trigger-all', authenticateApiKey, async (req: Request, res: Response) => {
    try {
      const { clientId, priority }: TriggerAllRequest = req.body;

      if (!clientId) {
        return res.status(400).json({
          success: false,
          error: 'Missing required field: clientId',
        });
      }

      // Validate client exists and get integrations
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .select('id, name, is_active')
        .eq('id', clientId)
        .eq('is_active', true)
        .single();

      if (clientError || !client) {
        return res.status(404).json({
          success: false,
          error: 'Client not found or inactive',
        });
      }

      // Get all active integrations for client
      const { data: integrations, error: integrationsError } = await supabase
        .from('client_integrations')
        .select('platform')
        .eq('client_id', clientId)
        .eq('is_active', true);

      if (integrationsError) {
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch client integrations',
        });
      }

      if (!integrations || integrations.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'No active integrations found for client',
        });
      }

      // Collect all audit types for the client's platforms
      const auditTypes = new Set<string>();
      for (const integration of integrations) {
        const platformAudits = PLATFORM_AUDITS[integration.platform] || [];
        platformAudits.forEach(auditType => auditTypes.add(auditType));
      }

      // Add technical SEO audit (doesn't require specific integration)
      auditTypes.add('seo_technical');

      const results: Array<{
        auditType: string;
        runId: string;
        jobId: string;
        status: string;
      }> = [];

      // Create audit runs and jobs for each audit type
      for (const auditType of auditTypes) {
        try {
          // Create audit run
          const { data: run, error: runError } = await supabase
            .from('audit_runs')
            .insert({
              client_id: clientId,
              audit_type: auditType,
              status: 'pending',
              metadata: {
                triggered_by: 'manual_full_suite',
                triggered_at: new Date().toISOString(),
              },
            })
            .select()
            .single();

          if (runError || !run) {
            logger.error({ error: runError, auditType }, 'Failed to create audit run');
            results.push({
              auditType,
              runId: '',
              jobId: '',
              status: 'failed',
            });
            continue;
          }

          // Add job to queue
          const job = await addAuditJob(clientId, auditType, run.id, {
            priority: priority || 8, // Medium-high priority for full suite
            metadata: {
              manual: true,
              fullSuite: true,
            },
          });

          results.push({
            auditType,
            runId: run.id,
            jobId: job.id,
            status: 'queued',
          });

        } catch (error) {
          logger.error({ error, auditType }, 'Failed to create audit job');
          results.push({
            auditType,
            runId: '',
            jobId: '',
            status: 'failed',
          });
        }
      }

      const successCount = results.filter(r => r.status === 'queued').length;
      const failedCount = results.filter(r => r.status === 'failed').length;

      logger.info({ 
        clientId,
        totalAudits: results.length,
        successCount,
        failedCount
      }, 'Full audit suite triggered');

      res.json({
        success: true,
        data: {
          client: client.name,
          totalAudits: results.length,
          successCount,
          failedCount,
          results,
        },
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      logger.error({ error }, 'Failed to trigger full audit suite');
      res.status(500).json({
        success: false,
        error: 'Failed to trigger full audit suite',
      });
    }
  });

  logger.info('Manual trigger endpoints configured');
}