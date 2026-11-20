// Serves the preview build (dist-preview/, made by scripts/build-web-preview.sh) for the browser tests.
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../../dist-preview');
const port = Number(process.env.PORT ?? 8098);
if (!existsSync(path.join(root, 'index.html'))) {
  console.error('No dist-preview/ yet: run `bash scripts/build-web-preview.sh` first.');
  process.exit(1);
}
const types = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.ttf': 'font/ttf', '.json': 'application/json', '.svg': 'image/svg+xml' };

createServer((req, res) => {
  const url = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
  let file = path.join(root, url);
  if (!file.startsWith(root)) return res.writeHead(403).end();
  if (existsSync(file) && statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!existsSync(file)) return res.writeHead(404).end();
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
}).listen(port, () => console.log(`dist-preview on http://localhost:${port}`));
