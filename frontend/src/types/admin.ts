export interface AdminUser {
  id: number
  email: string
  name: string
  picture: string | null
  createdAt: string
  emailVerified: boolean
  isAdmin: boolean
  googleId: string | null
  hasPassword: boolean
  gameCount: number
  playCount: number
  friendCount: number
  wishlistCount: number
}

export interface AdminUserListResponse {
  users: AdminUser[]
  total: number
  page: number
  pageSize: number
}

export interface PlatformOverview {
  totalUsers: number
  totalGames: number
  totalPlays: number
  totalFriendships: number
  totalWishlistItems: number
}

export interface GrowthDataPoint {
  date: string
  count: number
}

export interface EngagementStats {
  activeToday: number
  activeWeek: number
  activeMonth: number
  avgGamesPerUser: number
  avgPlaysPerUser: number
  authMethodBreakdown: { google: number; email: number }
}

export interface PopularGame {
  title: string
  imageUrl: string | null
  bggId: number | null
  ownerCount: number
  playCount: number
}

export interface SystemHealth {
  dbSizeBytes: number
  dbSizeMb: string
  uptime: number
  uptimeFormatted: string
  nodeVersion: string
  memoryUsage: { rss: number; heapUsed: number; heapTotal: number }
  tableCounts: Record<string, number>
}

export interface SystemConfig {
  rateLimits: { global: number; auth: number }
  features: { emailEnabled: boolean; aiChatEnabled: boolean; googleAuthEnabled: boolean }
  environment: string
}
