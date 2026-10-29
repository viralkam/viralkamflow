'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { InstagramIcon, FacebookIcon, ThreadsIcon, MetaIcon } from '@/components/PlatformIcons';
import {
  MessageSquareText, Plus, CheckCircle2, AlertTriangle, Trash2,
  Zap, Copy, Check, Send, Sparkles, ArrowRight, ShieldCheck, ChevronDown, ChevronUp, RefreshCw,
  Lock, Unlock, UserCheck, UserX, Link2
} from 'lucide-react';
import Link from 'next/link';

export default function AutoReplyPage() {
  const router = useRouter();
  const {
    user, isLoaded, accounts, autoReplyRules,
    addAutoReplyRule, toggleAutoReplyRule, deleteAutoReplyRule, incrementRuleTriggerCount
  } = useApp();

  // New Rule Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [platform, setPlatform] = useState<'Instagram' | 'Facebook' | 'Threads' | 'All'>('Instagram');
  const [keyword, setKeyword] = useState('');
  const [dmMessage, setDmMessage] = useState('');
  const [commentReply, setCommentReply] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Follower-Only Link Gate State
  const [requireFollower, setRequireFollower] = useState(false);
  const [followerOnlyLink, setFollowerOnlyLink] = useState('');
  const [followerDmMessage, setFollowerDmMessage] = useState('');
  const [nonFollowerDmMessage, setNonFollowerDmMessage] = useState('');
  const [nonFollowerCommentReply, setNonFollowerCommentReply] = useState('');

  // Simulation State
  const [simulatingRuleId, setSimulatingRuleId] = useState<string | null>(null);
  const [simulationResult, setSimulationResult] = useState<{
    ruleId: string;
    commenter: string;
    keyword: string;
    sentDm: string;
    publicReply?: string;
    isFollower?: boolean;
    wasFollowerGated?: boolean;
  } | null>(null);

  // Live Auto-Reply Scanner State
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<any | null>(null);
  const [autoScanEnabled, setAutoScanEnabled] = useState(false);

  // Webhook Guide Toggle
  const [showWebhookGuide, setShowWebhookGuide] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);

  const webhookUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/webhooks/meta`
    : 'https://your-domain.com/api/webhooks/meta';
  const verifyToken = 'publishingflow_meta_token';



  // Sync initial server rules
  useEffect(() => {
    fetch('/api/auto-reply/rules')
      .then(res => res.json())
      .then(data => {
        if (data.rules && Array.isArray(data.rules) && data.rules.length > 0) {
          // If local is empty, populate from server
          if (autoReplyRules.length === 0) {
            for (const r of data.rules) {
              addAutoReplyRule(r).catch(() => {});
            }
          }
        }
      })
      .catch(() => {});
  }, []);

  // Background auto-scan poller for localhost development
  useEffect(() => {
    if (!autoScanEnabled) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/auto-reply/scan', { method: 'POST' });
        const data = await res.json();
        setScanResult(data);
        if (data.results?.some((r: any) => r.repliesTriggered > 0)) {
          // refresh triggers
        }
      } catch {}
    }, 20000);
    return () => clearInterval(interval);
  }, [autoScanEnabled]);

  const handleLiveScan = async () => {
    setIsScanning(true);
    setScanResult(null);
    try {
      const res = await fetch('/api/auto-reply/scan', { method: 'POST' });
      const data = await res.json();
      setScanResult(data);
      if (data.results) {
        const totalChecked = data.results.reduce((s: number, r: any) => s + (r.commentsChecked || 0), 0);
        const totalReplied = data.results.reduce((s: number, r: any) => s + (r.repliesTriggered || 0), 0);
        setFormSuccess(`Scanned ${totalChecked} comments across accounts. Sent ${totalReplied} auto-replies!`);
        setTimeout(() => setFormSuccess(null), 5000);
      }
    } catch (err: any) {
      setFormError(`Live scan failed: ${err.message}`);
    } finally {
      setIsScanning(false);
    }
  };


  const totalTriggers = autoReplyRules.reduce((acc, r) => acc + (r.triggerCount || 0), 0);
  const activeRulesCount = autoReplyRules.filter(r => r.isActive).length;

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!keyword.trim()) {
      setFormError('Please enter a trigger keyword (e.g. LINK, PRICE, INFO, or * for all).');
      return;
    }
    if (!dmMessage.trim()) {
      setFormError('Please enter the automated DM message to send.');
      return;
    }

    try {
      const newRule = await addAutoReplyRule({
        platform,
        keyword: keyword.trim().toUpperCase(),
        dmMessage: dmMessage.trim(),
        commentReply: commentReply.trim() || undefined,
        isActive,
        requireFollower,
        followerOnlyLink: followerOnlyLink.trim() || undefined,
        followerDmMessage: followerDmMessage.trim() || undefined,
        nonFollowerDmMessage: nonFollowerDmMessage.trim() || undefined,
        nonFollowerCommentReply: nonFollowerCommentReply.trim() || undefined,
      });

      // Persist to server API as well
      await fetch('/api/auto-reply/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRule),
      });

      setFormSuccess('Auto Reply rule saved successfully!');
      setKeyword('');
      setDmMessage('');
      setCommentReply('');
      setRequireFollower(false);
      setFollowerOnlyLink('');
      setFollowerDmMessage('');
      setNonFollowerDmMessage('');
      setNonFollowerCommentReply('');
      setShowAddForm(false);
      setTimeout(() => setFormSuccess(null), 4000);
    } catch (err: any) {
      setFormError(err.message || 'Failed to save rule.');
    }
  };

  const handleSimulateTest = async (rule: typeof autoReplyRules[0], asFollower: boolean = true) => {
    setSimulatingRuleId(rule.id);
    setSimulationResult(null);

    // Simulate 0.9 second processing
    setTimeout(async () => {
      await incrementRuleTriggerCount(rule.id);

      let sentDm = rule.dmMessage;
      let publicReply = rule.commentReply;

      if (rule.requireFollower) {
        if (asFollower) {
          sentDm = rule.followerDmMessage || rule.dmMessage;
          if (rule.followerOnlyLink && !sentDm.includes(rule.followerOnlyLink)) {
            sentDm += `\n\n🔗 Your exclusive link: ${rule.followerOnlyLink}`;
          }
        } else {
          sentDm = rule.nonFollowerDmMessage || "Hey! 👋 To unlock your exclusive link, please follow our account first! Once you follow, comment again or reply here. 🎁";
          publicReply = rule.nonFollowerCommentReply || "Please follow our profile first so we can DM you the link! 🔒";
        }
      }

      setSimulationResult({
        ruleId: rule.id,
        commenter: asFollower ? '@rahul_follower (Follower ✅)' : '@amit_guest (Non-Follower 🔒)',
        keyword: rule.keyword,
        sentDm,
        publicReply,
        isFollower: asFollower,
        wasFollowerGated: Boolean(rule.requireFollower),
      });
      setSimulatingRuleId(null);
    }, 900);
  };

  const copyToClipboard = (text: string, isToken: boolean = false) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      if (isToken) {
        setCopiedToken(true);
        setTimeout(() => setCopiedToken(false), 2000);
      } else {
        setCopiedUrl(true);
        setTimeout(() => setCopiedUrl(false), 2000);
      }
    }
  };

  return (
    <div className="app-container" style={{ maxWidth: '850px' }}>
      {/* Page Header */}
      <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
            <span style={{
              background: '#fdf2f8',
              color: '#db2777',
              padding: '0.2rem 0.6rem',
              borderRadius: '999px',
              fontSize: '0.75rem',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem'
            }}>
              <Sparkles size={12} /> ManyChat Competitor
            </span>
          </div>
          <h1 className="page-title">Step 4: Auto Reply &amp; Comment-to-DM</h1>
          <p className="page-desc">
            Automatically send private DMs and public replies whenever someone comments on your Instagram Reels or Facebook posts.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Link
            href="/comments"
            className="btn btn-secondary"
            style={{ padding: '0.75rem 1.15rem', display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}
          >
            <MessageSquareText size={17} color="#4f46e5" />
            <span>Live Comments Inbox</span>
          </Link>

          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="btn btn-primary"
            style={{ padding: '0.75rem 1.25rem' }}
          >
            <Plus size={18} />
            <span>{showAddForm ? 'Close Form' : 'New Automation Rule'}</span>
          </button>
        </div>
      </div>

      {/* Quick Metrics Bar */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem',
        marginBottom: '1.75rem'
      }}>
        <div className="card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#eef2ff', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Zap size={20} />
          </div>
          <div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-main)' }}>{activeRulesCount}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 600 }}>Active Rules</div>
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Send size={20} />
          </div>
          <div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-main)' }}>{totalTriggers}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 600 }}>Total DMs Sent</div>
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#f8fafc', color: '#16a34a', border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShieldCheck size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#16a34a' }}>Meta Webhook Ready</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Graph API v22.0</div>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {formSuccess && (
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
          <span>{formSuccess}</span>
        </div>
      )}

      {/* CREATE NEW RULE CARD */}
      {showAddForm && (
        <div className="card" style={{ padding: '2rem', marginBottom: '2rem', border: '2px solid #4f46e5' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.35rem', color: 'var(--text-main)' }}>
            Create Comment-to-DM Rule
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
            When a user comments the keyword on your Instagram Reel or Facebook post, this automated DM and public reply will be triggered.
          </p>

          {formError && (
            <div style={{
              padding: '0.75rem 1rem',
              borderRadius: 'var(--radius-sm)',
              background: '#fff1f2',
              border: '1px solid #fecdd3',
              color: '#be123c',
              fontSize: '0.88rem',
              marginBottom: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <AlertTriangle size={16} />
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={handleCreateRule} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Platform Selection */}
            <div>
              <label className="form-label" style={{ marginBottom: '0.5rem', display: 'block' }}>
                Platform
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.65rem' }}>
                {[
                  { key: 'Instagram', label: 'Instagram', icon: <InstagramIcon size={16} /> },
                  { key: 'Facebook', label: 'Facebook', icon: <FacebookIcon size={16} /> },
                  { key: 'Threads', label: 'Threads', icon: <ThreadsIcon size={16} /> },
                  { key: 'All', label: 'All Meta', icon: <MetaIcon size={16} /> },
                ].map((p) => {
                  const isSelected = platform === p.key;
                  return (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => setPlatform(p.key as any)}
                      style={{
                        padding: '0.65rem 0.85rem',
                        borderRadius: 'var(--radius-md)',
                        background: isSelected ? '#eef2ff' : '#f8fafc',
                        border: isSelected ? '2px solid #4f46e5' : '1px solid var(--border)',
                        color: isSelected ? '#4f46e5' : 'var(--text-main)',
                        fontWeight: 600,
                        fontSize: '0.85rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.45rem',
                        cursor: 'pointer'
                      }}
                    >
                      {p.icon}
                      <span>{p.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Keyword */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <label className="form-label" style={{ margin: 0 }}>
                  Trigger Keyword (Koi bhi comment kare ya specific word)
                </label>
                <div style={{ display: 'flex', gap: '0.35rem' }}>
                  {['*', 'LINK', 'PRICE', 'INFO'].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setKeyword(preset)}
                      style={{
                        fontSize: '0.72rem',
                        padding: '0.2rem 0.55rem',
                        borderRadius: '4px',
                        background: keyword === preset ? '#e0e7ff' : '#f1f5f9',
                        border: keyword === preset ? '1px solid #6366f1' : '1px solid #cbd5e1',
                        color: keyword === preset ? '#4338ca' : 'var(--text-main)',
                        fontWeight: keyword === preset ? 700 : 500,
                        cursor: 'pointer'
                      }}
                    >
                      {preset === '*' ? '⚡ Any Comment (*)' : `+ ${preset}`}
                    </button>
                  ))}
                </div>
              </div>
              <input
                type="text"
                className="input"
                placeholder="e.g. * (for all comments) ya LINK, PRICE, DEMO"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value.toUpperCase())}
                required
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.25rem', display: 'block' }}>
                💡 <strong>* (Asterisk)</strong> select karne par koi bhi user kuch bhi comment kare (Follower ya Unfollower), yeh auto-reply turant chalega!
              </span>
            </div>

            {/* Public Comment Reply (Always sent to everyone) */}
            <div>
              <label className="form-label">
                Public Comment Reply (Sabhi ko public reply milega)
              </label>
              <input
                type="text"
                className="input"
                placeholder="e.g. Sent to your DM! Check your inbox 📩"
                value={commentReply}
                onChange={(e) => setCommentReply(e.target.value)}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.25rem', display: 'block' }}>
                Yeh reply user ke comment ke niche publically publish hoga (Follower aur Unfollower dono ko jayega).
              </span>
            </div>

            {/* Automated DM */}
            <div>
              <label className="form-label">
                Main DM Message (Follower / Default DM)
              </label>
              <textarea
                className="textarea"
                rows={3}
                placeholder="Hey there! 👋 Here is your exclusive link: https://yourwebsite.com/offer&#10;&#10;Let me know if you have any questions!"
                value={dmMessage}
                onChange={(e) => setDmMessage(e.target.value)}
                required
              />
            </div>

            {/* FOLLOWER-ONLY LINK GATE TOGGLE */}
            <div style={{
              padding: '1.25rem',
              borderRadius: 'var(--radius-md)',
              background: requireFollower ? '#f5f3ff' : '#f8fafc',
              border: requireFollower ? '2px solid #8b5cf6' : '1px solid var(--border)',
              transition: 'all 0.2s ease'
            }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer', userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={requireFollower}
                  onChange={(e) => {
                    const val = e.target.checked;
                    setRequireFollower(val);
                    if (val && !nonFollowerDmMessage) {
                      setNonFollowerDmMessage("Hey! 👋 Ye link lene ke liye pehle hamare account ko follow karein! Follow karte hi yahan reply karein ya wapas comment karein, link turant mil jayega 🚀");
                    }
                  }}
                  style={{ width: '18px', height: '18px', marginTop: '0.15rem', accentColor: '#7c3aed', cursor: 'pointer' }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      {requireFollower ? <Lock size={15} color="#7c3aed" /> : <Unlock size={15} color="#64748b" />}
                      Follower-Only Link Gate (Instagram Trending Flow 🔥)
                    </span>
                    <span style={{
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      padding: '0.15rem 0.5rem',
                      borderRadius: '999px',
                      background: requireFollower ? '#ede9fe' : '#e2e8f0',
                      color: requireFollower ? '#6d28d9' : '#475569'
                    }}>
                      Viral Follower Growth 🚀
                    </span>
                  </div>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.45 }}>
                    {requireFollower ? (
                      <span style={{ color: '#6d28d9', fontWeight: 600 }}>
                        Active: Commenter agar <strong>Follower</strong> hai toh link wala main DM jayega. Agar <strong>Follower NAHI</strong> hai toh pehle account follow karne ka prompt DM jayega!
                      </span>
                    ) : (
                      <span>
                        Unchecked (Default): Comment aate hi har kisi ko direct main DM chala jayega (chahe follow kiya ho ya na kiya ho).
                      </span>
                    )}
                  </p>
                </div>
              </label>

              {requireFollower && (
                <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px dashed #c4b5fd', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {/* Link URL */}
                  <div>
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Link2 size={14} color="#7c3aed" />
                      <span>Target Link / URL (Jo Followers ko Dena Hai)</span>
                    </label>
                    <input
                      type="url"
                      className="input"
                      placeholder="https://yourwebsite.com/exclusive-offer"
                      value={followerOnlyLink}
                      onChange={(e) => setFollowerOnlyLink(e.target.value)}
                    />
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)', marginTop: '0.25rem', display: 'block' }}>
                      Yeh link verified follower ke DM message me automatically attach ho jayega.
                    </span>
                  </div>

                  {/* Follower DM */}
                  <div>
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <UserCheck size={14} color="#059669" />
                      <span>Follower DM Message (Verified Followers ke liye)</span>
                    </label>
                    <textarea
                      className="textarea"
                      rows={3}
                      placeholder="Thanks for following! 🎉 Here is your exclusive link: https://yourwebsite.com/offer&#10;&#10;Enjoy!"
                      value={followerDmMessage}
                      onChange={(e) => setFollowerDmMessage(e.target.value)}
                    />
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)', marginTop: '0.25rem', display: 'block' }}>
                      Agar blank chhodenge toh upar wala standard DM message send hoga.
                    </span>
                  </div>

                  {/* Non-Follower DM */}
                  <div>
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <UserX size={14} color="#d97706" />
                      <span>Non-Follower DM Message (Follow karne ka prompt)</span>
                    </label>
                    <textarea
                      className="textarea"
                      rows={3}
                      placeholder="Hey! 👋 Ye link lene ke liye pehle hamare account ko follow karein! Follow karte hi reply karein ya wapas comment karein, link turant mil jayega 🚀"
                      value={nonFollowerDmMessage}
                      onChange={(e) => setNonFollowerDmMessage(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.85rem', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="btn btn-ghost"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ padding: '0.75rem 1.75rem' }}
              >
                <SaveRuleIcon size={16} />
                <span>Save Automation Rule</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* LIVE SCANNER & REAL-TIME DISPATCHER */}
      <div className="card" style={{ padding: '1.5rem', marginBottom: '2rem', border: '1px solid #c7d2fe', background: '#f8faff' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <Zap size={18} color="#4f46e5" />
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                Live Comment Scanner &amp; Auto-Reply
              </h3>
              <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem', borderRadius: '999px', background: '#e0e7ff', color: '#4338ca', fontWeight: 700 }}>
                Instant Localhost &amp; Webhook
              </span>
            </div>
            <p style={{ fontSize: '0.83rem', color: 'var(--text-muted)', margin: 0 }}>
              Scans your connected Facebook Pages &amp; Instagram Reels for new comments, matches your keywords, and automatically sends DMs and replies.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', cursor: 'pointer', userSelect: 'none' }}>
              <input
                type="checkbox"
                checked={autoScanEnabled}
                onChange={(e) => setAutoScanEnabled(e.target.checked)}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
              <span>Auto-scan every 20s</span>
            </label>

            <button
              onClick={handleLiveScan}
              disabled={isScanning}
              className="btn btn-primary"
              style={{ padding: '0.65rem 1.15rem', fontSize: '0.85rem' }}
            >
              <RefreshCw size={15} className={isScanning ? 'spinner' : ''} />
              <span>{isScanning ? 'Scanning...' : '⚡ Scan & Reply Now'}</span>
            </button>
          </div>
        </div>

        {/* Scan Results Log */}
        {scanResult && (
          <div style={{
            background: '#ffffff',
            border: '1px solid #e0e7ff',
            borderRadius: 'var(--radius-sm)',
            padding: '1rem',
            fontSize: '0.82rem'
          }}>
            <div style={{ fontWeight: 700, color: '#3730a3', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Scan Results ({new Date(scanResult.timestamp || Date.now()).toLocaleTimeString()}):</span>
              <span style={{ fontSize: '0.75rem', color: '#6366f1' }}>
                {scanResult.results?.reduce((s: number, r: any) => s + (r.repliesTriggered || 0), 0)} replies triggered
              </span>
            </div>

            {scanResult.results && scanResult.results.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {scanResult.results.map((r: any, idx: number) => (
                  <div key={idx} style={{ padding: '0.5rem 0.75rem', borderRadius: '4px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                        {r.platform === 'Instagram' ? '📸' : '📘'} {r.accountName} ({r.platform})
                      </span>
                      <span style={{ color: 'var(--text-dim)' }}>
                        {r.commentsChecked} comments checked &bull; {r.repliesTriggered} auto-replies sent
                      </span>
                    </div>

                    {r.details && r.details.length > 0 && (
                      <div style={{ marginTop: '0.4rem', paddingLeft: '0.5rem', borderLeft: '2px solid #818cf8', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        {r.details.map((d: any, dIdx: number) => (
                          <div key={dIdx} style={{ fontSize: '0.78rem' }}>
                            Comment: <em>"{d.commentText}"</em> &rarr;{' '}
                            {d.result.triggered ? (
                              <span style={{ color: '#059669', fontWeight: 600 }}>
                                Matched "{d.result.keyword}"! {d.result.publicReplySuccess ? 'Public reply sent ✅ ' : ''}{d.result.dmSuccess ? 'DM sent ✅' : ''}
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text-dim)' }}>
                                Skipped ({d.result.skipReason || 'no keyword match'})
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: 'var(--text-muted)' }}>
                No active connected accounts scanned. Make sure your Facebook Page or Instagram account is connected.
              </div>
            )}
          </div>
        )}

        {/* Tip on Localhost vs Webhooks */}
        <div style={{ marginTop: '0.75rem', fontSize: '0.78rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span>💡</span>
          <span>
            <strong>Localhost Note:</strong> Meta Webhooks require a public URL. On localhost, click <strong>"Scan &amp; Reply Now"</strong> (or leave Auto-scan ON) to immediately detect and reply to real Facebook/Instagram comments!
          </span>
        </div>
      </div>

      {/* RULES LIST */}
      <div style={{ marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)' }}>
            Active Automation Rules ({autoReplyRules.length})
          </h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
            Triggered automatically via Meta Webhooks
          </span>
        </div>

        {autoReplyRules.length === 0 ? (
          <div className="card" style={{ padding: '2.5rem', textAlign: 'center' }}>
            <MessageSquareText size={36} color="#94a3b8" style={{ margin: '0 auto 0.75rem' }} />
            <h4 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)' }}>
              No Auto Reply Rules Created Yet
            </h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: '400px', margin: '0.4rem auto 1.25rem' }}>
              Create your first rule to automatically send DMs when followers comment on your Reels or Posts.
            </p>
            <button
              onClick={() => setShowAddForm(true)}
              className="btn btn-primary btn-sm"
            >
              <Plus size={16} />
              <span>Create Rule</span>
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {autoReplyRules.map((rule) => {
              const isSimulating = simulatingRuleId === rule.id;

              return (
                <div
                  key={rule.id}
                  className="card"
                  style={{
                    padding: '1.5rem',
                    border: rule.isActive ? '1px solid var(--border)' : '1px solid #e2e8f0',
                    opacity: rule.isActive ? 1 : 0.65,
                    transition: 'all 0.2s ease'
                  }}
                >
                  {/* Top Bar: Badges & Controls */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      {/* Platform Pill */}
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        padding: '0.25rem 0.65rem',
                        borderRadius: '6px',
                        background: rule.platform === 'Instagram' ? '#fdf2f8' : (rule.platform === 'Threads' ? '#f1f5f9' : '#eff6ff'),
                        color: rule.platform === 'Instagram' ? '#db2777' : (rule.platform === 'Threads' ? '#0f172a' : '#1877f2'),
                        fontWeight: 700,
                        fontSize: '0.78rem'
                      }}>
                        {rule.platform === 'Instagram' ? <InstagramIcon size={14} /> :
                         rule.platform === 'Threads' ? <ThreadsIcon size={14} /> :
                         rule.platform === 'Facebook' ? <FacebookIcon size={14} /> : <MetaIcon size={14} />}
                        <span>{rule.platform}</span>
                      </span>

                      {/* Keyword Pill */}
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        padding: '0.25rem 0.65rem',
                        borderRadius: '6px',
                        background: '#fef3c7',
                        color: '#92400e',
                        fontWeight: 800,
                        fontSize: '0.82rem',
                        letterSpacing: '0.03em'
                      }}>
                        Keyword: "{rule.keyword}"
                      </span>

                      {/* Follower Gate Badge */}
                      {rule.requireFollower && (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          padding: '0.25rem 0.65rem',
                          borderRadius: '6px',
                          background: '#ede9fe',
                          color: '#6d28d9',
                          fontWeight: 700,
                          fontSize: '0.78rem'
                        }}>
                          <Lock size={12} />
                          <span>Follower Gate Active</span>
                        </span>
                      )}

                      {/* Trigger Count */}
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', fontWeight: 600 }}>
                        🚀 {rule.triggerCount || 0} DMs sent
                      </span>
                    </div>

                    {/* Action buttons */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {/* Active Toggle Switch */}
                      <button
                        onClick={() => toggleAutoReplyRule(rule.id)}
                        style={{
                          padding: '0.35rem 0.75rem',
                          borderRadius: '999px',
                          border: 'none',
                          background: rule.isActive ? '#ecfdf5' : '#f1f5f9',
                          color: rule.isActive ? '#047857' : '#64748b',
                          fontWeight: 700,
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem'
                        }}
                      >
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: rule.isActive ? '#10b981' : '#94a3b8' }} />
                        <span>{rule.isActive ? 'Active' : 'Paused'}</span>
                      </button>

                      {/* Test Simulator Buttons */}
                      {rule.requireFollower ? (
                        <>
                          <button
                            onClick={() => handleSimulateTest(rule, true)}
                            disabled={isSimulating}
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', color: '#047857', background: '#ecfdf5', borderColor: '#a7f3d0' }}
                            title="Simulate comment from an account who FOLLOWS you (receives link)"
                          >
                            <UserCheck size={13} color="#059669" />
                            <span>{isSimulating ? '...' : 'Test Follower ✅'}</span>
                          </button>
                          <button
                            onClick={() => handleSimulateTest(rule, false)}
                            disabled={isSimulating}
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', color: '#b45309', background: '#fef3c7', borderColor: '#fde68a' }}
                            title="Simulate comment from a NON-FOLLOWER (receives follow prompt)"
                          >
                            <UserX size={13} color="#d97706" />
                            <span>{isSimulating ? '...' : 'Test Non-Follower 🔒'}</span>
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleSimulateTest(rule, true)}
                          disabled={isSimulating}
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}
                          title="Simulate a user commenting to test this automation"
                        >
                          <Sparkles size={13} color="#4f46e5" />
                          <span>{isSimulating ? 'Sending...' : 'Test DM'}</span>
                        </button>
                      )}

                      {/* Delete */}
                      <button
                        onClick={() => {
                          if (confirm('Delete this Auto Reply rule?')) {
                            deleteAutoReplyRule(rule.id);
                          }
                        }}
                        className="btn btn-ghost btn-sm"
                        style={{ color: 'var(--danger)', padding: '0.35rem 0.5rem' }}
                        title="Delete Rule"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Content Preview */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    {/* Public Comment Reply (Sabhi commenters ko milega) */}
                    {rule.commentReply && (
                      <div style={{
                        background: '#f8fafc',
                        borderRadius: 'var(--radius-md)',
                        padding: '0.75rem 1rem',
                        border: '1px solid var(--border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.75rem',
                        flexWrap: 'wrap'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#db2777', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <MessageSquareText size={13} color="#db2777" />
                            <span>Public Comment Reply (Sabhi ko):</span>
                          </span>
                          <span style={{ fontSize: '0.86rem', color: 'var(--text-main)', fontStyle: 'italic' }}>
                            "{rule.commentReply}"
                          </span>
                        </div>
                        <span style={{ fontSize: '0.7rem', color: '#10b981', background: '#ecfdf5', padding: '0.15rem 0.5rem', borderRadius: '999px', fontWeight: 600 }}>
                          Follower + Unfollower dono ko ✅
                        </span>
                      </div>
                    )}

                    {/* DMs Section: Dual cards if follower gate active, or single DM card */}
                    <div style={{ display: 'grid', gridTemplateColumns: rule.requireFollower ? '1fr 1fr' : '1fr', gap: '0.85rem' }}>
                      {/* Follower / Standard DM bubble */}
                      <div style={{
                        background: '#f8fafc',
                        borderRadius: 'var(--radius-md)',
                        padding: '0.85rem 1rem',
                        border: rule.requireFollower ? '1px solid #c7d2fe' : '1px solid var(--border)'
                      }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: rule.requireFollower ? '#4338ca' : 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          {rule.requireFollower ? <UserCheck size={13} color="#4f46e5" /> : <Send size={12} color="#4f46e5" />}
                          <span>{rule.requireFollower ? 'Follower DM (Link ke saath):' : 'Private Direct Message (DM):'}</span>
                        </div>
                        <p style={{ fontSize: '0.88rem', color: 'var(--text-main)', whiteSpace: 'pre-wrap', lineHeight: 1.45, margin: 0 }}>
                          {rule.followerDmMessage || rule.dmMessage}
                        </p>
                        {rule.followerOnlyLink && (
                          <div style={{ marginTop: '0.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.2rem 0.5rem', background: '#eff6ff', borderRadius: '4px', fontSize: '0.78rem', color: '#1d4ed8', fontWeight: 600 }}>
                            <Link2 size={12} />
                            <span>{rule.followerOnlyLink}</span>
                          </div>
                        )}
                      </div>

                      {/* Non-Follower DM (if Follower Gate Active) */}
                      {rule.requireFollower && (
                        <div style={{
                          background: '#fffbeb',
                          borderRadius: 'var(--radius-md)',
                          padding: '0.85rem 1rem',
                          border: '1px solid #fde68a'
                        }}>
                          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#92400e', textTransform: 'uppercase', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <UserX size={13} color="#d97706" />
                            <span>Non-Follower DM (Follow Prompt):</span>
                          </div>
                          <p style={{ fontSize: '0.88rem', color: '#78350f', whiteSpace: 'pre-wrap', lineHeight: 1.45, margin: 0 }}>
                            {rule.nonFollowerDmMessage || "Hey! 👋 Ye link lene ke liye pehle hamare account ko follow karein! Follow karte hi reply karein ya wapas comment karein, link turant mil jayega 🚀"}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* LIVE SIMULATION RESULT BANNER */}
                  {simulationResult && simulationResult.ruleId === rule.id && (
                    <div style={{
                      marginTop: '1rem',
                      padding: '0.85rem 1.15rem',
                      borderRadius: 'var(--radius-md)',
                      background: simulationResult.isFollower ? '#eff6ff' : '#fffbeb',
                      border: simulationResult.isFollower ? '1px solid #bfdbfe' : '1px solid #fde68a',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.45rem'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: simulationResult.isFollower ? '#1d4ed8' : '#b45309', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          {simulationResult.isFollower ? <CheckCircle2 size={16} color="#2563eb" /> : <Lock size={16} color="#d97706" />}
                          {simulationResult.isFollower
                            ? 'Test Success: Follower verified & Link delivered!'
                            : 'Test Success: Non-follower detected & Follow Prompt sent!'}
                        </span>
                        <span style={{ fontSize: '0.72rem', color: simulationResult.isFollower ? '#60a5fa' : '#d97706' }}>Trigger count +1</span>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: simulationResult.isFollower ? '#1e40af' : '#78350f' }}>
                        User <strong>{simulationResult.commenter}</strong> commented: <em>"{simulationResult.keyword}"</em>.
                      </div>
                      <div style={{ background: '#ffffff', padding: '0.65rem 0.85rem', borderRadius: '6px', border: '1px solid rgba(0,0,0,0.06)', fontSize: '0.82rem', color: 'var(--text-main)' }}>
                        <strong>Simulated DM Delivered:</strong>
                        <div style={{ marginTop: '0.2rem', whiteSpace: 'pre-wrap' }}>{simulationResult.sentDm}</div>
                      </div>
                    </div>
                  )}

                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* META WEBHOOK INTEGRATION GUIDE (COLLAPSIBLE) */}
      <div className="card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
        <div
          onClick={() => setShowWebhookGuide(!showWebhookGuide)}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#eff6ff', color: '#1877f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MetaIcon size={20} />
            </div>
            <div>
              <h4 style={{ fontSize: '0.98rem', fontWeight: 700, color: 'var(--text-main)' }}>
                Meta Webhook Integration Details
              </h4>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Connect Meta App Webhooks to automatically trigger these rules when real followers comment
              </p>
            </div>
          </div>

          <div style={{ color: 'var(--text-dim)' }}>
            {showWebhookGuide ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </div>
        </div>

        {showWebhookGuide && (
          <div style={{ marginTop: '1.25rem', borderTop: '1px solid var(--border)', paddingTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              To receive live comments from your Instagram Reels and Facebook Pages, add this Webhook inside your <strong>Meta for Developers</strong> dashboard:
            </p>

            {/* Webhook Callback URL */}
            <div>
              <label className="form-label" style={{ fontSize: '0.78rem' }}>Callback URL</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  readOnly
                  value={webhookUrl}
                  className="input"
                  style={{ background: '#f8fafc', fontFamily: 'monospace', fontSize: '0.82rem' }}
                />
                <button
                  type="button"
                  onClick={() => copyToClipboard(webhookUrl, false)}
                  className="btn btn-secondary btn-sm"
                  style={{ flexShrink: 0 }}
                >
                  {copiedUrl ? <Check size={14} color="#16a34a" /> : <Copy size={14} />}
                  <span>{copiedUrl ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* Verify Token */}
            <div>
              <label className="form-label" style={{ fontSize: '0.78rem' }}>Verify Token</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  readOnly
                  value={verifyToken}
                  className="input"
                  style={{ background: '#f8fafc', fontFamily: 'monospace', fontSize: '0.82rem' }}
                />
                <button
                  type="button"
                  onClick={() => copyToClipboard(verifyToken, true)}
                  className="btn btn-secondary btn-sm"
                  style={{ flexShrink: 0 }}
                >
                  {copiedToken ? <Check size={14} color="#16a34a" /> : <Copy size={14} />}
                  <span>{copiedToken ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* Step-by-step checklist */}
            <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: '0.4rem' }}>
                Meta Dashboard 3-Step Setup:
              </span>
              <ol style={{ fontSize: '0.82rem', color: 'var(--text-muted)', paddingLeft: '1.2rem', lineHeight: 1.6, margin: 0 }}>
                <li>Go to <strong>developers.facebook.com</strong> &gt; Your App &gt; <strong>Webhooks</strong>.</li>
                <li>Select <strong>Instagram</strong> or <strong>Page</strong> &gt; click <em>Subscribe to this object</em>.</li>
                <li>Enter the Callback URL and Verify Token above, and subscribe to <code>feed</code> and <code>comments</code>.</li>
              </ol>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '2rem' }}>
        <Link href="/upload" className="btn btn-secondary">
          ← Back to Upload &amp; Publish
        </Link>
        <Link href="/dashboard" className="btn btn-primary" style={{ padding: '0.8rem 1.75rem' }}>
          <span>Go to Overview</span>
          <ArrowRight size={18} />
        </Link>
      </div>
    </div>
  );
}

function SaveRuleIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
      <polyline points="17 21 17 13 7 13 7 21"/>
      <polyline points="7 3 7 8 15 8"/>
    </svg>
  );
}
