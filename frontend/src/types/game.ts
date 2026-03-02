export interface Tag {
  id: number
  name: string
}

export interface Game {
  id: number
  title: string
  min_players: number | null
  max_players: number | null
  min_duration: number | null
  max_duration: number | null
  is_card_game: number
  is_cooperative: number
  plays_in_teams: number
  supports_campaign: number
  rules_url: string | null
  image_url: string | null
  play_count: number
  status: 'collection' | 'wishlist'
  tags: Tag[]
}

export interface GameDetail extends Game {
  description: string | null
  bgg_id: number | null
  mechanics: string[]
}

export interface BggSearchResult {
  bggId: number
  name: string
  yearPublished: number | null
}

export interface Play {
  id: number
  gameId: number
  userId: number
  playedAt: string
  createdAt: string
}

export interface PlayStats {
  totalPlays: number
  gamesPlayed: number
  mostPlayed: { gameId: number; title: string; imageUrl: string | null; playCount: number }[]
  recentPlays: { id: number; gameId: number; title: string; imageUrl: string | null; playedAt: string }[]
}

export interface RetailerPrice {
  price: number
  product: number
  shipping: number
  stock: string
  country: string
  link: string
  itemName: string
}

export interface GamePrice {
  gameId: number
  bggId: number | null
  title: string
  imageUrl: string | null
  lowestPrice: number | null
  manualPrice: number | null
  url: string
  prices: RetailerPrice[]
}

export interface CollectionValue {
  currency: string
  totalMinPrice: number
  games: GamePrice[]
}

export interface GameFilters {
  search: string
  players: number | null
  duration: number | null
  isCardGame: boolean | null
  isCooperative: boolean | null
  playsInTeams: boolean | null
  supportsCampaign: boolean | null
  tag: number | null
}

export function createDefaultFilters(): GameFilters {
  return {
    search: '',
    players: null,
    duration: null,
    isCardGame: null,
    isCooperative: null,
    playsInTeams: null,
    supportsCampaign: null,
    tag: null,
  }
}
