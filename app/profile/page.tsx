'use client';

export const dynamic = 'force-dynamic';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { InstagramIcon, FacebookIcon, FacebookFilledIcon, ThreadsIcon } from '@/components/PlatformIcons';
import { CheckCircle2, AlertTriangle, Link2, Trash2, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function ProfilePage() {
  return (
    <Suspense fallback={<div className="app-container" style={{ textAlign: 'center', padding: '3rem' }}>Loading Accounts...</div>}>
      <ProfileContent />
    </Suspense>
  );
}

function ProfileContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, login, isLoaded, accounts, deleteAccount, refreshData } = useApp();
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const metaAccounts = accounts.filter(a =>
    (a.platform === 'Facebook' || a.platform === 'Instagram' || a.platform === 'Threads') &&
    a.connectionType === 'oauth' && a.connectionStatus === 'Connected'
  );

  const handleDisconnect = async (id: string) => {
    if (confirm('Disconnect this account?')) {
      await deleteAccount(id);
      await refreshData();
    }
  };

  return (
    <div className="app-container" style={{ maxWidth: '750px' }}>
      {/* Page Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 className="page-title">Step 1: Link Meta Account</h1>
        <p className="page-desc">
          Connect your Facebook creator account to link your Facebook Pages and Instagram account.
        </p>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div style={{
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
          gap: '0.6rem'
        }}>
          <CheckCircle2 size={18} color="#059669" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div style={{
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
          gap: '0.6rem'
        }}>
          <AlertTriangle size={18} color="#e11d48" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Meta Platform Connection Card */}
      <div className="card" style={{ padding: '2rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{
              width: '50px',
              height: '50px',
              borderRadius: '12px',
              background: '#eff6ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#1877f2'
            }}>
              <FacebookFilledIcon size={26} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)' }}>
                Social Channels (Meta Suite)
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                Connect Instagram, Facebook, and Threads independently using your single Meta App
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            <a
              href={`/api/oauth/instagram${user?.id ? `?userId=${encodeURIComponent(user.id)}` : ''}`}
              className="btn btn-primary"
              style={{ background: 'linear-gradient(45deg, #f09433, #dc2743, #bc1888)', padding: '0.65rem 1rem', fontSize: '0.86rem' }}
              title="Connect Instagram via Instagram OAuth"
            >
              <InstagramIcon size={16} />
              <span>Instagram OAuth</span>
            </a>
            <a
              href={`/api/oauth/facebook${user?.id ? `?userId=${encodeURIComponent(user.id)}` : ''}`}
              className="btn btn-primary"
              style={{ background: '#1877f2', padding: '0.65rem 1rem', fontSize: '0.86rem' }}
              title="Connect Facebook via FB OAuth"
            >
              <FacebookIcon size={16} />
              <span>FB OAuth</span>
            </a>
            <a
              href={`/api/oauth/threads${user?.id ? `?userId=${encodeURIComponent(user.id)}` : ''}`}
              className="btn btn-primary"
              style={{ background: '#0f172a', padding: '0.65rem 1rem', fontSize: '0.86rem' }}
              title="Connect Threads via Threads OAuth"
            >
              <ThreadsIcon size={16} />
              <span>Threads OAuth</span>
            </a>
          </div>
        </div>

        {/* Connected Meta Accounts List */}
        {metaAccounts.length > 0 ? (
          <div style={{ marginTop: '1.75rem', borderTop: '1px solid var(--border)', paddingTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Linked Channels ({metaAccounts.length}):
            </span>
            {metaAccounts.map((acc) => (
              <div
                key={acc.id}
                style={{
                  padding: '0.85rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  background: '#f8fafc',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: acc.platform === 'Instagram' ? '#fdf2f8' : (acc.platform === 'Threads' ? '#f1f5f9' : '#eff6ff'),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: acc.platform === 'Instagram' ? '#db2777' : (acc.platform === 'Threads' ? '#0f172a' : '#1877f2')
                  }}>
                    {acc.platform === 'Instagram' ? <InstagramIcon size={18} /> :
                     acc.platform === 'Threads' ? <ThreadsIcon size={18} /> :
                     <FacebookIcon size={18} />}
                  </div>
                  <div>
                    <strong style={{ fontSize: '0.92rem', color: 'var(--text-main)' }}>{acc.clientName}</strong>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginLeft: '0.5rem' }}>
                      ({acc.platform})
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => handleDisconnect(acc.id)}
                  className="btn btn-ghost btn-sm"
                  style={{ color: 'var(--danger)' }}
                  title="Disconnect"
                >
                  <Trash2 size={14} />
                  <span>Remove</span>
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div style={{
            marginTop: '1.5rem',
            padding: '1.25rem',
            borderRadius: 'var(--radius-sm)',
            background: '#f8fafc',
            border: '1px dashed var(--border)',
            textAlign: 'center',
            color: 'var(--text-muted)',
            fontSize: '0.88rem'
          }}>
            No Meta account linked yet. Click 'Connect Meta' above to grant Facebook and Instagram permissions.
          </div>
        )}
      </div>

      {/* Next Step Action Button */}
      <div style={{ textAlign: 'center' }}>
        <Link
          href="/upload"
          className="btn btn-primary btn-lg"
          style={{ padding: '0.9rem 2.5rem', fontSize: '1.05rem' }}
        >
          <span>Proceed to Upload &amp; Publish</span>
          <ArrowRight size={20} />
        </Link>
      </div>
    </div>
  );
}
