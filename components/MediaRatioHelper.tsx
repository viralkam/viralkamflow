'use client';

import React, { useState, useEffect } from 'react';
import { Crop, AlertTriangle, CheckCircle2, Sparkles, RefreshCw, Info } from 'lucide-react';

interface MediaRatioHelperProps {
  mediaUrl: string;
  mediaType: 'image' | 'video';
  originalFile?: File | null;
  onMediaFitted?: (newFile: File, previewUrl: string) => void;
  selectedPlatforms?: string[];
}

export function MediaRatioHelper({
  mediaUrl,
  mediaType,
  originalFile,
  onMediaFitted,
  selectedPlatforms = ['Instagram'],
}: MediaRatioHelperProps) {
  const [dimensions, setDimensions] = useState<{ width: number; height: number; ratio: number; ratioLabel: string } | null>(null);
  const [isFitting, setIsFitting] = useState(false);
  const [fittedApplied, setFittedApplied] = useState<string | null>(null);

  useEffect(() => {
    if (!mediaUrl) {
      setDimensions(null);
      setFittedApplied(null);
      return;
    }

    if (mediaType === 'image') {
      const img = new Image();
      img.onload = () => {
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        const r = w / h;
        setDimensions({
          width: w,
          height: h,
          ratio: r,
          ratioLabel: getRatioLabel(r),
        });
      };
      img.src = mediaUrl;
    } else {
      const video = document.createElement('video');
      video.onloadedmetadata = () => {
        const w = video.videoWidth;
        const h = video.videoHeight;
        const r = w / h;
        setDimensions({
          width: w,
          height: h,
          ratio: r,
          ratioLabel: getRatioLabel(r),
        });
      };
      video.src = mediaUrl;
    }
  }, [mediaUrl, mediaType]);

  const getRatioLabel = (r: number): string => {
    if (Math.abs(r - 1.0) < 0.05) return '1:1 Square';
    if (Math.abs(r - 0.8) < 0.05) return '4:5 Portrait (IG Feed)';
    if (Math.abs(r - 9 / 16) < 0.05) return '9:16 Vertical (Reel/Story)';
    if (Math.abs(r - 16 / 9) < 0.05) return '16:9 Landscape (Facebook)';
    if (r < 0.8) return `${r.toFixed(2)}:1 Tall`;
    return `${r.toFixed(2)}:1 Wide`;
  };

  const isInstagramSelected = selectedPlatforms.includes('Instagram');
  const isImage = mediaType === 'image';
  const isVideo = mediaType === 'video';

  // Instagram Graph API Feed rules: photo ratio must be between 4:5 (0.80) and 1.91:1
  const isInstagramImageMismatched = Boolean(
    isInstagramSelected &&
    isImage &&
    dimensions &&
    (dimensions.ratio < 0.79 || dimensions.ratio > 1.92)
  );

  const isInstagramVideoWarning = Boolean(
    isInstagramSelected &&
    isVideo &&
    dimensions &&
    dimensions.ratio > 1.0 &&
    dimensions.ratio < 1.7
  );

  // In-Browser Canvas Quick Fit (Auto-Fit to 1:1 or 4:5 without quality loss)
  const applyQuickFit = async (targetRatio: '1:1' | '4:5') => {
    if (!mediaUrl || mediaType !== 'image' || !onMediaFitted) return;
    setIsFitting(true);

    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = mediaUrl;
      });

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context not available');

      let targetW = 1080;
      let targetH = 1080;

      if (targetRatio === '4:5') {
        targetW = 1080;
        targetH = 1350;
      }

      canvas.width = targetW;
      canvas.height = targetH;

      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, targetW, targetH);

      // Subtle blur background
      ctx.save();
      ctx.filter = 'blur(30px) brightness(0.6)';
      ctx.drawImage(img, -20, -20, targetW + 40, targetH + 40);
      ctx.restore();

      // Fit original image centered
      const imgRatio = img.naturalWidth / img.naturalHeight;
      const targetCanvasRatio = targetW / targetH;

      let drawW = targetW;
      let drawH = targetH;
      let drawX = 0;
      let drawY = 0;

      if (imgRatio > targetCanvasRatio) {
        drawW = targetW;
        drawH = targetW / imgRatio;
        drawY = (targetH - drawH) / 2;
      } else {
        drawH = targetH;
        drawW = targetH * imgRatio;
        drawX = (targetW - drawW) / 2;
      }

      ctx.drawImage(img, drawX, drawY, drawW, drawH);

      canvas.toBlob((blob) => {
        if (!blob) return;
        const filename = (originalFile?.name || 'fitted-post').replace(/\.[^/.]+$/, '') + `_${targetRatio.replace(':', '-')}.jpg`;
        const newFile = new File([blob], filename, { type: 'image/jpeg' });
        const previewUrl = URL.createObjectURL(blob);

        onMediaFitted(newFile, previewUrl);
        setFittedApplied(targetRatio);
        setIsFitting(false);
      }, 'image/jpeg', 0.95);
    } catch (err) {
      console.error('Canvas fit error:', err);
      setIsFitting(false);
    }
  };

  if (!dimensions) return null;

  return (
    <div className="media-ratio-container" style={{ marginTop: '0.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.35rem',
          padding: '0.25rem 0.6rem',
          borderRadius: '6px',
          background: 'var(--bg-subtle, #f1f5f9)',
          border: '1px solid var(--border, #cbd5e1)',
          fontSize: '0.78rem',
          fontWeight: 600,
          color: 'var(--text-main, #0f172a)',
        }}>
          <Crop size={13} style={{ color: 'var(--primary, #4f46e5)' }} />
          <span>{dimensions.ratioLabel}</span>
        </span>

        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
          {dimensions.width} × {dimensions.height} px
        </span>

        {isInstagramImageMismatched ? (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.3rem',
            fontSize: '0.75rem',
            color: '#dc2626',
            fontWeight: 600,
            background: '#fef2f2',
            padding: '0.2rem 0.5rem',
            borderRadius: '4px',
            border: '1px solid #fecaca'
          }}>
            <AlertTriangle size={12} />
            <span>Ratio mismatch for Instagram</span>
          </span>
        ) : (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.3rem',
            fontSize: '0.75rem',
            color: '#16a34a',
            fontWeight: 500,
            background: '#f0fdf4',
            padding: '0.2rem 0.5rem',
            borderRadius: '4px',
            border: '1px solid #bbf7d0'
          }}>
            <CheckCircle2 size={12} />
            <span>Ratio looks good</span>
          </span>
        )}
      </div>

      {isInstagramImageMismatched && (
        <div style={{
          marginTop: '0.6rem',
          background: '#fffbeb',
          border: '1px solid #fde68a',
          borderRadius: '8px',
          padding: '0.75rem',
          fontSize: '0.82rem',
          color: '#92400e',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
            <AlertTriangle size={16} style={{ color: '#d97706', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <p style={{ fontWeight: 600, marginBottom: '0.2rem' }}>
                Instagram Aspect Ratio Warning
              </p>
              <p style={{ lineHeight: 1.4 }}>
                Instagram requires photos between <strong>4:5 (0.80)</strong> and <strong>1.91:1</strong>.
                Current ratio is <strong>{dimensions.ratio.toFixed(2)}:1</strong>.
              </p>
              
              {isImage && onMediaFitted && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#78350f' }}>1-Click Auto Fit:</span>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', gap: '0.35rem' }}
                    onClick={() => applyQuickFit('1:1')}
                    disabled={isFitting}
                  >
                    <Sparkles size={12} color="#4f46e5" />
                    <span>Fit 1:1 Square</span>
                  </button>

                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', gap: '0.35rem' }}
                    onClick={() => applyQuickFit('4:5')}
                    disabled={isFitting}
                  >
                    <Crop size={12} color="#7c3aed" />
                    <span>Fit 4:5 Portrait</span>
                  </button>

                  {isFitting && (
                    <span style={{ fontSize: '0.75rem', color: '#4f46e5', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <RefreshCw size={12} className="animate-spin" /> Adjusting...
                    </span>
                  )}
                  {fittedApplied && (
                    <span style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 600 }}>
                      ✓ Applied {fittedApplied} Fit!
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {isInstagramVideoWarning && (
        <div style={{
          marginTop: '0.5rem',
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '6px',
          padding: '0.5rem 0.75rem',
          fontSize: '0.78rem',
          color: '#64748b',
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem'
        }}>
          <Info size={14} color="#4f46e5" />
          <span>Note: Instagram Reels perform best with <strong>9:16 vertical video</strong> (1080 × 1920 px).</span>
        </div>
      )}
    </div>
  );
}
