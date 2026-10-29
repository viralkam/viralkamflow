'use client';

export const dynamic = 'force-dynamic';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { InstagramIcon } from '@/components/PlatformIcons';
import {
  Heart, MessageCircle, Eye, Play, Image as ImageIcon,
  ExternalLink, RefreshCw, Filter, Grid3X3, List,
  TrendingUp, Plus
} from 'lucide-react';
import Link from 'next/link';

interface FeedItem {
  id: string;
  platform: string;
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

export default function InstagramPage() {
  const router = useRouter();
  const { user, isLoaded } = useApp();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'video' | 'image'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedItem, setSelectedItem] = useState<FeedItem | null>(null);

  const fetchFeed = async () => {
    setLoading(true);
    try {
      const url = `/api/meta/feed?platform=instagram${user.id ? `&userId=${encodeURIComponent(user.id)}` : ''}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.items) setItems(data.items);
    } catch {} finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isLoaded) fetchFeed();
  }, [isLoaded]);

  const filtered = filter === 'all' ? items : items.filter(i => i.mediaType === filter);
  const totalLikes = items.reduce((s, i) => s + i.likeCount, 0);
  const totalComments = items.reduce((s, i) => s + i.commentCount, 0);
  const totalViews = items.reduce((s, i) => s + (i.viewCount || 0), 0);
  const videoCount = items.filter(i => i.mediaType === 'video').length;
  const imageCount = items.filter(i => i.mediaType === 'image').length;

  return (
    <div className="app-container" style={{ maxWidth: '1100px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '10px',
            background: 'linear-gradient(135deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
          }}>
            <InstagramIcon size={22} />
          </div>
          <div>
            <h1 className="page-title" style={{ fontSize: '1.6rem' }}>Instagram</h1>
            <p className="page-desc">Your live Instagram posts, reels & engagement</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem' }}>
          <Link href="/upload" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Plus size={16} />
            <span>Create / Upload Post</span>
          </Link>
          <button onClick={fetchFeed} className="btn btn-secondary" disabled={loading}>
            <RefreshCw size={16} className={loading ? 'spinner' : ''} />
            <span>{loading ? 'Loading...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: '1rem', marginBottom: '1.75rem',
      }}>
        {[
          { label: 'Total Posts', value: items.length, icon: <Grid3X3 size={18} />, color: '#E1306C', bg: '#fdf2f8' },
          { label: 'Videos', value: videoCount, icon: <Play size={18} />, color: '#7c3aed', bg: '#f5f3ff' },
          { label: 'Images', value: imageCount, icon: <ImageIcon size={18} />, color: '#0891b2', bg: '#ecfeff' },
          { label: 'Total Likes', value: totalLikes.toLocaleString(), icon: <Heart size={18} />, color: '#e11d48', bg: '#fff1f2' },
          { label: 'Comments', value: totalComments.toLocaleString(), icon: <MessageCircle size={18} />, color: '#4f46e5', bg: '#eef2ff' },
          { label: 'Views', value: totalViews.toLocaleString(), icon: <Eye size={18} />, color: '#059669', bg: '#ecfdf5' },
        ].map((s) => (
          <div key={s.label} className="card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '9px',
              background: s.bg, color: s.color,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {s.icon}
            </div>
            <div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)' }}>{s.value}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontWeight: 600 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {[
            { key: 'all', label: `All (${items.length})` },
            { key: 'video', label: `Videos (${videoCount})` },
            { key: 'image', label: `Images (${imageCount})` },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key as any)}
              style={{
                padding: '0.45rem 0.9rem', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 600,
                background: filter === f.key ? '#fdf2f8' : '#f8fafc',
                border: filter === f.key ? '2px solid #E1306C' : '1px solid var(--border)',
                color: filter === f.key ? '#E1306C' : 'var(--text-muted)', cursor: 'pointer',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '0.35rem' }}>
          <button
            onClick={() => setViewMode('grid')}
            className={`btn btn-ghost btn-sm`}
            style={{ color: viewMode === 'grid' ? '#E1306C' : 'var(--text-dim)' }}
          >
            <Grid3X3 size={16} />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`btn btn-ghost btn-sm`}
            style={{ color: viewMode === 'list' ? '#E1306C' : 'var(--text-dim)' }}
          >
            <List size={16} />
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto 1rem' }} />
          <p style={{ color: 'var(--text-muted)' }}>Loading Instagram feed...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
          <div style={{ color: '#94a3b8', display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
            <InstagramIcon size={40} />
          </div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.35rem' }}>
            No Instagram posts found
          </h3>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Connect your Instagram account first to see your live content
          </p>
          <Link href="/connect" className="btn btn-primary">
            Connect Instagram
          </Link>
        </div>
      ) : viewMode === 'grid' ? (
        /* Grid View */
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '1.15rem',
        }}>
          {filtered.map((item) => (
            <div
              key={item.id}
              className="card"
              style={{ padding: 0, overflow: 'hidden', cursor: 'pointer' }}
              onClick={() => setSelectedItem(item)}
            >
              {/* Thumbnail */}
              <div style={{
                width: '100%', height: '200px', background: '#f1f5f9',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                position: 'relative', overflow: 'hidden',
              }}>
                {item.thumbnailUrl || item.mediaUrl ? (
                  <img
                    src={item.thumbnailUrl || item.mediaUrl}
                    alt={item.caption?.slice(0, 50) || 'Instagram post'}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  <ImageIcon size={32} color="#94a3b8" />
                )}
                {item.mediaType === 'video' && (
                  <div style={{
                    position: 'absolute', top: '8px', right: '8px',
                    background: 'rgba(0,0,0,0.7)', color: '#fff', borderRadius: '6px',
                    padding: '3px 8px', fontSize: '0.72rem', fontWeight: 700,
                    display: 'flex', alignItems: 'center', gap: '4px',
                  }}>
                    <Play size={10} /> Video
                  </div>
                )}
              </div>

              {/* Info */}
              <div style={{ padding: '1rem' }}>
                <p style={{
                  fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: 500,
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                  overflow: 'hidden', lineHeight: 1.45, marginBottom: '0.75rem', minHeight: '2.4em',
                }}>
                  {item.caption || '(No caption)'}
                </p>

                {/* Engagement */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', fontWeight: 700, color: '#e11d48' }}>
                    <Heart size={13} /> {item.likeCount.toLocaleString()}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', fontWeight: 700, color: '#4f46e5' }}>
                    <MessageCircle size={13} /> {item.commentCount.toLocaleString()}
                  </span>
                  {(item.viewCount || 0) > 0 && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', fontWeight: 700, color: '#059669' }}>
                      <Eye size={13} /> {(item.viewCount || 0).toLocaleString()}
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.6rem' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                    {new Date(item.publishedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                  {item.permalink && (
                    <a
                      href={item.permalink}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      style={{ fontSize: '0.72rem', color: '#E1306C', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px' }}
                    >
                      View <ExternalLink size={10} />
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* List View */
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {filtered.map((item, idx) => (
            <div
              key={item.id}
              style={{
                display: 'flex', alignItems: 'center', gap: '1rem',
                padding: '1rem 1.25rem',
                borderBottom: idx < filtered.length - 1 ? '1px solid var(--border)' : 'none',
                cursor: 'pointer', transition: 'background 0.15s',
              }}
              onClick={() => setSelectedItem(item)}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#fafbfe')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              {/* Thumbnail */}
              <div style={{
                width: '60px', height: '60px', borderRadius: '10px',
                background: '#f1f5f9', overflow: 'hidden', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {item.thumbnailUrl || item.mediaUrl ? (
                  <img src={item.thumbnailUrl || item.mediaUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                ) : (
                  <ImageIcon size={20} color="#94a3b8" />
                )}
              </div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.caption || '(No caption)'}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.3rem' }}>
                  <span className="badge badge-muted" style={{ textTransform: 'capitalize' }}>{item.mediaType}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                    {new Date(item.publishedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              </div>

              {/* Stats */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexShrink: 0 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#e11d48' }}>{item.likeCount.toLocaleString()}</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', fontWeight: 600 }}>Likes</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#4f46e5' }}>{item.commentCount.toLocaleString()}</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', fontWeight: 600 }}>Comments</div>
                </div>
                {(item.viewCount || 0) > 0 && (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#059669' }}>{(item.viewCount || 0).toLocaleString()}</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', fontWeight: 600 }}>Views</div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {selectedItem && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(4px)', zIndex: 500,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '2rem',
          }}
          onClick={() => setSelectedItem(null)}
        >
          <div
            className="card"
            style={{
              maxWidth: '600px', width: '100%', maxHeight: '85vh',
              overflow: 'auto', padding: '2rem',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Media */}
            {(selectedItem.thumbnailUrl || selectedItem.mediaUrl) && (
              <div style={{ borderRadius: '12px', overflow: 'hidden', marginBottom: '1.25rem', background: '#f1f5f9' }}>
                <img
                  src={selectedItem.mediaUrl || selectedItem.thumbnailUrl}
                  alt=""
                  style={{ width: '100%', maxHeight: '350px', objectFit: 'cover' }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              </div>
            )}

            {/* Caption */}
            <p style={{ fontSize: '0.95rem', color: 'var(--text-main)', lineHeight: 1.6, marginBottom: '1.25rem', whiteSpace: 'pre-wrap' }}>
              {selectedItem.caption || '(No caption)'}
            </p>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '0.85rem', marginBottom: '1.25rem' }}>
              <div style={{ padding: '0.85rem', borderRadius: '10px', background: '#fff1f2', textAlign: 'center' }}>
                <Heart size={18} color="#e11d48" style={{ margin: '0 auto 4px' }} />
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#e11d48' }}>{selectedItem.likeCount.toLocaleString()}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>Likes</div>
              </div>
              <div style={{ padding: '0.85rem', borderRadius: '10px', background: '#eef2ff', textAlign: 'center' }}>
                <MessageCircle size={18} color="#4f46e5" style={{ margin: '0 auto 4px' }} />
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#4f46e5' }}>{selectedItem.commentCount.toLocaleString()}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>Comments</div>
              </div>
              {(selectedItem.viewCount || 0) > 0 && (
                <div style={{ padding: '0.85rem', borderRadius: '10px', background: '#ecfdf5', textAlign: 'center' }}>
                  <Eye size={18} color="#059669" style={{ margin: '0 auto 4px' }} />
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#059669' }}>{(selectedItem.viewCount || 0).toLocaleString()}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>Views</div>
                </div>
              )}
            </div>

            {/* Meta */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>{selectedItem.accountName}</span>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginLeft: '0.5rem' }}>
                  {new Date(selectedItem.publishedAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {selectedItem.permalink && (
                  <a href={selectedItem.permalink} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
                    <ExternalLink size={13} /> Open on Instagram
                  </a>
                )}
                <button onClick={() => setSelectedItem(null)} className="btn btn-ghost btn-sm">Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
