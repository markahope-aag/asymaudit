import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { logger } from '../utils/logger';
import { withRetry, RetryableError } from '../utils/retry';

export interface WordPressCredentials {
  url: string;
  rest_api_key?: string;
  username?: string;
  password?: string;
  application_password?: string;
}

export interface WordPressConfig {
  check_plugins?: boolean;
  check_themes?: boolean;
  check_updates?: boolean;
  check_security?: boolean;
  timeout?: number;
}

export interface WordPressSiteInfo {
  name: string;
  description: string;
  url: string;
  home: string;
  gmt_offset: number;
  timezone_string: string;
  namespaces: string[];
  authentication: Record<string, any>;
  routes: Record<string, any>;
}

export interface WordPressPlugin {
  plugin: string;
  status: 'active' | 'inactive';
  name: string;
  plugin_uri: string;
  version: string;
  description: string;
  author: string;
  author_uri: string;
  network_only: boolean;
  requires_wp: string;
  requires_php: string;
  text_domain: string;
}

export interface WordPressTheme {
  stylesheet: string;
  template: string;
  name: string;
  theme_uri: string;
  description: string;
  author: string;
  author_uri: string;
  version: string;
  status: 'active' | 'inactive';
  tags: string[];
  text_domain: string;
  requires_wp: string;
  requires_php: string;
}

export interface WordPressUser {
  id: number;
  username: string;
  name: string;
  first_name: string;
  last_name: string;
  email: string;
  url: string;
  description: string;
  link: string;
  locale: string;
  nickname: string;
  slug: string;
  roles: string[];
  capabilities: Record<string, boolean>;
  extra_capabilities: Record<string, boolean>;
  avatar_urls: Record<string, string>;
  meta: Record<string, any>;
}

export interface WordPressSiteHealth {
  status: 'good' | 'should_be_improved' | 'critical';
  total_tests: number;
  tests: {
    direct: Record<string, any>;
    async: Record<string, any>;
  };
}

export class WordPressClient {
  private client: AxiosInstance;
  private baseUrl: string;
  private logger = logger.child({ module: 'wordpress-client' });

  constructor(
    private credentials: WordPressCredentials,
    private config: WordPressConfig = {}
  ) {
    this.baseUrl = credentials.url.replace(/\/$/, '');
    
    this.client = axios.create({
      baseURL: `${this.baseUrl}/wp-json`,
      timeout: config.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'AsymAudit/1.0',
      },
    });

