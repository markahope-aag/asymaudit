import { BaseAudit, AuditResult } from '../base-audit';
import { GTMClient, GTMCredentials } from '../../integrations/gtm-client';

export class GTMContainerAudit extends BaseAudit {
  getAuditType(): string {
    return 'gtm_container';
  }

  async collect(): Promise<AuditResult> {
    this.logger.info('Starting GTM container audit');

    const integration = await this.getIntegration('google_tag_manager');
    if (!integration) throw new Error('GTM integration not found');

    const gtm = new GTMClient(integration.credentials as GTMCredentials);

    const [container, workspaces, versionHeaders] = await Promise.allSettled([
      gtm.getContainer(),
      gtm.getWorkspaces(),
      gtm.getVersionHeaders(),
    ]);

    // Get tags and triggers from the default workspace
    const ws = workspaces.status === 'fulfilled' ? workspaces.value : [];
    const defaultWs = ws[0];
    const wsId = defaultWs?.workspaceId || '0';

    const [tags, triggers, variables] = await Promise.allSettled([
      gtm.getTags(wsId),
      gtm.getTriggers(wsId),
      gtm.getVariables(wsId),
    ]);

    const tagList = tags.status === 'fulfilled' ? tags.value : [];
    const triggerList = triggers.status === 'fulfilled' ? triggers.value : [];

    // Analyze tags
    const ga4Tags = tagList.filter((t: any) => t.type === 'gaawc' || t.type === 'gaawe');
    const adsTags = tagList.filter((t: any) => t.type?.startsWith('awct') || t.type?.startsWith('gclidw'));
    const pausedTags = tagList.filter((t: any) => t.paused);
    const customHtmlTags = tagList.filter((t: any) => t.type === 'html');

    // Find orphaned triggers (not referenced by any tag)
    const usedTriggerIds = new Set<string>();
    for (const tag of tagList) {
      for (const ft of (tag as any).firingTriggerId || []) usedTriggerIds.add(ft);
      for (const bt of (tag as any).blockingTriggerId || []) usedTriggerIds.add(bt);
    }
    const orphanedTriggers = triggerList.filter((t: any) => !usedTriggerIds.has(t.triggerId));

    const rawData = {
      container: container.status === 'fulfilled' ? container.value : null,
      workspaces: ws,
      versions_count: versionHeaders.status === 'fulfilled' ? versionHeaders.value.length : 0,
      tags: {
        total: tagList.length,
        ga4: ga4Tags.length,
        ads: adsTags.length,
        paused: pausedTags.length,
        custom_html: customHtmlTags.length,
        list: tagList.map((t: any) => ({ name: t.name, type: t.type, paused: t.paused || false })),
      },
      triggers: {
        total: triggerList.length,
        orphaned: orphanedTriggers.length,
        orphaned_list: orphanedTriggers.map((t: any) => ({ name: t.name, type: t.type })),
      },
      variables: {
        total: variables.status === 'fulfilled' ? variables.value.length : 0,
      },
      audit_timestamp: new Date().toISOString(),
    };

    const metrics: Record<string, number> = {
      tags_total: rawData.tags.total,
      tags_ga4: rawData.tags.ga4,
      tags_ads: rawData.tags.ads,
      tags_paused: rawData.tags.paused,
      tags_custom_html: rawData.tags.custom_html,
      triggers_total: rawData.triggers.total,
      triggers_orphaned: rawData.triggers.orphaned,
      variables_total: rawData.variables.total,
    };

    return { rawData, metrics };
  }
}
