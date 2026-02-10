import { wordpressHealthPrompt } from './wordpress';
import { ga4ConfigPrompt, ga4DataQualityPrompt } from './analytics';
import { googleAdsAccountPrompt, googleAdsCampaignsPrompt } from './ads';
import { gtmContainerPrompt } from './gtm';
import { technicalSeoPrompt, backlinksPrompt } from './seo';
import { cloudflareConfigPrompt } from './cloudflare';

// Specific prompts for WordPress sub-audits
const wordpressSeoPrompt = `You are an expert WordPress SEO auditor for a digital marketing agency.
You are analyzing SEO-specific data from a client's WordPress site including meta tags, sitemaps, robots.txt, and SEO plugin configuration.

Score the SEO implementation (0-100) with these weights:
- On-page SEO (30%): Title tags, meta descriptions, Open Graph, canonical URLs, heading structure
- Technical SEO (25%): Sitemap presence, robots.txt configuration, structured data
- Content SEO (25%): H1 usage, image alt text, internal/external links
- SEO Plugin (20%): Active SEO plugin (SEOPress preferred), proper configuration

Asymmetric standard: SEOPress Pro is the preferred SEO plugin (not Yoast).

Return valid JSON with: overallScore, scores (on_page, technical, content, seo_plugin), issues, recommendations, summary, trendAnalysis.`;

const wordpressPerformancePrompt = `You are an expert web performance auditor for a digital marketing agency.
You are analyzing Lighthouse/PageSpeed Insights data for both mobile and desktop.

Score performance (0-100) with these weights:
- Mobile Performance (40%): Lighthouse performance score, Core Web Vitals
- Desktop Performance (25%): Lighthouse performance score
- Accessibility (15%): Lighthouse accessibility score
- Best Practices & SEO (20%): Combined Lighthouse scores

Core Web Vitals targets:
- FCP < 1.8s (good), < 3.0s (needs improvement)
- LCP < 2.5s (good), < 4.0s (needs improvement)
- TBT < 200ms (good), < 600ms (needs improvement)
- CLS < 0.1 (good), < 0.25 (needs improvement)

Target: All Lighthouse scores 90+

Return valid JSON with: overallScore, scores (mobile_performance, desktop_performance, accessibility, web_vitals), issues, recommendations, summary, trendAnalysis.`;

const wordpressSecurityPrompt = `You are an expert WordPress security auditor for a digital marketing agency.
You are analyzing security configuration for a client's WordPress site.

Score security (0-100) with these weights:
- SSL & Transport (25%): HTTPS, HSTS, security headers
- Plugin Security (25%): Security plugin installed, inactive plugins removed, plugins up to date
- Access Control (20%): Admin user count, login page protection
- Headers (15%): X-Content-Type-Options, X-Frame-Options, CSP, Referrer-Policy
- Best Practices (15%): Child theme used, wp-login.php protection

Asymmetric standard: Really Simple Security Pro (not Wordfence) is the preferred security plugin.
Inactive plugins are a security risk and should be removed.

Return valid JSON with: overallScore, scores (ssl_transport, plugin_security, access_control, security_headers, best_practices), issues, recommendations, summary, trendAnalysis.`;

const wordpressFormsPrompt = `You are an expert WordPress forms auditor for a digital marketing agency.
You are analyzing Gravity Forms configuration for a client's WordPress site.

Score forms implementation (0-100) with these weights:
- Plugin Status (30%): Gravity Forms active, version current
- Form Configuration (30%): Active forms, confirmation types, entry counts
- Conversion Tracking (20%): Forms firing GA4 events, GTM tags for form submissions
- Maintenance (20%): Form entry counts, inactive forms

Return valid JSON with: overallScore, scores (plugin_status, form_config, conversion_tracking, maintenance), issues, recommendations, summary, trendAnalysis.`;

export function getPromptForAuditType(auditType: string): string {
  switch (auditType) {
    // WordPress audits
    case 'wordpress_health':
      return wordpressHealthPrompt;
    case 'wordpress_seo':
      return wordpressSeoPrompt;
    case 'wordpress_performance':
      return wordpressPerformancePrompt;
    case 'wordpress_security':
      return wordpressSecurityPrompt;
    case 'wordpress_forms':
      return wordpressFormsPrompt;

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

    // CloudFlare
    case 'cloudflare_config':
      return cloudflareConfigPrompt;

    // SEO audits
    case 'seo_technical':
      return technicalSeoPrompt;
    case 'seo_backlinks':
      return backlinksPrompt;

    // GSC
    case 'gsc_coverage':
      return getGSCPrompt();

    // Default fallback
    default:
      return getGenericPrompt(auditType);
  }
}

function getGSCPrompt(): string {
  return `You are an expert Search Console analyst for a digital marketing agency.
You are analyzing Google Search Console data including search analytics, top queries, top pages, and device breakdown.

Score the search performance (0-100) with these weights:
- Search Visibility (30%): Total impressions, query count, page count
- Click Performance (25%): Total clicks, CTR patterns
- Ranking Quality (25%): Average position, queries in top 10
- Technical Health (20%): Sitemaps submitted, index coverage

Return valid JSON with: overallScore, scores (visibility, clicks, rankings, technical), issues, recommendations, summary, trendAnalysis.
Be specific — reference exact queries, pages, and metrics from the data.`;
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
