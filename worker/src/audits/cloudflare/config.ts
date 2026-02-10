import { BaseAudit, AuditResult } from '../base-audit';
import { CloudFlareClient, CloudFlareCredentials } from '../../integrations/cloudflare-client';

export class CloudFlareConfigAudit extends BaseAudit {
  getAuditType(): string {
    return 'cloudflare_config';
  }

  async collect(): Promise<AuditResult> {
    this.logger.info('Starting CloudFlare configuration audit');

    const integration = await this.getIntegration('cloudflare');
    if (!integration) throw new Error('CloudFlare integration not found');

    const cf = new CloudFlareClient(integration.credentials as CloudFlareCredentials);

    const [settings, ssl, securityLevel, minTls, caching, browserCache, firewallRules, pageRules, dnsRecords, transformRules, analytics] =
      await Promise.allSettled([
        cf.getZoneSettings(),
        cf.getSSLSettings(),
        cf.getSecurityLevel(),
        cf.getMinTLSVersion(),
        cf.getCachingLevel(),
        cf.getBrowserCacheTTL(),
        cf.getFirewallRules(),
        cf.getPageRules(),
        cf.getDNSRecords(),
        cf.getTransformRules(),
        cf.getZoneAnalytics(7),
      ]);

    // Extract key settings from zone settings array
    const settingsArray = settings.status === 'fulfilled' ? settings.value : [];
    const settingsMap: Record<string, any> = {};
    for (const s of settingsArray) {
      if (s && typeof s === 'object' && 'id' in s) {
        settingsMap[(s as any).id] = (s as any).value;
      }
    }

    const rawData = {
      ssl: ssl.status === 'fulfilled' ? ssl.value : null,
      security_level: securityLevel.status === 'fulfilled' ? securityLevel.value : null,
      min_tls_version: minTls.status === 'fulfilled' ? minTls.value : null,
      caching_level: caching.status === 'fulfilled' ? caching.value : null,
      browser_cache_ttl: browserCache.status === 'fulfilled' ? browserCache.value : null,
      key_settings: {
        rocket_loader: settingsMap['rocket_loader'],
        minify: settingsMap['minify'],
        auto_minify: settingsMap['auto_minify'],
        always_use_https: settingsMap['always_use_https'],
        opportunistic_encryption: settingsMap['opportunistic_encryption'],
        http2: settingsMap['http2'],
        http3: settingsMap['http3'],
        brotli: settingsMap['brotli'],
        early_hints: settingsMap['early_hints'],
        websockets: settingsMap['websockets'],
      },
      firewall_rules_count: firewallRules.status === 'fulfilled' ? firewallRules.value.length : 0,
      page_rules: pageRules.status === 'fulfilled' ? pageRules.value : [],
      dns_records_count: dnsRecords.status === 'fulfilled' ? dnsRecords.value.length : 0,
      transform_rules: transformRules.status === 'fulfilled' ? transformRules.value : [],
      analytics: analytics.status === 'fulfilled' ? analytics.value : null,
      audit_timestamp: new Date().toISOString(),
    };

    const metrics: Record<string, number> = {
      ssl_mode: rawData.ssl?.value === 'full' || rawData.ssl?.value === 'strict' ? 1 : 0,
      always_https: settingsMap['always_use_https'] === 'on' ? 1 : 0,
      http2_enabled: settingsMap['http2'] === 'on' ? 1 : 0,
      brotli_enabled: settingsMap['brotli'] === 'on' ? 1 : 0,
      rocket_loader_off: settingsMap['rocket_loader'] === 'off' ? 1 : 0, // Should be OFF
      firewall_rules: rawData.firewall_rules_count,
      page_rules: rawData.page_rules.length,
      dns_records: rawData.dns_records_count,
    };

    return { rawData, metrics };
  }
}
