'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import {
  LayoutDashboard,
  Link2,
  Image as ImageIconLucide,
  Megaphone,
  MessageSquare,
  MessageSquareText,
  Bot,
  LogOut,
  Share2,
  Menu,
  X,
  ChevronRight,
  UploadCloud,
  Calendar,
} from 'lucide-react';
import { InstagramIcon, FacebookIcon } from '@/components/PlatformIcons';

const menuItems = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    description: 'Overview & stats',
  },
  {
    href: '/upload',
    label: 'Upload & Publish',
    icon: UploadCloud,
    description: 'Post videos, reels & photos',
    accent: '#4f46e5',
  },
  {
    href: '/content',
    label: 'Content & Schedule',
    icon: Calendar,
    description: 'Scheduled queue & live feed',
    accent: '#0891b2',
  },
  {
    href: '/connect',
    label: 'Connect Accounts',
    icon: Link2,
    description: 'Facebook & Instagram',
  },
  {
    href: '/instagram',
    label: 'Instagram',
    icon: InstagramIcon,
    description: 'Posts, likes & views',
    accent: '#E1306C',
  },
  {
    href: '/facebook',
    label: 'Facebook',
    icon: FacebookIcon,
    description: 'Posts, likes & views',
    accent: '#1877F2',
  },
  {
    href: '/comments',
    label: 'Comments Inbox',
    icon: MessageSquare,
    description: 'Sabka real comments feed',
    accent: '#8b5cf6',
  },
  {
    href: '/auto-reply',
    label: 'Auto-Reply Rules',
    icon: Bot,
    description: 'Comment-to-DM & gates',
    accent: '#4f46e5',
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useApp();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isPublicLegalPage = ['/privacy', '/terms', '/data-deletion'].includes(pathname);
  if (isPublicLegalPage || !user.loggedIn) return null;

  const handleRefresh = async () => {
    await logout(); // re-runs refreshData()
  };

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    if (href === '/upload') return pathname === '/upload';
    if (href === '/connect') return pathname === '/connect';
    if (href === '/instagram/auto-dm') return pathname === '/instagram/auto-dm';
    if (href === '/facebook/auto-dm') return pathname === '/facebook/auto-dm';
    if (href === '/instagram') return pathname === '/instagram';
    if (href === '/facebook') return pathname === '/facebook';
    return pathname === href;
  };

  return (
    <>
      {/* Mobile Toggle Button */}
      <button
        className="sidebar-mobile-toggle"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label="Toggle menu"
      >
        {mobileOpen ? <X size={22} /> : <Menu size={22} />}
      </button>

      {/* Overlay for mobile */}
      {mobileOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
        {/* Brand */}
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon">
            <Share2 size={20} strokeWidth={2.5} />
          </div>
          <div className="sidebar-brand-text">
            <span className="sidebar-brand-name">PublishingFlow</span>
            <span className="sidebar-brand-tag">Social Manager</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          <div className="sidebar-section-label">MENU</div>
          {menuItems.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`sidebar-nav-item ${active ? 'active' : ''}`}
                onClick={() => setMobileOpen(false)}
              >
                <div
                  className="sidebar-nav-icon"
                  style={active && item.accent ? { color: item.accent } : {}}
                >
                  <Icon size={20} />
                </div>
                <div className="sidebar-nav-content">
                  <span className="sidebar-nav-label-text">{item.label}</span>
                  <span className="sidebar-nav-desc">{item.description}</span>
                </div>
                {active && (
                  <ChevronRight size={14} className="sidebar-nav-arrow" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* User Section */}
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-avatar">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="sidebar-user-info">
              <span className="sidebar-user-name">{user.name}</span>
              <span className="sidebar-user-role">
                {user.membershipTier || 'Free Member'}
              </span>
            </div>
            <button
              onClick={handleRefresh}
              className="sidebar-logout-btn"
              title="Refresh / Sync Data"
            >
              <LayoutDashboard size={16} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
