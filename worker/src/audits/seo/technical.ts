import { BaseAudit, AuditResult } from '../base-audit';
import axios from 'axios';
import * as cheerio from 'cheerio';

export class TechnicalSEOAudit extends BaseAudit {
  getAuditType(): string {
    return 'seo_technical';
  }

  async collect(): Promise<AuditResult> {
    this.logger.info('Starting technical SEO audit');

    // Get the website URL from client record
    const { data: client } = await this.supabase
      .from('clients')
      .select('website_url')
      .eq('id', this.clientId)
      .single();

    if (!client?.website_url) throw new Error('Client website URL not found');
    const siteUrl = client.website_url.replace(/\/$/, '');

    const [homepage, robotsTxt, sitemap, redirectChain, headers] = await Promise.allSettled([
      this.analyzeHomepage(siteUrl),
      this.checkRobotsTxt(siteUrl),
      this.checkSitemap(siteUrl),
      this.checkRedirectChain(siteUrl),
      this.checkHeaders(siteUrl),
    ]);

    const rawData = {
      homepage: homepage.status === 'fulfilled' ? homepage.value : {},
      robots_txt: robotsTxt.status === 'fulfilled' ? robotsTxt.value : { found: false },
      sitemap: sitemap.status === 'fulfilled' ? sitemap.value : { found: false },
      redirect_chain: redirectChain.status === 'fulfilled' ? redirectChain.value : {},
      headers: headers.status === 'fulfilled' ? headers.value : {},
      site_url: siteUrl,
      audit_timestamp: new Date().toISOString(),
    };

    const hp = rawData.homepage as Record<string, any>;
    const metrics: Record<string, number> = {
      has_robots_txt: (rawData.robots_txt as any).found ? 1 : 0,
      has_sitemap: (rawData.sitemap as any).found ? 1 : 0,
      has_ssl: siteUrl.startsWith('https') ? 1 : 0,
      has_meta_description: hp['hasMetaDescription'] ? 1 : 0,
      has_canonical: hp['hasCanonical'] ? 1 : 0,
      has_og_tags: hp['hasOgTags'] ? 1 : 0,
      h1_count: hp['h1Count'] || 0,
      image_alt_coverage: hp['imageAltCoverage'] || 0,
      redirect_correct: (rawData.redirect_chain as any).allCorrect ? 1 : 0,
    };

    return { rawData, metrics };
  }

  private async analyzeHomepage(siteUrl: string) {
    const res = await axios.get(siteUrl, { timeout: 15000, headers: { 'User-Agent': 'AsymAudit/1.0' } });
    const $ = cheerio.load(res.data);

    const images = $('img');
    const imagesWithAlt = $('img[alt]').filter((_, el) => !!$(el).attr('alt')?.trim());

    return {
      title: $('title').text().trim(),
      hasMetaDescription: !!$('meta[name="description"]').attr('content'),
      metaDescription: $('meta[name="description"]').attr('content') || null,
      hasCanonical: !!$('link[rel="canonical"]').attr('href'),
      canonical: $('link[rel="canonical"]').attr('href') || null,
      hasOgTags: !!$('meta[property="og:title"]').attr('content'),
      hasTwitterCard: !!$('meta[name="twitter:card"]').attr('content'),
      h1Count: $('h1').length,
      h1Text: $('h1').first().text().trim(),
      h2Count: $('h2').length,
      totalImages: images.length,
      imagesWithAlt: imagesWithAlt.length,
      imageAltCoverage: images.length > 0 ? Math.round((imagesWithAlt.length / images.length) * 100) : 100,
      hasStructuredData: $('script[type="application/ld+json"]').length > 0,
      hasViewport: !!$('meta[name="viewport"]').attr('content'),
      hasLang: !!$('html').attr('lang'),
      lang: $('html').attr('lang') || null,
      internalLinks: $('a[href^="/"], a[href^="' + siteUrl + '"]').length,
      externalLinks: $('a[href^="http"]').not('a[href^="' + siteUrl + '"]').length,
    };
  }

  private async checkRobotsTxt(siteUrl: string) {
    try {
      const res = await axios.get(`${siteUrl}/robots.txt`, { timeout: 10000 });
      return {
        found: true,
        hasSitemap: res.data.toLowerCase().includes('sitemap'),
        hasDisallow: res.data.includes('Disallow'),
        size: res.data.length,
      };
    } catch {
      return { found: false };
    }
  }

  private async checkSitemap(siteUrl: string) {
    const urls = [`${siteUrl}/sitemap_index.xml`, `${siteUrl}/sitemap.xml`, `${siteUrl}/wp-sitemap.xml`];
    for (const url of urls) {
      try {
        const res = await axios.get(url, { timeout: 10000 });
        if (res.status === 200 && res.data.includes('<?xml')) {
          return { found: true, url };
        }
      } catch { /* continue */ }
    }
    return { found: false };
  }

  private async checkRedirectChain(siteUrl: string) {
    const domain = new URL(siteUrl).hostname;
    const variants = [
      `http://${domain}`,
      `https://${domain}`,
      `http://www.${domain}`,
      `https://www.${domain}`,
    ];

    const results: Array<{ url: string; redirectsTo: string | null; status: number }> = [];
    for (const url of variants) {
      try {
        const res = await axios.get(url, {
          timeout: 10000,
          maxRedirects: 0,
          validateStatus: () => true,
        });
        results.push({
          url,
          redirectsTo: res.headers['location'] || null,
          status: res.status,
        });
      } catch {
        results.push({ url, redirectsTo: null, status: 0 });
      }
    }

    const allCorrect = results.every(r => r.status === 301 || r.url === siteUrl);
    return { variants: results, allCorrect };
  }

  private async checkHeaders(siteUrl: string) {
    try {
      const res = await axios.head(siteUrl, { timeout: 10000 });
      const h = res.headers;
      return {
        server: h['server'] || null,
        xPoweredBy: h['x-powered-by'] || null,
        cacheControl: h['cache-control'] || null,
        contentEncoding: h['content-encoding'] || null,
        xContentType: h['x-content-type-options'] || null,
        xFrameOptions: h['x-frame-options'] || null,
        hsts: h['strict-transport-security'] || null,
      };
    } catch {
      return {};
    }
  }
}
