import type { Game } from '../types/game'

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function boolLabel(value: number): string {
  return value ? 'Yes' : 'No'
}

const HEADERS = ['Title', 'Min Players', 'Max Players', 'Min Duration (min)', 'Max Duration (min)', 'Card Game', 'Cooperative', 'Teams', 'Campaign', 'Tags', 'Plays']

function gameToRow(game: Game): string {
  const fields = [
    escapeCsvField(game.title),
    game.min_players ?? '',
    game.max_players ?? '',
    game.min_duration ?? '',
    game.max_duration ?? '',
    boolLabel(game.is_card_game),
    boolLabel(game.is_cooperative),
    boolLabel(game.plays_in_teams),
    boolLabel(game.supports_campaign),
    escapeCsvField(game.tags.map((t) => t.name).join(';')),
    game.play_count,
  ]
  return fields.join(',')
}

export function exportCsv(games: Game[], filename: string) {
  const lines = [HEADERS.join(','), ...games.map(gameToRow)]
  const csv = lines.join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
