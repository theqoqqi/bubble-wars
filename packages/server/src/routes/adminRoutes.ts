import http from 'http';
import fs from 'fs';
import path from 'path';
import { GameRoom } from '../game/GameRoom.js';
import { parseJsonBody, sendHtml, sendJson } from '../utils/httpUtils.js';

function getAdminHtmlPath(): string {
  const candidates = [
    path.resolve(process.cwd(), 'packages/server/public/admin.html'),
    path.resolve(process.cwd(), 'public/admin.html'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return candidates[0];
}

let cachedAdminHtml: string | null = null;

function getAdminHtml(): string {
  if (process.env.NODE_ENV === 'production' && cachedAdminHtml) {
    return cachedAdminHtml;
  }
  const htmlPath = getAdminHtmlPath();
  if (fs.existsSync(htmlPath)) {
    const html = fs.readFileSync(htmlPath, 'utf-8');
    if (process.env.NODE_ENV === 'production') cachedAdminHtml = html;
    return html;
  }
  return '<!DOCTYPE html><html><body><h1>Bubble Wars Admin Panel</h1><p>admin.html not found</p></body></html>';
}

export async function handleAdminRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  gameRoom: GameRoom,
  url: string
): Promise<boolean> {
  // 1. Admin Panel HTML page
  if (url === '/admin' || url === '/admin.html') {
    sendHtml(res, 200, getAdminHtml());
    return true;
  }

  // 2. Admin State GET
  if (url === '/api/admin/state' && req.method === 'GET') {
    sendJson(res, 200, { status: 'ok', ...gameRoom.getAdminState() });
    return true;
  }

  // 3. Admin Config POST
  if (url === '/api/admin/config' && req.method === 'POST') {
    try {
      const data = await parseJsonBody(req);
      if (typeof data.botCount === 'number') {
        gameRoom.setBotCount(data.botCount);
      }
      if (typeof data.fragLimit === 'number') {
        gameRoom.setFragLimit(data.fragLimit);
      }
      sendJson(res, 200, { status: 'ok', ...gameRoom.getAdminState() });
    } catch {
      sendJson(res, 400, { error: 'Invalid JSON' });
    }
    return true;
  }

  // 4. Admin Reset Arena POST
  if (url === '/api/admin/reset' && req.method === 'POST') {
    gameRoom.resetArena();
    sendJson(res, 200, { status: 'ok', message: 'Arena reset' });
    return true;
  }

  // 5. Admin Kick Player POST
  if (url === '/api/admin/kick' && req.method === 'POST') {
    try {
      const data = await parseJsonBody(req);
      if (data.id) {
        const success = gameRoom.kickPlayer(data.id);
        sendJson(res, 200, { status: 'ok', success });
        return true;
      }
    } catch {
      /* ignore */
    }
    sendJson(res, 400, { error: 'Missing id' });
    return true;
  }

  return false;
}
