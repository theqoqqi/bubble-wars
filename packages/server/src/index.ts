import http from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import { ClientMessage } from '@bubble-wars/shared';
import { GameRoom } from './game/GameRoom.js';

const PORT = parseInt(process.env.PORT || '3000', 10);

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'ok', name: 'Bubble Wars Server', time: Date.now() }));
});

const wss = new WebSocketServer({ server });
const gameRoom = new GameRoom();

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

server.listen(PORT, () => {
  console.log(`🧼 [Bubble Wars Server] Running on http://localhost:${PORT} and ws://localhost:${PORT}`);
});
