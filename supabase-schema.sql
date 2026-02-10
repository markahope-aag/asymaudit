-- AsymAudit Database Schema
-- Supabase PostgreSQL schema for marketing audit automation engine

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- =============================================
-- CLIENTS TABLE
-- =============================================
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

-- Create updated_at trigger
CREATE TRIGGER update_clients_updated_at 
    BEFORE UPDATE ON clients 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- CLIENT INTEGRATIONS TABLE
-- =============================================
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

-- Enable RLS
ALTER TABLE client_integrations ENABLE ROW LEVEL SECURITY;

-- Create updated_at trigger
CREATE TRIGGER update_client_integrations_updated_at 
    BEFORE UPDATE ON client_integrations 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- AUDIT SCHEDULES TABLE
-- =============================================
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

-- Enable RLS
ALTER TABLE audit_schedules ENABLE ROW LEVEL SECURITY;

-- =============================================
-- AUDIT RUNS TABLE
-- =============================================
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

-- Enable RLS
ALTER TABLE audit_runs ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX idx_audit_runs_client_type ON audit_runs(client_id, audit_type);
CREATE INDEX idx_audit_runs_created ON audit_runs(created_at DESC);
CREATE INDEX idx_audit_runs_status ON audit_runs(status);

-- =============================================
-- AUDIT SNAPSHOTS TABLE
-- =============================================
CREATE TABLE audit_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_run_id UUID REFERENCES audit_runs(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    audit_type TEXT NOT NULL,
    metric_key TEXT NOT NULL,        -- e.g., 'page_speed_score', 'broken_links_count'
    metric_value NUMERIC NOT NULL,
    captured_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE audit_snapshots ENABLE ROW LEVEL SECURITY;

-- Create index for trending queries
CREATE INDEX idx_snapshots_trending ON audit_snapshots(client_id, audit_type, metric_key, captured_at);

-- =============================================
-- AUDIT DIFFS TABLE
-- =============================================
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

-- Enable RLS
ALTER TABLE audit_diffs ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX idx_audit_diffs_client ON audit_diffs(client_id, audit_type);
CREATE INDEX idx_audit_diffs_current ON audit_diffs(current_run_id);

-- =============================================
-- SAMPLE DATA
-- =============================================

-- Insert sample client
INSERT INTO clients (name, slug, website_url) VALUES 
('Acme Corporation', 'acme-corp', 'https://acme.example.com'),
('Beta Industries', 'beta-industries', 'https://beta.example.com');

-- Insert sample integrations
INSERT INTO client_integrations (client_id, platform, credentials, config) 
SELECT 
    c.id,
    'wordpress',
    '{"url": "https://acme.example.com", "rest_api_key": "wp_xxxxxxxxxxxxx"}',
    '{"check_plugins": true, "check_themes": true}'
FROM clients c WHERE c.slug = 'acme-corp';

INSERT INTO client_integrations (client_id, platform, credentials, config) 
SELECT 
    c.id,
    'google_analytics',
    '{"property_id": "123456789", "service_account": {"type": "service_account"}}',
    '{"reports": ["traffic", "conversions"]}'
FROM clients c WHERE c.slug = 'acme-corp';

-- Insert sample schedules
INSERT INTO audit_schedules (client_id, audit_type, cron_expression) 
SELECT 
    c.id,
    'wordpress_health',
    '0 2 * * 1'  -- Monday 2am
FROM clients c WHERE c.slug = 'acme-corp';

INSERT INTO audit_schedules (client_id, audit_type, cron_expression) 
SELECT 
    c.id,
    'ga4_config',
    '0 3 * * 1'  -- Monday 3am
FROM clients c WHERE c.slug = 'acme-corp';

-- =============================================
-- RLS POLICIES (Basic - expand based on auth requirements)
-- =============================================

-- Allow all operations for service role (worker service)
CREATE POLICY "Service role can do everything on clients" ON clients FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY "Service role can do everything on integrations" ON client_integrations FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY "Service role can do everything on schedules" ON audit_schedules FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY "Service role can do everything on runs" ON audit_runs FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY "Service role can do everything on snapshots" ON audit_snapshots FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY "Service role can do everything on diffs" ON audit_diffs FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Allow read access for authenticated users (dashboard)
CREATE POLICY "Authenticated users can read clients" ON clients FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can read integrations" ON client_integrations FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can read schedules" ON audit_schedules FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can read runs" ON audit_runs FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can read snapshots" ON audit_snapshots FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can read diffs" ON audit_diffs FOR SELECT USING (auth.role() = 'authenticated');