'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Account, Post, PostStatus, ConnectionStatus, ConnectionType, Platform, AutoReplyRule } from '@/types';

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export interface UserProfile {
  id?: string;
  username?: string;
  name: string;
  membershipTier?: string;
  loggedIn: boolean;
}

interface AppContextType {
  user: UserProfile;
  login: (userData: { id?: string; username?: string; name: string; membershipTier?: string }) => void;
  logout: () => Promise<void>;
  accounts: Account[];
  posts: Post[];
  autoReplyRules: AutoReplyRule[];
  isLoaded: boolean;
  isUsingSupabase: boolean;
  addAccount: (data: {
    clientName: string;
    platform: Platform;
    connectionType: ConnectionType;
    connectionStatus: ConnectionStatus;
    oauthAccountId?: string;
  }) => Promise<Account>;
  updateAccount: (id: string, updates: Partial<Account>) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;
  addPost: (data: Omit<Post, 'id' | 'createdAt'>) => Promise<Post>;
  updatePost: (id: string, updates: Partial<Post>) => Promise<void>;
  deletePost: (id: string) => Promise<void>;
  updatePostStatus: (id: string, status: PostStatus, publishedAt?: string) => Promise<void>;
  addAutoReplyRule: (rule: Omit<AutoReplyRule, 'id' | 'createdAt' | 'triggerCount'>) => Promise<AutoReplyRule>;
  toggleAutoReplyRule: (id: string) => Promise<void>;
  deleteAutoReplyRule: (id: string) => Promise<void>;
  incrementRuleTriggerCount: (id: string) => Promise<void>;
  refreshData: () => Promise<void>;
  triggerSchedulerWorker: () => Promise<{ success: boolean; message: string; processedCount: number }>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const DEFAULT_ADMIN_USER: UserProfile = {
  id: 'admin',
  username: 'admin',
  name: 'Admin',
  membershipTier: 'Administrator',
  loggedIn: true,
};

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile>(DEFAULT_ADMIN_USER);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [autoReplyRules, setAutoReplyRules] = useState<AutoReplyRule[]>([]);
  const [isLoaded, setIsLoaded] = useState(true);
  const [isUsingSupabase, setIsUsingSupabase] = useState(false);

