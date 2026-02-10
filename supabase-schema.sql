-- AsymAudit Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable Row Level Security on all tables by default
-- Note: You'll need to add specific RLS policies based on your auth requirements

-- Clients table
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  website_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- Client integrations table - stores API credentials per platform
CREATE TABLE client_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN (
    'wordpress', 'google_analytics', 'google_ads',
    'google_tag_manager', 'google_search_console',
    'moz', 'spyfu', 'semrush'
  )),
  credentials JSONB NOT NULL DEFAULT '{}',
  config JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(client_id, platform)
);

ALTER TABLE client_integrations ENABLE ROW LEVEL SECURITY;

-- Audit schedules table
CREATE TABLE audit_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  audit_type TEXT NOT NULL CHECK (audit_type IN (
    'wordpress_health', 'wordpress_seo', 'wordpress_performance',
    'wordpress_security', 'ga4_config', 'ga4_data_quality',
    'google_ads_account', 'google_ads_campaigns',
    'gtm_container', 'gsc_coverage', 'seo_technical',
    'seo_backlinks', 'full_suite'
  )),
  cron_expression TEXT NOT NULL DEFAULT '0 2 * * 1',  -- Weekly Monday 2am
  is_active BOOLEAN DEFAULT true,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE audit_schedules ENABLE ROW LEVEL SECURITY;

-- Audit runs table - tracks each execution
CREATE TABLE audit_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  audit_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'collecting', 'analyzing', 'complete', 'failed'
  )),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  raw_data JSONB,             -- Raw API responses and collected data
  ai_analysis JSONB,          -- Structured AI analysis output
  overall_score INTEGER,      -- 0-100 health score
  scores JSONB,               -- Category-level scores
  issues JSONB,               -- Array of identified issues
  recommendations JSONB,      -- Array of AI recommendations
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE audit_runs ENABLE ROW LEVEL SECURITY;

-- Indexes for audit_runs
CREATE INDEX idx_audit_runs_client_type ON audit_runs(client_id, audit_type);
CREATE INDEX idx_audit_runs_created ON audit_runs(created_at DESC);
CREATE INDEX idx_audit_runs_status ON audit_runs(status);

-- Audit snapshots table - flattened metrics for trending
CREATE TABLE audit_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_run_id UUID REFERENCES audit_runs(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  audit_type TEXT NOT NULL,
  metric_key TEXT NOT NULL,        -- e.g., 'page_speed_score', 'broken_links_count'
  metric_value NUMERIC NOT NULL,
  captured_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE audit_snapshots ENABLE ROW LEVEL SECURITY;

-- Index for trending queries
CREATE INDEX idx_snapshots_trending ON audit_snapshots(client_id, audit_type, metric_key, captured_at);

-- Audit diffs table - stores changes between runs
CREATE TABLE audit_diffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  audit_type TEXT NOT NULL,
  current_run_id UUID REFERENCES audit_runs(id),
  previous_run_id UUID REFERENCES audit_runs(id),
  changes JSONB NOT NULL,         -- { added: [], removed: [], changed: [] }
  severity TEXT CHECK (severity IN ('info', 'warning', 'critical')),
  summary TEXT,                   -- AI-generated summary of what changed
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE audit_diffs ENABLE ROW LEVEL SECURITY;

-- Index for diff queries
CREATE INDEX idx_audit_diffs_client_type ON audit_diffs(client_id, audit_type, created_at DESC);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON clients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_client_integrations_updated_at BEFORE UPDATE ON client_integrations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Sample data for testing
INSERT INTO clients (name, slug, website_url) VALUES 
  ('Acme Corporation', 'acme-corp', 'https://acme.com'),
  ('Tech Startup Inc', 'tech-startup', 'https://techstartup.io');

-- Sample client integration (WordPress)
INSERT INTO client_integrations (client_id, platform, credentials, config) 
SELECT 
  id,
  'wordpress',
  '{"url": "https://acme.com", "rest_api_key": "placeholder-key"}',
  '{"check_plugins": true, "check_themes": true}'
FROM clients WHERE slug = 'acme-corp';

-- Sample audit schedule (weekly WordPress health check)
INSERT INTO audit_schedules (client_id, audit_type, cron_expression)
SELECT 
  id,
  'wordpress_health',
  '0 2 * * 1'  -- Every Monday at 2 AM
FROM clients WHERE slug = 'acme-corp';