# AsymAudit - Marketing Audit Automation Engine

AsymAudit is a comprehensive automated marketing audit engine that runs scheduled audits across client WordPress sites, Google Tag Manager, Google Analytics 4, Google Ads, and SEO tools. The system collects raw data, stores it in Supabase, runs AI-powered analysis via the Anthropic API, and surfaces results through a Next.js dashboard with historical trending.

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│  NEXT.JS FRONTEND (Vercel)                          │
│  - Dashboard: audit results, scores, trends         │
│  - Client views with role-based access              │
│  - Alerts & regression notifications                │
│  - Manual audit trigger UI                          │
└──────────────────────┬──────────────────────────────┘
                       │ Supabase Client
┌──────────────────────▼──────────────────────────────┐
│  SUPABASE (Data Layer)                              │
│  - Audit results (raw + AI analysis)                │
│  - Client/site configurations                       │
│  - Historical snapshots for trending                │
│  - Audit schedules & job status                     │
└──────────────────────┬──────────────────────────────┘
                       │ Supabase Client
┌──────────────────────▼──────────────────────────────┐
│  NODE.JS WORKER SERVICE (Hetzner/Coolify)           │
│  - Scheduled audit runners (node-cron)              │
│  - Job queue (BullMQ + Redis)                       │
│  - API integrations (GA4, Ads, GTM, WP, SEO)       │
│  - Anthropic API calls for AI analysis              │
│  - Webhook endpoints for manual triggers            │
└─────────────────────────────────────────────────────┘
```

## Tech Stack

- **Frontend**: Next.js 14+ (App Router), TypeScript, Tailwind CSS, Recharts
- **Backend/Data**: Supabase (Postgres + Auth + RLS + Realtime)
- **Worker Service**: Node.js, TypeScript, BullMQ, Redis, node-cron
- **AI**: Anthropic Claude API (claude-3-5-sonnet-20241022)
- **Deployment**: Vercel (frontend), Hetzner/Coolify (worker), Supabase Cloud (database)

## Project Structure

```
/
├── supabase-schema.sql          # Database schema and initial data
├── worker/                      # Node.js worker service
│   ├── src/
│   │   ├── audits/             # Audit implementations
│   │   │   ├── base-audit.ts   # Abstract base class
│   │   │   └── wordpress/      # WordPress audit types
│   │   ├── analysis/           # AI analysis and diffing
│   │   ├── config/             # Configuration and clients
│   │   ├── integrations/       # API clients (WP, Google, etc.)
│   │   ├── queue/              # BullMQ job processing
│   │   ├── scheduler/          # Cron scheduling
│   │   └── utils/              # Logging, retry, notifications
│   └── package.json
└── frontend/                   # Next.js dashboard
    ├── src/
    │   ├── app/               # Next.js app router pages
    │   ├── components/        # React components
    │   ├── lib/              # Utilities and Supabase client
    │   └── types/            # TypeScript type definitions
    └── package.json
```

## Quick Start

### 1. Database Setup

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Run the SQL schema in your Supabase SQL Editor:
   ```sql
   -- Copy and paste the contents of supabase-schema.sql
   ```

### 2. Worker Service Setup

1. Navigate to the worker directory:
   ```bash
   cd worker
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy environment variables:
   ```bash
   cp .env.example .env
   ```

4. Configure your `.env` file with:
   - Supabase URL and service role key
   - Redis connection URL
   - Anthropic API key
   - Google API credentials
   - External API keys (Moz, SpyFu, etc.)

5. Start the worker service:
   ```bash
   # Development
   npm run dev
   
   # Production
   npm run build
   npm start
   ```

### 3. Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy environment variables:
   ```bash
   cp .env.local.example .env.local
   ```

4. Configure your `.env.local` file with:
   - Supabase URL and anon key
   - Worker service URL and API key

5. Start the development server:
   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000) in your browser

## Available Audit Types

### WordPress Audits
- `wordpress_health` - Core health, plugins, themes, system status ✅ **IMPLEMENTED**
- `wordpress_seo` - SEO configuration, meta tags, sitemaps
- `wordpress_performance` - Page speed, Core Web Vitals
- `wordpress_security` - Security headers, vulnerabilities, SSL

### Google Analytics Audits
- `ga4_config` - Property configuration, data streams
- `ga4_data_quality` - Event tracking, conversion setup

### Google Ads Audits
- `google_ads_account` - Account structure and settings
- `google_ads_campaigns` - Campaign performance and quality

### Other Audits
- `gtm_container` - Google Tag Manager configuration
- `gsc_coverage` - Search Console index coverage
- `seo_technical` - Technical SEO (robots.txt, canonicals, etc.)
- `seo_backlinks` - Backlink profile analysis

## API Documentation

### Worker Service Endpoints

- `GET /health` - Health check
- `GET /api/queue/status` - Queue statistics
- `POST /api/audit/trigger` - Trigger single audit
- `POST /api/audit/trigger-all` - Trigger full audit suite
- `GET /api/audit/status/:runId` - Get audit run status

### Manual Audit Triggers

```bash
# Single audit
curl -X POST http://localhost:3001/api/audit/trigger \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-worker-api-key" \
  -d '{"clientId": "client-uuid", "auditType": "wordpress_health"}'

# Full audit suite
curl -X POST http://localhost:3001/api/audit/trigger-all \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-worker-api-key" \
  -d '{"clientId": "client-uuid"}'
```

## What's Built and Working

✅ **Complete Foundation (Phase 1)**
- Full database schema with 6 tables and proper relationships
- Production-ready worker service with TypeScript, BullMQ, and AI integration
- Working WordPress Health audit - complete end-to-end implementation
- Modern Next.js dashboard with real-time client health visualization
- Comprehensive documentation and setup guides

✅ **Key Features:**
- Scheduled audit execution via cron
- Queue-based job processing with retry logic
- AI-powered analysis with Claude Sonnet
- Diff computation between audit runs
- Real-time dashboard with health scores
- Manual trigger API endpoints

## License

This project is licensed under the MIT License.

## Support

For support and questions:
- Create an issue on GitHub
- Check the documentation
- Review the code comments for implementation details