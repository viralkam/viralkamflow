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
  Settings,
  Save,
  Check,
  Copy,
  ExternalLink,
  Info,
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
  const { accounts, deleteAccount, refreshData } = useApp();
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // App Credentials Settings State
  const [showConfig, setShowConfig] = useState(false);
  const [credentials, setCredentials] = useState<{
    facebook: { appId: string; hasSecret: boolean; redirectUri?: string };
    instagram: { appId: string; hasSecret: boolean; configId?: string; redirectUri?: string };
    threads: { appId: string; hasSecret: boolean; redirectUri?: string };
  }>({
    facebook: { appId: '', hasSecret: false },
    instagram: { appId: '', hasSecret: false, configId: '' },
    threads: { appId: '', hasSecret: false },
  });

  // Form inputs for updating keys
  const [metaAppId, setMetaAppId] = useState('');
  const [metaAppSecret, setMetaAppSecret] = useState('');
  const [igConfigId, setIgConfigId] = useState('');
  const [thAppId, setThAppId] = useState('');
  const [thAppSecret, setThAppSecret] = useState('');
  const [savingKeys, setSavingKeys] = useState(false);
  const [keysSavedMsg, setKeysSavedMsg] = useState<string | null>(null);
  const [copiedCallback, setCopiedCallback] = useState<string | null>(null);

  const fetchCredentials = async () => {
    try {
      const res = await fetch('/api/admin/credentials');
      if (res.ok) {
        const data = await res.json();
        setCredentials(data);
        if (data.facebook?.appId) setMetaAppId(data.facebook.appId);
        if (data.instagram?.configId) setIgConfigId(data.instagram.configId);
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
          metaAppId: metaAppId || undefined,
          metaAppSecret: metaAppSecret || undefined,
          instagramConfigId: igConfigId || undefined,
          threadsAppId: thAppId || undefined,
          threadsAppSecret: thAppSecret || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setKeysSavedMsg('App credentials saved successfully!');
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

  const copyToClipboard = (text: string, label: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedCallback(label);
      setTimeout(() => setCopiedCallback(null), 2500);
    }
  };

  const openOAuthPopup = (url: string, title = 'Connect Account') => {
    if (typeof window === 'undefined') return;
    const width = 640;
    const height = 760;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    const popup = window.open(
      url,
      title,
      `toolbar=no,location=no,status=no,menubar=no,scrollbars=yes,resizable=yes,width=${width},height=${height},top=${top},left=${left}`
    );

    const timer = setInterval(() => {
      if (!popup || popup.closed) {
        clearInterval(timer);
        refreshData();
      }
    }, 1500);

    return popup;
  };

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.data || typeof event.data !== 'object') return;
      if (event.data.type === 'OAUTH_SUCCESS') {
        const platformDisplay = event.data.platform
          ? event.data.platform.charAt(0).toUpperCase() + event.data.platform.slice(1)
          : 'Account';
        setSuccessMsg(
          `${platformDisplay} connected successfully${event.data.name ? `: @${event.data.name}` : ''}!`
        );
        refreshData();
        setTimeout(() => setSuccessMsg(null), 6000);
      } else if (event.data.type === 'OAUTH_ERROR') {
        setErrorMsg(`Connection notice: ${event.data.message || 'Authentication failed'}. Please try again.`);
        setTimeout(() => setErrorMsg(null), 7000);
      }
    };

    window.addEventListener('message', handleMessage);

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
    const message = searchParams.get('message');
    if (error) {
      if (error === 'oauth_not_configured' || error === 'instagram_not_configured') {
        setErrorMsg(
          message ||
            'OAuth credentials are not configured yet. Click "Configure App Credentials" above to enter your Meta App ID, Secret, and Unified Login Configuration ID.'
        );
        setShowConfig(true);
      } else {
        setErrorMsg(`Connection notice: ${message || error}. Please try again.`);
      }
      setTimeout(() => setErrorMsg(null), 8000);
    }

    return () => window.removeEventListener('message', handleMessage);
  }, [searchParams, refreshData]);

  const connectedAccounts = accounts.filter(
    (a) => a.connectionType === 'oauth' && a.connectionStatus === 'Connected'
  );

  const fbAccounts = connectedAccounts.filter((a) => a.platform === 'Facebook');
  const igAccounts = connectedAccounts.filter((a) => a.platform === 'Instagram');
  const thAccounts = connectedAccounts.filter((a) => a.platform === 'Threads');

  const handleDisconnect = async (id: string, platformName: string) => {
    if (confirm(`Disconnect this ${platformName} account? Other platform connections will not be affected.`)) {
      await deleteAccount(id);
      await refreshData();
      setSuccessMsg(`${platformName} account disconnected successfully.`);
      setTimeout(() => setSuccessMsg(null), 4000);
    }
  };

  const appBaseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://viralkamflow.vercel.app';
  const fbCallbackUrl = `${appBaseUrl}/api/oauth/facebook/callback`;
  const igCallbackUrl = `${appBaseUrl}/api/oauth/instagram/callback`;
  const thCallbackUrl = `${appBaseUrl}/api/oauth/threads/callback`;

  return (
    <div className="app-container" style={{ maxWidth: '960px', margin: '0 auto', padding: '1.5rem' }}>
      {/* Header */}
      <div
        style={{
          marginBottom: '2rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
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
              Connect Facebook, Instagram &amp; Threads with separate, independent authorization flows
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
                Meta &amp; Platform Credentials Configuration
              </h3>
              <p style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '0.2rem' }}>
                Configures your Meta App credentials, Instagram Unified Login Configuration ID, and Threads credentials.
              </p>
            </div>
            {keysSavedMsg && (
              <span
                style={{
                  fontSize: '0.82rem',
                  color: '#059669',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
              >
                <Check size={16} /> {keysSavedMsg}
              </span>
            )}
          </div>

          <form onSubmit={handleSaveCredentials} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
              {/* 1. Meta Developer App (Facebook & Unified Login) */}
              <div style={{ border: '1px solid #bfdbfe', borderRadius: '10px', padding: '1rem', background: '#f8fafc' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <FacebookIcon size={18} />
                  <strong style={{ fontSize: '0.92rem', color: '#1877f2' }}>Meta App (Facebook &amp; Instagram Base)</strong>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569' }}>
                      Meta App ID (META_CLIENT_ID)
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. 2082873572346486"
                      value={metaAppId}
                      onChange={(e) => setMetaAppId(e.target.value)}
                      style={{ fontSize: '0.85rem', width: '100%', marginTop: '0.2rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569' }}>
                      Meta App Secret (META_CLIENT_SECRET)
                    </label>
                    <input
                      type="password"
                      className="form-input"
                      placeholder={credentials.facebook?.hasSecret ? '•••••••••••••••• (Configured)' : 'Enter Meta App Secret'}
                      value={metaAppSecret}
                      onChange={(e) => setMetaAppSecret(e.target.value)}
                      style={{ fontSize: '0.85rem', width: '100%', marginTop: '0.2rem' }}
                    />
                  </div>
                </div>
              </div>

              {/* 2. Instagram Unified Login Configuration ID */}
              <div style={{ border: '1px solid #fbcfe8', borderRadius: '10px', padding: '1rem', background: '#f8fafc' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <InstagramIcon size={18} />
                  <strong style={{ fontSize: '0.92rem', color: '#e1306c' }}>Instagram API (Unified Login)</strong>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569' }}>
                      Unified Login Configuration ID (INSTAGRAM_CONFIG_ID)
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. 123456789012345"
                      value={igConfigId}
                      onChange={(e) => setIgConfigId(e.target.value)}
                      style={{ fontSize: '0.85rem', width: '100%', marginTop: '0.2rem' }}
                    />
                    <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.35rem', lineHeight: '1.4' }}>
                      Found in Meta Dashboard &rarr; <em>Instagram API &rarr; API setup with Unified login &rarr; Configuration ID</em>.
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Threads App */}
              <div style={{ border: '1px solid #cbd5e1', borderRadius: '10px', padding: '1rem', background: '#f8fafc' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <ThreadsIcon size={18} />
                  <strong style={{ fontSize: '0.92rem', color: '#0f172a' }}>Threads App Credentials</strong>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569' }}>Threads App ID (THREADS_APP_ID)</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. 2082873572346486"
                      value={thAppId}
                      onChange={(e) => setThAppId(e.target.value)}
                      style={{ fontSize: '0.85rem', width: '100%', marginTop: '0.2rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569' }}>
                      Threads App Secret (THREADS_APP_SECRET)
                    </label>
                    <input
                      type="password"
                      className="form-input"
                      placeholder={credentials.threads?.hasSecret ? '•••••••••••••••• (Configured)' : 'Enter Threads App Secret'}
                      value={thAppSecret}
                      onChange={(e) => setThAppSecret(e.target.value)}
                      style={{ fontSize: '0.85rem', width: '100%', marginTop: '0.2rem' }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Callback URIs to copy to Meta Dashboard */}
            <div
              style={{
                background: '#f1f5f9',
                borderRadius: '8px',
                padding: '0.85rem 1rem',
                border: '1px solid #e2e8f0',
              }}
            >
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '0.5rem' }}>
                Meta Developer Dashboard — Valid OAuth Redirect URIs to Whitelist:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.78rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', padding: '4px 8px', borderRadius: '4px' }}>
                  <span><strong>Facebook:</strong> <code>{fbCallbackUrl}</code></span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(fbCallbackUrl, 'fb')}
                    className="btn btn-ghost btn-sm"
                    style={{ padding: '2px 6px', fontSize: '0.72rem' }}
                  >
                    {copiedCallback === 'fb' ? <Check size={12} color="#059669" /> : <Copy size={12} />}
                  </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', padding: '4px 8px', borderRadius: '4px' }}>
                  <span><strong>Instagram:</strong> <code>{igCallbackUrl}</code></span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(igCallbackUrl, 'ig')}
                    className="btn btn-ghost btn-sm"
                    style={{ padding: '2px 6px', fontSize: '0.72rem' }}
                  >
                    {copiedCallback === 'ig' ? <Check size={12} color="#059669" /> : <Copy size={12} />}
                  </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', padding: '4px 8px', borderRadius: '4px' }}>
                  <span><strong>Threads:</strong> <code>{thCallbackUrl}</code></span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(thCallbackUrl, 'th')}
                    className="btn btn-ghost btn-sm"
                    style={{ padding: '2px 6px', fontSize: '0.72rem' }}
                  >
                    {copiedCallback === 'th' ? <Check size={12} color="#059669" /> : <Copy size={12} />}
                  </button>
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
                <span>{savingKeys ? 'Saving...' : 'Save Credentials'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Independent Status Summary */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          marginBottom: '2rem',
        }}
      >
        {/* Facebook Status Box */}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.92rem', fontWeight: 800, color: fbAccounts.length > 0 ? '#1877f2' : 'var(--text-main)' }}>
                Facebook
              </span>
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  padding: '1px 6px',
                  borderRadius: '10px',
                  background: fbAccounts.length > 0 ? '#dcfce7' : '#f1f5f9',
                  color: fbAccounts.length > 0 ? '#15803d' : '#64748b',
                }}
              >
                {fbAccounts.length > 0 ? 'Connected' : 'Not Connected'}
              </span>
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', fontWeight: 600 }}>
              {fbAccounts.length} Page{fbAccounts.length === 1 ? '' : 's'} linked
            </div>
          </div>
        </div>

        {/* Instagram Status Box */}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.92rem', fontWeight: 800, color: igAccounts.length > 0 ? '#E1306C' : 'var(--text-main)' }}>
                Instagram
              </span>
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  padding: '1px 6px',
                  borderRadius: '10px',
                  background: igAccounts.length > 0 ? '#dcfce7' : '#f1f5f9',
                  color: igAccounts.length > 0 ? '#15803d' : '#64748b',
                }}
              >
                {igAccounts.length > 0 ? 'Connected' : 'Not Connected'}
              </span>
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', fontWeight: 600 }}>
              {igAccounts.length} Account{igAccounts.length === 1 ? '' : 's'} linked
            </div>
          </div>
        </div>

        {/* Threads Status Box */}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.92rem', fontWeight: 800, color: thAccounts.length > 0 ? '#0f172a' : 'var(--text-main)' }}>
                Threads
              </span>
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  padding: '1px 6px',
                  borderRadius: '10px',
                  background: thAccounts.length > 0 ? '#dcfce7' : '#f1f5f9',
                  color: thAccounts.length > 0 ? '#15803d' : '#64748b',
                }}
              >
                {thAccounts.length > 0 ? 'Connected' : 'Not Connected'}
              </span>
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', fontWeight: 600 }}>
              {thAccounts.length} Profile{thAccounts.length === 1 ? '' : 's'} linked
            </div>
          </div>
        </div>
      </div>

      {/* Grid of Platform Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2rem' }}>
        
        {/* 1. FACEBOOK CARD */}
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
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>Facebook</h3>
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
                    Official FB Login
                  </span>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '12px',
                      background: fbAccounts.length > 0 ? '#dcfce7' : '#f1f5f9',
                      color: fbAccounts.length > 0 ? '#15803d' : '#64748b',
                    }}
                  >
                    {fbAccounts.length > 0 ? 'Connected' : 'Not Connected'}
                  </span>
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  Connect your Facebook Pages to publish feed posts, video reels &amp; manage page comments
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => openOAuthPopup('/api/oauth/facebook?userId=admin', 'Connect Facebook')}
              className="btn btn-primary"
              style={{ background: '#1877f2', padding: '0.75rem 1.4rem', fontSize: '0.92rem', cursor: 'pointer', border: 'none' }}
            >
              <Link2 size={17} />
              <span>{fbAccounts.length > 0 ? 'Add / Reconnect Facebook' : 'Connect Facebook'}</span>
            </button>
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
                      title="Disconnect Facebook"
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

        {/* 2. INSTAGRAM CARD (UNIFIED LOGIN) */}
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
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>Instagram</h3>
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
                    Meta Unified Login
                  </span>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '12px',
                      background: igAccounts.length > 0 ? '#dcfce7' : '#f1f5f9',
                      color: igAccounts.length > 0 ? '#15803d' : '#64748b',
                    }}
                  >
                    {igAccounts.length > 0 ? 'Connected' : 'Not Connected'}
                  </span>
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  Uses your Meta Business configuration to authenticate your Instagram professional account
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => openOAuthPopup('/api/oauth/instagram?userId=admin', 'Connect Instagram')}
                className="btn btn-primary"
                style={{
                  background: 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
                  padding: '0.75rem 1.4rem',
                  fontSize: '0.92rem',
                  cursor: 'pointer',
                  border: 'none',
                }}
              >
                <Link2 size={17} />
                <span>{igAccounts.length > 0 ? 'Add / Reconnect Instagram' : 'Connect Instagram'}</span>
              </button>
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
                      title="Disconnect Instagram"
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
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>Threads</h3>
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
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '12px',
                      background: thAccounts.length > 0 ? '#dcfce7' : '#f1f5f9',
                      color: thAccounts.length > 0 ? '#15803d' : '#64748b',
                    }}
                  >
                    {thAccounts.length > 0 ? 'Connected' : 'Not Connected'}
                  </span>
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  Connect your Threads account directly to post text discussions, media and threads
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => openOAuthPopup('/api/oauth/threads?userId=admin', 'Connect Threads')}
              className="btn btn-primary"
              style={{ background: '#0f172a', color: '#ffffff', padding: '0.75rem 1.4rem', fontSize: '0.92rem', cursor: 'pointer', border: 'none' }}
            >
              <Link2 size={17} />
              <span>{thAccounts.length > 0 ? 'Add / Reconnect Threads' : 'Connect Threads'}</span>
            </button>
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
                      title="Disconnect Threads"
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
            Three Fully Independent Connection Flows
          </h4>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
            Each platform (Facebook, Instagram, and Threads) operates with its own authorization route, its own OAuth callback, its own tokens, and its own disconnected state. Disconnecting one platform will never disconnect or alter another.
          </p>
        </div>
      </div>
    </div>
  );
}
