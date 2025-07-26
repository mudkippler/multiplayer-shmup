const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static(path.join(__dirname, 'public')));

const TICK_RATE = 60;
const BULLET_SPEED = 5;
const players = {};
const bullets = [];
const dummy = { x: 400, y: 300, radius: 30, health: Infinity };
const damageLog = {}; // id -> total damage

wss.on('connection', (ws) => {
  const id = uuidv4();
  players[id] = {
    x: Math.random() * 800,
    y: Math.random() * 600,
    vx: 0,
    vy: 0,
    color: `hsl(${Math.random() * 360}, 100%, 50%)`,
    keys: {},
    lastShot: 0
  };
  damageLog[id] = 0;
  ws.id = id;

  ws.send(JSON.stringify({ type: 'init', id, color: players[id].color }));

  ws.on('message', (msg) => {
    try {
      const data = JSON.parse(msg);
      if (data.type === 'keydown' || data.type === 'keyup') {
        players[id].keys[data.key] = data.type === 'keydown';
      }
    } catch (e) {}
  });

  ws.on('close', () => {
    delete players[ws.id];
    delete damageLog[ws.id];
  });
});

function gameLoop() {
  const now = Date.now();

  // Update players
  for (const id in players) {
    const p = players[id];
    p.vx = 0;
    p.vy = 0;
    if (p.keys['ArrowUp'] || p.keys['w']) p.vy -= 1;
    if (p.keys['ArrowDown'] || p.keys['s']) p.vy += 1;
    if (p.keys['ArrowLeft'] || p.keys['a']) p.vx -= 1;
    if (p.keys['ArrowRight'] || p.keys['d']) p.vx += 1;

    const len = Math.hypot(p.vx, p.vy);
    if (len > 0) {
      p.vx /= len;
      p.vy /= len;
    }

    const speed = 3.5;
    p.x += p.vx * speed;
    p.y += p.vy * speed;

    // Shoot bullets
    if ((p.keys[' '] || p.keys['Space']) && now - p.lastShot > 300) {
      p.lastShot = now;
      bullets.push({
        x: p.x,
        y: p.y,
        dx: p.vx * BULLET_SPEED || 0,
        dy: p.vy * BULLET_SPEED || -BULLET_SPEED, // shoot up if standing still
        color: p.color,
        owner: id
      });
    }
  }

  // Update bullets
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += b.dx;
    b.y += b.dy;

    // Check collision with dummy
    const dist = Math.hypot(b.x - dummy.x, b.y - dummy.y);
    if (dist < dummy.radius) {
      damageLog[b.owner] = (damageLog[b.owner] || 0) + 10;
      wss.clients.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'damage',
            x: b.x,
            y: b.y,
            amount: 10,
            color: b.color,
            owner: b.owner
          }));
        }
      });
      bullets.splice(i, 1);
    } else if (b.x < 0 || b.x > 800 || b.y < 0 || b.y > 600) {
      bullets.splice(i, 1); // remove offscreen bullets
    }
  }

  // Send game state
  const state = {
    type: 'state',
    players: Object.entries(players).map(([id, p]) => ({
        ...p,
        id
    })),
    bullets,
    dummy,
    damageLog
  };

  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(state));
    }
  }
}

setInterval(gameLoop, 1000 / TICK_RATE);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
