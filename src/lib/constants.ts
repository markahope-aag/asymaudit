import type { AuditType, IssueSeverity, AuditStatus } from '@/types';

// Brand colors (hex) for charts and direct use
export const BRAND = {
  graphite: '#1e1e1e',
  white: '#ffffff',
  legacyBlue: '#252160',
  gold: '#c7a65a',
  legacyRed: '#bd123c',
  legacyGrey: '#57575b',
  darkGrey: '#404041',
  lightGrey: '#f5f5f5',
} as const;

// Chart colors
export const CHART_COLORS = {
  primary: BRAND.legacyBlue,
  accent: BRAND.gold,
  destructive: BRAND.legacyRed,
  muted: BRAND.legacyGrey,
  success: '#22c55e',
  warning: '#f59e0b',
  info: '#3b82f6',
} as const;

// Score thresholds
export const SCORE_THRESHOLDS = {
  excellent: 90,
  good: 75,
  fair: 50,
  poor: 25,
} as const;

// Audit status configuration
export const STATUS_CONFIG: Record<AuditStatus, { label: string; color: string; bgColor: string; pulse: boolean }> = {
  pending: { label: 'Pending', color: 'text-muted-foreground', bgColor: 'bg-muted', pulse: false },
  collecting: { label: 'Collecting', color: 'text-blue-500', bgColor: 'bg-blue-500/10', pulse: true },
  analyzing: { label: 'Analyzing', color: 'text-amber-500', bgColor: 'bg-amber-500/10', pulse: true },
  complete: { label: 'Complete', color: 'text-emerald-500', bgColor: 'bg-emerald-500/10', pulse: false },
  failed: { label: 'Failed', color: 'text-red-500', bgColor: 'bg-red-500/10', pulse: false },
};

// Issue severity configuration
export const SEVERITY_CONFIG: Record<IssueSeverity, { label: string; color: string; icon: string }> = {
  critical: { label: 'Critical', color: 'text-red-500', icon: 'AlertCircle' },
  warning: { label: 'Warning', color: 'text-amber-500', icon: 'AlertTriangle' },
  info: { label: 'Info', color: 'text-blue-500', icon: 'Info' },
};

// All audit types grouped by platform
export const AUDIT_TYPES_BY_PLATFORM: Record<string, AuditType[]> = {
  WordPress: ['wordpress_health', 'wordpress_seo', 'wordpress_performance', 'wordpress_security', 'wordpress_forms'],
  'Google Analytics': ['ga4_config', 'ga4_data_quality'],
  'Tag Manager': ['gtm_container'],
  'Search Console': ['gsc_coverage'],
  CloudFlare: ['cloudflare_config'],
  'Google Ads': ['google_ads_account', 'google_ads_campaigns'],
  SEO: ['seo_technical', 'seo_backlinks'],
};

// Platform to integration platform mapping (for checking which audits a client can run)
export const AUDIT_TYPE_TO_PLATFORM: Record<string, string | null> = {
  wordpress_health: 'wordpress',
  wordpress_seo: 'wordpress',
  wordpress_performance: 'wordpress',
  wordpress_security: 'wordpress',
  wordpress_forms: 'wordpress',
  ga4_config: 'google_analytics',
  ga4_data_quality: 'google_analytics',
  gtm_container: 'google_tag_manager',
  gsc_coverage: 'google_search_console',
  cloudflare_config: 'cloudflare',
  google_ads_account: 'google_ads',
  google_ads_campaigns: 'google_ads',
  seo_technical: null, // No integration required
  seo_backlinks: null,
};

// Queue poll interval (ms)
export const QUEUE_POLL_INTERVAL = 30_000;

// Realtime subscription channel
export const REALTIME_CHANNEL = 'audit-runs';
