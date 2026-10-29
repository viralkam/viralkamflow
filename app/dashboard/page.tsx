'use client';

export const dynamic = 'force-dynamic';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { InstagramIcon, FacebookIcon } from '@/components/PlatformIcons';
import {
  LayoutDashboard, Link2, TrendingUp, Users, Eye,
  Heart, MessageCircle, Share2, ArrowRight, Zap,
  CheckCircle2, UploadCloud, Calendar, Clock, Send, Trash2, Play
} from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const router = useRouter();
  const { user, isLoaded, accounts, posts, autoReplyRules, deletePost, refreshData } = useApp();
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [feedStats, setFeedStats] = useState<{
    igCount: number; fbCount: number;
    totalLikes: number; totalComments: number; totalViews: number;
  }>({ igCount: 0, fbCount: 0, totalLikes: 0, totalComments: 0, totalViews: 0 });

  // Fetch live stats from API
  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch('/api/meta/feed?platform=all');
        const data = await res.json();
        if (data.items && Array.isArray(data.items)) {
          const igItems = data.items.filter((i: any) => i.platform === 'Instagram');
          const fbItems = data.items.filter((i: any) => i.platform === 'Facebook');
          const totalLikes = data.items.reduce((s: number, i: any) => s + (i.likeCount || 0), 0);
          const totalComments = data.items.reduce((s: number, i: any) => s + (i.commentCount || 0), 0);
          const totalViews = data.items.reduce((s: number, i: any) => s + (i.viewCount || 0), 0);
          setFeedStats({
            igCount: igItems.length,
            fbCount: fbItems.length,
            totalLikes,
            totalComments,
            totalViews,
          });
        }
      } catch {}
    }
    if (isLoaded) fetchStats();
  }, [isLoaded]);

  const connectedAccounts = accounts.filter(a => a.connectionStatus === 'Connected' && a.connectionType === 'oauth');
  const igAccounts = connectedAccounts.filter(a => a.platform === 'Instagram');
  const fbAccounts = connectedAccounts.filter(a => a.platform === 'Facebook');
  const activeRules = autoReplyRules.filter(r => r.isActive);
  const totalDmsSent = autoReplyRules.reduce((s, r) => s + (r.triggerCount || 0), 0);

  const scheduledPosts = (posts || []).filter(p => p.status === 'scheduled');

  const handlePublishNow = async (postId: string) => {
    setPublishingId(postId);
    setActionMsg(null);
    try {
      const res = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to publish post');
      }
      setActionMsg({ text: 'Post published successfully!' });
      await refreshData();
      setTimeout(() => setActionMsg(null), 4000);
    } catch (err: any) {
      setActionMsg({ text: err.message || 'Publishing error', error: true });
    } finally {
      setPublishingId(null);
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!confirm('Are you sure you want to cancel and delete this scheduled post?')) return;
    try {
      await deletePost(postId);
      await refreshData();
    } catch (err) {
      console.error('Delete post error:', err);
    }
  };

  const statCards = [
    {
      label: 'Connected Accounts',
      value: connectedAccounts.length,
      icon: <Users size={20} />,
      color: '#4f46e5',
      bg: '#eef2ff',
      sub: `${igAccounts.length} IG · ${fbAccounts.length} FB`,
    },
    {
      label: 'Scheduled Posts',
      value: scheduledPosts.length,
      icon: <Calendar size={20} />,
      color: '#0891b2',
      bg: '#ecfeff',
      sub: `${scheduledPosts.length} in upcoming queue`,
    },
    {
      label: 'Total Likes',
      value: feedStats.totalLikes.toLocaleString(),
      icon: <Heart size={20} />,
      color: '#e11d48',
      bg: '#fff1f2',
      sub: 'Across all posts',
    },
    {
      label: 'Total Views',
      value: feedStats.totalViews.toLocaleString(),
      icon: <Eye size={20} />,
      color: '#059669',
      bg: '#ecfdf5',
      sub: 'Video views',
    },
    {
      label: 'Auto DMs Sent',
      value: totalDmsSent,
      icon: <Zap size={20} />,
      color: '#7c3aed',
      bg: '#f5f3ff',
      sub: `${activeRules.length} active rules`,
    },
  ];

  const quickActions = [
    { label: 'Upload & Publish', href: '/upload', icon: <UploadCloud size={18} />, desc: 'Post videos, reels & photos', color: '#4f46e5' },
    { label: 'Connect Accounts', href: '/connect', icon: <Link2 size={18} />, desc: 'Link Facebook & Instagram', color: '#1877f2' },
    { label: 'Instagram Feed', href: '/instagram', icon: <InstagramIcon size={18} />, desc: `${feedStats.igCount} posts`, color: '#E1306C' },
    { label: 'Facebook Feed', href: '/facebook', icon: <FacebookIcon size={18} />, desc: `${feedStats.fbCount} posts`, color: '#1877F2' },
    { label: 'Auto DM Rules', href: '/instagram/auto-dm', icon: <Zap size={18} />, desc: `${activeRules.length} rules active`, color: '#7c3aed' },
  ];

  return (
    <div className="app-container" style={{ maxWidth: '1100px' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '10px',
            background: '#eef2ff', color: '#4f46e5',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <LayoutDashboard size={22} />
          </div>
          <div>
            <h1 className="page-title" style={{ fontSize: '1.6rem' }}>
              Welcome back, {user.name}!
            </h1>
            <p className="page-desc">Here&apos;s your social media overview</p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
        gap: '1.15rem',
        marginBottom: '2rem',
      }}>
        {statCards.map((stat) => (
          <div key={stat.label} className="card" style={{
            padding: '1.35rem 1.5rem',
            display: 'flex', alignItems: 'center', gap: '1rem',
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
              background: stat.color,
            }} />
            <div style={{
              width: '46px', height: '46px', borderRadius: '12px',
              background: stat.bg, color: stat.color,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              {stat.icon}
            </div>
            <div>
              <div style={{ fontSize: '1.55rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
                {stat.value}
              </div>
              <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>{stat.label}</div>
              <div style={{ fontSize: '0.73rem', color: 'var(--text-dim)', marginTop: '2px' }}>{stat.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '1rem' }}>
          Quick Actions
        </h3>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem',
        }}>
          {quickActions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="card"
              style={{
                padding: '1.25rem',
                display: 'flex', alignItems: 'center', gap: '0.85rem',
                textDecoration: 'none', cursor: 'pointer',
              }}
            >
              <div style={{
                width: '42px', height: '42px', borderRadius: '10px',
                background: `${action.color}12`,
                color: action.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                {action.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)' }}>{action.label}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>{action.desc}</div>
              </div>
              <ArrowRight size={16} color="var(--text-dim)" />
            </Link>
          ))}
        </div>
      </div>

      {/* Action Notification */}
      {actionMsg && (
        <div style={{
          marginBottom: '1.5rem',
          padding: '0.85rem 1.25rem',
          borderRadius: '10px',
          background: actionMsg.error ? '#fef2f2' : '#f0fdf4',
          border: `1px solid ${actionMsg.error ? '#fecaca' : '#bbf7d0'}`,
          color: actionMsg.error ? '#dc2626' : '#16a34a',
          fontSize: '0.9rem',
          fontWeight: 600,
        }}>
          {actionMsg.text}
        </div>
      )}

      {/* Scheduled Posts & Publishing Queue */}
      <div className="card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '9px',
              background: '#ecfeff', color: '#0891b2',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Calendar size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                Scheduled Posts &amp; Queue
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)', margin: 0 }}>
                {scheduledPosts.length} post{scheduledPosts.length === 1 ? '' : 's'} waiting to be published automatically
              </p>
            </div>
          </div>
          <Link href="/upload" className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <UploadCloud size={14} /> + Schedule New Post
          </Link>
        </div>

        {scheduledPosts.length === 0 ? (
          <div style={{
            padding: '2.5rem 1.5rem',
            textAlign: 'center',
            background: '#f8fafc',
            borderRadius: '12px',
            border: '1px dashed var(--border)',
          }}>
            <Clock size={36} color="#94a3b8" style={{ margin: '0 auto 0.75rem' }} />
            <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.25rem' }}>
              No upcoming posts scheduled
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-dim)', maxWidth: '400px', margin: '0 auto 1rem' }}>
              You can schedule Instagram Reels, Facebook videos, and posts in advance. They will appear here in your queue.
            </p>
            <Link href="/upload" className="btn btn-secondary btn-sm">
              Schedule a Post Now
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {scheduledPosts.map((post) => {
              const scheduledDate = post.scheduledAt ? new Date(post.scheduledAt) : null;
              const formattedDate = scheduledDate && !isNaN(scheduledDate.getTime())
                ? scheduledDate.toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true,
                  })
                : 'Pending time';

              return (
                <div
                  key={post.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '1rem 1.25rem',
                    borderRadius: '12px',
                    background: '#f8fafc',
                    border: '1px solid var(--border)',
                    flexWrap: 'wrap',
                    gap: '1rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, minWidth: '240px' }}>
                    {/* Platform Badge */}
                    <div style={{
                      width: '38px', height: '38px', borderRadius: '10px',
                      background: post.platform === 'Instagram' ? '#fdf2f8' : '#eff6ff',
                      color: post.platform === 'Instagram' ? '#db2777' : '#1877f2',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      {post.platform === 'Instagram' ? <InstagramIcon size={18} /> : <FacebookIcon size={18} />}
                    </div>

                    {/* Post Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)' }}>
                          {post.clientName}
                        </span>
                        <span className="badge badge-info" style={{ fontSize: '0.7rem', padding: '2px 7px' }}>
                          {post.mediaType === 'video' ? '🎬 Reel/Video' : '📷 Image'}
                        </span>
                      </div>
                      <div style={{
                        fontSize: '0.85rem',
                        color: 'var(--text-muted)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: '450px',
                      }}>
                        {post.caption || post.title || 'Untitled Post'}
                      </div>
                    </div>
                  </div>

                  {/* Scheduled Time & Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#0891b2', fontSize: '0.82rem', fontWeight: 600 }}>
                      <Clock size={15} />
                      <span>{formattedDate}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <button
                        onClick={() => handlePublishNow(post.id)}
                        disabled={publishingId === post.id}
                        className="btn btn-primary btn-sm"
                        style={{ fontSize: '0.78rem', padding: '0.4rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                        title="Publish immediately without waiting for scheduled time"
                      >
                        <Send size={12} />
                        {publishingId === post.id ? 'Publishing...' : 'Publish Now'}
                      </button>

                      <button
                        onClick={() => handleDeletePost(post.id)}
                        className="btn btn-ghost btn-sm"
                        style={{ color: '#ef4444', padding: '0.4rem 0.6rem' }}
                        title="Cancel & delete scheduled post"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Connected Accounts Summary */}
      {connectedAccounts.length > 0 && (
        <div className="card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>
              Connected Accounts
            </h3>
            <Link href="/connect" className="btn btn-ghost btn-sm" style={{ color: 'var(--primary)' }}>
              Manage <ArrowRight size={14} />
            </Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {connectedAccounts.map((acc) => (
              <div key={acc.id} style={{
                display: 'flex', alignItems: 'center', gap: '0.85rem',
                padding: '0.7rem 0.85rem',
                borderRadius: '10px', background: '#f8fafc',
                border: '1px solid var(--border)',
              }}>
                <div style={{
                  width: '32px', height: '32px', borderRadius: '8px',
                  background: acc.platform === 'Instagram' ? '#fdf2f8' : '#eff6ff',
                  color: acc.platform === 'Instagram' ? '#db2777' : '#1877f2',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {acc.platform === 'Instagram' ? <InstagramIcon size={16} /> : <FacebookIcon size={16} />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main)' }}>{acc.clientName}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{acc.platform}</div>
                </div>
                <span className="badge badge-success">
                  <CheckCircle2 size={10} /> Connected
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {connectedAccounts.length === 0 && (
        <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
          <Link2 size={40} color="#94a3b8" style={{ margin: '0 auto 1rem' }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.35rem' }}>
            No accounts connected yet
          </h3>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
            Connect your Facebook & Instagram accounts to get started
          </p>
          <Link href="/connect" className="btn btn-primary">
            <Link2 size={16} /> Connect Accounts
          </Link>
        </div>
      )}
    </div>
  );
}
