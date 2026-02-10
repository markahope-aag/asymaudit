import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../config/supabase';
import { logger } from '../utils/logger';
import { withRetry } from '../utils/retry';

export interface AuditResult {
  rawData: Record<string, any>;
  metrics: Record<string, number>;  // Flattened metrics for snapshots
}

export interface ClientIntegration {
  id: string;
  client_id: string;
  platform: string;
  credentials: Record<string, any>;
  config: Record<string, any>;
  is_active: boolean;
}

export abstract class BaseAudit {
  protected readonly logger = logger.child({
    auditType: this.getAuditType(),
    clientId: this.clientId,
    runId: this.runId,
  });

  constructor(
    protected supabase: SupabaseClient<Database>,
    protected clientId: string,
    protected runId: string
  ) {}

  /**
   * Main execution method - orchestrates the entire audit process
   */
  async execute(): Promise<void> {
    this.logger.info('Starting audit execution');

    try {
      // 1. Update run status to 'collecting'
      await this.updateStatus('collecting');

      // 2. Run the audit collection with retry logic
      const result = await withRetry(
        () => this.collect(),
        { maxAttempts: 3, baseDelay: 2000 },
        `${this.getAuditType()} collection`
      );

      this.logger.info({ metricsCount: Object.keys(result.metrics).length }, 'Audit data collected');

      // 3. Update run with raw data
      await this.supabase
        .from('audit_runs')
        .update({ raw_data: result.rawData })
        .eq('id', this.runId);

      // 4. Store metrics as snapshots for trending
      if (Object.keys(result.metrics).length > 0) {
        const snapshots = Object.entries(result.metrics).map(([key, value]) => ({
          audit_run_id: this.runId,
          client_id: this.clientId,
          audit_type: this.getAuditType(),
          metric_key: key,
          metric_value: value,
        }));

        const { error: snapshotError } = await this.supabase
          .from('audit_snapshots')
          .insert(snapshots);

        if (snapshotError) {
          this.logger.error({ error: snapshotError }, 'Failed to insert audit snapshots');
          throw snapshotError;
        }

        this.logger.debug({ snapshotCount: snapshots.length }, 'Audit snapshots stored');
      }

      // 5. Update status to 'analyzing' (AI analysis will be handled by job processor)
      await this.updateStatus('analyzing');

      this.logger.info('Audit collection completed successfully');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error({ error }, 'Audit execution failed');
      
      await this.updateStatus('failed', errorMessage);
      throw error;
    }
  }

  /**
   * Abstract method that each audit type must implement
   * Should collect raw data and return flattened metrics
   */
  abstract collect(): Promise<AuditResult>;

  /**
   * Abstract method to return the audit type identifier
   */
  abstract getAuditType(): string;

  /**
   * Get integration credentials for a specific platform
   */
  protected async getIntegration(platform: string): Promise<ClientIntegration | null> {
    const { data, error } = await this.supabase
      .from('client_integrations')
      .select('*')
      .eq('client_id', this.clientId)
      .eq('platform', platform)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      this.logger.error({ error, platform }, 'Failed to fetch integration');
      throw error;
    }

    if (!data) {
      this.logger.warn({ platform }, 'No active integration found for platform');
      return null;
    }

    return data as ClientIntegration;
  }

  /**
   * Get the previous completed audit run for comparison
   */
  protected async getPreviousRun(): Promise<Database['public']['Tables']['audit_runs']['Row'] | null> {
    const { data, error } = await this.supabase
      .from('audit_runs')
      .select('*')
      .eq('client_id', this.clientId)
      .eq('audit_type', this.getAuditType())
      .eq('status', 'complete')
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      this.logger.error({ error }, 'Failed to fetch previous run');
      throw error;
    }

    return data;
  }

  /**
   * Update the audit run status in the database
   */
  protected async updateStatus(
    status: 'pending' | 'collecting' | 'analyzing' | 'complete' | 'failed',
    errorMessage?: string
  ): Promise<void> {
    const update: Partial<Database['public']['Tables']['audit_runs']['Update']> = { status };

    if (status === 'collecting') {
      update.started_at = new Date().toISOString();
    }
    
    if (status === 'complete') {
      update.completed_at = new Date().toISOString();
    }
    
    if (errorMessage) {
      update.error_message = errorMessage;
    }

    const { error } = await this.supabase
      .from('audit_runs')
      .update(update)
      .eq('id', this.runId);

    if (error) {
      this.logger.error({ error, status }, 'Failed to update audit run status');
      throw error;
    }

    this.logger.debug({ status }, 'Audit run status updated');
  }

  /**
   * Helper method to validate required credentials
   */
  protected validateCredentials(
    credentials: Record<string, any>,
    requiredFields: string[]
  ): void {
    const missingFields = requiredFields.filter(field => !credentials[field]);
    
    if (missingFields.length > 0) {
      throw new Error(`Missing required credentials: ${missingFields.join(', ')}`);
    }
  }

  /**
   * Helper method to safely extract numeric metrics
   */
  protected extractMetric(
    data: any,
    path: string,
    defaultValue: number = 0
  ): number {
    try {
      const keys = path.split('.');
      let value = data;
      
      for (const key of keys) {
        if (value && typeof value === 'object' && key in value) {
          value = value[key];
        } else {
          return defaultValue;
        }
      }
      
      const numValue = Number(value);
      return isNaN(numValue) ? defaultValue : numValue;
    } catch {
      return defaultValue;
    }
  }

  /**
   * Helper method to safely extract string values
   */
  protected extractString(
    data: any,
    path: string,
    defaultValue: string = ''
  ): string {
    try {
      const keys = path.split('.');
      let value = data;
      
      for (const key of keys) {
        if (value && typeof value === 'object' && key in value) {
          value = value[key];
        } else {
          return defaultValue;
        }
      }
      
      return String(value || defaultValue);
    } catch {
      return defaultValue;
    }
  }

  /**
   * Helper method to calculate percentage safely
   */
  protected calculatePercentage(numerator: number, denominator: number): number {
    if (denominator === 0) return 0;
    return Math.round((numerator / denominator) * 100);
  }

  /**
   * Helper method to calculate a weighted score
   */
  protected calculateWeightedScore(scores: Array<{ value: number; weight: number }>): number {
    if (scores.length === 0) return 0;
    
    const totalWeight = scores.reduce((sum, score) => sum + score.weight, 0);
    if (totalWeight === 0) return 0;
    
    const weightedSum = scores.reduce((sum, score) => sum + (score.value * score.weight), 0);
    return Math.round(weightedSum / totalWeight);
  }
}