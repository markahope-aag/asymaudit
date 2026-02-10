import { BaseAudit, AuditResult, ClientIntegration } from '../base-audit';
import { WordPressClient, WordPressCredentials, WordPressConfig } from '../../integrations/wordpress-client';
import { withRetry } from '../../utils/retry';

export interface WordPressHealthData {
  site_info: any;
  plugins: any[];
  themes: any[];
  users: any[];
  site_health: any;
  system_status: any;
  ssl_check: any;
  connection_test: any;
  content_stats: {
    posts_count: number;
    pages_count: number;
    media_count: number;
  };
  audit_timestamp: string;
}

export class WordPressHealthAudit extends BaseAudit {
  private wpClient: WordPressClient | null = null;

  getAuditType(): string {
    return 'wordpress_health';
  }

  async collect(): Promise<AuditResult> {
    this.logger.info('Starting WordPress health audit');

    // Get WordPress integration
    const integration = await this.getIntegration('wordpress');
    if (!integration) {
      throw new Error('WordPress integration not found or not active');
    }

    // Initialize WordPress client
    this.wpClient = this.createWordPressClient(integration);

    // Test connection first
    const connectionTest = await this.wpClient.testConnection();
    if (!connectionTest.success) {
      throw new Error(`WordPress connection failed: ${connectionTest.error}`);
    }

    this.logger.info({ responseTime: connectionTest.responseTime }, 'WordPress connection successful');

    // Collect all audit data
    const rawData = await this.collectWordPressData();
    
    // Extract metrics for trending
    const metrics = this.extractMetrics(rawData);

    this.logger.info({ 
      metricsCount: Object.keys(metrics).length,
      pluginsCount: rawData.plugins.length,
      themesCount: rawData.themes.length,
    }, 'WordPress health audit completed');

    return {
      rawData,
      metrics,
    };
  }

  private createWordPressClient(integration: ClientIntegration): WordPressClient {
    // Validate required credentials
    this.validateCredentials(integration.credentials, ['url']);

    const credentials: WordPressCredentials = {
      url: integration.credentials['url'],
      rest_api_key: integration.credentials['rest_api_key'],
      username: integration.credentials['username'],
      password: integration.credentials['password'],
      application_password: integration.credentials['application_password'],
    };

    const config: WordPressConfig = {
      check_plugins: integration.config['check_plugins'] !== false,
      check_themes: integration.config['check_themes'] !== false,
      check_updates: integration.config['check_updates'] !== false,
      check_security: integration.config['check_security'] !== false,
      timeout: integration.config['timeout'] || 30000,
    };

    return new WordPressClient(credentials, config);
  }

