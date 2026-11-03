import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(__dirname, 'google-login-test', 'index.html');

const server = http.createServer((req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
  });
  fs.createReadStream(htmlPath).pipe(res);
});

const PORT = 5173;
server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`> Halaman uji Google Login siap di: http://localhost:${PORT}`);
  console.log(`======================================================\n`);
});

