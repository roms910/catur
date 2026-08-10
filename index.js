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
    if (requestCount > 35) { // Sedikit dilonggarkan untuk assets
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

// ==========================================
// DIRECTORY STRUCTURE GENERATOR & ROUTING
// ==========================================
const gamesDir = path.join(__dirname, 'games');
const pagesDir = path.join(__dirname, 'pages');

if (!fs.existsSync(gamesDir)) fs.mkdirSync(gamesDir, { recursive: true });
if (!fs.existsSync(pagesDir)) fs.mkdirSync(pagesDir, { recursive: true });

// Routes utama dan game
app.get('/', (req, res) => res.sendFile(path.join(pagesDir, 'home.html')));
app.get('/ctr', (req, res) => res.sendFile(path.join(gamesDir, 'ctr.html')));
app.get('/ttt', (req, res) => res.sendFile(path.join(gamesDir, 'ttt.html')));
app.get('/dd', (req, res) => res.sendFile(path.join(gamesDir, 'dd.html')));
app.get('/ular', (req, res) => res.sendFile(path.join(gamesDir, 'ular.html')));

// Static folders
app.use('/games', express.static(gamesDir));
app.use('/pages', express.static(pagesDir));
app.use('/assets', express.static(path.join(__dirname, 'assets')));

// Error 404 & 500 Handlers
app.use((req, res, next) => {
    if (req.path === '/favicon.ico') return res.status(204).end();
    const err404 = path.join(pagesDir, '404.html');
    if (fs.existsSync(err404)) res.status(404).sendFile(err404);
    else res.status(404).json({ error: true, message: 'Endpoint not found', path: req.originalUrl });
});

app.use((err, req, res, next) => {
    console.error(chalk.red(err.stack));
    const err500 = path.join(pagesDir, '500.html');
    if (fs.existsSync(err500)) res.status(500).sendFile(err500);
    else res.status(500).json({ error: true, message: 'Internal Server Error' });
});

app.listen(PORT, () => {
    console.log(chalk.bgHex('#5EEAD4').hex('#0A0E14').bold(` Server is running on port ${PORT} `));
    console.log(chalk.cyan(`
╔══════════════════════════════════════╗
║        Plengers Game Hub - v5.0      ║
╠══════════════════════════════════════╣
║ Status: ${chalk.green('Online')}                       ║
║ Port: ${chalk.yellow(PORT)}                           ║
║ URL: ${chalk.blue('https://games.plengers.my.id')}     ║
║ Routes: /ctr, /ttt, /dd, /ular       ║
╚══════════════════════════════════════╝
    `));
});

module.exports = app;

