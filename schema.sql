-- ==============================================================================
-- PublishingFlow - Production-Ready Multi-Client Social Publishing Schema
-- 
-- NORMALIZED ARCHITECTURE:
-- 1. clients (Unlimited clients, name, timestamps)
-- 2. accounts (Social accounts linked to client_id with tokens, connection_type)
-- 3. posts (Posts linked to client_id & account_id, scheduling, retries, audit)
-- 4. audit_logs (Complete audit trail of all actions, publishing attempts, token refreshes)
-- ==============================================================================

-- Enable pgcrypto for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 1. Automated updated_at Function
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- 2. Clients Table (Unlimited Clients Support)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trigger_clients_updated_at ON public.clients;
CREATE TRIGGER trigger_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ==============================================================================
-- 3. Accounts Table (Social Media Accounts)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  client_name TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('Instagram', 'Facebook', 'Threads')),
  connection_type TEXT NOT NULL DEFAULT 'manual' CHECK (connection_type IN ('manual', 'mock', 'oauth')),
  connection_status TEXT NOT NULL DEFAULT 'Connected' CHECK (connection_status IN ('Connected', 'Disconnected', 'Pending')),
  oauth_access_token TEXT,
  oauth_refresh_token TEXT,
  oauth_account_id TEXT,
  oauth_token_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Safe migrations for accounts
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='accounts' AND column_name='client_id') THEN
    ALTER TABLE public.accounts ADD COLUMN client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='accounts' AND column_name='connection_type') THEN
    ALTER TABLE public.accounts ADD COLUMN connection_type TEXT NOT NULL DEFAULT 'manual';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='accounts' AND column_name='oauth_access_token') THEN
    ALTER TABLE public.accounts ADD COLUMN oauth_access_token TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='accounts' AND column_name='oauth_refresh_token') THEN
    ALTER TABLE public.accounts ADD COLUMN oauth_refresh_token TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='accounts' AND column_name='oauth_account_id') THEN
    ALTER TABLE public.accounts ADD COLUMN oauth_account_id TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='accounts' AND column_name='oauth_token_expires_at') THEN
    ALTER TABLE public.accounts ADD COLUMN oauth_token_expires_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='accounts' AND column_name='updated_at') THEN
    ALTER TABLE public.accounts ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;
END $$;

DROP TRIGGER IF EXISTS trigger_accounts_updated_at ON public.accounts;
CREATE TRIGGER trigger_accounts_updated_at
  BEFORE UPDATE ON public.accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ==============================================================================
-- 4. Posts Table (Normalized with Scheduling & Retry Fields)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  client_name TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('Instagram', 'Facebook', 'Threads')),
  title TEXT DEFAULT '',
  caption TEXT DEFAULT '',
  description TEXT DEFAULT '',
  media_url TEXT,
  media_type TEXT CHECK (media_type IN ('image', 'video') OR media_type IS NULL),
  media_name TEXT,
  is_scheduled BOOLEAN NOT NULL DEFAULT false,
  scheduled_at TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'posted', 'failed')),
  retry_count INT NOT NULL DEFAULT 0,
  max_retries INT NOT NULL DEFAULT 3,
  last_error TEXT,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Safe migrations for posts
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='posts' AND column_name='client_id') THEN
    ALTER TABLE public.posts ADD COLUMN client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='posts' AND column_name='account_id') THEN
    ALTER TABLE public.posts ADD COLUMN account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='posts' AND column_name='retry_count') THEN
    ALTER TABLE public.posts ADD COLUMN retry_count INT NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='posts' AND column_name='max_retries') THEN
    ALTER TABLE public.posts ADD COLUMN max_retries INT NOT NULL DEFAULT 3;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='posts' AND column_name='last_error') THEN
    ALTER TABLE public.posts ADD COLUMN last_error TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='posts' AND column_name='published_at') THEN
    ALTER TABLE public.posts ADD COLUMN published_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='posts' AND column_name='updated_at') THEN
    ALTER TABLE public.posts ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;
END $$;

DROP TRIGGER IF EXISTS trigger_posts_updated_at ON public.posts;
CREATE TRIGGER trigger_posts_updated_at
  BEFORE UPDATE ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ==============================================================================
