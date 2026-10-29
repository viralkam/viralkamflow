'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  MessageSquare,
  Search,
  Filter,
  RefreshCw,
  Send,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Heart,
  Clock,
  Sparkles,
  Bot,
  User,
  ArrowRight,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { InstagramIcon, FacebookIcon, MetaIcon } from '@/components/PlatformIcons';

interface CommentItem {
  id: string;
  commentId: string;
  platform: 'Instagram' | 'Facebook';
  accountName: string;
  accountId?: string;
  mediaId: string;
  postTitle: string;
  permalink?: string;
  fromUser: string;
  fromName: string;
  fromId?: string;
  text: string;
  timestamp: string;
  likeCount: number;
  replied: boolean;
  replyText?: string;
}

export default function CommentsInboxPage() {
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [platformFilter, setPlatformFilter] = useState<'All' | 'Instagram' | 'Facebook'>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Unreplied' | 'Replied'>('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Inline Reply State
  const [replyingCommentId, setReplyingCommentId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [replySuccessMessage, setReplySuccessMessage] = useState<string | null>(null);

  const fetchComments = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    setError(null);
    try {
      const res = await fetch('/api/comments');
      const data = await res.json();
      if (data.comments) {
        setComments(data.comments);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch live comments.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchComments();
  }, []);

  // Quick reply presets
  const quickPresets = [
    'Sent you a DM with the link! 📩',
    'Thanks for watching! Check your inbox 🚀',
    'Details shared in your DM! Let me know if you need anything else 👍',
  ];

  const handleSendReply = async (comment: CommentItem) => {
    if (!replyText.trim()) return;
    setSendingReply(true);
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commentId: comment.commentId,
          platform: comment.platform,
          replyMessage: replyText.trim(),
          accountId: comment.accountId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send reply');

      // Update local state to mark replied
      setComments((prev) =>
        prev.map((c) =>
          c.commentId === comment.commentId
            ? { ...c, replied: true, replyText: replyText.trim() }
            : c
        )
      );

      setReplySuccessMessage(`Reply posted to @${comment.fromUser} successfully!`);
      setReplyingCommentId(null);
      setReplyText('');
      setTimeout(() => setReplySuccessMessage(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Error posting reply');
    } finally {
      setSendingReply(false);
    }
  };

  // Filtered comments
  const filteredComments = useMemo(() => {
    return comments.filter((c) => {
      if (platformFilter !== 'All' && c.platform !== platformFilter) return false;
      if (statusFilter === 'Unreplied' && c.replied) return false;
      if (statusFilter === 'Replied' && !c.replied) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesUser = c.fromUser.toLowerCase().includes(q) || c.fromName.toLowerCase().includes(q);
        const matchesText = c.text.toLowerCase().includes(q);
        const matchesPost = c.postTitle.toLowerCase().includes(q);
        if (!matchesUser && !matchesText && !matchesPost) return false;
      }
      return true;
    });
  }, [comments, platformFilter, statusFilter, searchQuery]);

  const totalCount = comments.length;
  const igCount = comments.filter((c) => c.platform === 'Instagram').length;
  const fbCount = comments.filter((c) => c.platform === 'Facebook').length;
  const unrepliedCount = comments.filter((c) => !c.replied).length;

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const diffMs = Date.now() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}d ago`;
    } catch {
      return 'Recently';
    }
  };

  return (
    <div className="app-container" style={{ maxWidth: '1000px' }}>
      {/* Top Header */}
      <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
            <span style={{
              background: '#e0e7ff',
              color: '#4338ca',
              padding: '0.2rem 0.65rem',
              borderRadius: '999px',
              fontSize: '0.75rem',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
            }}>
              <MessageSquare size={12} /> Live Unified Inbox
            </span>
          </div>
          <h1 className="page-title">Live Comments Inbox</h1>
          <p className="page-desc">
            Sabhi users ke real comments Facebook Pages aur Instagram Reels se yahan live sync hote hain. Aap direct yahan se reply bhi kar sakte hain.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={() => fetchComments(true)}
            disabled={refreshing}
            className="btn btn-secondary"
            style={{ padding: '0.65rem 1rem', fontSize: '0.85rem' }}
          >
            <RefreshCw size={15} className={refreshing ? 'spinner' : ''} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh Comments'}</span>
          </button>

          <Link href="/auto-reply" className="btn btn-primary" style={{ padding: '0.65rem 1.15rem', fontSize: '0.85rem' }}>
            <Bot size={16} />
            <span>Auto-Reply Rules</span>
          </Link>
        </div>
      </div>

      {/* Metrics Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem',
        marginBottom: '1.75rem',
      }}>
        <div className="card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#eef2ff', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <MessageSquare size={20} />
          </div>
          <div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)' }}>{totalCount}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 600 }}>Total Comments</div>
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#fdf2f8', color: '#db2777', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <InstagramIcon size={20} />
          </div>
          <div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)' }}>{igCount}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 600 }}>Instagram Comments</div>
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#eff6ff', color: '#1877f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FacebookIcon size={20} />
          </div>
          <div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)' }}>{fbCount}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 600 }}>Facebook Comments</div>
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: unrepliedCount > 0 ? '#fffbeb' : '#ecfdf5', color: unrepliedCount > 0 ? '#d97706' : '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Sparkles size={20} />
          </div>
          <div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)' }}>{unrepliedCount}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 600 }}>Pending Reply</div>
          </div>
        </div>
      </div>

      {/* Success banner */}
      {replySuccessMessage && (
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
          gap: '0.6rem',
        }}>
          <CheckCircle2 size={18} color="#059669" />
          <span>{replySuccessMessage}</span>
        </div>
      )}

      {/* Search & Filter Toolbar */}
      <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* Search bar */}
          <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
            <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              className="input"
              placeholder="Search by user name, keyword, or post..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '2.25rem' }}
            />
          </div>

          {/* Platform Filters */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: '#f1f5f9', padding: '0.25rem', borderRadius: '8px' }}>
            {(['All', 'Instagram', 'Facebook'] as const).map((p) => {
              const isSelected = platformFilter === p;
              return (
                <button
                  key={p}
                  onClick={() => setPlatformFilter(p)}
                  style={{
                    padding: '0.4rem 0.75rem',
                    borderRadius: '6px',
                    border: 'none',
                    background: isSelected ? '#ffffff' : 'transparent',
                    color: isSelected ? 'var(--text-main)' : 'var(--text-muted)',
                    fontWeight: isSelected ? 700 : 500,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    boxShadow: isSelected ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                  }}
                >
                  {p === 'Instagram' && <InstagramIcon size={13} />}
                  {p === 'Facebook' && <FacebookIcon size={13} />}
                  {p === 'All' && <MetaIcon size={13} />}
                  <span>{p}</span>
                </button>
              );
            })}
          </div>

          {/* Status Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: '#f1f5f9', padding: '0.25rem', borderRadius: '8px' }}>
            {(['All', 'Unreplied', 'Replied'] as const).map((s) => {
              const isSelected = statusFilter === s;
              return (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  style={{
                    padding: '0.4rem 0.75rem',
                    borderRadius: '6px',
                    border: 'none',
                    background: isSelected ? '#ffffff' : 'transparent',
                    color: isSelected ? 'var(--text-main)' : 'var(--text-muted)',
                    fontWeight: isSelected ? 700 : 500,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    boxShadow: isSelected ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  }}
                >
                  {s === 'All' ? 'All Status' : s}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* COMMENTS LIST */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2.5rem' }}>
        {loading ? (
          <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
            <RefreshCw size={28} className="spinner" style={{ margin: '0 auto 1rem', color: '#4f46e5' }} />
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>Fetching all real comments from Meta...</p>
          </div>
        ) : filteredComments.length === 0 ? (
          <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
            <MessageSquare size={36} color="#cbd5e1" style={{ margin: '0 auto 0.75rem' }} />
            <h4 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)', margin: '0 0 0.35rem' }}>
              No comments match your filter
            </h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
              Try changing the search query or status filter above.
            </p>
          </div>
        ) : (
          filteredComments.map((comment) => {
            const isReplying = replyingCommentId === comment.commentId;

            return (
              <div
                key={comment.id}
                className="card"
                style={{
                  padding: '1.25rem 1.5rem',
                  border: comment.replied ? '1px solid var(--border)' : '1.5px solid #c7d2fe',
                  background: comment.replied ? '#ffffff' : '#fafbff',
                  transition: 'all 0.2s ease',
                }}
              >
                {/* Header: User details + Platform + Post */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.85rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {/* User Avatar */}
                    <div style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '50%',
                      background: comment.platform === 'Instagram'
                        ? 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)'
                        : '#1877f2',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: '0.9rem',
                      flexShrink: 0,
                    }}>
                      {comment.fromName.charAt(0).toUpperCase()}
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-main)' }}>
                          {comment.fromName}
                        </span>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                          @{comment.fromUser}
                        </span>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          padding: '0.15rem 0.5rem',
                          borderRadius: '4px',
                          background: comment.platform === 'Instagram' ? '#fdf2f8' : '#eff6ff',
                          color: comment.platform === 'Instagram' ? '#db2777' : '#1877f2',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                        }}>
                          {comment.platform === 'Instagram' ? <InstagramIcon size={12} /> : <FacebookIcon size={12} />}
                          <span>{comment.platform}</span>
                        </span>
                      </div>

                      {/* Post reference */}
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-dim)', marginTop: '0.15rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span>on:</span>
                        <span style={{ fontWeight: 600, color: '#475569' }}>
                          "{comment.postTitle}"
                        </span>
                        {comment.permalink && (
                          <a
                            href={comment.permalink}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: '#6366f1', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}
                            title="View post on Meta"
                          >
                            <ExternalLink size={11} />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Timestamp & Status badge */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Clock size={12} />
                      {formatTime(comment.timestamp)}
                    </span>

                    {comment.replied ? (
                      <span style={{
                        padding: '0.2rem 0.6rem',
                        borderRadius: '999px',
                        background: '#ecfdf5',
                        color: '#059669',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                      }}>
                        <CheckCircle2 size={12} /> Replied
                      </span>
                    ) : (
                      <span style={{
                        padding: '0.2rem 0.6rem',
                        borderRadius: '999px',
                        background: '#fffbeb',
                        color: '#b45309',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                      }}>
                        Needs Reply
                      </span>
                    )}
                  </div>
                </div>

                {/* Comment Text Body */}
                <div style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: 'var(--radius-sm)',
                  padding: '0.85rem 1rem',
                  marginBottom: '0.75rem',
                }}>
                  <p style={{ fontSize: '0.92rem', color: 'var(--text-main)', margin: 0, lineHeight: 1.5, fontWeight: 500 }}>
                    "{comment.text}"
                  </p>
                </div>

                {/* If replied, show replied preview */}
                {comment.replied && comment.replyText && (
                  <div style={{
                    padding: '0.6rem 0.85rem',
                    borderRadius: 'var(--radius-sm)',
                    background: '#f8fafc',
                    borderLeft: '3px solid #10b981',
                    fontSize: '0.82rem',
                    color: '#334155',
                    marginBottom: '0.75rem',
                  }}>
                    <strong style={{ color: '#047857' }}>Your Reply:</strong> "{comment.replyText}"
                  </div>
                )}

                {/* Actions Bar */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Heart size={13} color="#f43f5e" /> {comment.likeCount} likes
                    </span>
                    <span>Account: {comment.accountName}</span>
                  </div>

                  <div>
                    {!isReplying && (
                      <button
                        onClick={() => {
                          setReplyingCommentId(comment.commentId);
                          setReplyText('');
                        }}
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}
                      >
                        <Send size={12} color="#4f46e5" />
                        <span>{comment.replied ? 'Reply Again' : 'Quick Reply'}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* INLINE REPLY COMPOSER */}
                {isReplying && (
                  <div style={{
                    marginTop: '1rem',
                    padding: '1rem',
                    borderRadius: 'var(--radius-md)',
                    background: '#f8faff',
                    border: '1.5px solid #818cf8',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#3730a3', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Send size={13} />
                        Replying to @{comment.fromUser}
                      </span>
                      <button
                        onClick={() => setReplyingCommentId(null)}
                        style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: '0.75rem', cursor: 'pointer' }}
                      >
                        Cancel
                      </button>
                    </div>

                    {/* Quick Presets */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontWeight: 600 }}>Presets:</span>
                      {quickPresets.map((preset, pIdx) => (
                        <button
                          key={pIdx}
                          type="button"
                          onClick={() => setReplyText(preset)}
                          style={{
                            fontSize: '0.72rem',
                            padding: '0.2rem 0.5rem',
                            borderRadius: '4px',
                            background: '#ffffff',
                            border: '1px solid #cbd5e1',
                            color: '#334155',
                            cursor: 'pointer',
                          }}
                        >
                          {preset.slice(0, 24)}...
                        </button>
                      ))}
                    </div>

                    <textarea
                      className="textarea"
                      rows={2}
                      placeholder={`Write your reply to @${comment.fromUser}...`}
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      style={{ fontSize: '0.85rem' }}
                    />

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.65rem' }}>
                      <button
                        type="button"
                        onClick={() => setReplyingCommentId(null)}
                        className="btn btn-ghost btn-sm"
                        style={{ fontSize: '0.78rem' }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={sendingReply || !replyText.trim()}
                        onClick={() => handleSendReply(comment)}
                        className="btn btn-primary btn-sm"
                        style={{ padding: '0.45rem 1rem', fontSize: '0.8rem' }}
                      >
                        <Send size={13} className={sendingReply ? 'spinner' : ''} />
                        <span>{sendingReply ? 'Sending...' : 'Send Live Reply'}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '2rem' }}>
        <Link href="/auto-reply" className="btn btn-secondary">
          ← Back to Auto-Reply Rules
        </Link>
        <Link href="/dashboard" className="btn btn-primary" style={{ padding: '0.8rem 1.75rem' }}>
          <span>Go to Overview</span>
          <ArrowRight size={18} />
        </Link>
      </div>
    </div>
  );
}
