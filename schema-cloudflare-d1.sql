-- ==============================================================================
-- Cloudflare D1 Database Schema for PublishingFlow (viralkam-db)
-- Serverless SQLite Database on Cloudflare D1
-- ==============================================================================

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  email TEXT,
  password_hash TEXT,
  salt TEXT,
  membership_tier TEXT DEFAULT 'pro',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 2. Clients Table (Clients / Brands)
CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 3. Social Media Accounts (Instagram, Facebook, Threads)
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT DEFAULT 'admin',
  client_id TEXT,
  client_name TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('Instagram', 'Facebook', 'Threads')),
  connection_type TEXT NOT NULL DEFAULT 'oauth',
  connection_status TEXT NOT NULL DEFAULT 'Connected',
  oauth_access_token TEXT,
  oauth_refresh_token TEXT,
  oauth_account_id TEXT,
  oauth_token_expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

-- 4. Posts Table (Reels, Videos, Photos, Schedules)
CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  user_id TEXT DEFAULT 'admin',
  client_id TEXT,
  account_id TEXT,
  client_name TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('Instagram', 'Facebook', 'Threads')),
  title TEXT DEFAULT '',
  caption TEXT DEFAULT '',
  description TEXT DEFAULT '',
  media_type TEXT CHECK (media_type IN ('image', 'video', 'text', 'carousel')),
  media_url TEXT,
  media_name TEXT,
  scheduled_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('draft', 'scheduled', 'publishing', 'posted', 'failed')),
  published_at TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL
);

-- 5. Auto Reply Rules (Keywords, Follower Gate, Auto DM, Comments)
CREATE TABLE IF NOT EXISTS auto_reply_rules (
  id TEXT PRIMARY KEY,
  user_id TEXT DEFAULT 'admin',
  platform TEXT NOT NULL DEFAULT 'All',
  keyword TEXT NOT NULL,
  require_follower INTEGER NOT NULL DEFAULT 0,
  public_reply TEXT,
  private_reply TEXT,
  not_following_reply TEXT,
  target_post_id TEXT DEFAULT 'all',
  is_active INTEGER NOT NULL DEFAULT 1,
  trigger_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 6. Comment Replies History (Prevents duplicate replies)
CREATE TABLE IF NOT EXISTS comment_replies (
  id TEXT PRIMARY KEY,
  comment_id TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL,
  rule_id TEXT,
  comment_text TEXT,
  replied_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 7. Audit Logs Table (Full audit tracking)
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT DEFAULT 'admin',
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  client_name TEXT,
  platform TEXT,
  status TEXT NOT NULL,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Fast lookup indexes
CREATE INDEX IF NOT EXISTS idx_accounts_platform ON accounts(platform);
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);
CREATE INDEX IF NOT EXISTS idx_posts_scheduled_at ON posts(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_auto_reply_rules_keyword ON auto_reply_rules(keyword);
CREATE INDEX IF NOT EXISTS idx_comment_replies_comment_id ON comment_replies(comment_id);
