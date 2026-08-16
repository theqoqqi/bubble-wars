import http from 'http';
import fs from 'fs';
import path from 'path';

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

export function serveStatic(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: string
): boolean {
  if (!fs.existsSync(CLIENT_DIST)) {
    return false;
  }

  let reqPath = url;
  if (reqPath === '/') reqPath = '/index.html';

  const filePath = path.join(CLIENT_DIST, reqPath);

  // Serve static asset if found
  if (filePath.startsWith(CLIENT_DIST) && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000',
    });
    fs.createReadStream(filePath).pipe(res);
    return true;
  }

  // Fallback to index.html for SPA routing if available
  const indexPath = path.join(CLIENT_DIST, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    fs.createReadStream(indexPath).pipe(res);
    return true;
  }

  return false;
}
