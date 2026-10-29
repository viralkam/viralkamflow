'use client';

import React, { useState } from 'react';
import { Platform } from '@/types';
import { InstagramIcon, FacebookIcon, ThreadsIcon } from './PlatformIcons';
import { 
  Heart, 
  MessageCircle, 
  Send, 
  Bookmark, 
  ThumbsUp, 
  Share2, 
  MoreHorizontal, 
  Eye,
  Repeat2
} from 'lucide-react';

interface SocialPreviewCardProps {
  platform?: Platform;
  clientName?: string;
  caption?: string;
  title?: string;
  description?: string;
  tags?: string[];
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
}

export function SocialPreviewCard({
  platform = 'Instagram',
  clientName = 'Your Account',
  caption = '',
  title = '',
  description = '',
  tags = [],
  mediaUrl = '',
  mediaType = 'image',
}: SocialPreviewCardProps) {
  const [activeTab, setActiveTab] = useState<Platform>(platform || 'Instagram');

  const displayName = clientName || 'creator_account';
  const tagString = tags.length > 0 ? tags.map(t => t.startsWith('#') ? t : `#${t}`).join(' ') : '';
  const fullContent = `${caption}${tagString ? '\n\n' + tagString : ''}`;

  return (
    <div className="social-preview-wrapper" style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-xl)',
      padding: '1.25rem',
      boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
      position: 'sticky',
      top: '80px',
    }}>
      {/* Header & Platform Toggle */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '1rem',
        paddingBottom: '0.75rem',
        borderBottom: '1px solid var(--border)',
        flexWrap: 'wrap',
        gap: '0.5rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Eye size={16} style={{ color: 'var(--primary)' }} />
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>
            Live Social Preview
          </span>
        </div>

        {/* Platform Switcher Pills */}
        <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
          {(['Instagram', 'Facebook', 'Threads'] as Platform[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setActiveTab(p)}
              style={{
                padding: '0.25rem 0.55rem',
                borderRadius: '999px',
                border: activeTab === p ? '1px solid var(--primary)' : '1px solid var(--border)',
                background: activeTab === p ? 'var(--primary-light)' : 'transparent',
                color: activeTab === p ? 'var(--primary)' : 'var(--text-dim)',
                fontSize: '0.72rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                transition: 'all 0.15s ease',
              }}
            >
              {p === 'Instagram' && <InstagramIcon size={12} />}
              {p === 'Facebook' && <FacebookIcon size={12} />}
              {p === 'Threads' && <ThreadsIcon size={12} />}
              <span>{p}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ================= INSTAGRAM PREVIEW ================= */}
      {activeTab === 'Instagram' && (
        <div className="mockup-instagram" style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: '0 4px 15px rgba(0,0,0,0.05)',
        }}>
          {/* IG Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.65rem 0.85rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
                padding: '2px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <div style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  background: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: '#333',
                }}>
                  {displayName.charAt(0).toUpperCase()}
                </div>
              </div>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#111827' }}>
                {displayName.toLowerCase().replace(/\s+/g, '_')}
              </span>
            </div>
            <MoreHorizontal size={16} color="#6b7280" />
          </div>

          {/* IG Media Frame */}
          <div style={{
            width: '100%',
            background: '#000',
            aspectRatio: mediaType === 'video' ? '9 / 16' : '1 / 1',
            maxHeight: '320px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            overflow: 'hidden',
          }}>
            {mediaUrl ? (
              mediaType === 'video' ? (
                <video src={mediaUrl} controls style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={mediaUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              )
            ) : (
              <div style={{ textAlign: 'center', color: '#94a3b8', padding: '1.5rem' }}>
                <InstagramIcon size={36} />
                <p style={{ fontSize: '0.75rem', marginTop: '0.4rem', color: '#94a3b8' }}>Select media to preview here</p>
              </div>
            )}
          </div>

          {/* IG Actions Bar */}
          <div style={{ padding: '0.65rem 0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.45rem' }}>
              <div style={{ display: 'flex', gap: '0.85rem' }}>
                <Heart size={20} color="#111827" />
                <MessageCircle size={20} color="#111827" />
                <Send size={20} color="#111827" />
              </div>
              <Bookmark size={20} color="#111827" />
            </div>
            <p style={{ fontSize: '0.78rem', fontWeight: 700, color: '#111827', marginBottom: '0.3rem' }}>
              1,248 likes
            </p>

            {/* IG Caption */}
            <div style={{ fontSize: '0.8rem', color: '#1f2937', lineHeight: 1.4, whiteSpace: 'pre-wrap' }}>
              <strong style={{ marginRight: '0.4rem' }}>{displayName.toLowerCase().replace(/\s+/g, '_')}</strong>
              <span>{fullContent || title || 'Your caption and hashtags will appear here...'}</span>
            </div>
          </div>
        </div>
      )}

      {/* ================= FACEBOOK PREVIEW ================= */}
      {activeTab === 'Facebook' && (
        <div className="mockup-facebook" style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: '0 4px 15px rgba(0,0,0,0.05)',
        }}>
          <div style={{ padding: '0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.6rem' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: '#1877f2',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '0.85rem',
              }}>
                {displayName.charAt(0).toUpperCase()}
              </div>
              <div>
                <p style={{ fontSize: '0.85rem', fontWeight: 700, color: '#111827', margin: 0 }}>
                  {displayName}
                </p>
                <p style={{ fontSize: '0.72rem', color: '#6b7280', margin: 0 }}>Just now · 🌍 Public</p>
              </div>
            </div>

            {/* Caption Text */}
            <p style={{ fontSize: '0.82rem', color: '#1f2937', lineHeight: 1.4, marginBottom: '0.6rem', whiteSpace: 'pre-wrap' }}>
              {title ? `${title}\n\n` : ''}{fullContent || 'Write your post caption in the editor...'}
            </p>
          </div>

          {/* FB Media Frame */}
          {mediaUrl && (
            <div style={{ width: '100%', maxHeight: '280px', background: '#000', overflow: 'hidden' }}>
              {mediaType === 'video' ? (
                <video src={mediaUrl} controls style={{ width: '100%', maxHeight: '280px', objectFit: 'contain' }} />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={mediaUrl} alt="Preview" style={{ width: '100%', maxHeight: '280px', objectFit: 'cover' }} />
              )}
            </div>
          )}

          {/* FB Engagement bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-around',
            padding: '0.6rem 0.85rem',
            borderTop: '1px solid #f1f5f9',
            fontSize: '0.78rem',
            fontWeight: 600,
            color: '#4b5563',
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}><ThumbsUp size={15} color="#1877f2" /> Like</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}><MessageCircle size={15} /> Comment</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}><Share2 size={15} /> Share</span>
          </div>
        </div>
      )}

      {/* ================= THREADS PREVIEW ================= */}
      {activeTab === 'Threads' && (
        <div className="mockup-threads" style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          overflow: 'hidden',
          padding: '0.85rem',
          boxShadow: '0 4px 15px rgba(0,0,0,0.05)',
        }}>
          <div style={{ display: 'flex', gap: '0.65rem' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: '#000',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '0.85rem',
              flexShrink: 0
            }}>
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#000' }}>
                  {displayName.toLowerCase().replace(/\s+/g, '_')}
                </span>
                <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>1m</span>
              </div>
              <p style={{ fontSize: '0.82rem', color: '#111827', marginTop: '0.35rem', lineHeight: 1.4, whiteSpace: 'pre-wrap' }}>
                {title ? `${title}\n\n` : ''}{fullContent || 'Your Threads post content...'}
              </p>

              {mediaUrl && (
                <div style={{ width: '100%', maxHeight: '240px', borderRadius: '8px', overflow: 'hidden', marginTop: '0.6rem', background: '#000' }}>
                  {mediaType === 'video' ? (
                    <video src={mediaUrl} controls style={{ width: '100%', maxHeight: '240px', objectFit: 'contain' }} />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={mediaUrl} alt="Preview" style={{ width: '100%', maxHeight: '240px', objectFit: 'cover' }} />
                  )}
                </div>
              )}

              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.65rem', color: '#111827' }}>
                <Heart size={16} />
                <MessageCircle size={16} />
                <Repeat2 size={16} />
                <Send size={16} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
