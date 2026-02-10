import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import type { AuditType, IssueSeverity } from '@/types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return 'Never';
  try {
    return format(parseISO(dateString), 'MMM d, yyyy');
  } catch {
    return 'Invalid date';
  }
}

export function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return 'Never';
  try {
    return format(parseISO(dateString), 'MMM d, yyyy h:mm a');
  } catch {
    return 'Invalid date';
  }
}

export function formatRelativeTime(dateString: string | null | undefined): string {
  if (!dateString) return 'Never';
  try {
    return formatDistanceToNow(parseISO(dateString), { addSuffix: true });
  } catch {
    return 'Unknown';
  }
}

export function getScoreColor(score: number | null | undefined): string {
  if (score == null) return 'text-muted-foreground';
  if (score >= 75) return 'text-emerald-500';
  if (score >= 50) return 'text-amber-500';
  return 'text-red-500';
}

export function getScoreBgColor(score: number | null | undefined): string {
  if (score == null) return 'bg-muted';
  if (score >= 75) return 'bg-emerald-500';
  if (score >= 50) return 'bg-amber-500';
  return 'bg-red-500';
}

export function getScoreLabel(score: number | null | undefined): string {
  if (score == null) return 'N/A';
  if (score >= 90) return 'Excellent';
  if (score >= 75) return 'Good';
  if (score >= 50) return 'Fair';
  if (score >= 25) return 'Poor';
  return 'Critical';
}

export function getSeverityColor(severity: IssueSeverity): string {
  switch (severity) {
    case 'critical': return 'text-red-500';
    case 'warning': return 'text-amber-500';
    case 'info': return 'text-blue-500';
  }
}

export function getSeverityBgColor(severity: IssueSeverity): string {
  switch (severity) {
    case 'critical': return 'bg-red-500/10 text-red-500 border-red-500/20';
    case 'warning': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
    case 'info': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
  }
}

export function getTrendArrow(current: number | null, previous: number | null): string {
  if (current == null || previous == null) return '—';
  const diff = current - previous;
  if (diff > 2) return '↑';
  if (diff < -2) return '↓';
  return '→';
}

export function getTrendColor(current: number | null, previous: number | null): string {
  if (current == null || previous == null) return 'text-muted-foreground';
  const diff = current - previous;
  if (diff > 2) return 'text-emerald-500';
  if (diff < -2) return 'text-red-500';
  return 'text-muted-foreground';
}

const AUDIT_TYPE_LABELS: Record<string, string> = {
  wordpress_health: 'WordPress Health',
  wordpress_seo: 'WordPress SEO',
  wordpress_performance: 'Performance',
  wordpress_security: 'Security',
  wordpress_forms: 'Gravity Forms',
  ga4_config: 'GA4 Config',
  ga4_data_quality: 'GA4 Data Quality',
  gtm_container: 'GTM Container',
  gsc_coverage: 'Search Console',
  cloudflare_config: 'CloudFlare',
  google_ads_account: 'Google Ads Account',
  google_ads_campaigns: 'Google Ads Campaigns',
  seo_technical: 'Technical SEO',
  seo_backlinks: 'Backlinks',
};

export function formatAuditType(auditType: string): string {
  return AUDIT_TYPE_LABELS[auditType] || auditType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function getAuditTypeCategory(auditType: string): string {
  if (auditType.startsWith('wordpress_')) return 'WordPress';
  if (auditType.startsWith('ga4_')) return 'Google Analytics';
  if (auditType.startsWith('google_ads_')) return 'Google Ads';
  if (auditType === 'gtm_container') return 'Tag Manager';
  if (auditType === 'gsc_coverage') return 'Search Console';
  if (auditType === 'cloudflare_config') return 'CloudFlare';
  if (auditType.startsWith('seo_')) return 'SEO';
  return 'Other';
}

export function getAuditTypeIcon(auditType: string): string {
  const category = getAuditTypeCategory(auditType);
  switch (category) {
    case 'WordPress': return 'Globe';
    case 'Google Analytics': return 'BarChart3';
    case 'Google Ads': return 'Megaphone';
    case 'Tag Manager': return 'Tags';
    case 'Search Console': return 'Search';
    case 'CloudFlare': return 'Shield';
    case 'SEO': return 'TrendingUp';
    default: return 'FileSearch';
  }
}
