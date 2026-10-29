export type Platform = 'Instagram' | 'Facebook' | 'Threads' | 'YouTube';

export type ConnectionStatus = 'Connected' | 'Disconnected' | 'Pending';

export type ConnectionType = 'manual' | 'mock' | 'oauth';

export type PostStatus = 'draft' | 'scheduled' | 'posted' | 'failed';

export interface AutoReplyRule {
  id: string;
  platform: 'Instagram' | 'Facebook' | 'Threads' | 'All';
  keyword: string;
  dmMessage: string;
  commentReply?: string;
  isActive: boolean;
  triggerCount: number;
  createdAt: string;
  targetPostId?: string; // Specific post/reel ID or 'all'
  targetPostTitle?: string;
  requireFollower?: boolean; // Follower-only Gate: link only sent if commenter follows
  followerOnlyLink?: string; // Direct link or resource to send
  followerDmMessage?: string; // DM sent to verified followers (with link)
  nonFollowerDmMessage?: string; // DM sent to non-followers prompting them to follow
  nonFollowerCommentReply?: string; // Public reply telling user to follow
}

export interface Client {
  id: string;
  name: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Account {
  id: string;
  clientId?: string;
  clientName: string;
  platform: Platform;
  connectionType: ConnectionType;
  connectionStatus: ConnectionStatus;
  oauthAccountId?: string;
  oauthAccessToken?: string;
  oauthTokenExpiresAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Post {
  id: string;
  clientId?: string;
  accountId?: string;
  clientName: string;
  platform: Platform;
  title: string;
  caption: string;
  description: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
  mediaName?: string;
  isScheduled: boolean;
  scheduledAt?: string;
  status: PostStatus;
  retryCount?: number;
  maxRetries?: number;
  lastError?: string;
  publishedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface AuditLog {
  id: string;
  action: string;
  entityType: 'post' | 'account' | 'client' | 'system';
  entityId?: string;
  clientName?: string;
  platform?: Platform | string;
  status: 'success' | 'failed' | 'info' | 'warning';
  details?: Record<string, any>;
  createdAt: string;
}

export interface OAuthProviderStatus {
  instagram: boolean;
  facebook: boolean;
  youtube: boolean;
}
