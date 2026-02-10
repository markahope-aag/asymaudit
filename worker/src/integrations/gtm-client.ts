import { google } from 'googleapis';
import { logger } from '../utils/logger';
import { withRetry } from '../utils/retry';

export interface GTMCredentials {
  account_id: string;
  container_id: string;
  service_account_email?: string;
  service_account_key?: string;
}

export class GTMClient {
  private tagmanager: ReturnType<typeof google.tagmanager>;
  private accountId: string;
  private containerId: string;
  private log = logger.child({ module: 'gtm-client' });

  constructor(credentials: GTMCredentials) {
    this.accountId = credentials.account_id;
    this.containerId = credentials.container_id;

    const auth = credentials.service_account_key
      ? new google.auth.GoogleAuth({
          credentials: JSON.parse(credentials.service_account_key),
          scopes: ['https://www.googleapis.com/auth/tagmanager.readonly'],
        })
      : new google.auth.GoogleAuth({
          scopes: ['https://www.googleapis.com/auth/tagmanager.readonly'],
        });

    this.tagmanager = google.tagmanager({ version: 'v2', auth });
  }

  private get containerPath() {
    return `accounts/${this.accountId}/containers/${this.containerId}`;
  }

  async getContainer() {
    return withRetry(async () => {
      const res = await this.tagmanager.accounts.containers.get({
        path: this.containerPath,
      });
      return res.data;
    }, {}, 'get GTM container');
  }

  async getWorkspaces() {
    return withRetry(async () => {
      const res = await this.tagmanager.accounts.containers.workspaces.list({
        parent: this.containerPath,
      });
      return res.data.workspace || [];
    }, {}, 'get GTM workspaces');
  }

  async getTags(workspaceId: string) {
    return withRetry(async () => {
      const res = await this.tagmanager.accounts.containers.workspaces.tags.list({
        parent: `${this.containerPath}/workspaces/${workspaceId}`,
      });
      return res.data.tag || [];
    }, {}, 'get GTM tags');
  }

  async getTriggers(workspaceId: string) {
    return withRetry(async () => {
      const res = await this.tagmanager.accounts.containers.workspaces.triggers.list({
        parent: `${this.containerPath}/workspaces/${workspaceId}`,
      });
      return res.data.trigger || [];
    }, {}, 'get GTM triggers');
  }

  async getVariables(workspaceId: string) {
    return withRetry(async () => {
      const res = await this.tagmanager.accounts.containers.workspaces.variables.list({
        parent: `${this.containerPath}/workspaces/${workspaceId}`,
      });
      return res.data.variable || [];
    }, {}, 'get GTM variables');
  }

  async getVersionHeaders() {
    return withRetry(async () => {
      const res = await this.tagmanager.accounts.containers.version_headers.list({
        parent: this.containerPath,
      });
      return res.data.containerVersionHeader || [];
    }, {}, 'get GTM version headers');
  }
}