-- 5. Audit Logs Table (Full Traceability & Compliance)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  client_name TEXT,
  platform TEXT,
  status TEXT NOT NULL DEFAULT 'info' CHECK (status IN ('success', 'failed', 'info', 'warning')),
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 6. Indexes for Maximum Performance
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_clients_name ON public.clients(name);
CREATE INDEX IF NOT EXISTS idx_accounts_client_id ON public.accounts(client_id);
CREATE INDEX IF NOT EXISTS idx_accounts_client_name ON public.accounts(client_name);
CREATE INDEX IF NOT EXISTS idx_accounts_platform ON public.accounts(platform);
CREATE INDEX IF NOT EXISTS idx_accounts_connection_type ON public.accounts(connection_type);

CREATE INDEX IF NOT EXISTS idx_posts_client_id ON public.posts(client_id);
CREATE INDEX IF NOT EXISTS idx_posts_account_id ON public.posts(account_id);
CREATE INDEX IF NOT EXISTS idx_posts_client_name ON public.posts(client_name);
CREATE INDEX IF NOT EXISTS idx_posts_status ON public.posts(status);
CREATE INDEX IF NOT EXISTS idx_posts_platform ON public.posts(platform);
CREATE INDEX IF NOT EXISTS idx_posts_is_scheduled ON public.posts(is_scheduled) WHERE is_scheduled = true;
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON public.posts(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- ==============================================================================
-- 7. Row Level Security & Policies
-- ==============================================================================
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Idempotent RLS Policies
DROP POLICY IF EXISTS "Allow read clients" ON public.clients;
DROP POLICY IF EXISTS "Allow insert clients" ON public.clients;
DROP POLICY IF EXISTS "Allow update clients" ON public.clients;
DROP POLICY IF EXISTS "Allow delete clients" ON public.clients;

CREATE POLICY "Allow read clients" ON public.clients FOR SELECT USING (true);
CREATE POLICY "Allow insert clients" ON public.clients FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update clients" ON public.clients FOR UPDATE USING (true);
CREATE POLICY "Allow delete clients" ON public.clients FOR DELETE USING (true);

DROP POLICY IF EXISTS "Allow read accounts" ON public.accounts;
DROP POLICY IF EXISTS "Allow insert accounts" ON public.accounts;
DROP POLICY IF EXISTS "Allow update accounts" ON public.accounts;
DROP POLICY IF EXISTS "Allow delete accounts" ON public.accounts;

CREATE POLICY "Allow read accounts" ON public.accounts FOR SELECT USING (true);
CREATE POLICY "Allow insert accounts" ON public.accounts FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update accounts" ON public.accounts FOR UPDATE USING (true);
CREATE POLICY "Allow delete accounts" ON public.accounts FOR DELETE USING (true);

DROP POLICY IF EXISTS "Allow read posts" ON public.posts;
DROP POLICY IF EXISTS "Allow insert posts" ON public.posts;
DROP POLICY IF EXISTS "Allow update posts" ON public.posts;
DROP POLICY IF EXISTS "Allow delete posts" ON public.posts;

CREATE POLICY "Allow read posts" ON public.posts FOR SELECT USING (true);
CREATE POLICY "Allow insert posts" ON public.posts FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update posts" ON public.posts FOR UPDATE USING (true);
CREATE POLICY "Allow delete posts" ON public.posts FOR DELETE USING (true);

DROP POLICY IF EXISTS "Allow read audit_logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Allow insert audit_logs" ON public.audit_logs;

CREATE POLICY "Allow read audit_logs" ON public.audit_logs FOR SELECT USING (true);
CREATE POLICY "Allow insert audit_logs" ON public.audit_logs FOR INSERT WITH CHECK (true);

-- ==============================================================================
-- 8. Seed Initial Clients and Sync Client IDs
-- ==============================================================================
INSERT INTO public.clients (name)
VALUES 
  ('Apex Fitness Studio'),
  ('Blue Harbor Bistro'),
  ('TechCraft Academy'),
  ('Zenith Real Estate'),
  ('Horizon Creative Labs')
ON CONFLICT (name) DO NOTHING;

-- Link existing accounts to client_id
UPDATE public.accounts a
SET client_id = c.id
FROM public.clients c
WHERE a.client_name = c.name AND a.client_id IS NULL;

-- Link existing posts to client_id
UPDATE public.posts p
SET client_id = c.id
FROM public.clients c
WHERE p.client_name = c.name AND p.client_id IS NULL;