  private async collectWordPressData(): Promise<WordPressHealthData> {
    if (!this.wpClient) {
      throw new Error('WordPress client not initialized');
    }

    this.logger.debug('Collecting WordPress data in parallel');

    // Collect data in parallel for better performance
    const [
      siteInfo,
      plugins,
      themes,
      users,
      siteHealth,
      systemStatus,
      sslCheck,
      connectionTest,
      postsCount,
      pagesCount,
      mediaCount,
    ] = await Promise.allSettled([
      this.wpClient.getSiteInfo(),
      this.wpClient.getPlugins(),
      this.wpClient.getThemes(),
      this.wpClient.getUsers(),
      this.wpClient.getSiteHealth(),
      this.wpClient.getSystemStatus(),
      this.wpClient.checkSslCertificate(),
      this.wpClient.testConnection(),
      this.wpClient.getPostsCount(),
      this.wpClient.getPagesCount(),
      this.wpClient.getMediaCount(),
    ]);

    // Extract results, handling failures gracefully
    const data: WordPressHealthData = {
      site_info: siteInfo.status === 'fulfilled' ? siteInfo.value : null,
      plugins: plugins.status === 'fulfilled' ? plugins.value : [],
      themes: themes.status === 'fulfilled' ? themes.value : [],
      users: users.status === 'fulfilled' ? users.value : [],
      site_health: siteHealth.status === 'fulfilled' ? siteHealth.value : null,
      system_status: systemStatus.status === 'fulfilled' ? systemStatus.value : {},
      ssl_check: sslCheck.status === 'fulfilled' ? sslCheck.value : { isSecure: false },
      connection_test: connectionTest.status === 'fulfilled' ? connectionTest.value : { success: false },
      content_stats: {
        posts_count: postsCount.status === 'fulfilled' ? postsCount.value : 0,
        pages_count: pagesCount.status === 'fulfilled' ? pagesCount.value : 0,
        media_count: mediaCount.status === 'fulfilled' ? mediaCount.value : 0,
      },
      audit_timestamp: new Date().toISOString(),
    };

    // Log any collection failures
    const failures = [
      { name: 'site_info', result: siteInfo },
      { name: 'plugins', result: plugins },
      { name: 'themes', result: themes },
      { name: 'users', result: users },
      { name: 'site_health', result: siteHealth },
      { name: 'system_status', result: systemStatus },
      { name: 'ssl_check', result: sslCheck },
      { name: 'connection_test', result: connectionTest },
      { name: 'posts_count', result: postsCount },
      { name: 'pages_count', result: pagesCount },
      { name: 'media_count', result: mediaCount },
    ].filter(item => item.result.status === 'rejected');

    if (failures.length > 0) {
      this.logger.warn({ 
        failures: failures.map(f => ({ 
          name: f.name, 
          error: f.result.status === 'rejected' ? f.result.reason?.message : 'Unknown error'
        }))
      }, 'Some WordPress data collection failed');
    }

    return data;
  }

  private extractMetrics(data: WordPressHealthData): Record<string, number> {
    const metrics: Record<string, number> = {};

    // Basic counts
    metrics['plugins_total'] = data.plugins.length;
    metrics['plugins_active'] = data.plugins.filter(p => p.status === 'active').length;
    metrics['plugins_inactive'] = data.plugins.filter(p => p.status === 'inactive').length;
    
    metrics['themes_total'] = data.themes.length;
    metrics['themes_active'] = data.themes.filter(t => t.status === 'active').length;
    
    metrics['users_total'] = data.users.length;
    metrics['users_admin'] = data.users.filter(u => u.roles.includes('administrator')).length;
    
    metrics['posts_count'] = data.content_stats.posts_count;
    metrics['pages_count'] = data.content_stats.pages_count;
    metrics['media_count'] = data.content_stats.media_count;

    // Security metrics
    metrics['ssl_enabled'] = data.ssl_check.isSecure ? 1 : 0;
    metrics['connection_success'] = data.connection_test.success ? 1 : 0;
    metrics['response_time_ms'] = data.connection_test.responseTime || 0;

    // Plugin analysis
    const outdatedPlugins = this.analyzePluginUpdates(data.plugins);
    metrics['plugins_outdated'] = outdatedPlugins.length;
    metrics['plugins_security_risk'] = this.countSecurityRiskPlugins(data.plugins);

    // Theme analysis
    const activeTheme = data.themes.find(t => t.status === 'active');
    metrics['active_theme_outdated'] = activeTheme && this.isThemeOutdated(activeTheme) ? 1 : 0;
    metrics['child_theme_used'] = activeTheme && this.isChildTheme(activeTheme) ? 1 : 0;

    // WordPress core analysis
    if (data.site_info) {
      metrics['wp_version_latest'] = this.isWordPressVersionLatest(data.site_info) ? 1 : 0;
    }

    // Site health score
    if (data.site_health) {
      metrics['site_health_score'] = this.calculateSiteHealthScore(data.site_health);
    }

    // Calculate overall health score
    metrics['overall_health_score'] = this.calculateOverallHealthScore(metrics, data);

    return metrics;
  }

