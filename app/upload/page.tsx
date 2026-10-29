'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { Platform } from '@/types';
import { InstagramIcon, FacebookIcon, ThreadsIcon, YouTubeIcon } from '@/components/PlatformIcons';
import { SocialPreviewCard } from '@/components/SocialPreviewCard';
import { MediaRatioHelper } from '@/components/MediaRatioHelper';
import {
  UploadCloud, X, Send, Calendar, FileVideo, FileImage,
  CheckCircle2, AlertTriangle, Clock, Loader2, Check, ArrowRight,
  Globe, HardDrive, Hash, Sparkles, Plus, Tag, HelpCircle, Trash2
} from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

function extractDriveId(url: string): string | null {
  const patterns = [
    /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/,
    /drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/,
    /drive\.google\.com\/uc\?.*id=([a-zA-Z0-9_-]+)/,
    /docs\.google\.com\/.*\/d\/([a-zA-Z0-9_-]+)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

function getDriveDirectUrl(fileId: string): string {
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}

const QUICK_HASHTAGS = [
  '#reels', '#viral', '#trending', '#shorts',
  '#explore', '#fyp', '#creator', '#instagram',
  '#business', '#marketing'
];

export default function UploadPage() {
  const router = useRouter();
  const { user, isLoaded, accounts, addPost, refreshData } = useApp();

  // Multi-account selection
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set());

  // Media state
  const [mediaTab, setMediaTab] = useState<'upload' | 'url' | 'drive'>('upload');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState('');
  const [mediaType, setMediaType] = useState<'image' | 'video'>('video');
  const [urlInput, setUrlInput] = useState('');
  const [driveInput, setDriveInput] = useState('');
  const [driveResolved, setDriveResolved] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Content fields
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  // Scheduling & submitting (supports multiple future schedule slots)
  const [scheduleTimes, setScheduleTimes] = useState<string[]>(['']);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [publishResults, setPublishResults] = useState<Array<{ platform: string; success: boolean; error?: string }>>([]);



  // Default schedule: tomorrow 10 AM
  useEffect(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    const tzOffset = tomorrow.getTimezoneOffset() * 60000;
    const initialIso = new Date(tomorrow.getTime() - tzOffset).toISOString().slice(0, 16);
    setScheduleTimes([initialIso]);
  }, []);

  const addScheduleTime = () => {
    const last = scheduleTimes[scheduleTimes.length - 1];
    if (!last) return;
    const next = new Date(last);
    next.setDate(next.getDate() + 1);
    const tzOff = next.getTimezoneOffset() * 60000;
    setScheduleTimes([...scheduleTimes, new Date(next.getTime() - tzOff).toISOString().slice(0, 16)]);
  };

  const removeScheduleTime = (idx: number) => {
    if (scheduleTimes.length <= 1) return;
    setScheduleTimes(scheduleTimes.filter((_, i) => i !== idx));
  };

  const updateScheduleTime = (idx: number, val: string) => {
    const updated = [...scheduleTimes];
    updated[idx] = val;
    setScheduleTimes(updated);
  };

  const connectedAccounts = accounts.filter(
    a => a.connectionStatus === 'Connected' &&
         a.connectionType === 'oauth' &&
         (a.platform === 'Facebook' || a.platform === 'Instagram' || a.platform === 'Threads' || a.platform === 'YouTube')
  );

  // Auto-select all connected accounts by default
  useEffect(() => {
    if (connectedAccounts.length > 0 && selectedAccounts.size === 0) {
      setSelectedAccounts(new Set(connectedAccounts.map(a => a.id)));
    }
  }, [connectedAccounts.length]);

  const selectedPlatformNames = useMemo(() => {
    const list = connectedAccounts.filter(a => selectedAccounts.has(a.id)).map(a => a.platform);
    return Array.from(new Set(list));
  }, [connectedAccounts, selectedAccounts]);

  const primaryClientName = useMemo(() => {
    const acc = connectedAccounts.find(a => selectedAccounts.has(a.id));
    return acc ? acc.clientName : 'Your Account';
  }, [connectedAccounts, selectedAccounts]);

  const primaryPlatform = useMemo(() => {
    const acc = connectedAccounts.find(a => selectedAccounts.has(a.id));
    return acc ? (acc.platform as Platform) : 'Instagram';
  }, [connectedAccounts, selectedAccounts]);

  // Media Handlers
  const handleFileSelect = (file: File) => {
    if (!file) return;
    setMediaFile(file);
    const isVid = file.type.startsWith('video');
    setMediaType(isVid ? 'video' : 'image');
    setMediaPreview(URL.createObjectURL(file));
    setPublishResults([]);
  };

  const handleMediaFitted = (newFile: File, previewUrl: string) => {
    setMediaFile(newFile);
    setMediaPreview(previewUrl);
    setMediaType('image');
  };

  const handleApplyUrl = () => {
    if (!urlInput.trim()) return;
    setMediaFile(null);
    setMediaPreview(urlInput.trim());
    const isVid = urlInput.match(/\.(mp4|mov|webm)(\?.*)?$/i) !== null;
    setMediaType(isVid ? 'video' : 'image');
  };

  const handleApplyDrive = () => {
    if (!driveInput.trim()) return;
    const fileId = extractDriveId(driveInput.trim());
    if (!fileId) {
      setSubmitError('Invalid Google Drive URL. Please make sure the link is set to "Anyone with the link can view".');
      return;
    }
    const direct = getDriveDirectUrl(fileId);
    setDriveResolved(direct);
    setMediaFile(null);
    setMediaPreview(direct);
    setMediaType('video');
  };

  const clearMedia = () => {
    setMediaFile(null);
    setMediaPreview('');
    setUrlInput('');
    setDriveInput('');
    setDriveResolved('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const toggleAccount = (id: string) => {
    setSelectedAccounts(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Tags Handlers
  const handleAddTag = (rawTag: string) => {
    const clean = rawTag.replace(/^#/, '').trim();
    if (!clean) return;
    if (!tags.includes(clean)) {
      setTags(prev => [...prev, clean]);
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(prev => prev.filter(t => t !== tagToRemove));
  };

  const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddTag(tagInput);
      setTagInput('');
    }
  };

  const insertHashtagToCaption = (ht: string) => {
    if (caption.includes(ht)) return;
    setCaption(prev => prev ? `${prev} ${ht}` : ht);
  };

  // Stream media directly: video buffer is streamed directly to Meta / Instagram / YouTube servers
  // ZERO server disk storage and ZERO Supabase storage used!
  const prepareMediaPayload = async (): Promise<{ mediaUrl?: string; fileToSend?: File }> => {
    if (mediaFile) {
      return { fileToSend: mediaFile };
    }
    
    if (mediaPreview && (mediaTab === 'url' || mediaTab === 'drive')) {
      return { mediaUrl: mediaPreview };
    }

    return {};
  };

  // Publish / Schedule Logic
  const handlePublishNow = async () => {
    setSubmitError(null);
    setPublishResults([]);

    if (selectedAccounts.size === 0) {
      setSubmitError('Please tick at least one account to publish to.');
      return;
    }
    if (!caption.trim() && !title.trim() && !mediaFile && !mediaPreview) {
      setSubmitError('Please enter a caption, title, or select media.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { mediaUrl, fileToSend } = await prepareMediaPayload();

      const fd = new FormData();
      if (fileToSend) {
        fd.append('file', fileToSend);
      } else if (mediaUrl) {
        fd.append('mediaUrl', mediaUrl);
      }

      fd.append('title', title.trim());
      fd.append('caption', caption.trim());
      fd.append('description', description.trim());
      fd.append('tags', JSON.stringify(tags));
      fd.append('accountIds', JSON.stringify(Array.from(selectedAccounts)));

      const res = await fetch('/api/publish/direct', {
        method: 'POST',
        body: fd,
      });

      const responseText = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(responseText);
      } catch {
        if (res.status === 413 || responseText.includes('Request Entity Too Large')) {
          throw new Error('Video file exceeded direct proxy limit. Please retry with transit upload.');
        }
        throw new Error(responseText || `Server responded with status ${res.status}`);
      }

      if (data.results) {
        setPublishResults(
          data.results.map((r: any) => ({
            platform: r.platform,
            success: r.success,
            error: r.error,
          }))
        );
      }

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Direct publishing encountered errors.');
      }

      await refreshData();
      setTimeout(() => router.push('/dashboard'), 2000);
    } catch (err: any) {
      setSubmitError(err.message || 'Publishing failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSchedule = async () => {
    setSubmitError(null);
    setPublishResults([]);

    if (selectedAccounts.size === 0) {
      setSubmitError('Please tick at least one account to schedule.');
      return;
    }
    if (!caption.trim() && !title.trim() && !mediaFile && !mediaPreview) {
      setSubmitError('Please enter a caption, title, or select media.');
      return;
    }
    if (scheduleTimes.some(t => !t)) {
      setSubmitError('Please select valid date and time for all schedule slots.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { mediaUrl, fileToSend } = await prepareMediaPayload();

      const fd = new FormData();
      if (fileToSend) {
        fd.append('file', fileToSend);
      } else if (mediaUrl) {
        fd.append('mediaUrl', mediaUrl);
      }

      fd.append('title', title.trim());
      fd.append('caption', caption.trim());
      fd.append('description', description.trim());
      fd.append('tags', JSON.stringify(tags));
      fd.append('accountIds', JSON.stringify(Array.from(selectedAccounts)));
      fd.append('scheduleTimes', JSON.stringify(scheduleTimes));

      const res = await fetch('/api/publish/direct', {
        method: 'POST',
        body: fd,
      });

      const responseText = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(responseText);
      } catch {
        if (res.status === 413 || responseText.includes('Request Entity Too Large')) {
          throw new Error('Video file exceeded direct proxy limit. Please retry with transit upload.');
        }
        throw new Error(responseText || `Server responded with status ${res.status}`);
      }

      if (data.results) {
        setPublishResults(
          data.results.map((r: any) => ({
            platform: r.platform,
            success: r.success,
            error: r.error,
          }))
        );
      }

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Direct scheduling encountered errors.');
      }

      await refreshData();
      router.push('/dashboard');
    } catch (err: any) {
      setSubmitError(err.message || 'Scheduling failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="app-container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title" style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
            Publishing Hub
          </h1>
          <p className="page-desc" style={{ color: 'var(--text-dim)', marginTop: '0.25rem', fontSize: '0.9rem' }}>
            Compose, preview across channels, and stream directly to Meta &amp; YouTube with zero storage cost.
          </p>
        </div>
      </div>

      {/* 2-Column Responsive Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: '2rem', alignItems: 'start' }}>
        
        {/* ================= LEFT COLUMN: COMPOSER ================= */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* 1. SELECT TARGET ACCOUNTS */}
          <div className="card" style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                1. Select Accounts to Publish To
              </h3>
              <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                {selectedAccounts.size} of {connectedAccounts.length} selected
              </span>
            </div>

            {connectedAccounts.length === 0 ? (
              <div style={{
                padding: '1.25rem',
                borderRadius: 'var(--radius-md)',
                background: '#fffbeb',
                border: '1px solid #fde68a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1rem'
              }}>
                <div>
                  <p style={{ fontWeight: 600, color: '#92400e', margin: 0 }}>No connected accounts found</p>
                  <span style={{ fontSize: '0.82rem', color: '#b45309' }}>Connect Facebook, Instagram, or YouTube first.</span>
                </div>
                <Link href="/profile" className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span>Connect Accounts</span>
                  <ArrowRight size={14} />
                </Link>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.65rem' }}>
                {connectedAccounts.map((acc) => {
                  const isChecked = selectedAccounts.has(acc.id);
                  return (
                    <label
                      key={acc.id}
                      onClick={() => toggleAccount(acc.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.65rem',
                        padding: '0.65rem 0.85rem',
                        borderRadius: 'var(--radius-md)',
                        border: isChecked ? '2px solid var(--primary, #4f46e5)' : '1px solid var(--border, #e2e8f0)',
                        background: isChecked ? 'rgba(79, 70, 229, 0.05)' : '#fff',
                        cursor: 'pointer',
                        userSelect: 'none',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        style={{ width: '16px', height: '16px', accentColor: 'var(--primary, #4f46e5)' }}
                      />
                      <div style={{ flexShrink: 0 }}>
                        {acc.platform === 'Instagram' && <InstagramIcon size={20} />}
                        {acc.platform === 'Facebook' && <FacebookIcon size={20} />}
                        {acc.platform === 'Threads' && <ThreadsIcon size={20} />}
                        {acc.platform === 'YouTube' && <YouTubeIcon size={20} />}
                      </div>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <p style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main)', margin: 0 }}>{acc.clientName}</p>
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{acc.platform}</span>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* 2. MEDIA UPLOADER WITH TABS & RATIO HELPER */}
          <div className="card" style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                2. Media Attachment
              </h3>
              {mediaPreview && (
                <button
                  type="button"
                  onClick={clearMedia}
                  className="btn btn-ghost btn-sm"
                  style={{ color: '#dc2626', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.78rem' }}
                >
                  <X size={14} /> Remove Media
                </button>
              )}
            </div>

            {/* Media Source Tabs */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setMediaTab('upload')}
                style={{
                  padding: '0.35rem 0.75rem',
                  borderRadius: '6px',
                  border: 'none',
                  background: mediaTab === 'upload' ? 'var(--primary, #4f46e5)' : 'transparent',
                  color: mediaTab === 'upload' ? '#fff' : '#64748b',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem'
                }}
              >
                <UploadCloud size={14} /> Local File
              </button>
              <button
                type="button"
                onClick={() => setMediaTab('url')}
                style={{
                  padding: '0.35rem 0.75rem',
                  borderRadius: '6px',
                  border: 'none',
                  background: mediaTab === 'url' ? 'var(--primary, #4f46e5)' : 'transparent',
                  color: mediaTab === 'url' ? '#fff' : '#64748b',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem'
                }}
              >
                <Globe size={14} /> Direct URL
              </button>
              <button
                type="button"
                onClick={() => setMediaTab('drive')}
                style={{
                  padding: '0.35rem 0.75rem',
                  borderRadius: '6px',
                  border: 'none',
                  background: mediaTab === 'drive' ? 'var(--primary, #4f46e5)' : 'transparent',
                  color: mediaTab === 'drive' ? '#fff' : '#64748b',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem'
                }}
              >
                <HardDrive size={14} /> Google Drive
              </button>
            </div>

            {/* Tab 1: Local File Upload */}
            {mediaTab === 'upload' && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/mp4,video/quicktime,video/webm,image/jpeg,image/png,image/webp"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileSelect(f);
                  }}
                />

                {!mediaPreview ? (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      border: '2px dashed #cbd5e1',
                      borderRadius: 'var(--radius-md)',
                      padding: '2.5rem 1.5rem',
                      textAlign: 'center',
                      background: '#f8fafc',
                      cursor: 'pointer',
                      transition: 'border 0.2s ease',
                    }}
                  >
                    <UploadCloud size={38} color="#4f46e5" style={{ margin: '0 auto 0.75rem' }} />
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)', margin: 0 }}>
                      Click to select video or photo
                    </h4>
                    <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.35rem' }}>
                      MP4, MOV, JPG, PNG or WEBP (Direct stream, 0 MB server storage)
                    </p>
                  </div>
                ) : (
                  <div style={{ borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: '#000', overflow: 'hidden' }}>
                    {mediaType === 'video' ? (
                      <video src={mediaPreview} controls style={{ width: '100%', maxHeight: '320px', objectFit: 'contain' }} />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={mediaPreview} alt="Preview" style={{ width: '100%', maxHeight: '320px', objectFit: 'contain' }} />
                    )}
                    {mediaFile && (
                      <div style={{ background: '#f8fafc', padding: '0.5rem 0.85rem', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)' }}>{mediaFile.name}</span>
                        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{(mediaFile.size / (1024 * 1024)).toFixed(1)} MB</span>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Tab 2: Direct URL */}
            {mediaTab === 'url' && (
              <div>
                <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem', display: 'block' }}>
                  Public Image or Video URL
                </label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="url"
                    className="input"
                    placeholder="https://example.com/video.mp4"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    style={{ flex: 1, padding: '0.55rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border)' }}
                  />
                  <button
                    type="button"
                    onClick={handleApplyUrl}
                    className="btn btn-secondary"
                    style={{ padding: '0.55rem 1rem', fontSize: '0.82rem' }}
                  >
                    Load Media
                  </button>
                </div>
              </div>
            )}

            {/* Tab 3: Google Drive */}
            {mediaTab === 'drive' && (
              <div>
                <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem', display: 'block' }}>
                  Google Drive Public Share Link
                </label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="url"
                    className="input"
                    placeholder="https://drive.google.com/file/d/1A2B3C.../view?usp=sharing"
                    value={driveInput}
                    onChange={(e) => setDriveInput(e.target.value)}
                    style={{ flex: 1, padding: '0.55rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border)' }}
                  />
                  <button
                    type="button"
                    onClick={handleApplyDrive}
                    className="btn btn-secondary"
                    style={{ padding: '0.55rem 1rem', fontSize: '0.82rem' }}
                  >
                    Resolve Link
                  </button>
                </div>
                <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.4rem' }}>
                  Ensure link access is set to <em>&quot;Anyone with the link can view&quot;</em>.
                </p>
              </div>
            )}

            {/* Ratio Helper Tool */}
            {mediaPreview && (
              <MediaRatioHelper
                mediaUrl={mediaPreview}
                mediaType={mediaType}
                originalFile={mediaFile}
                onMediaFitted={handleMediaFitted}
                selectedPlatforms={selectedPlatformNames}
              />
            )}
          </div>

          {/* 3. TITLE, CAPTION, TAGS & DESCRIPTION */}
          <div className="card" style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-main)' }}>
              3. Content &amp; SEO Metadata
            </h3>

            {/* Title */}
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 600, color: '#475569', margin: 0 }}>
                  Title <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 400 }}>(Required for YouTube, recommended for Facebook &amp; Threads)</span>
                </label>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{title.length}/100</span>
              </div>
              <input
                type="text"
                className="input"
                placeholder="e.g. 5 Game-Changing AI Tools for Content Creators in 2026"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={100}
                style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid var(--border)' }}
              />
            </div>

            {/* Main Caption */}
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 600, color: '#475569', margin: 0 }}>
                  Caption &amp; Body Text
                </label>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                  {caption.length} chars · {caption.trim() ? caption.trim().split(/\s+/).length : 0} words
                </span>
              </div>
              <textarea
                className="textarea"
                placeholder="Write your engaging caption here. Include hashtags and mentions..."
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={5}
                style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '6px', border: '1px solid var(--border)', resize: 'vertical' }}
              />

              {/* Quick Hashtag / Tag Suggestions */}
              <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Sparkles size={12} color="#4f46e5" /> Quick Tags:
                </span>
                {QUICK_HASHTAGS.map((ht) => (
                  <button
                    key={ht}
                    type="button"
                    onClick={() => {
                      insertHashtagToCaption(ht);
                      handleAddTag(ht);
                    }}
                    style={{
                      border: '1px solid #e2e8f0',
                      background: '#f8fafc',
                      color: '#4f46e5',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      padding: '0.2rem 0.5rem',
                      borderRadius: '999px',
                      cursor: 'pointer',
                      transition: 'background 0.15s ease',
                    }}
                  >
                    {ht}
                  </button>
                ))}
              </div>
            </div>

            {/* Tags & Keywords Chip Input */}
            <div style={{ marginBottom: '1rem' }}>
              <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 600, color: '#475569', marginBottom: '0.3rem', display: 'block' }}>
                Tags &amp; Keywords <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 400 }}>(Press Enter or comma to add, used for YouTube tags &amp; SEO)</span>
              </label>

              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.4rem',
                padding: '0.4rem 0.6rem',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                background: '#fff',
                minHeight: '42px',
                alignItems: 'center'
              }}>
                {tags.map((tag) => (
                  <span
                    key={tag}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      background: '#eef2ff',
                      color: '#4338ca',
                      padding: '0.2rem 0.55rem',
                      borderRadius: '4px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                    }}
                  >
                    #{tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#6366f1', padding: 0, display: 'flex' }}
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  placeholder={tags.length === 0 ? "Add tags like 'tech', 'ai', 'productivity'..." : "Add tag..."}
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagInputKeyDown}
                  style={{
                    border: 'none',
                    outline: 'none',
                    fontSize: '0.82rem',
                    flex: 1,
                    minWidth: '120px',
                    padding: '0.25rem',
                  }}
                />
              </div>
            </div>

            {/* Extended Description (Optional - YouTube / FB) */}
            <div>
              <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 600, color: '#475569', marginBottom: '0.3rem', display: 'block' }}>
                Extended Description <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 400 }}>(Optional - timestamps, links, YouTube deep description)</span>
              </label>
              <textarea
                className="textarea"
                placeholder="0:00 Intro&#10;1:20 Tool 1 Demonstration&#10;2:45 Conclusion and Links..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '6px', border: '1px solid var(--border)', resize: 'vertical' }}
              />
            </div>
          </div>

          {/* 4. PUBLISH OR SCHEDULE ACTION CARD */}
          <div className="card" style={{ background: '#fff', border: '2px solid var(--primary, #4f46e5)', borderRadius: 'var(--radius-lg)', padding: '1.25rem' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-main)' }}>
              4. Publish or Schedule
            </h3>

            {submitError && (
              <div style={{
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-sm)',
                background: '#fff1f2',
                border: '1px solid #fecdd3',
                color: '#be123c',
                fontSize: '0.88rem',
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <AlertTriangle size={16} />
                <span>{submitError}</span>
              </div>
            )}

            {publishResults.length > 0 && (
              <div style={{ marginBottom: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {publishResults.map((r, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '0.65rem 0.85rem',
                      borderRadius: 'var(--radius-sm)',
                      background: r.success ? '#ecfdf5' : '#fff1f2',
                      border: r.success ? '1px solid #a7f3d0' : '1px solid #fecdd3',
                      color: r.success ? '#047857' : '#be123c',
                      fontSize: '0.88rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}
                  >
                    {r.success ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                    <span><strong>{r.platform}:</strong> {r.success ? 'Successfully published! (0 MB Storage)' : r.error}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Instant Publish Button */}
            <div style={{ marginBottom: '1.25rem' }}>
              <button
                type="button"
                onClick={handlePublishNow}
                disabled={isSubmitting || selectedAccounts.size === 0}
                className="btn btn-primary btn-lg"
                style={{ width: '100%', height: '52px', fontSize: '0.98rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={18} className="spinner" />
                    <span>Publishing...</span>
                  </>
                ) : (
                  <>
                    <Send size={18} />
                    <span>Publish Immediately ({selectedAccounts.size} Account{selectedAccounts.size > 1 ? 's' : ''})</span>
                  </>
                )}
              </button>
            </div>

            {/* Multi-Slot Schedule Section */}
            <div style={{ paddingTop: '1.25rem', borderTop: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Calendar size={16} color="var(--primary, #4f46e5)" />
                  <span>Schedule for Future Publishing ({scheduleTimes.length} Slot{scheduleTimes.length > 1 ? 's' : ''})</span>
                </span>
                <button
                  type="button"
                  onClick={addScheduleTime}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.3rem 0.65rem' }}
                >
                  <Plus size={13} />
                  <span>Add Another Time Slot</span>
                </button>
              </div>

              {/* Numbered Schedule Slots */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {scheduleTimes.map((t, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{
                      width: '26px', height: '26px', borderRadius: '50%', background: '#eef2ff', color: '#4338ca',
                      fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                    }}>
                      {idx + 1}
                    </span>
                    <input
                      type="datetime-local"
                      className="input"
                      style={{ flex: 1, padding: '0.55rem 0.75rem', fontSize: '0.85rem', border: '1px solid var(--border)' }}
                      value={t}
                      onChange={(e) => updateScheduleTime(idx, e.target.value)}
                    />
                    {scheduleTimes.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeScheduleTime(idx)}
                        className="btn btn-ghost btn-sm"
                        style={{ color: '#dc2626', padding: '0.45rem', border: '1px solid #fee2e2', borderRadius: '6px' }}
                        title="Remove time slot"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Helper count & Schedule Action */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <span style={{ fontSize: '0.78rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <Clock size={13} />
                  Will schedule {selectedAccounts.size * scheduleTimes.length} total post(s) ({selectedAccounts.size} account{selectedAccounts.size > 1 ? 's' : ''} × {scheduleTimes.length} time{scheduleTimes.length > 1 ? 's' : ''})
                </span>

                <button
                  type="button"
                  onClick={handleSchedule}
                  disabled={isSubmitting || selectedAccounts.size === 0}
                  className="btn btn-secondary"
                  style={{ height: '42px', padding: '0 1.25rem', display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 600 }}
                >
                  <Calendar size={16} />
                  <span>Schedule All Slots</span>
                </button>
              </div>
            </div>
          </div>

        </div>

        {/* ================= RIGHT COLUMN: LIVE SOCIAL PREVIEW ================= */}
        <div>
          <SocialPreviewCard
            platform={primaryPlatform}
            clientName={primaryClientName}
            caption={caption}
            title={title}
            description={description}
            tags={tags}
            mediaUrl={mediaPreview}
            mediaType={mediaType}
          />
        </div>

      </div>
    </div>
  );
}
