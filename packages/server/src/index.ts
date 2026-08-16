import http from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import { ClientMessage } from '@bubble-wars/shared';
import { GameRoom } from './game/GameRoom.js';
import { handleAdminRoutes } from './routes/adminRoutes.js';
import { serveStatic } from './routes/staticServer.js';
import { sendJson } from './utils/httpUtils.js';

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';

const gameRoom = new GameRoom();

// HTTP Server
const server = http.createServer(async (req, res) => {
  const url = req.url?.split('?')[0] || '/';

  // 1. Health check endpoint
  if (url === '/health' || url === '/api/status') {
    sendJson(res, 200, { status: 'ok', game: 'Bubble Wars Server', time: Date.now() });
    return;
  }

  // 2. Admin routes & API
  if (await handleAdminRoutes(req, res, gameRoom, url)) {
    return;
  }

  // 3. Serve static client files if built
  if (serveStatic(req, res, url)) {
    return;
  }

  // 4. Default fallback
  sendJson(res, 200, { status: 'ok', name: 'Bubble Wars Server', time: Date.now() });
});

// WebSocket Server
const wss = new WebSocketServer({ server });

wss.on('connection', (ws: WebSocket) => {
  let playerId: string | null = null;

  ws.on('message', (raw: string) => {
    try {
      const msg: ClientMessage = JSON.parse(raw.toString());

      switch (msg.type) {
        case 'join': {
          const player = gameRoom.handlePlayerJoin(ws, msg.name, msg.color);
          playerId = player.id;
          console.log(`[Server] Player joined: "${player.tank.name}" (${player.id}) [Color: ${player.tank.color}]`);
          break;
        }

        case 'input': {
          if (playerId) {
            gameRoom.handlePlayerInput(playerId, msg.input);
          }
          break;
        }

        case 'respawn': {
          if (playerId) {
            gameRoom.handlePlayerRespawn(playerId);
          }
          break;
        }

        case 'rematch': {
          if (playerId) {
            gameRoom.handlePlayerRematch(playerId);
          }
          break;
        }

        case 'ping': {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(
              JSON.stringify({
                type: 'pong',
                clientTime: msg.clientTime,
                serverTime: Date.now(),
              })
            );
          }
          break;
        }
      }
    } catch (err) {
      console.error('[Server] Failed to parse message:', err);
    }
  });

  ws.on('close', () => {
    if (playerId) {
      console.log(`[Server] Player disconnected: ${playerId}`);
      gameRoom.handlePlayerDisconnect(playerId);
    }
  });

  ws.on('error', (err) => {
    console.error(`[Server] WebSocket error on player ${playerId}:`, err);
    if (playerId) {
      gameRoom.handlePlayerDisconnect(playerId);
    }
  });
});

server.listen(PORT, HOST, () => {
  console.log(`🧼 [Bubble Wars Server] Listening on http://${HOST}:${PORT} and ws://${HOST}:${PORT}`);
  console.log(`🛠️ [Admin Panel] Accessible at http://${HOST}:${PORT}/admin`);
});