  private analyzePluginUpdates(plugins: any[]): any[] {
    // This would typically check against WordPress.org API or plugin update data
    // For now, we'll use heuristics based on plugin data
    return plugins.filter(plugin => {
      // Check if plugin has update information indicating it's outdated
      // This is a simplified check - in practice you'd compare with latest versions
      return plugin.update_available || false;
    });
  }

  private countSecurityRiskPlugins(plugins: any[]): number {
    // This would typically check against vulnerability databases
    // For now, we'll identify potential risks based on plugin characteristics
    return plugins.filter(plugin => {
      // Inactive plugins are a security risk
      if (plugin.status === 'inactive') return true;
      
      // Very old plugins might be security risks
      if (plugin.version && this.isVersionVeryOld(plugin.version)) return true;
      
      // Plugins without recent updates
      if (!plugin.requires_wp || this.isRequiredWpVersionOld(plugin.requires_wp)) return true;
      
      return false;
    }).length;
  }

  private isThemeOutdated(theme: any): boolean {
    // Check if theme version indicates it might be outdated
    return theme.update_available || false;
  }

  private isChildTheme(theme: any): boolean {
    // A child theme typically has a different stylesheet and template
    return theme.stylesheet !== theme.template;
  }

  private isWordPressVersionLatest(siteInfo: any): boolean {
    // This would typically check against WordPress.org API for latest version
    // For now, we'll assume versions 6.0+ are reasonably current
    const version = siteInfo.wp_version || '0.0';
    const majorVersion = parseFloat(version);
    return majorVersion >= 6.0;
  }

  private isVersionVeryOld(version: string): boolean {
    // Consider versions older than 2 years as very old
    // This is a simplified heuristic
    const versionNumber = parseFloat(version);
    return versionNumber < 1.0; // Very conservative check
  }

  private isRequiredWpVersionOld(requiredWp: string): boolean {
    // Check if required WordPress version is very old
    const requiredVersion = parseFloat(requiredWp);
    return requiredVersion < 5.0; // WordPress 5.0 was released in 2018
  }

  private calculateSiteHealthScore(siteHealth: any): number {
    if (!siteHealth || !siteHealth.tests) return 50;

    let totalTests = 0;
    let passedTests = 0;

    // Count direct tests
    if (siteHealth.tests.direct) {
      for (const [testName, testResult] of Object.entries(siteHealth.tests.direct)) {
        totalTests++;
        if ((testResult as any).status === 'good') {
          passedTests++;
        }
      }
    }

    // Count async tests
    if (siteHealth.tests.async) {
      for (const [testName, testResult] of Object.entries(siteHealth.tests.async)) {
        totalTests++;
        if ((testResult as any).status === 'good') {
          passedTests++;
        }
      }
    }

    return totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 50;
  }

  private calculateOverallHealthScore(metrics: Record<string, number>, data: WordPressHealthData): number {
    // Calculate weighted score based on different factors
    const scores = [
      { value: (metrics['ssl_enabled'] || 0) * 100, weight: 0.2 }, // Security: 20%
      { value: (metrics['connection_success'] || 0) * 100, weight: 0.1 }, // Connectivity: 10%
      { value: (metrics['wp_version_latest'] || 0) * 100, weight: 0.15 }, // Core updates: 15%
      { value: Math.max(0, 100 - ((metrics['plugins_outdated'] || 0) * 10)), weight: 0.15 }, // Plugin health: 15%
      { value: Math.max(0, 100 - ((metrics['plugins_security_risk'] || 0) * 20)), weight: 0.2 }, // Security risks: 20%
      { value: (metrics['child_theme_used'] || 0) * 100, weight: 0.1 }, // Theme best practices: 10%
      { value: metrics['site_health_score'] || 50, weight: 0.1 }, // Site health: 10%
    ];

    return this.calculateWeightedScore(scores);
  }
}