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
                case 'room_list': {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(
                            JSON.stringify({
                                type: 'room_list',
                                rooms: roomManager.getPublicRoomInfos(),
                            })
                        );
                    }
                    break;
                }

                case 'room_create': {
                    const cleanName = (msg.name || 'Мыльная Арена').trim().slice(0, 32);
                    const room = roomManager.createRoom(undefined, {
                        name: cleanName,
                        maxPlayers: msg.maxPlayers,
                        botCount: msg.botCount,
                        fragLimit: msg.fragLimit,
                        breakSeconds: msg.breakSeconds,
                        breakReadyCheck: msg.breakReadyCheck,
                    });

                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(
                            JSON.stringify({
                                type: 'room_created',
                                roomId: room.roomId,
                                roomName: room.roomName,
                            })
                        );
                    }
                    break;
                }

                case 'room_join': {
                    const room = roomManager.getRoom(msg.roomId);

                    if (!room) {
                        if (ws.readyState === WebSocket.OPEN) {
                            ws.send(
                                JSON.stringify({
                                    type: 'error',
                                    code: 'room_not_found',
                                    message: 'Комната не найдена или была закрыта',
                                })
                            );
                        }
                        break;
                    }

                    const isFull = room.getActivePlayerCount() >= room.maxPlayers;
                    const isReconnecting = !!msg.sessionToken && room.hasPlayerToken(msg.sessionToken);

                    if (isFull && !isReconnecting) {
                        if (ws.readyState === WebSocket.OPEN) {
                            ws.send(
                                JSON.stringify({
                                    type: 'error',
                                    code: 'room_full',
                                    message: 'В выбранной комнате достигнут лимит игроков',
                                })
                            );
                        }
                        break;
                    }

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
                    if (session && msg.input) {
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

                case 'ready': {
                    const session = wsSessions.get(ws);
                    if (session) {
                        session.room.setPlayerReady(session.playerId, !!msg.isReady);
                    }
                    break;
                }

                case 'room_config_update': {
                    const session = wsSessions.get(ws);
                    if (session) {
                        session.room.updateConfigByHost(session.playerId, {
                            name: msg.name,
                            maxPlayers: msg.maxPlayers,
                            botCount: msg.botCount,
                            fragLimit: msg.fragLimit,
                            breakSeconds: msg.breakSeconds,
                            breakReadyCheck: msg.breakReadyCheck,
                        });
                    }
                    break;
                }

                case 'room_config_editing': {
                    const session = wsSessions.get(ws);
                    if (session) {
                        session.room.setConfigEditing(session.playerId, !!msg.isEditing);
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
