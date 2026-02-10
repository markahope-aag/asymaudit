import { BaseAudit, AuditResult, ClientIntegration } from '../base-audit';
import { WordPressClient, WordPressCredentials, WordPressConfig } from '../../integrations/wordpress-client';
import axios from 'axios';
import * as cheerio from 'cheerio';

export class WordPressSEOAudit extends BaseAudit {
  getAuditType(): string {
    return 'wordpress_seo';
  }

  async collect(): Promise<AuditResult> {
    this.logger.info('Starting WordPress SEO audit');

    const integration = await this.getIntegration('wordpress');
    if (!integration) throw new Error('WordPress integration not found');

    const siteUrl = integration.credentials['url'];
    const wpClient = new WordPressClient(
      { url: siteUrl, ...integration.credentials } as WordPressCredentials,
      integration.config as WordPressConfig,
    );

    // Collect SEO data in parallel
    const [siteInfo, plugins, pages, posts, sitemapCheck, robotsCheck, metaCheck] = await Promise.allSettled([
      wpClient.getSiteInfo(),
      wpClient.getPlugins(),
      wpClient.getPagesCount(),
      wpClient.getPostsCount(),
      this.checkSitemap(siteUrl),
      this.checkRobotsTxt(siteUrl),
      this.checkMetaTags(siteUrl),
    ]);

    const pluginList = plugins.status === 'fulfilled' ? plugins.value : [];
    const seoPlugin = this.detectSEOPlugin(pluginList);

    const rawData = {
      site_info: siteInfo.status === 'fulfilled' ? siteInfo.value : null,
      seo_plugin: seoPlugin,
      sitemap: sitemapCheck.status === 'fulfilled' ? sitemapCheck.value : { found: false },
      robots_txt: robotsCheck.status === 'fulfilled' ? robotsCheck.value : { found: false },
      meta_tags: metaCheck.status === 'fulfilled' ? metaCheck.value : {},
      content_stats: {
        pages_count: pages.status === 'fulfilled' ? pages.value : 0,
        posts_count: posts.status === 'fulfilled' ? posts.value : 0,
      },
      all_plugins: pluginList.map(p => ({ name: p.name, status: p.status })),
      audit_timestamp: new Date().toISOString(),
    };

    const metrics: Record<string, number> = {
      has_seo_plugin: seoPlugin ? 1 : 0,
      has_sitemap: rawData.sitemap.found ? 1 : 0,
      has_robots_txt: rawData.robots_txt.found ? 1 : 0,
      has_meta_description: rawData.meta_tags.hasDescription ? 1 : 0,
      has_og_tags: rawData.meta_tags.hasOpenGraph ? 1 : 0,
      pages_count: rawData.content_stats.pages_count,
      posts_count: rawData.content_stats.posts_count,
    };

    return { rawData, metrics };
  }

  private detectSEOPlugin(plugins: any[]): string | null {
    const seoPlugins = ['seopress', 'yoast', 'rank-math', 'all-in-one-seo', 'the-seo-framework'];
    const active = plugins.find(p =>
      p.status === 'active' && seoPlugins.some(sp => p.plugin?.toLowerCase().includes(sp) || p.name?.toLowerCase().includes(sp))
    );
    return active ? active.name : null;
  }

  private async checkSitemap(siteUrl: string) {
    const urls = [`${siteUrl}/sitemap_index.xml`, `${siteUrl}/sitemap.xml`, `${siteUrl}/wp-sitemap.xml`];
    for (const url of urls) {
      try {
        const res = await axios.get(url, { timeout: 10000, maxRedirects: 3 });
        if (res.status === 200 && res.data.includes('<?xml')) {
          return { found: true, url, type: url.includes('index') ? 'index' : 'single' };
        }
      } catch { /* continue */ }
    }
    return { found: false };
  }

  private async checkRobotsTxt(siteUrl: string) {
    try {
      const res = await axios.get(`${siteUrl}/robots.txt`, { timeout: 10000 });
      const text = res.data as string;
      return {
        found: true,
        hasSitemap: text.toLowerCase().includes('sitemap'),
        hasDisallow: text.includes('Disallow'),
        content: text.slice(0, 500),
      };
    } catch {
      return { found: false };
    }
  }

  private async checkMetaTags(siteUrl: string) {
    try {
      const res = await axios.get(siteUrl, { timeout: 15000, headers: { 'User-Agent': 'AsymAudit/1.0' } });
      const $ = cheerio.load(res.data);
      return {
        title: $('title').text() || null,
        hasDescription: !!$('meta[name="description"]').attr('content'),
        description: $('meta[name="description"]').attr('content') || null,
        hasOpenGraph: !!$('meta[property="og:title"]').attr('content'),
        hasTwitterCard: !!$('meta[name="twitter:card"]').attr('content'),
        hasCanonical: !!$('link[rel="canonical"]').attr('href'),
        canonical: $('link[rel="canonical"]').attr('href') || null,
        hasHreflang: $('link[rel="alternate"][hreflang]').length > 0,
        h1Count: $('h1').length,
      };
    } catch {
      return {};
    }
  }
}
