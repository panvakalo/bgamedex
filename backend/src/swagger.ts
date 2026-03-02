import type { JsonObject } from 'swagger-ui-express'

export const swaggerDocument: JsonObject = {
  openapi: '3.0.3',
  info: {
    title: 'Bgamedex API',
    description: 'API for browsing and filtering a personal board game collection.',
    version: '1.0.0',
  },
  servers: [
    { url: '/', description: 'Current host' },
  ],
  paths: {
    '/api/health': {
      get: {
        summary: 'Health check',
        tags: ['System'],
        responses: {
          '200': {
            description: 'Server is running',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'ok' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/games': {
      get: {
        summary: 'List games',
        description: 'Returns all games matching the given filters, ordered by title. All query parameters are optional — omitting them returns the full collection.',
        tags: ['Games'],
        parameters: [
          {
            name: 'search',
            in: 'query',
            description: 'Case-insensitive substring match on game title',
            schema: { type: 'string' },
            example: 'catan',
          },
          {
            name: 'players',
            in: 'query',
            description: 'Number of players. Filters games where `minPlayers <= players <= maxPlayers`.',
            schema: { type: 'integer', minimum: 1 },
            example: 4,
          },
          {
            name: 'duration',
            in: 'query',
            description: 'Available time in minutes. Filters games where `minDuration <= duration`.',
            schema: { type: 'integer', minimum: 1 },
            example: 60,
          },
          {
            name: 'isCardGame',
            in: 'query',
            description: 'Filter by card game (`true` = only card games, `false` = exclude card games)',
            schema: { type: 'boolean' },
          },
          {
            name: 'isCooperative',
            in: 'query',
            description: 'Filter by cooperative play',
            schema: { type: 'boolean' },
          },
          {
            name: 'playsInTeams',
            in: 'query',
            description: 'Filter by team-based play',
            schema: { type: 'boolean' },
          },
          {
            name: 'supportsCampaign',
            in: 'query',
            description: 'Filter by campaign support',
            schema: { type: 'boolean' },
          },
        ],
        responses: {
          '200': {
            description: 'Array of games matching the filters',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/GameSummary' },
                },
              },
            },
          },
        },
      },
    },
    '/api/games/{id}/chat': {
      post: {
        summary: 'Chat about game rules',
        description: 'Send a conversation to get AI-powered answers about a game\'s rules. The response is streamed via SSE with events: `text` (content chunk), `done` (stream complete), `error` (failure). The game must have a `rules_url` set.',
        tags: ['Games'],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'Game ID',
            schema: { type: 'integer' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['messages'],
                properties: {
                  messages: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['role', 'content'],
                      properties: {
                        role: { type: 'string', enum: ['user', 'assistant'] },
                        content: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'SSE stream of chat response chunks',
            content: {
              'text/event-stream': {
                schema: { type: 'string' },
              },
            },
          },
          '400': {
            description: 'Invalid request or no rules PDF available',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    error: { type: 'string' },
                  },
                },
              },
            },
          },
          '404': {
            description: 'Game not found',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    error: { type: 'string', example: 'Game not found' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/games/{id}': {
      get: {
        summary: 'Get game by ID',
        description: 'Returns a single game with full details including description and mechanics.',
        tags: ['Games'],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'Game ID',
            schema: { type: 'integer' },
          },
        ],
        responses: {
          '200': {
            description: 'Game found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/GameDetail' },
              },
            },
          },
          '404': {
            description: 'Game not found',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    error: { type: 'string', example: 'Game not found' },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      GameSummary: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          title: { type: 'string', example: 'Catan' },
          min_players: { type: 'integer', nullable: true, example: 3 },
          max_players: { type: 'integer', nullable: true, example: 4 },
          min_duration: { type: 'integer', nullable: true, description: 'Minutes', example: 60 },
          max_duration: { type: 'integer', nullable: true, description: 'Minutes', example: 120 },
          is_card_game: { type: 'integer', enum: [0, 1], example: 0 },
          is_cooperative: { type: 'integer', enum: [0, 1], example: 0 },
          plays_in_teams: { type: 'integer', enum: [0, 1], example: 0 },
          supports_campaign: { type: 'integer', enum: [0, 1], example: 0 },
          rules_url: { type: 'string', nullable: true, example: 'https://example.com/rules.pdf' },
          image_url: { type: 'string', nullable: true, example: 'https://cf.geekdo-images.com/...' },
        },
      },
      GameDetail: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          title: { type: 'string', example: 'Catan' },
          min_players: { type: 'integer', nullable: true, example: 3 },
          max_players: { type: 'integer', nullable: true, example: 4 },
          min_duration: { type: 'integer', nullable: true, description: 'Minutes', example: 60 },
          max_duration: { type: 'integer', nullable: true, description: 'Minutes', example: 120 },
          is_card_game: { type: 'integer', enum: [0, 1], example: 0 },
          is_cooperative: { type: 'integer', enum: [0, 1], example: 0 },
          plays_in_teams: { type: 'integer', enum: [0, 1], example: 0 },
          supports_campaign: { type: 'integer', enum: [0, 1], example: 0 },
          rules_url: { type: 'string', nullable: true, example: 'https://example.com/rules.pdf' },
          image_url: { type: 'string', nullable: true, example: 'https://cf.geekdo-images.com/...' },
          description: { type: 'string', nullable: true, example: 'In Catan, players try to be the dominant force...' },
          bgg_id: { type: 'integer', nullable: true, example: 13 },
          mechanics: {
            type: 'array',
            items: { type: 'string' },
            example: ['Dice Rolling', 'Hand Management', 'Trading'],
          },
        },
      },
    },
  },
}
