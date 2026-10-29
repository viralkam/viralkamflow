'use client';

export const dynamic = 'force-dynamic';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { Share2, Link2, Upload, ListChecks, LogOut, MessageSquareText, LayoutGrid, MessageSquare } from 'lucide-react';

export function SimpleNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useApp();

  if (!user.loggedIn) return null;

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  const navLinks = [
    { href: '/profile', label: '1. Accounts', icon: <Link2 size={16} /> },
    { href: '/upload', label: '2. Upload & Publish', icon: <Upload size={16} /> },
    { href: '/content', label: '3. Content Manager', icon: <LayoutGrid size={16} /> },
    { href: '/comments', label: '4. Comments Inbox', icon: <MessageSquare size={16} /> },
    { href: '/auto-reply', label: '5. Auto Reply', icon: <MessageSquareText size={16} /> },
    { href: '/dashboard', label: '6. Overview', icon: <ListChecks size={16} /> },
  ];

  return (
    <nav className="nav-bar">
      <Link href="/upload" className="nav-brand">
        <div className="nav-brand-icon">
          <Share2 size={18} strokeWidth={2.5} />
        </div>
        <span>PublishingFlow</span>
      </Link>

      <div className="nav-links">
        {navLinks.map((link) => {
          const isActive = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`nav-link ${isActive ? 'active' : ''}`}
            >
              {link.icon}
              <span>{link.label}</span>
            </Link>
          );
        })}
      </div>

      <div className="nav-right">
        <div className="nav-user">
          <div className="nav-avatar">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <span className="nav-username">{user.name}</span>
          <button
            onClick={handleLogout}
            title="Log Out"
            className="nav-logout-btn"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </nav>
  );
}
