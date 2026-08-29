import http from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import { ClientMessage } from '@bubble-wars/shared';
import { RoomManager } from './game/RoomManager.js';
import { GameRoom } from './game/GameRoom.js';
import { handleAdminRoutes } from './routes/adminRoutes.js';
import { serveStatic } from './routes/staticServer.js';
import { sendJson } from './utils/httpUtils.js';

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';

const roomManager = new RoomManager();

// HTTP Server
const server = http.createServer(async (req, res) => {
    const url = req.url?.split('?')[0] || '/';

    // 1. Health check endpoint
    if (url === '/health' || url === '/api/status') {
        sendJson(res, 200, { status: 'ok', game: 'Bubble Wars Server', time: Date.now() });
        return;
    }

    // 2. Admin routes & API
    if (await handleAdminRoutes(req, res, roomManager, url)) {
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

interface WsSession {
    room: GameRoom;
    playerId: string;
}

const wsSessions = new Map<WebSocket, WsSession>();

wss.on('connection', (ws: WebSocket) => {
    ws.on('message', (raw: string) => {
        try {
            const msg: ClientMessage = JSON.parse(raw.toString());

            switch (msg.type) {
                case 'room_join': {
                    const room = roomManager.getOrCreateDefaultRoom();

                    const player = room.handlePlayerJoin(
                        ws,
                        msg.name,
                        msg.color,
                        msg.blueprintId,
                        msg.sessionToken
                    );

                    wsSessions.set(ws, { room, playerId: player.id });
                    break;
                }

                case 'input': {
                    const session = wsSessions.get(ws);
                    if (session) {
                        session.room.handlePlayerInput(session.playerId, msg.input);
                    }
                    break;
                }

                case 'respawn': {
                    const session = wsSessions.get(ws);
                    if (session) {
                        session.room.handlePlayerRespawn(session.playerId);
                    }
                    break;
                }

                case 'rematch': {
                    const session = wsSessions.get(ws);
                    if (session) {
                        session.room.handlePlayerRematch(session.playerId);
                    }
                    break;
                }

                case 'leave': {
                    const session = wsSessions.get(ws);
                    if (session) {
                        console.log(
                            `[Server] Player left match intentionally: ${session.playerId}`
                        );
                        session.room.removePlayerCompletely(session.playerId);
                        wsSessions.delete(ws);
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
        const session = wsSessions.get(ws);
        if (session) {
            console.log(`[Server] Player disconnected: ${session.playerId}`);
            session.room.handlePlayerDisconnect(session.playerId);
            wsSessions.delete(ws);
        }
    });

    ws.on('error', (err) => {
        const session = wsSessions.get(ws);
        console.error(`[Server] WebSocket error on player ${session?.playerId}:`, err);
        if (session) {
            session.room.handlePlayerDisconnect(session.playerId);
            wsSessions.delete(ws);
        }
    });
});

server.listen(PORT, HOST, () => {
    console.log(
        `🧼 [Bubble Wars Server] Listening on http://${HOST}:${PORT} and ws://${HOST}:${PORT}`
    );
    console.log(`🛠️ [Admin Panel] Accessible at http://${HOST}:${PORT}/admin`);
});