  // Instant hydration from local client storage on mount
  useEffect(() => {
    try {
      const cached = localStorage.getItem('pf_cached_data_admin');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.accounts) setAccounts(parsed.accounts);
        if (parsed.posts) setPosts(parsed.posts);
        if (parsed.autoReplyRules) setAutoReplyRules(parsed.autoReplyRules);
      }
    } catch {}
  }, []);

  const refreshData = useCallback(async () => {
    try {
      // 1. Fetch user data immediately
      const dataRes = await fetch('/api/user/data');
      if (dataRes.ok) {
        const json = await dataRes.json();
        if (json.data) {
          const accs = json.data.accounts || [];
          const pts = json.data.posts || [];
          const rules = json.data.autoReplyRules || [];
          setAccounts(accs);
          setPosts(pts);
          setAutoReplyRules(rules);
          try {
            localStorage.setItem('pf_cached_data_admin', JSON.stringify({ accounts: accs, posts: pts, autoReplyRules: rules }));
          } catch {}
        }
      }

      // 2. Refresh auth profile
      const meRes = await fetch('/api/auth/me');
      if (meRes.ok) {
        const meData = await meRes.json();
        if (meData.loggedIn && meData.user) {
          setUser({
            id: meData.user.id || 'admin',
            username: meData.user.username || 'admin',
            name: meData.user.name || 'Admin',
            membershipTier: meData.user.membershipTier || 'Administrator',
            loggedIn: true,
          });
        }
      }
    } catch (err) {
      console.warn('[AppContext] Failed to refresh data:', err);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  const login = useCallback((userData: { id?: string; username?: string; name: string; membershipTier?: string }) => {
    setUser({
      id: userData.id || 'admin',
      username: userData.username || 'admin',
      name: userData.name || 'Admin',
      membershipTier: userData.membershipTier || 'Administrator',
      loggedIn: true,
    });
    refreshData();
  }, [refreshData]);

  const logout = useCallback(async () => {
    // Admin mode: refresh data instead of locking out
    await refreshData();
  }, [refreshData]);

  // Initial load
  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Background scheduler (every 30s)
  useEffect(() => {
    if (!user.loggedIn) return;
    const runWorker = async () => {
      try {
        const res = await fetch('/api/cron/publish-scheduled');
        if (res.ok) {
          const data = await res.json();
          if (data.results && data.results.length > 0) {
            await refreshData();
          }
        }
      } catch {}
    };
    const initialTimer = setTimeout(runWorker, 5000);
    const interval = setInterval(runWorker, 30000);
    return () => { clearTimeout(initialTimer); clearInterval(interval); };
  }, [user.loggedIn, refreshData]);

  const triggerSchedulerWorker = useCallback(async () => {
    try {
      const res = await fetch('/api/cron/publish-scheduled', { method: 'POST' });
      const data = await res.json();
      if (data.results && data.results.length > 0) await refreshData();
      return { success: res.ok, message: data.message || 'Done.', processedCount: data.processedCount || 0 };
    } catch (err: any) {
      return { success: false, message: err.message || 'Failed.', processedCount: 0 };
    }
  }, [refreshData]);

  const addAccount = async (data: {
    clientName: string;
    platform: Platform;
    connectionType: ConnectionType;
    connectionStatus: ConnectionStatus;
    oauthAccountId?: string;
  }) => {
    const now = new Date().toISOString();
    const newAccount: Account = {
      id: generateUUID(),
      clientName: data.clientName.trim(),
      platform: data.platform,
      connectionType: data.connectionType,
      connectionStatus: data.connectionStatus,
      oauthAccountId: data.oauthAccountId,
      createdAt: now,
      updatedAt: now,
    };
    const updated = [newAccount, ...accounts];
    setAccounts(updated);

    try {
      await fetch('/api/user/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_all', payload: { accounts: updated } }),
      });
    } catch {}

    return newAccount;
  };

  const updateAccount = async (id: string, updates: Partial<Account>) => {
    const now = new Date().toISOString();
    const updated = accounts.map((acc) => (acc.id === id ? { ...acc, ...updates, updatedAt: now } : acc));
    setAccounts(updated);

    try {
      await fetch('/api/user/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_all', payload: { accounts: updated } }),
      });
    } catch {}
  };

  const deleteAccount = async (id: string) => {
    const updated = accounts.filter((acc) => acc.id !== id);
    setAccounts(updated);

    try {
      await fetch('/api/user/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_account', payload: { id } }),
      });
    } catch {}
  };

  const addPost = async (data: Omit<Post, 'id' | 'createdAt'>) => {
    const now = new Date().toISOString();
    const newPost: Post = {
      ...data,
      id: generateUUID(),
      accountId: data.accountId || accounts.find(a => a.clientName === data.clientName)?.id,
      createdAt: now,
      updatedAt: now,
    };
    const updated = [newPost, ...posts];
    setPosts(updated);

    try {
      await fetch('/api/user/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_all', payload: { posts: updated } }),
      });
    } catch {}

    return newPost;
  };

  const updatePost = async (id: string, updates: Partial<Post>) => {
    const now = new Date().toISOString();
    const updated = posts.map((p) => (p.id === id ? { ...p, ...updates, updatedAt: now } : p));
    setPosts(updated);

    try {
      await fetch('/api/user/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_all', payload: { posts: updated } }),
      });
    } catch {}
  };

  const deletePost = async (id: string) => {
    const updated = posts.filter((p) => p.id !== id);
    setPosts(updated);

    try {
      await fetch('/api/user/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_all', payload: { posts: updated } }),
      });
    } catch {}
  };

  const updatePostStatus = async (id: string, status: PostStatus, publishedAt?: string) => {
    await updatePost(id, { status, ...(publishedAt ? { publishedAt } : {}) });
  };

  const addAutoReplyRule = async (ruleData: Omit<AutoReplyRule, 'id' | 'createdAt' | 'triggerCount'>) => {
    const newRule: AutoReplyRule = {
      ...ruleData,
      id: generateUUID(),
      triggerCount: 0,
      createdAt: new Date().toISOString(),
    };
    const updated = [newRule, ...autoReplyRules];
    setAutoReplyRules(updated);

    try {
      await fetch('/api/user/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add_rule', payload: { rule: newRule } }),
      });
    } catch {}

    return newRule;
  };

  const toggleAutoReplyRule = async (id: string) => {
    const target = autoReplyRules.find(r => r.id === id);
    if (!target) return;
    const updated = autoReplyRules.map(r => r.id === id ? { ...r, isActive: !r.isActive } : r);
    setAutoReplyRules(updated);

    try {
      await fetch('/api/user/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_all', payload: { autoReplyRules: updated } }),
      });
    } catch {}
  };

  const deleteAutoReplyRule = async (id: string) => {
    const updated = autoReplyRules.filter(r => r.id !== id);
    setAutoReplyRules(updated);

    try {
      await fetch('/api/user/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_rule', payload: { id } }),
      });
    } catch {}
  };

  const incrementRuleTriggerCount = async (id: string) => {
    const updated = autoReplyRules.map(r => r.id === id ? { ...r, triggerCount: (r.triggerCount || 0) + 1 } : r);
    setAutoReplyRules(updated);

    try {
      await fetch('/api/user/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'increment_rule', payload: { id } }),
      });
    } catch {}
  };

  return (
    <AppContext.Provider
      value={{
        user,
        login,
        logout,
        accounts,
        posts,
        autoReplyRules,
        isLoaded,
        isUsingSupabase,
        addAccount,
        updateAccount,
        deleteAccount,
        addPost,
        updatePost,
        deletePost,
        updatePostStatus,
        addAutoReplyRule,
        toggleAutoReplyRule,
        deleteAutoReplyRule,
        incrementRuleTriggerCount,
        refreshData,
        triggerSchedulerWorker,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
