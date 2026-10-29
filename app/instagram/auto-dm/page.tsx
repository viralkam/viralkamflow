'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { InstagramIcon } from '@/components/PlatformIcons';
import {
  MessageSquareText, Plus, CheckCircle2, AlertTriangle, Trash2,
  Zap, Send, Sparkles, RefreshCw,
} from 'lucide-react';

export default function InstagramAutoDMPage() {
  const router = useRouter();
  const {
    user, isLoaded, accounts, autoReplyRules,
    addAutoReplyRule, toggleAutoReplyRule, deleteAutoReplyRule, incrementRuleTriggerCount,
    refreshData,
  } = useApp();

  const [showAddForm, setShowAddForm] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [dmMessage, setDmMessage] = useState('');
  const [commentReply, setCommentReply] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [simulatingRuleId, setSimulatingRuleId] = useState<string | null>(null);
  const [simulationResult, setSimulationResult] = useState<{
    ruleId: string; commenter: string; keyword: string; sentDm: string; publicReply?: string;
  } | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<any | null>(null);
  const [autoScanEnabled, setAutoScanEnabled] = useState(true);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('pf_ig_autoscan');
      if (stored !== null) {
        setAutoScanEnabled(stored === 'true');
      }
    }
  }, []);

  const handleToggleAutoScan = (enabled: boolean) => {
    setAutoScanEnabled(enabled);
    if (typeof window !== 'undefined') {
      localStorage.setItem('pf_ig_autoscan', String(enabled));
    }
  };

  // Target Post selection state
  const [targetMode, setTargetMode] = useState<'all' | 'specific'>('all');
  const [selectedPostId, setSelectedPostId] = useState('');
  const [availablePosts, setAvailablePosts] = useState<Array<{ id: string; caption?: string; permalink?: string }>>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);

  useEffect(() => {
    if (showAddForm && availablePosts.length === 0) {
      setLoadingPosts(true);
      fetch('/api/meta/feed?platform=instagram')
        .then(r => r.json())
        .then(data => {
          if (data.items) {
            setAvailablePosts(data.items.map((it: any) => ({
              id: it.id,
              caption: it.caption || it.title || 'Untitled Post',
              permalink: it.permalink,
            })));
          }
        })
        .catch(() => {})
        .finally(() => setLoadingPosts(false));
    }
  }, [showAddForm, availablePosts.length]);



  // Filter rules for Instagram only
  const igRules = autoReplyRules.filter(r => r.platform === 'Instagram' || r.platform === 'All');
  const activeRulesCount = igRules.filter(r => r.isActive).length;
  const totalTriggers = igRules.reduce((acc, r) => acc + (r.triggerCount || 0), 0);

  // Auto scan poller
  useEffect(() => {
    if (!autoScanEnabled) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/auto-reply/scan', { method: 'POST' });
        const data = await res.json();
        setScanResult(data);
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
        const totalChecked = data.results.filter((r: any) => r.platform === 'Instagram').reduce((s: number, r: any) => s + (r.commentsChecked || 0), 0);
        const totalReplied = data.results.filter((r: any) => r.platform === 'Instagram').reduce((s: number, r: any) => s + (r.repliesTriggered || 0), 0);
        setFormSuccess(`Scanned ${totalChecked} Instagram comments. Sent ${totalReplied} auto-replies!`);
        setTimeout(() => setFormSuccess(null), 5000);
      }
    } catch (err: any) {
      setFormError(`Scan failed: ${err.message}`);
    } finally {
      setIsScanning(false);
    }
  };

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!keyword.trim()) { setFormError('Enter a trigger keyword.'); return; }
    if (!dmMessage.trim()) { setFormError('Enter a DM message.'); return; }
    if (targetMode === 'specific' && !selectedPostId) {
      setFormError('Please choose a specific Reel or Post from the list.');
      return;
    }

    const selectedPost = availablePosts.find(p => p.id === selectedPostId);

    try {
      const newRule = await addAutoReplyRule({
        platform: 'Instagram',
        keyword: keyword.trim().toUpperCase(),
        dmMessage: dmMessage.trim(),
        commentReply: commentReply.trim() || undefined,
        isActive: true,
        targetPostId: targetMode === 'specific' ? selectedPostId : undefined,
        targetPostTitle: targetMode === 'specific' ? (selectedPost?.caption?.slice(0, 45) || `Post ${selectedPostId.slice(-6)}`) : undefined,
      });

      await fetch('/api/auto-reply/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRule),
      });

      await refreshData();

      setFormSuccess('Instagram Auto Reply rule saved!');
      setKeyword(''); setDmMessage(''); setCommentReply(''); setSelectedPostId(''); setTargetMode('all');
      setShowAddForm(false);
      setTimeout(() => setFormSuccess(null), 4000);
    } catch (err: any) {
      setFormError(err.message || 'Failed to save rule.');
    }
  };

  const handleSimulateTest = async (rule: typeof igRules[0]) => {
    setSimulatingRuleId(rule.id);
    setSimulationResult(null);
    setTimeout(async () => {
      await incrementRuleTriggerCount(rule.id);
      setSimulationResult({
        ruleId: rule.id, commenter: '@instagram_user',
        keyword: rule.keyword, sentDm: rule.dmMessage, publicReply: rule.commentReply,
      });
      setSimulatingRuleId(null);
    }, 900);
  };


  return (
    <div className="app-container" style={{ maxWidth: '850px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '10px',
            background: 'linear-gradient(135deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
          }}>
            <MessageSquareText size={22} />
          </div>
          <div>
            <h1 className="page-title" style={{ fontSize: '1.6rem' }}>Instagram Auto DM</h1>
            <p className="page-desc">Auto reply & DM when someone comments on your Reels</p>
          </div>
        </div>
        <button onClick={() => setShowAddForm(!showAddForm)} className="btn btn-primary" style={{ padding: '0.75rem 1.25rem' }}>
          <Plus size={18} />
          <span>{showAddForm ? 'Close Form' : 'New Rule'}</span>
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.75rem' }}>
        <div className="card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#fdf2f8', color: '#E1306C', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Zap size={20} />
          </div>
          <div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800 }}>{activeRulesCount}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 600 }}>Active Rules</div>
          </div>
        </div>
        <div className="card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Send size={20} />
          </div>
          <div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800 }}>{totalTriggers}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 600 }}>DMs Sent</div>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {formSuccess && (
        <div style={{ padding: '0.85rem 1.25rem', borderRadius: 'var(--radius-md)', background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', fontSize: '0.9rem', fontWeight: 600, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <CheckCircle2 size={18} color="#059669" />
          <span>{formSuccess}</span>
        </div>
      )}

      {/* Live Scanner */}
      <div className="card" style={{ padding: '1.5rem', marginBottom: '2rem', border: '1px solid #fbcfe8', background: '#fef7fb' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <Zap size={18} color="#E1306C" />
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>Instagram Comment Scanner</h3>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
              Scans your Instagram Reels for new comments, matches keywords & sends DMs
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}>
              <input type="checkbox" checked={autoScanEnabled} onChange={(e) => handleToggleAutoScan(e.target.checked)} style={{ width: '16px', height: '16px' }} />
              Auto-scan 20s
            </label>
            <button onClick={handleLiveScan} disabled={isScanning} className="btn btn-primary" style={{ padding: '0.65rem 1.15rem', fontSize: '0.85rem', background: '#E1306C' }}>
              <RefreshCw size={15} className={isScanning ? 'spinner' : ''} />
              <span>{isScanning ? 'Scanning...' : '⚡ Scan Now'}</span>
            </button>
          </div>
        </div>

        {scanResult && scanResult.results && (
          <div style={{ marginTop: '1rem', background: '#fff', border: '1px solid #fbcfe8', borderRadius: 'var(--radius-sm)', padding: '1rem', fontSize: '0.82rem' }}>
            {scanResult.results.filter((r: any) => r.platform === 'Instagram').map((r: any, idx: number) => (
              <div key={idx} style={{ padding: '0.4rem 0', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 600 }}>📸 {r.accountName}</span>
                <span style={{ color: 'var(--text-dim)' }}>{r.commentsChecked} checked · {r.repliesTriggered} replied</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Rule Form */}
      {showAddForm && (
        <div className="card" style={{ padding: '2rem', marginBottom: '2rem', border: '2px solid #E1306C' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.35rem' }}>Create Instagram Auto Reply Rule</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
            When someone comments the keyword on your Reel, this DM will be sent automatically.
          </p>

          {formError && (
            <div style={{ padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', background: '#fff1f2', border: '1px solid #fecdd3', color: '#be123c', fontSize: '0.88rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertTriangle size={16} /> <span>{formError}</span>
            </div>
          )}

          <form onSubmit={handleCreateRule} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <label className="form-label" style={{ margin: 0 }}>Trigger Keyword</label>
                <div style={{ display: 'flex', gap: '0.35rem' }}>
                  {['LINK', 'PRICE', 'INFO', '*'].map((preset) => (
                    <button key={preset} type="button" onClick={() => setKeyword(preset)} style={{ fontSize: '0.72rem', padding: '0.15rem 0.5rem', borderRadius: '4px', background: '#fdf2f8', border: '1px solid #fbcfe8', color: '#E1306C', cursor: 'pointer' }}>
                      +{preset === '*' ? 'Any' : preset}
                    </button>
                  ))}
                </div>
              </div>
              <input type="text" className="input" placeholder="e.g. LINK, PRICE, or * for all" value={keyword} onChange={(e) => setKeyword(e.target.value.toUpperCase())} required />
            </div>

            <div>
              <label className="form-label">Automated DM Message</label>
              <textarea className="textarea" rows={4} placeholder="Hey! 👋 Here is your link: https://example.com" value={dmMessage} onChange={(e) => setDmMessage(e.target.value)} required />
            </div>

            {/* Target Media Selection */}
            <div>
              <label className="form-label" style={{ marginBottom: '0.4rem' }}>Target Reel / Post</label>
              <div style={{ display: 'flex', gap: '1.25rem', marginBottom: '0.65rem' }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer', fontSize: '0.88rem', fontWeight: 600 }}>
                  <input type="radio" name="igTargetMode" checked={targetMode === 'all'} onChange={() => setTargetMode('all')} />
                  <span>🌐 All Reels & Posts</span>
                </label>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer', fontSize: '0.88rem', fontWeight: 600 }}>
                  <input type="radio" name="igTargetMode" checked={targetMode === 'specific'} onChange={() => setTargetMode('specific')} />
                  <span>🎯 Specific Reel / Post</span>
                </label>
              </div>

              {targetMode === 'specific' && (
                <div style={{ marginTop: '0.5rem' }}>
                  {loadingPosts ? (
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>Loading your recent Instagram posts...</div>
                  ) : availablePosts.length === 0 ? (
                    <input
                      type="text"
                      className="input"
                      placeholder="Paste Reel / Post ID (e.g. 18625542238046783)"
                      value={selectedPostId}
                      onChange={(e) => setSelectedPostId(e.target.value.trim())}
                      required
                    />
                  ) : (
                    <select className="input" value={selectedPostId} onChange={(e) => setSelectedPostId(e.target.value)} required={targetMode === 'specific'}>
                      <option value="">-- Choose target Reel / Post --</option>
                      {availablePosts.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.caption ? p.caption.slice(0, 60) : `Post ${p.id}`}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="form-label">Public Comment Reply (Optional)</label>
              <input type="text" className="input" placeholder="e.g. Check your DM! 📩" value={commentReply} onChange={(e) => setCommentReply(e.target.value)} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.85rem' }}>
              <button type="button" onClick={() => setShowAddForm(false)} className="btn btn-ghost">Cancel</button>
              <button type="submit" className="btn btn-primary" style={{ background: '#E1306C', padding: '0.75rem 1.75rem' }}>
                <CheckCircle2 size={16} /> Save Rule
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Rules List */}
      <div>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '1rem' }}>
          Instagram Rules ({igRules.length})
        </h3>

        {igRules.length === 0 ? (
          <div className="card" style={{ padding: '2.5rem', textAlign: 'center' }}>
            <MessageSquareText size={36} color="#94a3b8" style={{ margin: '0 auto 0.75rem' }} />
            <h4 style={{ fontSize: '1rem', fontWeight: 600 }}>No Instagram rules yet</h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>Create your first rule to auto-DM on Instagram Reels</p>
            <button onClick={() => setShowAddForm(true)} className="btn btn-primary btn-sm" style={{ background: '#E1306C' }}>
              <Plus size={16} /> Create Rule
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {igRules.map((rule) => (
              <div key={rule.id} className="card" style={{ padding: '1.5rem', opacity: rule.isActive ? 1 : 0.65 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <span style={{ padding: '0.25rem 0.65rem', borderRadius: '6px', background: '#fdf2f8', color: '#E1306C', fontWeight: 700, fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                      <InstagramIcon size={14} /> Instagram
                    </span>
                    <span style={{ padding: '0.25rem 0.65rem', borderRadius: '6px', background: '#fef3c7', color: '#92400e', fontWeight: 800, fontSize: '0.82rem' }}>
                      Keyword: &quot;{rule.keyword}&quot;
                    </span>
                    {rule.targetPostId ? (
                      <span style={{ padding: '0.25rem 0.65rem', borderRadius: '6px', background: '#ede9fe', color: '#6d28d9', fontWeight: 700, fontSize: '0.78rem' }}>
                        🎯 {rule.targetPostTitle || 'Specific Post'}
                      </span>
                    ) : (
                      <span style={{ padding: '0.25rem 0.65rem', borderRadius: '6px', background: '#f1f5f9', color: '#475569', fontWeight: 600, fontSize: '0.78rem' }}>
                        🌐 All Posts
                      </span>
                    )}
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', fontWeight: 600 }}>
                      🚀 {rule.triggerCount || 0} DMs
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <button onClick={() => toggleAutoReplyRule(rule.id)} style={{ padding: '0.35rem 0.75rem', borderRadius: '999px', border: 'none', background: rule.isActive ? '#ecfdf5' : '#f1f5f9', color: rule.isActive ? '#047857' : '#64748b', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: rule.isActive ? '#10b981' : '#94a3b8' }} />
                      {rule.isActive ? 'Active' : 'Paused'}
                    </button>
                    <button onClick={() => handleSimulateTest(rule)} disabled={simulatingRuleId === rule.id} className="btn btn-secondary btn-sm" style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}>
                      <Sparkles size={13} color="#E1306C" />
                      {simulatingRuleId === rule.id ? 'Sending...' : 'Test'}
                    </button>
                    <button onClick={() => { if (confirm('Delete?')) deleteAutoReplyRule(rule.id); }} className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)', padding: '0.35rem 0.5rem' }}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: rule.commentReply ? '1.4fr 1fr' : '1fr', gap: '1rem' }}>
                  <div style={{ background: '#f8fafc', borderRadius: 'var(--radius-md)', padding: '0.85rem 1rem', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Send size={12} color="#E1306C" /> Private DM:
                    </div>
                    <p style={{ fontSize: '0.88rem', whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>{rule.dmMessage}</p>
                  </div>
                  {rule.commentReply && (
                    <div style={{ background: '#f8fafc', borderRadius: 'var(--radius-md)', padding: '0.85rem 1rem', border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <MessageSquareText size={12} color="#E1306C" /> Reply:
                      </div>
                      <p style={{ fontSize: '0.88rem', fontStyle: 'italic', lineHeight: 1.45 }}>&quot;{rule.commentReply}&quot;</p>
                    </div>
                  )}
                </div>

                {simulationResult && simulationResult.ruleId === rule.id && (
                  <div style={{ marginTop: '1rem', padding: '0.85rem 1.15rem', borderRadius: 'var(--radius-md)', background: '#fdf2f8', border: '1px solid #fbcfe8' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#E1306C', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <CheckCircle2 size={16} /> Test Success: DM triggered to {simulationResult.commenter}!
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
