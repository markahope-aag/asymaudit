import { createClient } from '@supabase/supabase-js';
import { env } from './env';

export interface Database {
  public: {
    Tables: {
      clients: {
        Row: {
          id: string;
          name: string;
          slug: string;
          website_url: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          website_url?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          website_url?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      client_integrations: {
        Row: {
          id: string;
          client_id: string;
          platform: 'wordpress' | 'google_analytics' | 'google_ads' | 'google_tag_manager' | 'google_search_console' | 'moz' | 'spyfu' | 'semrush';
          credentials: Record<string, any>;
          config: Record<string, any>;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          platform: 'wordpress' | 'google_analytics' | 'google_ads' | 'google_tag_manager' | 'google_search_console' | 'moz' | 'spyfu' | 'semrush';
          credentials?: Record<string, any>;
          config?: Record<string, any>;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          client_id?: string;
          platform?: 'wordpress' | 'google_analytics' | 'google_ads' | 'google_tag_manager' | 'google_search_console' | 'moz' | 'spyfu' | 'semrush';
          credentials?: Record<string, any>;
          config?: Record<string, any>;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      audit_schedules: {
        Row: {
          id: string;
          client_id: string;
          audit_type: string;
          cron_expression: string;
          is_active: boolean;
          last_run_at: string | null;
          next_run_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          audit_type: string;
          cron_expression?: string;
          is_active?: boolean;
          last_run_at?: string | null;
          next_run_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          client_id?: string;
          audit_type?: string;
          cron_expression?: string;
          is_active?: boolean;
          last_run_at?: string | null;
          next_run_at?: string | null;
          created_at?: string;
        };
      };
      audit_runs: {
        Row: {
          id: string;
          client_id: string;
          audit_type: string;
          status: 'pending' | 'collecting' | 'analyzing' | 'complete' | 'failed';
          started_at: string | null;
          completed_at: string | null;
          raw_data: Record<string, any> | null;
          ai_analysis: Record<string, any> | null;
          overall_score: number | null;
          scores: Record<string, any> | null;
          issues: Record<string, any> | null;
          recommendations: Record<string, any> | null;
          error_message: string | null;
          metadata: Record<string, any>;
          created_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          audit_type: string;
          status?: 'pending' | 'collecting' | 'analyzing' | 'complete' | 'failed';
          started_at?: string | null;
          completed_at?: string | null;
          raw_data?: Record<string, any> | null;
          ai_analysis?: Record<string, any> | null;
          overall_score?: number | null;
          scores?: Record<string, any> | null;
          issues?: Record<string, any> | null;
          recommendations?: Record<string, any> | null;
          error_message?: string | null;
          metadata?: Record<string, any>;
          created_at?: string;
        };
        Update: {
          id?: string;
          client_id?: string;
          audit_type?: string;
          status?: 'pending' | 'collecting' | 'analyzing' | 'complete' | 'failed';
          started_at?: string | null;
          completed_at?: string | null;
          raw_data?: Record<string, any> | null;
          ai_analysis?: Record<string, any> | null;
          overall_score?: number | null;
          scores?: Record<string, any> | null;
          issues?: Record<string, any> | null;
          recommendations?: Record<string, any> | null;
          error_message?: string | null;
          metadata?: Record<string, any>;
          created_at?: string;
        };
      };
      audit_snapshots: {
        Row: {
          id: string;
          audit_run_id: string;
          client_id: string;
          audit_type: string;
          metric_key: string;
          metric_value: number;
          captured_at: string;
        };
        Insert: {
          id?: string;
          audit_run_id: string;
          client_id: string;
          audit_type: string;
          metric_key: string;
          metric_value: number;
          captured_at?: string;
        };
        Update: {
          id?: string;
          audit_run_id?: string;
          client_id?: string;
          audit_type?: string;
          metric_key?: string;
          metric_value?: number;
          captured_at?: string;
        };
      };
      audit_diffs: {
        Row: {
          id: string;
          client_id: string;
          audit_type: string;
          current_run_id: string | null;
          previous_run_id: string | null;
          changes: Record<string, any>;
          severity: 'info' | 'warning' | 'critical' | null;
          summary: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          audit_type: string;
          current_run_id?: string | null;
          previous_run_id?: string | null;
          changes: Record<string, any>;
          severity?: 'info' | 'warning' | 'critical' | null;
          summary?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          client_id?: string;
          audit_type?: string;
          current_run_id?: string | null;
          previous_run_id?: string | null;
          changes?: Record<string, any>;
          severity?: 'info' | 'warning' | 'critical' | null;
          summary?: string | null;
          created_at?: string;
        };
      };
    };
  };
}

export const supabase = createClient<any>(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);