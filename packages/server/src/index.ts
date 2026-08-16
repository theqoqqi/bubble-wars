import http from 'http';
import fs from 'fs';
import path from 'path';
import { WebSocket, WebSocketServer } from 'ws';
import { ClientMessage } from '@bubble-wars/shared';
import { GameRoom } from './game/GameRoom.js';

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';

// Optional static web server for client bundle (useful on VPS)
const CLIENT_DIST = fs.existsSync(path.resolve(process.cwd(), 'packages/client/dist'))
  ? path.resolve(process.cwd(), 'packages/client/dist')
  : path.resolve(process.cwd(), 'client/dist');

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

const server = http.createServer((req, res) => {
  // 1. Health check endpoint
  if (req.url === '/health' || req.url === '/api/status') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ status: 'ok', game: 'Bubble Wars Server', time: Date.now() }));
    return;
  }

  // 2. Serve static client files if built
  if (fs.existsSync(CLIENT_DIST)) {
    let reqPath = req.url?.split('?')[0] || '/';
    if (reqPath === '/') reqPath = '/index.html';

    const filePath = path.join(CLIENT_DIST, reqPath);

    // Prevent directory traversal
    if (filePath.startsWith(CLIENT_DIST) && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000',
      });
      fs.createReadStream(filePath).pipe(res);
      return;
    }

    // SPA fallback to index.html
    const indexPath = path.join(CLIENT_DIST, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      fs.createReadStream(indexPath).pipe(res);
      return;
    }
  }

  // 3. Default fallback if client dist is not present
  res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
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

server.listen(PORT, HOST, () => {
  console.log(`🧼 [Bubble Wars Server] Listening on http://${HOST}:${PORT} and ws://${HOST}:${PORT}`);
});
