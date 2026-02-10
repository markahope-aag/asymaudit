import { wordpressHealthPrompt } from './wordpress';
import { ga4ConfigPrompt, ga4DataQualityPrompt } from './analytics';
import { googleAdsAccountPrompt, googleAdsCampaignsPrompt } from './ads';
import { gtmContainerPrompt } from './gtm';
import { technicalSeoPrompt, backlinksPrompt } from './seo';

export function getPromptForAuditType(auditType: string): string {
  switch (auditType) {
    // WordPress audits
    case 'wordpress_health':
      return wordpressHealthPrompt;
    case 'wordpress_seo':
      return wordpressHealthPrompt; // TODO: Create specific SEO prompt
    case 'wordpress_performance':
      return wordpressHealthPrompt; // TODO: Create specific performance prompt
    case 'wordpress_security':
      return wordpressHealthPrompt; // TODO: Create specific security prompt

    // Google Analytics audits
    case 'ga4_config':
      return ga4ConfigPrompt;
    case 'ga4_data_quality':
      return ga4DataQualityPrompt;

    // Google Ads audits
    case 'google_ads_account':
      return googleAdsAccountPrompt;
    case 'google_ads_campaigns':
      return googleAdsCampaignsPrompt;

    // Google Tag Manager audits
    case 'gtm_container':
      return gtmContainerPrompt;

    // SEO audits
    case 'seo_technical':
      return technicalSeoPrompt;
    case 'seo_backlinks':
      return backlinksPrompt;

    // Default fallback
    default:
      return getGenericPrompt(auditType);
  }
}

function getGenericPrompt(auditType: string): string {
  return `You are an expert digital marketing auditor analyzing ${auditType} audit data.

Your job is to:
1. Score the audit results overall (0-100) based on best practices and performance.
2. Identify specific issues with severity levels (critical, warning, info).
3. Provide actionable recommendations prioritized by impact and effort.
4. If previous audit data is provided, identify trends — what improved, what degraded, what's new.

Return your analysis as valid JSON matching this structure:
{
  "overallScore": number (0-100),
  "scores": {
    "category1": number (0-100),
    "category2": number (0-100)
  },
  "issues": [
    {
      "severity": "critical" | "warning" | "info",
      "category": string,
      "title": string,
      "description": string,
      "recommendation": string,
      "impact": string
    }
  ],
  "recommendations": [
    {
      "priority": "high" | "medium" | "low",
      "title": string,
      "description": string,
      "estimatedImpact": string,
      "effort": string
    }
  ],
  "summary": string,
  "trendAnalysis": string | null
}

Be specific and actionable. Reference exact values, configurations, and metrics from the audit data.
Do not be generic — this analysis drives real client decisions and improvements.`;
}