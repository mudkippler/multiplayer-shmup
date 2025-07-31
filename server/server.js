const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const { circularAttack, bigRedBallAttack } = require('./attacks.js');
const { generateShortId } = require('./utils.js');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static(path.join(__dirname, '../public')));

const t = (n) => Math.round(n * 100) / 100;



const TICK_RATE = 60;
const BULLET_SPEED = 5;
const PLAYER_SPEED = 5;
const BOSS_ATTACK_RATE = 250; //delay in ms between the boss attacks
const players = {};
const bullets = [];
const bossBullets = [];
const dummy = { x: 400, y: 100, radius: 30, health: Infinity };
const damageLog = {}; // id -> total damage
let lastBossAttack = 0;
let angleOffset = 0;

wss.on('connection', (ws) => {
  const id = generateShortId();
  players[id] = {
    x: Math.random() * 800,
    y: Math.random() * 600,
    vx: 0,
    vy: 0,
    color: `hsl(${t(Math.random() * 360)}, 100%, 50%)`,
    keys: {},
    lastShot: 0,
    lastActive: Date.now(),
    health: 100
  };
  damageLog[id] = 0;
  ws.id = id;

  ws.send(JSON.stringify({ type: 'init', id, dummy: {...dummy, x: t(dummy.x), y: t(dummy.y)} }));

  ws.on('message', (msg) => {
    try {
      const data = JSON.parse(msg);
      if (data.type === 'keydown' || data.type === 'keyup') {
        players[id].keys[data.key] = data.type === 'keydown';
        players[id].lastActive = Date.now();
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


  // Despawn players inactive for 60 seconds
  for (const id in players) {
    if (now - players[id].lastActive > 60000) {
      console.log(`Despawning inactive player: ${id}`);
      delete players[id];
      delete damageLog[id];
    }
  }

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

    p.x += p.vx * PLAYER_SPEED;
    p.y += p.vy * PLAYER_SPEED;

    // Clamp player position to screen bounds
    p.x = Math.max(0, Math.min(800, p.x));
    p.y = Math.max(0, Math.min(600, p.y));

    // Shoot bullets
    if ((p.keys[' '] || p.keys['Space']) && now - p.lastShot > 200) {
      p.lastShot = now;
      bullets.push({
        x: p.x,
        y: p.y,
        dx: 0,
        dy: -BULLET_SPEED,
        owner: id
      });
    }
  }

  // Boss attacks
  if (now - lastBossAttack > BOSS_ATTACK_RATE) {
    lastBossAttack = now;
    circularAttack(dummy, bossBullets, angleOffset);
    angleOffset += 0.1;

    if (Math.random() < 0.1) {
        bigRedBallAttack(dummy, bossBullets);
    }
  }

  // Update bullets
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += b.dx;
    b.y += b.dy;

    let hit = false;
    // Player collision
    for (const id in players) {
      if (id === b.owner) continue;
      const p = players[id];
      const dist = Math.hypot(b.x - p.x, b.y - p.y);
      if (dist < 10) { // Player radius
        p.health -= 10;
        damageLog[b.owner] = (damageLog[b.owner] || 0) - 10;

        if (p.health <= 0) {
            for (const client of wss.clients) {
                if (client.id === id) {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify({ type: 'dead' }));
                    }
                    client.terminate(); // Triggers 'close' event which handles cleanup
                    break;
                }
            }
        }

        wss.clients.forEach(ws => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'damage',
              x: t(b.x),
              y: t(b.y),
              amount: -10,
              owner: b.owner
            }));
          }
        });
        bullets.splice(i, 1);
        hit = true;
        break;
      }
    }

    if (hit) continue;

    // Check collision with dummy
    const dist = Math.hypot(b.x - dummy.x, b.y - dummy.y);
    if (dist < dummy.radius) {
      damageLog[b.owner] = (damageLog[b.owner] || 0) + 10;
      wss.clients.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'damage',
            x: t(b.x),
            y: t(b.y),
            amount: 10,
            owner: b.owner
          }));
        }
      });
      bullets.splice(i, 1);
    } else if (b.x < 0 || b.x > 800 || b.y < 0 || b.y > 600) {
      bullets.splice(i, 1); // remove offscreen bullets
    }
  }

  // Update boss bullets
  for (let i = bossBullets.length - 1; i >= 0; i--) {
    const b = bossBullets[i];
    b.x += b.dx;
    b.y += b.dy;

    for (const id in players) {
        const p = players[id];
        const dist = Math.hypot(b.x - p.x, b.y - p.y);
        if (dist < b.size) { // Player radius
            p.health -= 10;
            if (p.health <= 0) {
                for (const client of wss.clients) {
                    if (client.id === id) {
                        if (client.readyState === WebSocket.OPEN) {
                            client.send(JSON.stringify({ type: 'dead' }));
                        }
                        client.terminate();
                        break;
                    }
                }
            }
            bossBullets.splice(i, 1);
            break;
        }
    }

    if (b.x < 0 || b.x > 800 || b.y < 0 || b.y > 600) {
        bossBullets.splice(i, 1);
    }
  }

  // Send game state
  const state = {
    type: 'state',
    players: Object.entries(players).map(([id, p]) => ({
        id,
        x: t(p.x),
        y: t(p.y),
        color: p.color,
        health: p.health
    })),
    bullets: bullets.map(b => ({ x: t(b.x), y: t(b.y), owner: b.owner })),
    bossBullets: bossBullets.map(b => ({...b, id: b.id, x: t(b.x), y: t(b.y), dx: t(b.dx), dy: t(b.dy)}))
  };

  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(state));
    }
  }
}

setInterval(gameLoop, 1000 / TICK_RATE);

// Send leaderboard updates less frequently
setInterval(() => {
    const leaderboard = {
        type: 'leaderboard',
        damageLog
    };
    for (const client of wss.clients) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(leaderboard));
        }
    }
}, 1000);


const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
