// Database row types (mirroring worker/src/config/supabase.ts)

export type Platform =
  | 'wordpress'
  | 'google_analytics'
  | 'google_ads'
  | 'google_tag_manager'
  | 'google_search_console'
  | 'moz'
  | 'spyfu'
  | 'semrush'
  | 'cloudflare';

export type AuditStatus = 'pending' | 'collecting' | 'analyzing' | 'complete' | 'failed';
export type DiffSeverity = 'info' | 'warning' | 'critical';
export type IssueSeverity = 'critical' | 'warning' | 'info';
export type Priority = 'high' | 'medium' | 'low';

export type AuditType =
  | 'wordpress_health'
  | 'wordpress_seo'
  | 'wordpress_performance'
  | 'wordpress_security'
  | 'wordpress_forms'
  | 'ga4_config'
  | 'ga4_data_quality'
  | 'gtm_container'
  | 'gsc_coverage'
  | 'cloudflare_config'
  | 'google_ads_account'
  | 'google_ads_campaigns'
  | 'seo_technical'
  | 'seo_backlinks';

// --- Database Row Types ---

export interface Client {
  id: string;
  name: string;
  slug: string;
  website_url: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ClientIntegration {
  id: string;
  client_id: string;
  platform: Platform;
  credentials: Record<string, unknown>;
  config: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuditSchedule {
  id: string;
  client_id: string;
  audit_type: string;
  cron_expression: string;
  is_active: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
  created_at: string;
}

export interface AuditRun {
  id: string;
  client_id: string;
  audit_type: string;
  status: AuditStatus;
  started_at: string;
  completed_at: string | null;
  raw_data: Record<string, unknown> | null;
  ai_analysis: AIAnalysis | null;
  overall_score: number | null;
  scores: Record<string, number> | null;
  issues: AuditIssue[] | null;
  recommendations: AuditRecommendation[] | null;
  error_message: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface AuditSnapshot {
  id: string;
  audit_run_id: string;
  client_id: string;
  audit_type: string;
  metric_key: string;
  metric_value: number;
  captured_at: string;
}

export interface AuditDiff {
  id: string;
  client_id: string;
  audit_type: string;
  current_run_id: string;
  previous_run_id: string;
  changes: DiffChanges;
  severity: DiffSeverity;
  summary: string;
  created_at: string;
}

// --- AI Analysis Types ---

export interface AIAnalysis {
  overallScore: number;
  scores: Record<string, number>;
  issues: AuditIssue[];
  recommendations: AuditRecommendation[];
  summary: string;
  trendAnalysis?: string;
}

export interface AuditIssue {
  severity: IssueSeverity;
  category: string;
  title: string;
  description: string;
  recommendation: string;
  impact: string;
}

export interface AuditRecommendation {
  priority: Priority;
  title: string;
  description: string;
  estimatedImpact: string;
  effort: string;
}

// --- Diff Types ---

export interface DiffChanges {
  added: DiffChangeAdded[];
  removed: DiffChangeRemoved[];
  changed: DiffChangeModified[];
}

export interface DiffChangeAdded {
  key: string;
  description: string;
  value: unknown;
}

export interface DiffChangeRemoved {
  key: string;
  description: string;
  value: unknown;
}

export interface DiffChangeModified {
  key: string;
  description: string;
  previous: unknown;
  current: unknown;
  direction: 'improved' | 'degraded' | 'neutral';
}

// --- API Response Types ---

export interface QueueStatus {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

export interface TriggerResponse {
  success: boolean;
  runId: string;
  jobId?: string;
  clientName?: string;
  auditType?: string;
  status?: string;
}

export interface TriggerAllResponse {
  success: boolean;
  clientName: string;
  totalAudits: number;
  successCount: number;
  failedCount: number;
  results: TriggerResponse[];
}

export interface WorkerHealth {
  status: string;
  timestamp: string;
  service: string;
}

// --- UI Types ---

export interface ClientWithStats extends Client {
  latestScore: number | null;
  previousScore: number | null;
  lastAuditDate: string | null;
  criticalIssues: number;
  totalRuns: number;
}

export interface AuditCategorySummary {
  auditType: AuditType;
  latestScore: number | null;
  issueCount: { critical: number; warning: number; info: number };
  lastRunAt: string | null;
  trendData: { date: string; score: number }[];
}
