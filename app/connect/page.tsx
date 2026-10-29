'use client';

export const dynamic = 'force-dynamic';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import {
  InstagramIcon,
  FacebookIcon,
  FacebookFilledIcon,
  ThreadsIcon,
} from '@/components/PlatformIcons';
import {
  CheckCircle2,
  AlertTriangle,
  Link2,
  Trash2,
  Shield,
  Wifi,
  ExternalLink,
  Settings,
  Save,
  Check,
  RefreshCw,
} from 'lucide-react';

export default function ConnectPage() {
  return (
    <Suspense
      fallback={
        <div className="app-container" style={{ textAlign: 'center', padding: '3rem' }}>
          Loading...
        </div>
      }
    >
      <ConnectContent />
    </Suspense>
  );
}

function ConnectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoaded, accounts, deleteAccount, refreshData } = useApp();
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // App Credentials Settings State
  const [showConfig, setShowConfig] = useState(false);
  const [credentials, setCredentials] = useState<{
    facebook: { appId: string; hasSecret: boolean };
    instagram: { appId: string; hasSecret: boolean };
    threads: { appId: string; hasSecret: boolean };
  }>({
    facebook: { appId: '', hasSecret: false },
    instagram: { appId: '', hasSecret: false },
    threads: { appId: '', hasSecret: false },
  });

  // Form inputs for updating keys
  const [fbAppId, setFbAppId] = useState('');
  const [fbAppSecret, setFbAppSecret] = useState('');
  const [igAppId, setIgAppId] = useState('');
  const [igAppSecret, setIgAppSecret] = useState('');
  const [thAppId, setThAppId] = useState('');
  const [thAppSecret, setThAppSecret] = useState('');
  const [savingKeys, setSavingKeys] = useState(false);
  const [keysSavedMsg, setKeysSavedMsg] = useState<string | null>(null);

  const fetchCredentials = async () => {
    try {
      const res = await fetch('/api/admin/credentials');
      if (res.ok) {
        const data = await res.json();
        setCredentials(data);
        if (data.facebook?.appId) setFbAppId(data.facebook.appId);
        if (data.instagram?.appId) setIgAppId(data.instagram.appId);
        if (data.threads?.appId) setThAppId(data.threads.appId);
      }
    } catch {}
  };

  useEffect(() => {
    fetchCredentials();
  }, []);

  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingKeys(true);
    setKeysSavedMsg(null);
    try {
      const res = await fetch('/api/admin/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          facebookAppId: fbAppId,
          facebookAppSecret: fbAppSecret || undefined,
          instagramAppId: igAppId,
          instagramAppSecret: igAppSecret || undefined,
          threadsAppId: thAppId,
          threadsAppSecret: thAppSecret || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setKeysSavedMsg('New App credentials saved successfully!');
        fetchCredentials();
        setTimeout(() => setKeysSavedMsg(null), 4000);
      } else {
        setErrorMsg(data.error || 'Failed to save credentials');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error saving credentials');
    } finally {
      setSavingKeys(false);
    }
  };

  useEffect(() => {
    const connected = searchParams.get('connected');
    const platform = searchParams.get('platform');
    const name = searchParams.get('name');

    if (connected === 'true') {
      const platformDisplay = platform ? platform.charAt(0).toUpperCase() + platform.slice(1) : 'Channel';
      setSuccessMsg(`${platformDisplay} connected successfully${name ? `: ${name}` : ''}!`);
      refreshData();
      setTimeout(() => setSuccessMsg(null), 6000);
    }

    const error = searchParams.get('error');
    if (error) {
      if (error === 'oauth_not_configured') {
        const p = searchParams.get('platform') || 'platform';
        setErrorMsg(`New ${p} App ID/Secret is not configured yet. Click "Configure App Credentials" below to add it.`);
        setShowConfig(true);
      } else {
        setErrorMsg(`Connection notice: ${error}. Please try again.`);
      }
      setTimeout(() => setErrorMsg(null), 7000);
    }
  }, [searchParams, refreshData]);

  const connectedAccounts = accounts.filter(
    (a) => a.connectionType === 'oauth' && a.connectionStatus === 'Connected'
  );

  const igAccounts = connectedAccounts.filter((a) => a.platform === 'Instagram');
  const fbAccounts = connectedAccounts.filter((a) => a.platform === 'Facebook');
  const thAccounts = connectedAccounts.filter((a) => a.platform === 'Threads');

  const handleDisconnect = async (id: string, platformName: string) => {
    if (confirm(`Disconnect ${platformName} account?`)) {
      await deleteAccount(id);
      await refreshData();
    }
  };

  return (
    <div className="app-container" style={{ maxWidth: '960px', margin: '0 auto', padding: '1.5rem' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: '#eff6ff',
              color: '#1877f2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Link2 size={22} />
          </div>
          <div>
            <h1 className="page-title" style={{ fontSize: '1.65rem', fontWeight: 800, margin: 0 }}>
              Connect Social Channels
            </h1>
            <p className="page-desc" style={{ color: 'var(--text-dim)', marginTop: '0.25rem', fontSize: '0.9rem' }}>
              Connect Facebook, Instagram &amp; Threads individually with dedicated apps
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowConfig(!showConfig)}
          className="btn btn-secondary"
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.88rem' }}
        >
          <Settings size={16} />
          <span>{showConfig ? 'Hide App Settings' : 'Configure App Credentials'}</span>
        </button>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div
          style={{
            padding: '0.85rem 1.25rem',
            borderRadius: 'var(--radius-md)',
            background: '#ecfdf5',
            border: '1px solid #a7f3d0',
            color: '#065f46',
            fontSize: '0.9rem',
            fontWeight: 600,
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
          }}
        >
          <CheckCircle2 size={18} color="#059669" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div
          style={{
            padding: '0.85rem 1.25rem',
            borderRadius: 'var(--radius-md)',
            background: '#fff1f2',
            border: '1px solid #fecdd3',
            color: '#9f1239',
            fontSize: '0.9rem',
            fontWeight: 600,
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
          }}
        >
          <AlertTriangle size={18} color="#e11d48" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* App Credentials Configuration Panel */}
      {showConfig && (
        <div
          className="card"
          style={{
            background: '#fff',
            border: '2px solid #6366f1',
            borderRadius: 'var(--radius-lg)',
            padding: '1.5rem',
            marginBottom: '2rem',
            boxShadow: '0 4px 14px rgba(99, 102, 241, 0.1)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                Set Your New App Credentials
              </h3>
              <p style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '0.2rem' }}>
                Enter your new Facebook App ID, Instagram App ID, and Threads App ID. They are saved securely into <code>.env.local</code>.
              </p>
            </div>
            {keysSavedMsg && (
              <span style={{ fontSize: '0.82rem', color: '#059669', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Check size={16} /> {keysSavedMsg}
              </span>
            )}
          </div>

          <form onSubmit={handleSaveCredentials} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
              
              {/* Facebook App */}
              <div style={{ border: '1px solid #bfdbfe', borderRadius: '10px', padding: '1rem', background: '#f8fafc' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <FacebookIcon size={18} />
                  <strong style={{ fontSize: '0.92rem', color: '#1877f2' }}>Facebook App Credentials</strong>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569' }}>Facebook App ID</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. 123456789012345"
                      value={fbAppId}
                      onChange={(e) => setFbAppId(e.target.value)}
                      style={{ fontSize: '0.85rem', width: '100%', marginTop: '0.2rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569' }}>Facebook App Secret</label>
                    <input
                      type="password"
                      className="form-input"
                      placeholder={credentials.facebook?.hasSecret ? '•••••••••••••••• (Configured)' : 'Enter App Secret'}
                      value={fbAppSecret}
                      onChange={(e) => setFbAppSecret(e.target.value)}
                      style={{ fontSize: '0.85rem', width: '100%', marginTop: '0.2rem' }}
                    />
                  </div>
                </div>
              </div>

              {/* Instagram App */}
              <div style={{ border: '1px solid #fbcfe8', borderRadius: '10px', padding: '1rem', background: '#f8fafc' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <InstagramIcon size={18} />
                  <strong style={{ fontSize: '0.92rem', color: '#e1306c' }}>Instagram App Credentials</strong>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569' }}>Instagram App ID</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. 987654321098765"
                      value={igAppId}
                      onChange={(e) => setIgAppId(e.target.value)}
                      style={{ fontSize: '0.85rem', width: '100%', marginTop: '0.2rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569' }}>Instagram App Secret</label>
                    <input
                      type="password"
                      className="form-input"
                      placeholder={credentials.instagram?.hasSecret ? '•••••••••••••••• (Configured)' : 'Enter App Secret'}
                      value={igAppSecret}
                      onChange={(e) => setIgAppSecret(e.target.value)}
                      style={{ fontSize: '0.85rem', width: '100%', marginTop: '0.2rem' }}
                    />
                  </div>
                </div>
              </div>

              {/* Threads App */}
              <div style={{ border: '1px solid #cbd5e1', borderRadius: '10px', padding: '1rem', background: '#f8fafc' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <ThreadsIcon size={18} />
                  <strong style={{ fontSize: '0.92rem', color: '#0f172a' }}>Threads App Credentials</strong>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569' }}>Threads App ID</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. 543216789012345"
                      value={thAppId}
                      onChange={(e) => setThAppId(e.target.value)}
                      style={{ fontSize: '0.85rem', width: '100%', marginTop: '0.2rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569' }}>Threads App Secret</label>
                    <input
                      type="password"
                      className="form-input"
                      placeholder={credentials.threads?.hasSecret ? '•••••••••••••••• (Configured)' : 'Enter App Secret'}
                      value={thAppSecret}
                      onChange={(e) => setThAppSecret(e.target.value)}
                      style={{ fontSize: '0.85rem', width: '100%', marginTop: '0.2rem' }}
                    />
                  </div>
                </div>
              </div>

            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => setShowConfig(false)}
                className="btn btn-ghost"
                style={{ fontSize: '0.88rem' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingKeys}
                className="btn btn-primary"
                style={{ background: '#6366f1', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.88rem' }}
              >
                <Save size={16} />
                <span>{savingKeys ? 'Saving...' : 'Save New Credentials'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Status Summary */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '1rem',
          marginBottom: '2rem',
        }}
      >
        <div className="card" style={{ padding: '1.15rem', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: '#fdf2f8',
              color: '#E1306C',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <InstagramIcon size={20} />
          </div>
          <div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>{igAccounts.length}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', fontWeight: 600 }}>Instagram</div>
          </div>
        </div>

        <div className="card" style={{ padding: '1.15rem', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: '#eff6ff',
              color: '#1877f2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <FacebookIcon size={20} />
          </div>
          <div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>{fbAccounts.length}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', fontWeight: 600 }}>Facebook Pages</div>
          </div>
        </div>

        <div className="card" style={{ padding: '1.15rem', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: '#f8fafc',
              color: '#0f172a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ThreadsIcon size={20} />
          </div>
          <div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>{thAccounts.length}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', fontWeight: 600 }}>Threads</div>
          </div>
        </div>

        <div className="card" style={{ padding: '1.15rem', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: '#ecfdf5',
              color: '#059669',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Wifi size={20} />
          </div>
          <div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#059669' }}>
              {connectedAccounts.length > 0 ? `${connectedAccounts.length} Connected` : 'None'}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', fontWeight: 600 }}>Total Channels</div>
          </div>
        </div>
      </div>

      {/* Grid of Platform Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2rem' }}>
        
        {/* 1. INSTAGRAM CARD */}
        <div className="card" style={{ padding: '1.75rem', borderLeft: '4px solid #E1306C' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div
                style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '14px',
                  background: 'linear-gradient(135deg, #fdf497 0%, #fdf497 5%, #fd5949 45%, #d6249f 60%, #285AEB 90%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                }}
              >
                <InstagramIcon size={26} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)' }}>Instagram</h3>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '12px',
                      background: '#fdf2f8',
                      color: '#db2777',
                    }}
                  >
                    Instagram OAuth
                  </span>
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  Connect your Instagram Professional or Creator account for Reels direct posting &amp; Auto DM
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <a
                href="/api/oauth/instagram?mode=meta_dialog&userId=admin"
                className="btn btn-primary"
                style={{
                  background: 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
                  padding: '0.75rem 1.4rem',
                  fontSize: '0.92rem',
                }}
              >
                <Link2 size={17} />
                <span>{igAccounts.length > 0 ? 'Add / Reconnect Instagram' : 'Connect Instagram'}</span>
              </a>
              <a
                href="/api/oauth/instagram?scopeLevel=basic&userId=admin"
                style={{ fontSize: '0.78rem', color: 'var(--text-dim)', textDecoration: 'underline' }}
                title="Connect with basic permissions if advanced scopes are not added to Meta App yet"
              >
                Connect Basic Profile
              </a>
            </div>
          </div>

          {/* Instagram Connected List */}
          {igAccounts.length > 0 && (
            <div style={{ marginTop: '1.25rem', borderTop: '1px solid var(--border)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                Connected Instagram Accounts ({igAccounts.length}):
              </span>
              {igAccounts.map((acc) => (
                <div
                  key={acc.id}
                  style={{
                    padding: '0.75rem 1rem',
                    borderRadius: 'var(--radius-md)',
                    background: '#fdf2f8',
                    border: '1px solid #fbcfe8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        background: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#db2777',
                      }}
                    >
                      <InstagramIcon size={18} />
                    </div>
                    <div>
                      <strong style={{ fontSize: '0.92rem', color: 'var(--text-main)' }}>@{acc.clientName}</strong>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginLeft: '0.5rem' }}>
                        ID: {acc.oauthAccountId || acc.id}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span className="badge badge-success">
                      <CheckCircle2 size={10} /> Active
                    </span>
                    <button
                      onClick={() => handleDisconnect(acc.id, 'Instagram')}
                      className="btn btn-ghost btn-sm"
                      style={{ color: 'var(--danger)' }}
                      title="Disconnect"
                    >
                      <Trash2 size={14} />
                      <span>Disconnect</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 2. FACEBOOK CARD */}
        <div className="card" style={{ padding: '1.75rem', borderLeft: '4px solid #1877f2' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div
                style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '14px',
                  background: '#eff6ff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#1877f2',
                }}
              >
                <FacebookFilledIcon size={28} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)' }}>Facebook</h3>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '12px',
                      background: '#eff6ff',
                      color: '#1877f2',
                    }}
                  >
                    FB OAuth
                  </span>
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  Connect your Facebook Pages to publish feed posts, video reels &amp; auto-replies
                </p>
              </div>
            </div>

            <a
              href="/api/oauth/facebook?userId=admin"
              className="btn btn-primary"
              style={{ background: '#1877f2', padding: '0.75rem 1.4rem', fontSize: '0.92rem' }}
            >
              <Link2 size={17} />
              <span>{fbAccounts.length > 0 ? 'Add / Reconnect Facebook' : 'Connect Facebook'}</span>
            </a>
          </div>

          {/* Facebook Connected List */}
          {fbAccounts.length > 0 && (
            <div style={{ marginTop: '1.25rem', borderTop: '1px solid var(--border)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                Connected Facebook Pages ({fbAccounts.length}):
              </span>
              {fbAccounts.map((acc) => (
                <div
                  key={acc.id}
                  style={{
                    padding: '0.75rem 1rem',
                    borderRadius: 'var(--radius-md)',
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        background: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#1877f2',
                      }}
                    >
                      <FacebookIcon size={18} />
                    </div>
                    <div>
                      <strong style={{ fontSize: '0.92rem', color: 'var(--text-main)' }}>{acc.clientName}</strong>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginLeft: '0.5rem' }}>
                        Page ID: {acc.oauthAccountId || acc.id}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span className="badge badge-success">
                      <CheckCircle2 size={10} /> Active
                    </span>
                    <button
                      onClick={() => handleDisconnect(acc.id, 'Facebook')}
                      className="btn btn-ghost btn-sm"
                      style={{ color: 'var(--danger)' }}
                      title="Disconnect"
                    >
                      <Trash2 size={14} />
                      <span>Disconnect</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 3. THREADS CARD */}
        <div className="card" style={{ padding: '1.75rem', borderLeft: '4px solid #0f172a' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div
                style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '14px',
                  background: '#0f172a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                }}
              >
                <ThreadsIcon size={24} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)' }}>Threads</h3>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '12px',
                      background: '#f1f5f9',
                      color: '#0f172a',
                    }}
                  >
                    Threads OAuth
                  </span>
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  Connect your Threads account directly to post text discussions, media and threads
                </p>
              </div>
            </div>

            <a
              href="/api/oauth/threads?userId=admin"
              className="btn btn-primary"
              style={{ background: '#0f172a', color: '#ffffff', padding: '0.75rem 1.4rem', fontSize: '0.92rem' }}
            >
              <Link2 size={17} />
              <span>{thAccounts.length > 0 ? 'Add / Reconnect Threads' : 'Connect Threads'}</span>
            </a>
          </div>

          {/* Threads Connected List */}
          {thAccounts.length > 0 && (
            <div style={{ marginTop: '1.25rem', borderTop: '1px solid var(--border)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                Connected Threads Accounts ({thAccounts.length}):
              </span>
              {thAccounts.map((acc) => (
                <div
                  key={acc.id}
                  style={{
                    padding: '0.75rem 1rem',
                    borderRadius: 'var(--radius-md)',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        background: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#0f172a',
                      }}
                    >
                      <ThreadsIcon size={18} />
                    </div>
                    <div>
                      <strong style={{ fontSize: '0.92rem', color: 'var(--text-main)' }}>@{acc.clientName}</strong>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginLeft: '0.5rem' }}>
                        ID: {acc.oauthAccountId || acc.id}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span className="badge badge-success">
                      <CheckCircle2 size={10} /> Active
                    </span>
                    <button
                      onClick={() => handleDisconnect(acc.id, 'Threads')}
                      className="btn btn-ghost btn-sm"
                      style={{ color: 'var(--danger)' }}
                      title="Disconnect"
                    >
                      <Trash2 size={14} />
                      <span>Disconnect</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Guide Note */}
      <div
        style={{
          padding: '1.25rem 1.5rem',
          borderRadius: 'var(--radius-md)',
          background: '#f8fafc',
          border: '1px solid var(--border)',
          display: 'flex',
          gap: '1rem',
          alignItems: 'flex-start',
        }}
      >
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: '#e0e7ff',
            color: '#4338ca',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            marginTop: '2px',
          }}
        >
          <Shield size={20} />
        </div>
        <div>
          <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.25rem' }}>
            Independent Platform Connections
          </h4>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
            Facebook, Instagram, and Threads can now each connect via their own dedicated app credentials.
            When you create your new apps on Meta Developer Portal, simply click <strong>Configure App Credentials</strong> above
            to paste your new App ID and App Secret. Each channel initiates its own isolated OAuth flow!
          </p>
        </div>
      </div>
    </div>
  );
}
