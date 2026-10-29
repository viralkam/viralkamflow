'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { InstagramIcon, FacebookIcon } from '@/components/PlatformIcons';
import {
  LayoutGrid, List, RefreshCw, ExternalLink, Heart, MessageCircle,
  Share2, Film, Image as ImageIcon, Search, Plus, Calendar, Clock,
  CheckCircle2, AlertTriangle, Play, X, Zap, Send, Trash2
} from 'lucide-react';
import Link from 'next/link';

interface ContentItem {
  id: string;
  platform: 'Instagram' | 'Facebook';
  caption: string;
  mediaType: 'video' | 'image' | 'text';
  mediaUrl?: string;
  thumbnailUrl?: string;
  permalink?: string;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  viewCount?: number;
  publishedAt: string;
  accountName: string;
}

export default function ContentManagerPage() {
  const router = useRouter();
  const { user, isLoaded, accounts, posts, deletePost, refreshData } = useApp();

  const [contentTab, setContentTab] = useState<'queue' | 'live'>('queue');
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<{ text: string; error?: boolean } | null>(null);

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [platformFilter, setPlatformFilter] = useState<'all' | 'Instagram' | 'Facebook'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'video' | 'image'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [metaFeedItems, setMetaFeedItems] = useState<ContentItem[]>([]);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  // Scheduled posts filter
  const scheduledPosts = useMemo(() => {
    let list = (posts || []).filter(p => p.status === 'scheduled');
    if (platformFilter !== 'all') {
      list = list.filter(p => p.platform === platformFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(p => (p.caption || '').toLowerCase().includes(q) || (p.title || '').toLowerCase().includes(q) || (p.clientName || '').toLowerCase().includes(q));
    }
    return list;
  }, [posts, platformFilter, searchQuery]);

  const handlePublishNow = async (postId: string) => {
    setPublishingId(postId);
    setActionNotice(null);
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
      setActionNotice({ text: 'Post published successfully!' });
      await refreshData();
      setTimeout(() => setActionNotice(null), 4000);
    } catch (err: any) {
      setActionNotice({ text: err.message || 'Publishing error', error: true });
    } finally {
      setPublishingId(null);
    }
  };

  const handleDeleteScheduled = async (postId: string) => {
    if (!confirm('Are you sure you want to cancel and delete this scheduled post?')) return;
    try {
      await deletePost(postId);
      await refreshData();
    } catch (err) {
      console.error('Delete post error:', err);
    }
  };

  // Selected item for modal preview
  const [selectedItem, setSelectedItem] = useState<ContentItem | null>(null);



  // Fetch live feed from Meta Graph API
  const syncLiveFeed = async () => {
    setIsSyncing(true);
    setSyncNotice(null);
    try {
      const res = await fetch('/api/meta/feed');
      const data = await res.json();
      if (data.items && Array.isArray(data.items)) {
        setMetaFeedItems(data.items);
        setSyncNotice(`Synced ${data.items.length} live posts from Meta!`);
        setTimeout(() => setSyncNotice(null), 4000);
      }
    } catch (err) {
      console.warn('Live sync fallback:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    if (user.loggedIn) {
      syncLiveFeed();
    }
  }, [user.loggedIn]);

  // Content Manager displays 100% verified live content from Meta Graph API
  const allContent: ContentItem[] = useMemo(() => {
    let filtered = [...metaFeedItems];

    // Filter by Platform
    if (platformFilter !== 'all') {
      filtered = filtered.filter(item => item.platform === platformFilter);
    }

    // Filter by Media Type
    if (typeFilter !== 'all') {
      filtered = filtered.filter(item => item.mediaType === typeFilter);
    }

    // Filter by Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(item =>
        item.caption.toLowerCase().includes(q) || item.accountName.toLowerCase().includes(q)
      );
    }

    return filtered;
  }, [metaFeedItems, platformFilter, typeFilter, searchQuery]);

  const connectedAccounts = accounts.filter(
    a => a.connectionStatus === 'Connected' && (a.platform === 'Facebook' || a.platform === 'Instagram')
  );

  const totalVideos = allContent.filter(c => c.mediaType === 'video').length;
  const totalLikes = allContent.reduce((sum, c) => sum + (c.likeCount || 0), 0);
  const totalComments = allContent.reduce((sum, c) => sum + (c.commentCount || 0), 0);
  const totalViews = allContent.reduce((sum, c) => sum + (c.viewCount || 0), 0);

  return (
    <div className="app-container" style={{ maxWidth: '1050px' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.75rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title">Step 3: Content Manager</h1>
          <p className="page-desc">
            Manage, review, and track all your published Reels, videos, and posts across your connected Facebook &amp; Instagram accounts.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={syncLiveFeed}
            disabled={isSyncing}
            className="btn btn-secondary"
            style={{ padding: '0.65rem 1rem', fontSize: '0.88rem' }}
            title="Fetch latest posts from Meta Graph API"
          >
            <RefreshCw size={15} className={isSyncing ? 'spinner' : ''} />
            <span>{isSyncing ? 'Syncing...' : 'Sync from Meta'}</span>
          </button>

          <Link href="/upload" className="btn btn-primary" style={{ padding: '0.65rem 1.15rem', fontSize: '0.88rem' }}>
            <Plus size={16} />
            <span>New Post</span>
          </Link>
        </div>
      </div>

      {/* Connected Channels Banner */}
      <div style={{
        background: '#fff',
        borderRadius: 'var(--radius-md)',
        padding: '0.85rem 1.25rem',
        border: '1px solid var(--border)',
        marginBottom: '1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.75rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase' }}>
            Connected Profiles:
          </span>
          {connectedAccounts.length > 0 ? (
            connectedAccounts.map(acc => (
              <span
                key={acc.id}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.25rem 0.65rem',
                  borderRadius: '999px',
                  background: acc.platform === 'Instagram' ? '#fdf2f8' : '#eff6ff',
                  color: acc.platform === 'Instagram' ? '#db2777' : '#1877f2',
                  fontSize: '0.8rem',
                  fontWeight: 600
                }}
              >
                {acc.platform === 'Instagram' ? <InstagramIcon size={14} /> : <FacebookIcon size={14} />}
                <span>{acc.clientName}</span>
              </span>
            ))
          ) : (
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              No accounts linked yet. <Link href="/profile" style={{ color: 'var(--primary)', fontWeight: 600 }}>Link Meta Account</Link>
            </span>
          )}
        </div>

        {syncNotice && (
          <span style={{ fontSize: '0.82rem', color: '#059669', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <CheckCircle2 size={14} /> {syncNotice}
          </span>
        )}
      </div>

      {/* Metrics Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '1rem',
        marginBottom: '1.75rem'
      }}>
        <div className="card" style={{ padding: '1.15rem' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase' }}>
            Total Posts
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '0.25rem' }}>
            {allContent.length}
          </div>
        </div>

        <div className="card" style={{ padding: '1.15rem' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase' }}>
            Reels / Videos
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#4f46e5', marginTop: '0.25rem' }}>
            {totalVideos}
          </div>
        </div>

        <div className="card" style={{ padding: '1.15rem' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase' }}>
            Total Likes
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#db2777', marginTop: '0.25rem' }}>
            {totalLikes.toLocaleString()}
          </div>
        </div>

        <div className="card" style={{ padding: '1.15rem' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase' }}>
            Total Comments
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#059669', marginTop: '0.25rem' }}>
            {totalComments.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Controls & Filters Bar */}
      <div className="card" style={{ padding: '1rem 1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          
          {/* Search Box */}
          <div style={{ position: 'relative', minWidth: '220px', flex: 1 }}>
            <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
            <input
              type="text"
              placeholder="Search captions, tags..."
              className="input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '2.2rem', fontSize: '0.88rem' }}
            />
          </div>

          {/* Platform Filters */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: '#f1f5f9', padding: '0.25rem', borderRadius: '8px' }}>
            {(['all', 'Instagram', 'Facebook'] as const).map(p => (
              <button
                key={p}
                onClick={() => setPlatformFilter(p)}
                style={{
                  padding: '0.35rem 0.75rem',
                  borderRadius: '6px',
                  border: 'none',
                  background: platformFilter === p ? '#fff' : 'transparent',
                  color: platformFilter === p ? 'var(--text-main)' : 'var(--text-muted)',
                  fontWeight: platformFilter === p ? 700 : 500,
                  fontSize: '0.82rem',
                  boxShadow: platformFilter === p ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  cursor: 'pointer'
                }}
              >
                {p === 'all' ? 'All Platforms' : p}
              </button>
            ))}
          </div>

          {/* Media Type Filters */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: '#f1f5f9', padding: '0.25rem', borderRadius: '8px' }}>
            {(['all', 'video', 'image'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                style={{
                  padding: '0.35rem 0.75rem',
                  borderRadius: '6px',
                  border: 'none',
                  background: typeFilter === t ? '#fff' : 'transparent',
                  color: typeFilter === t ? 'var(--text-main)' : 'var(--text-muted)',
                  fontWeight: typeFilter === t ? 700 : 500,
                  fontSize: '0.82rem',
                  boxShadow: typeFilter === t ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  cursor: 'pointer'
                }}
              >
                {t === 'all' ? 'All Types' : t === 'video' ? '🎬 Reels' : '🖼️ Photos'}
              </button>
            ))}
          </div>

          {/* View Mode Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', background: '#f1f5f9', padding: '0.25rem', borderRadius: '8px' }}>
            <button
              onClick={() => setViewMode('grid')}
              style={{
                padding: '0.35rem 0.55rem',
                borderRadius: '6px',
                border: 'none',
                background: viewMode === 'grid' ? '#fff' : 'transparent',
                color: viewMode === 'grid' ? '#4f46e5' : 'var(--text-dim)',
                boxShadow: viewMode === 'grid' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                cursor: 'pointer'
              }}
              title="Grid View"
            >
              <LayoutGrid size={17} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              style={{
                padding: '0.35rem 0.55rem',
                borderRadius: '6px',
                border: 'none',
                background: viewMode === 'list' ? '#fff' : 'transparent',
                color: viewMode === 'list' ? '#4f46e5' : 'var(--text-dim)',
                boxShadow: viewMode === 'list' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                cursor: 'pointer'
              }}
              title="List View"
            >
              <List size={17} />
            </button>
          </div>

        </div>
      </div>

      {/* Primary Tab Switcher */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
        <button
          onClick={() => setContentTab('queue')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.6rem 1.15rem',
            borderRadius: '8px',
            border: 'none',
            background: contentTab === 'queue' ? '#4f46e5' : '#f8fafc',
            color: contentTab === 'queue' ? '#fff' : 'var(--text-main)',
            fontWeight: 700,
            fontSize: '0.9rem',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <Calendar size={16} />
          <span>Scheduled Queue</span>
          <span style={{
            background: contentTab === 'queue' ? 'rgba(255,255,255,0.25)' : '#e2e8f0',
            color: contentTab === 'queue' ? '#fff' : 'var(--text-main)',
            padding: '2px 7px',
            borderRadius: '999px',
            fontSize: '0.75rem',
            fontWeight: 800,
          }}>
            {scheduledPosts.length}
          </span>
        </button>

        <button
          onClick={() => setContentTab('live')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.6rem 1.15rem',
            borderRadius: '8px',
            border: 'none',
            background: contentTab === 'live' ? '#4f46e5' : '#f8fafc',
            color: contentTab === 'live' ? '#fff' : 'var(--text-main)',
            fontWeight: 700,
            fontSize: '0.9rem',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <Zap size={16} />
          <span>Live Meta Feed</span>
          <span style={{
            background: contentTab === 'live' ? 'rgba(255,255,255,0.25)' : '#e2e8f0',
            color: contentTab === 'live' ? '#fff' : 'var(--text-main)',
            padding: '2px 7px',
            borderRadius: '999px',
            fontSize: '0.75rem',
            fontWeight: 800,
          }}>
            {allContent.length}
          </span>
        </button>
      </div>

      {actionNotice && (
        <div style={{
          marginBottom: '1.5rem',
          padding: '0.85rem 1.25rem',
          borderRadius: '10px',
          background: actionNotice.error ? '#fef2f2' : '#f0fdf4',
          border: `1px solid ${actionNotice.error ? '#fecaca' : '#bbf7d0'}`,
          color: actionNotice.error ? '#dc2626' : '#16a34a',
          fontSize: '0.9rem',
          fontWeight: 600,
        }}>
          {actionNotice.text}
        </div>
      )}

      {/* SCHEDULED QUEUE TAB VIEW */}
      {contentTab === 'queue' ? (
        <div>
          {scheduledPosts.length === 0 ? (
            <div className="card" style={{ padding: '3.5rem 1.5rem', textAlign: 'center' }}>
              <Clock size={42} color="#94a3b8" style={{ margin: '0 auto 0.75rem' }} />
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)' }}>No Scheduled Posts</h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', maxWidth: '420px', margin: '0.4rem auto 1.5rem' }}>
                You have no upcoming posts in your scheduling queue. Upload videos or photos and set future dates/times to publish automatically.
              </p>
              <Link href="/upload" className="btn btn-primary">
                <Plus size={16} /> Schedule a Post Now
              </Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2.5rem' }}>
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
                    className="card"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '1.25rem 1.5rem',
                      flexWrap: 'wrap',
                      gap: '1.25rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.15rem', flex: 1, minWidth: '260px' }}>
                      <div style={{
                        width: '44px', height: '44px', borderRadius: '12px',
                        background: post.platform === 'Instagram' ? '#fdf2f8' : '#eff6ff',
                        color: post.platform === 'Instagram' ? '#db2777' : '#1877f2',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        {post.platform === 'Instagram' ? <InstagramIcon size={20} /> : <FacebookIcon size={20} />}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem' }}>
                          <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)' }}>
                            {post.clientName}
                          </span>
                          <span className="badge badge-info" style={{ fontSize: '0.72rem', padding: '2px 8px' }}>
                            {post.mediaType === 'video' ? '🎬 Reel/Video' : '📷 Image'}
                          </span>
                          <span className="badge badge-warning" style={{ fontSize: '0.72rem', padding: '2px 8px' }}>
                            Scheduled
                          </span>
                        </div>
                        <div style={{
                          fontSize: '0.88rem',
                          color: 'var(--text-muted)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          maxWidth: '500px',
                        }}>
                          {post.caption || post.title || 'Untitled Post'}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#0891b2', fontSize: '0.86rem', fontWeight: 700 }}>
                        <Clock size={16} />
                        <span>{formattedDate}</span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <button
                          onClick={() => handlePublishNow(post.id)}
                          disabled={publishingId === post.id}
                          className="btn btn-primary btn-sm"
                          style={{ fontSize: '0.82rem', padding: '0.45rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                          title="Publish immediately without waiting for scheduled time"
                        >
                          <Send size={13} />
                          {publishingId === post.id ? 'Publishing...' : 'Publish Now'}
                        </button>

                        <button
                          onClick={() => handleDeleteScheduled(post.id)}
                          className="btn btn-ghost btn-sm"
                          style={{ color: '#ef4444', padding: '0.45rem 0.65rem' }}
                          title="Cancel & delete scheduled post"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* LIVE META FEED VIEW */
        <div>
          {allContent.length === 0 ? (
        <div className="card" style={{ padding: '3.5rem', textAlign: 'center' }}>
          <Film size={40} color="#94a3b8" style={{ margin: '0 auto 0.75rem' }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>No Content Found</h3>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', maxWidth: '400px', margin: '0.4rem auto 1.5rem' }}>
            Publish your first Reel or post, or click 'Sync from Meta' to load existing posts from your Facebook Page or Instagram.
          </p>
          <Link href="/upload" className="btn btn-primary">
            Upload &amp; Publish Now
          </Link>
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID VIEW (Instagram & Facebook Grid Style) */
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '1.25rem',
          marginBottom: '2.5rem'
        }}>
          {allContent.map((item) => (
            <div
              key={item.id}
              onClick={() => setSelectedItem(item)}
              className="card"
              style={{
                padding: 0,
                overflow: 'hidden',
                cursor: 'pointer',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              {/* Media Thumbnail Container */}
              <div style={{
                position: 'relative',
                width: '100%',
                paddingTop: '65%',
                background: '#0f172a',
                overflow: 'hidden'
              }}>
                {item.thumbnailUrl || item.mediaUrl ? (
                  item.mediaType === 'video' && item.mediaUrl?.endsWith('.mp4') ? (
                    <video
                      src={item.mediaUrl}
                      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                      muted
                    />
                  ) : (
                    <img
                      src={item.thumbnailUrl || item.mediaUrl}
                      alt="Thumbnail"
                      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  )
                ) : (
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'linear-gradient(135deg, #1e293b, #0f172a)',
                    color: '#94a3b8',
                    padding: '1rem',
                    textAlign: 'center',
                    fontSize: '0.85rem'
                  }}>
                    {item.caption ? `"${item.caption.slice(0, 70)}..."` : 'Text Post'}
                  </div>
                )}

                {/* Top Overlay Badges */}
                <div style={{ position: 'absolute', top: '10px', left: '10px', display: 'flex', gap: '0.4rem' }}>
                  <span style={{
                    background: item.platform === 'Instagram' ? 'rgba(219, 39, 119, 0.9)' : 'rgba(24, 119, 242, 0.9)',
                    color: '#fff',
                    padding: '0.2rem 0.55rem',
                    borderRadius: '6px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    backdropFilter: 'blur(4px)'
                  }}>
                    {item.platform === 'Instagram' ? <InstagramIcon size={12} /> : <FacebookIcon size={12} />}
                    <span>{item.platform}</span>
                  </span>

                  {item.mediaType === 'video' && (
                    <span style={{
                      background: 'rgba(0,0,0,0.7)',
                      color: '#fff',
                      padding: '0.2rem 0.5rem',
                      borderRadius: '6px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      backdropFilter: 'blur(4px)'
                    }}>
                      <Film size={12} /> Reel
                    </span>
                  )}
                </div>
              </div>

              {/* Card Footer: Caption & Engagement Stats */}
              <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1, justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-dim)' }}>
                      {item.accountName}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                      {new Date(item.publishedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  <p style={{
                    fontSize: '0.85rem',
                    color: 'var(--text-main)',
                    lineHeight: 1.4,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    margin: 0
                  }}>
                    {item.caption || '(No caption)'}
                  </p>
                </div>

                {/* Engagement Bar */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderTop: '1px solid var(--border)',
                  paddingTop: '0.65rem',
                  marginTop: '0.4rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Heart size={14} color="#db2777" /> {item.likeCount}
                    </span>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <MessageCircle size={14} color="#4f46e5" /> {item.commentCount}
                    </span>
                    {item.viewCount !== undefined && item.viewCount > 0 && (
                      <span style={{ fontSize: '0.78rem', color: '#059669', display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 600 }}>
                        <Play size={12} fill="#059669" color="#059669" /> {item.viewCount} views
                      </span>
                    )}
                  </div>

                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--primary)' }}>
                    Manage →
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* LIST VIEW */
        <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: '2.5rem' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '0.85rem 1rem', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase' }}>Content</th>
                  <th style={{ padding: '0.85rem 1rem', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase' }}>Platform</th>
                  <th style={{ padding: '0.85rem 1rem', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase' }}>Type</th>
                  <th style={{ padding: '0.85rem 1rem', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase' }}>Likes</th>
                  <th style={{ padding: '0.85rem 1rem', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase' }}>Comments</th>
                  <th style={{ padding: '0.85rem 1rem', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase' }}>Date</th>
                  <th style={{ padding: '0.85rem 1rem', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {allContent.map((item) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                        <div style={{ width: '42px', height: '42px', borderRadius: '8px', background: '#0f172a', overflow: 'hidden', flexShrink: 0 }}>
                          {item.thumbnailUrl || item.mediaUrl ? (
                            <img src={item.thumbnailUrl || item.mediaUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.7rem' }}>Text</div>
                          )}
                        </div>
                        <div style={{ maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main)' }}>
                          {item.caption || '(Media post)'}
                        </div>
                      </div>
                    </td>

                    <td style={{ padding: '0.85rem 1rem' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        color: item.platform === 'Instagram' ? '#db2777' : '#1877f2'
                      }}>
                        {item.platform === 'Instagram' ? <InstagramIcon size={14} /> : <FacebookIcon size={14} />}
                        <span>{item.platform}</span>
                      </span>
                    </td>

                    <td style={{ padding: '0.85rem 1rem', fontSize: '0.82rem', color: 'var(--text-dim)' }}>
                      {item.mediaType === 'video' ? '🎬 Reel' : '🖼️ Photo'}
                    </td>

                    <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>
                      {item.likeCount}
                    </td>

                    <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>
                      {item.commentCount}
                    </td>

                    <td style={{ padding: '0.85rem 1rem', fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                      {new Date(item.publishedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </td>

                    <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                      <button
                        onClick={() => setSelectedItem(item)}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '0.8rem', padding: '0.3rem 0.75rem' }}
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        )}
        </div>
      )}

      {/* CONTENT DETAIL & ACTION MODAL */}
      {selectedItem && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.65)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1.5rem'
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '16px',
            maxWidth: '650px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '2rem',
            position: 'relative',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
          }}>
            {/* Close button */}
            <button
              onClick={() => setSelectedItem(null)}
              style={{
                position: 'absolute',
                top: '1.25rem',
                right: '1.25rem',
                border: 'none',
                background: '#f1f5f9',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-dim)'
              }}
            >
              <X size={18} />
            </button>

            {/* Header info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1.25rem' }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.3rem 0.75rem',
                borderRadius: '6px',
                background: selectedItem.platform === 'Instagram' ? '#fdf2f8' : '#eff6ff',
                color: selectedItem.platform === 'Instagram' ? '#db2777' : '#1877f2',
                fontWeight: 700,
                fontSize: '0.82rem'
              }}>
                {selectedItem.platform === 'Instagram' ? <InstagramIcon size={14} /> : <FacebookIcon size={14} />}
                <span>{selectedItem.platform}</span>
              </span>

              <span style={{ fontSize: '0.85rem', color: 'var(--text-dim)', fontWeight: 600 }}>
                {selectedItem.accountName} • {new Date(selectedItem.publishedAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
              </span>
            </div>

            {/* Media Player / Image Preview */}
            {(selectedItem.mediaUrl || selectedItem.thumbnailUrl) && (
              <div style={{
                borderRadius: '12px',
                overflow: 'hidden',
                background: '#000',
                marginBottom: '1.25rem',
                maxHeight: '350px',
                textAlign: 'center'
              }}>
                {selectedItem.mediaType === 'video' && selectedItem.mediaUrl?.endsWith('.mp4') ? (
                  <video
                    src={selectedItem.mediaUrl}
                    controls
                    autoPlay
                    style={{ maxHeight: '350px', width: '100%', objectFit: 'contain' }}
                  />
                ) : (
                  <img
                    src={selectedItem.thumbnailUrl || selectedItem.mediaUrl}
                    alt="Preview"
                    style={{ maxHeight: '350px', width: '100%', objectFit: 'contain' }}
                  />
                )}
              </div>
            )}

            {/* Caption */}
            <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', marginBottom: '1.25rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', display: 'block', marginBottom: '0.35rem' }}>
                Caption &amp; Hashtags:
              </span>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-main)', whiteSpace: 'pre-wrap', lineHeight: 1.5, margin: 0 }}>
                {selectedItem.caption || '(No caption text)'}
              </p>
            </div>

            {/* Live Metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: selectedItem.mediaType === 'video' ? 'repeat(4, 1fr)' : 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1.5rem', textAlign: 'center' }}>
              <div style={{ padding: '0.75rem', background: '#fdf2f8', borderRadius: '8px' }}>
                <span style={{ fontSize: '0.75rem', color: '#db2777', fontWeight: 600 }}>Likes</span>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#be185d' }}>{selectedItem.likeCount}</div>
              </div>

              <div style={{ padding: '0.75rem', background: '#eff6ff', borderRadius: '8px' }}>
                <span style={{ fontSize: '0.75rem', color: '#2563eb', fontWeight: 600 }}>Comments</span>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1d4ed8' }}>{selectedItem.commentCount}</div>
              </div>

              <div style={{ padding: '0.75rem', background: '#f1f5f9', borderRadius: '8px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontWeight: 600 }}>Shares</span>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>{selectedItem.shareCount}</div>
              </div>

              {selectedItem.mediaType === 'video' && (
                <div style={{ padding: '0.75rem', background: '#ecfdf5', borderRadius: '8px' }}>
                  <span style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 600 }}>Views</span>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#047857' }}>{selectedItem.viewCount || 0}</div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
              {selectedItem.permalink && (
                <a
                  href={selectedItem.permalink}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  <span>View on {selectedItem.platform}</span>
                  <ExternalLink size={14} />
                </a>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <Link
                  href="/auto-reply"
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#db2777' }}
                >
                  <Zap size={14} />
                  <span>Set Comment-to-DM</span>
                </Link>

                <Link
                  href="/upload"
                  className="btn btn-primary btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  <Plus size={14} />
                  <span>Repost / Reuse</span>
                </Link>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
