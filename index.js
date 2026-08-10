const express = require('express');
const chalk = require('chalk');
const fs = require('fs');
const cors = require('cors');
const path = require('path');

try { require("./function.js"); } catch(e) {}

const app = express();
const PORT = process.env.PORT || 8080;

function logRequest({ method, status, url, duration, error = null }) {
    let colorFunc;
    if (status >= 500) colorFunc = chalk.red;
    else if (status >= 400) colorFunc = chalk.yellow;
    else if (status === 304) colorFunc = chalk.blue;
    else colorFunc = chalk.green;

    let line = colorFunc(`[${method}] ${status} ${url} - ${duration}ms`);
    if (error) line += chalk.red(`\n[ERROR] ${error.message || error}`);
    console.log(line);
}

let requestCount = 0;
let isCooldown = false;
setInterval(() => { requestCount = 0; }, 1000);

app.use((req, res, next) => {
    if (isCooldown) {
        logRequest({ method: req.method, status: 503, url: req.originalUrl, duration: 0, error: 'Server is in cooldown' });
        return res.status(503).json({ error: 'Server is in cooldown, try again later.' });
    }
    requestCount++;
    if (requestCount > 25) {
        isCooldown = true;
        setTimeout(() => { isCooldown = false; }, 10000);
        return res.status(503).json({ error: 'Too many requests, server cooldown!' });
    }
    next();
});

app.enable("trust proxy");
app.set("json spaces", 2);
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors());

app.get('/favicon.ico', (req, res) => res.status(204).end());
app.get('/favicon.png', (req, res) => res.status(204).end());

try {
    const settingsPath = path.join(__dirname, './assets/settings.json');
    if(fs.existsSync(settingsPath)) {
        const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
        global.apikey = settings.apiSettings.apikey;
    }
} catch(e) {}

app.use((req, res, next) => {
    if (req.path === '/favicon.ico' || req.path === '/favicon.png') return next();
    const start = Date.now();
    const originalJson = res.json;

    res.json = function (data) {
        if (data && typeof data === 'object') {
            const responseData = { status: data.status, creator: "Romzz", ...data };
            return originalJson.call(this, responseData);
        }
        return originalJson.call(this, data);
    };

    res.on('finish', () => {
        logRequest({ method: req.method, status: res.statusCode, url: req.originalUrl, duration: Date.now() - start });
    });
    next();
});

// ==========================================
// DIRECTORY STRUCTURE GENERATOR & ROUTING
// ==========================================
const gamesDir = path.join(__dirname, 'games');
const pagesDir = path.join(__dirname, 'pages');

if (!fs.existsSync(gamesDir)) fs.mkdirSync(gamesDir, { recursive: true });
if (!fs.existsSync(pagesDir)) fs.mkdirSync(pagesDir, { recursive: true });

// Auto-create default home.html jika belum ada
const homePath = path.join(pagesDir, 'home.html');
if (!fs.existsSync(homePath)) {
    const defaultHome = `<!DOCTYPE html>
<html lang="id" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Plengers Games Hub</title>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700;800&family=Inter:wght@400;600;800&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { background-color: #030712; color: #e5e7eb; font-family: 'Inter', sans-serif; }
    .glass { background: rgba(17, 24, 39, 0.7); backdrop-filter: blur(12px); border: 1px solid rgba(0, 240, 255, 0.2); }
    .btn-glow:hover { box-shadow: 0 0 25px rgba(0, 240, 255, 0.5); border-color: #00F0FF; }
  </style>
</head>
<body class="min-h-screen flex flex-col items-center justify-center p-6">
  <div class="text-center mb-12">
    <h1 class="font-mono text-4xl md:text-6xl font-extrabold mb-3">PLENGERS <span class="text-cyan-400">GAMES HUB</span></h1>
    <p class="text-gray-400 font-mono text-sm">Pilih sistem simulasi permainan taktis yang ingin diinisialisasi.</p>
  </div>
  <div class="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl w-full">
    <a href="/ctr" class="glass p-6 rounded-2xl text-center btn-glow transition-all group">
      <div class="text-5xl mb-4 group-hover:scale-110 transition-transform">♟️</div>
      <h2 class="text-2xl font-bold font-mono mb-2 text-cyan-400">CATUR</h2>
      <p class="text-xs text-gray-400 font-mono">Cyber Chess Tactics & Multi-Skin.</p>
    </a>
    <a href="/ttt" class="glass p-6 rounded-2xl text-center btn-glow transition-all group">
      <div class="text-5xl mb-4 group-hover:scale-110 transition-transform">❌</div>
      <h2 class="text-2xl font-bold font-mono mb-2 text-purple-400">TIC TAC TOE</h2>
      <p class="text-xs text-gray-400 font-mono">Minimax AI & Moving Pieces.</p>
    </a>
    <a href="/dd" class="glass p-6 rounded-2xl text-center btn-glow transition-all group">
      <div class="text-5xl mb-4 group-hover:scale-110 transition-transform">🎯</div>
      <h2 class="text-2xl font-bold font-mono mb-2 text-green-400">DAM-DAMAN</h2>
      <p class="text-xs text-gray-400 font-mono">Checkers with Multi-Jump Combo.</p>
    </a>
  </div>
</body>
</html>`;
    fs.writeFileSync(homePath, defaultHome);
}

// Routes utama dan game
app.get('/', (req, res) => res.sendFile(homePath));
app.get('/ctr', (req, res) => res.sendFile(path.join(gamesDir, 'ctr.html')));
app.get('/ttt', (req, res) => res.sendFile(path.join(gamesDir, 'ttt.html')));
app.get('/dd', (req, res) => res.sendFile(path.join(gamesDir, 'dd.html')));

// Static folders
app.use('/games', express.static(gamesDir));
app.use('/pages', express.static(pagesDir));
app.use('/assets', express.static(path.join(__dirname, 'assets')));

// Error 404 & 500 Handlers
app.use((req, res, next) => {
    if (req.path === '/favicon.ico' || req.path === '/favicon.png') return res.status(204).end();
    
    const err404 = path.join(pagesDir, '404.html');
    if (fs.existsSync(err404)) {
        res.status(404).sendFile(err404);
    } else {
        res.status(404).json({ error: true, message: 'Endpoint not found', path: req.originalUrl });
    }
});

app.use((err, req, res, next) => {
    console.error(chalk.red(err.stack));
    
    const err500 = path.join(pagesDir, '500.html');
    if (fs.existsSync(err500)) {
        res.status(500).sendFile(err500);
    } else {
        res.status(500).json({ error: true, message: 'Internal Server Error' });
    }
});

app.listen(PORT, () => {
    console.log(chalk.bgHex('#90EE90').hex('#333').bold(` Server is running on port ${PORT} `));
    console.log(chalk.cyan(`
╔══════════════════════════════════════╗
║        Plengers Game Hub - v4.0      ║
╠══════════════════════════════════════╣
║ Status: ${chalk.green('Online')}                       ║
║ Port: ${chalk.yellow(PORT)}                           ║
║ URL: ${chalk.blue('https://games.plengers.my.id')}     ║
║ Routes: /ctr, /ttt, /dd              ║
╚══════════════════════════════════════╝
    `));
});

module.exports = app;

