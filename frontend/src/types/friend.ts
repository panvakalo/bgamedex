export interface FriendUser {
  id: number
  name: string
  picture: string | null
}

export interface Friend {
  friendshipId: number
  userId: number
  name: string
  picture: string | null
}

export interface FriendRequest {
  id: number
  requesterId: number
  name: string
  picture: string | null
  createdAt: string
}

export type FriendshipStatus = 'none' | 'pending_sent' | 'pending_received' | 'accepted'

export interface UserSearchResult extends FriendUser {
  friendshipStatus: FriendshipStatus
}