    this.setupAuthentication();
    this.setupInterceptors();
  }

  private setupAuthentication(): void {
    if (this.credentials.rest_api_key) {
      // Custom REST API key
      this.client.defaults.headers.common['Authorization'] = `Bearer ${this.credentials.rest_api_key}`;
    } else if (this.credentials.username && this.credentials.application_password) {
      // Application password (recommended)
      const auth = Buffer.from(`${this.credentials.username}:${this.credentials.application_password}`).toString('base64');
      this.client.defaults.headers.common['Authorization'] = `Basic ${auth}`;
    } else if (this.credentials.username && this.credentials.password) {
      // Basic auth (less secure)
      const auth = Buffer.from(`${this.credentials.username}:${this.credentials.password}`).toString('base64');
      this.client.defaults.headers.common['Authorization'] = `Basic ${auth}`;
    }
  }

  private setupInterceptors(): void {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        this.logger.debug({ 
          method: config.method?.toUpperCase(),
          url: config.url,
        }, 'WordPress API request');
        return config;
      },
      (error) => {
        this.logger.error({ error }, 'WordPress API request error');
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        this.logger.debug({ 
          status: response.status,
          url: response.config.url,
        }, 'WordPress API response');
        return response;
      },
      (error) => {
        const status = error.response?.status;
        const message = error.response?.data?.message || error.message;
        
        this.logger.error({ 
          status,
          message,
          url: error.config?.url,
        }, 'WordPress API response error');

        // Determine if error is retryable
        if (status >= 500 || status === 429 || error.code === 'ECONNRESET') {
          throw new RetryableError(`WordPress API error: ${message}`);
        }

        throw error;
      }
    );
  }

  async getSiteInfo(): Promise<WordPressSiteInfo> {
    return withRetry(async () => {
      const response: AxiosResponse<WordPressSiteInfo> = await this.client.get('/wp/v2');
      return response.data;
    }, {}, 'get site info');
  }

  async getPlugins(): Promise<WordPressPlugin[]> {
    if (!this.config.check_plugins) {
      return [];
    }

    return withRetry(async () => {
      const response: AxiosResponse<WordPressPlugin[]> = await this.client.get('/wp/v2/plugins');
      return response.data;
    }, {}, 'get plugins');
  }

  async getThemes(): Promise<WordPressTheme[]> {
    if (!this.config.check_themes) {
      return [];
    }

    return withRetry(async () => {
      const response: AxiosResponse<WordPressTheme[]> = await this.client.get('/wp/v2/themes');
      return response.data;
    }, {}, 'get themes');
  }

  async getUsers(): Promise<WordPressUser[]> {
    return withRetry(async () => {
      const response: AxiosResponse<WordPressUser[]> = await this.client.get('/wp/v2/users');
      return response.data;
    }, {}, 'get users');
  }

  async getSiteHealth(): Promise<WordPressSiteHealth | null> {
    try {
      return await withRetry(async () => {
        const response: AxiosResponse<WordPressSiteHealth> = await this.client.get('/wp-site-health/v1/tests/direct');
        return response.data;
      }, {}, 'get site health');
    } catch (error) {
      // Site health endpoint might not be available
      this.logger.warn('Site health endpoint not available');
      return null;
    }
  }

  async getSystemStatus(): Promise<Record<string, any>> {
    try {
      return await withRetry(async () => {
        // Try to get system status from various possible endpoints
        const endpoints = [
          '/wp/v2/system-status',
          '/wp-site-health/v1/directory-sizes',
          '/wp-site-health/v1/tests/background-updates',
        ];

        const results: Record<string, any> = {};

        for (const endpoint of endpoints) {
          try {
            const response = await this.client.get(endpoint);
            const endpointName = endpoint.split('/').pop() || 'unknown';
            results[endpointName] = response.data;
          } catch (error) {
            // Endpoint not available, continue
            continue;
          }
        }

        return results;
      }, {}, 'get system status');
    } catch (error) {
      this.logger.warn('System status endpoints not available');
      return {};
    }
  }

  async checkSslCertificate(): Promise<{
    isSecure: boolean;
    certificate?: any;
    error?: string;
  }> {
    try {
      const isHttps = this.baseUrl.startsWith('https://');
      
      if (!isHttps) {
        return {
          isSecure: false,
          error: 'Site is not using HTTPS',
        };
      }

      // Make a simple request to check SSL
      await withRetry(async () => {
        await this.client.get('/wp/v2', {
          timeout: 10000,
        });
      }, {}, 'check SSL');

      return {
        isSecure: true,
      };
    } catch (error) {
      return {
        isSecure: false,
        error: error instanceof Error ? error.message : 'SSL check failed',
      };
    }
  }

  async getPostsCount(): Promise<number> {
    try {
      const response = await this.client.head('/wp/v2/posts');
      const totalPosts = response.headers['x-wp-total'];
      return totalPosts ? parseInt(totalPosts, 10) : 0;
    } catch (error) {
      this.logger.warn('Failed to get posts count');
      return 0;
    }
  }

  async getPagesCount(): Promise<number> {
    try {
      const response = await this.client.head('/wp/v2/pages');
      const totalPages = response.headers['x-wp-total'];
      return totalPages ? parseInt(totalPages, 10) : 0;
    } catch (error) {
      this.logger.warn('Failed to get pages count');
      return 0;
    }
  }

  async getMediaCount(): Promise<number> {
    try {
      const response = await this.client.head('/wp/v2/media');
      const totalMedia = response.headers['x-wp-total'];
      return totalMedia ? parseInt(totalMedia, 10) : 0;
    } catch (error) {
      this.logger.warn('Failed to get media count');
      return 0;
    }
  }

  async testConnection(): Promise<{
    success: boolean;
    responseTime: number;
    error?: string;
  }> {
    const startTime = Date.now();
    
    try {
      await this.getSiteInfo();
      const responseTime = Date.now() - startTime;
      
      return {
        success: true,
        responseTime,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      return {
        success: false,
        responseTime,
        error: error instanceof Error ? error.message : 'Connection test failed',
      };
    }
  }
}