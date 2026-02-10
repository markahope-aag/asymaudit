import { BaseAudit, AuditResult } from '../base-audit';
import { WordPressClient, WordPressCredentials, WordPressConfig } from '../../integrations/wordpress-client';
import axios from 'axios';

export class WordPressSecurityAudit extends BaseAudit {
  getAuditType(): string {
    return 'wordpress_security';
  }

  async collect(): Promise<AuditResult> {
    this.logger.info('Starting WordPress security audit');

    const integration = await this.getIntegration('wordpress');
    if (!integration) throw new Error('WordPress integration not found');

    const siteUrl = integration.credentials['url'];
    const wpClient = new WordPressClient(
      { url: siteUrl, ...integration.credentials } as WordPressCredentials,
      integration.config as WordPressConfig,
    );

    const [plugins, themes, users, sslCheck, headers, wpLogin] = await Promise.allSettled([
      wpClient.getPlugins(),
      wpClient.getThemes(),
      wpClient.getUsers(),
      wpClient.checkSslCertificate(),
      this.checkSecurityHeaders(siteUrl),
      this.checkLoginPage(siteUrl),
    ]);

    const pluginList = plugins.status === 'fulfilled' ? plugins.value : [];
    const userList = users.status === 'fulfilled' ? users.value : [];

    const securityPlugins = this.detectSecurityPlugins(pluginList);
    const inactivePlugins = pluginList.filter(p => p.status === 'inactive');
    const adminUsers = userList.filter(u => u.roles?.includes('administrator'));

    const rawData = {
      ssl: sslCheck.status === 'fulfilled' ? sslCheck.value : { isSecure: false },
      security_headers: headers.status === 'fulfilled' ? headers.value : {},
      login_page: wpLogin.status === 'fulfilled' ? wpLogin.value : {},
      plugins_total: pluginList.length,
      inactive_plugins: inactivePlugins.map(p => ({ name: p.name, version: p.version })),
      security_plugins: securityPlugins,
      themes: themes.status === 'fulfilled' ? themes.value.map((t: any) => ({ name: t.name, status: t.status, version: t.version })) : [],
      admin_users: adminUsers.length,
      total_users: userList.length,
      user_roles: this.countRoles(userList),
      audit_timestamp: new Date().toISOString(),
    };

    const headerData = rawData.security_headers as Record<string, any>;
    const metrics: Record<string, number> = {
      ssl_enabled: rawData.ssl.isSecure ? 1 : 0,
      inactive_plugins_count: inactivePlugins.length,
      has_security_plugin: securityPlugins.length > 0 ? 1 : 0,
      admin_user_count: adminUsers.length,
      has_x_content_type: headerData['xContentType'] ? 1 : 0,
      has_x_frame_options: headerData['xFrameOptions'] ? 1 : 0,
      has_strict_transport: headerData['hsts'] ? 1 : 0,
      has_csp: headerData['csp'] ? 1 : 0,
      login_accessible: (rawData.login_page as any).accessible ? 1 : 0,
    };

    return { rawData, metrics };
  }

  private detectSecurityPlugins(plugins: any[]): string[] {
    const secPlugins = ['really-simple-ssl', 'wordfence', 'sucuri', 'ithemes-security', 'all-in-one-wp-security'];
    return plugins
      .filter(p => p.status === 'active' && secPlugins.some(sp => p.plugin?.toLowerCase().includes(sp)))
      .map(p => p.name);
  }

  private countRoles(users: any[]): Record<string, number> {
    const roles: Record<string, number> = {};
    for (const user of users) {
      for (const role of (user.roles || [])) {
        roles[role] = (roles[role] || 0) + 1;
      }
    }
    return roles;
  }

  private async checkSecurityHeaders(siteUrl: string) {
    try {
      const res = await axios.head(siteUrl, { timeout: 10000, maxRedirects: 5 });
      const h = res.headers;
      return {
        xContentType: h['x-content-type-options'] || null,
        xFrameOptions: h['x-frame-options'] || null,
        hsts: h['strict-transport-security'] || null,
        csp: h['content-security-policy'] || null,
        referrerPolicy: h['referrer-policy'] || null,
        permissionsPolicy: h['permissions-policy'] || null,
        xXssProtection: h['x-xss-protection'] || null,
        server: h['server'] || null,
      };
    } catch {
      return {};
    }
  }

  private async checkLoginPage(siteUrl: string) {
    try {
      const res = await axios.get(`${siteUrl}/wp-login.php`, {
        timeout: 10000,
        maxRedirects: 5,
        validateStatus: () => true,
      });
      return {
        accessible: res.status === 200,
        statusCode: res.status,
        redirected: res.request?.res?.responseUrl !== `${siteUrl}/wp-login.php`,
      };
    } catch {
      return { accessible: false };
    }
  }
}
