import { draw } from './renderer.js';
import { updateHUD } from './hud.js';
import { updateDiagnostics, addReceivedBytes, addSentBytes } from './diagnostics.js';

const INTERPOLATION_DELAY = 100; // milliseconds

const socket = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`);

let myId = null;
let players = {};
let bullets = [];
let bossBullets = [];
let dummy = {};
let fullDamageLog = {};
const damagePopups = [];

socket.addEventListener('message', e => {
    addReceivedBytes(e.data.length);
    const data = JSON.parse(e.data);
    if (data.type === 'init') {
        myId = data.id;
        dummy = data.dummy;
    } else if (data.type === 'state') {
        // Update players object, keeping color property
        const newPlayers = {};
        for (const p of data.players) {
            newPlayers[p.id] = { ...players[p.id], ...p };
        }
        players = newPlayers;

        bullets = data.bullets;
        // Store boss bullet states with timestamps for interpolation
        const now = performance.now();
        for (const newBullet of data.bossBullets) {
            let existingBullet = bossBullets.find(b => b.id === newBullet.id);
            if (!existingBullet) {
                existingBullet = { id: newBullet.id, type: newBullet.type, history: [] };
                bossBullets.push(existingBullet);
            }
            existingBullet.history.push({ x: newBullet.x, y: newBullet.y, timestamp: now });
            // Keep history clean (e.g., only last 200ms of data)
            existingBullet.history = existingBullet.history.filter(s => now - s.timestamp < 200);
        }
        // Remove bullets that are no longer in the server update
        bossBullets = bossBullets.filter(b => data.bossBullets.some(nb => nb.id === b.id)); 
    } else if (data.type === 'leaderboard') {
        fullDamageLog = data.damageLog;
    } else if (data.type === 'damage') {
        const owner = players[data.owner];
        damagePopups.push({
            x: data.x,
            y: data.y,
            amount: data.amount,
            color: data.amount > 0 ? owner?.color : 'red',
            alpha: 1,
            dy: -0.5
        });
    } else if (data.type === 'dead') {
        document.getElementById('death-screen').style.display = 'block';
    }
});

document.addEventListener('keydown', e => {
    const message = JSON.stringify({ type: 'keydown', key: e.key });
    addSentBytes(message.length);
    socket.send(message);
});
document.addEventListener('keyup', e => {
    const message = JSON.stringify({ type: 'keyup', key: e.key });
    addSentBytes(message.length);
    socket.send(message);
});

function gameLoop() {
    const playerList = Object.values(players);

    const now = performance.now();
    const interpolatedBossBullets = [];

    for (const b of bossBullets) {
        let interpolatedX = b.x;
        let interpolatedY = b.y;

        // Find the two states to interpolate between
        let stateA = null;
        let stateB = null;
        for (let i = b.history.length - 1; i >= 0; i--) {
            if (b.history[i].timestamp <= now - INTERPOLATION_DELAY) {
                stateA = b.history[i];
                if (i + 1 < b.history.length) {
                    stateB = b.history[i + 1];
                }
                break;
            }
        }

        if (stateA && stateB) {
            const t = (now - INTERPOLATION_DELAY - stateA.timestamp) / (stateB.timestamp - stateA.timestamp);
            interpolatedX = stateA.x + (stateB.x - stateA.x) * t;
            interpolatedY = stateA.y + (stateB.y - stateA.y) * t;
        } else if (stateA) {
            // Only one state, use it directly
            interpolatedX = stateA.x;
            interpolatedY = stateA.y;
        }

        interpolatedBossBullets.push({ ...b, x: interpolatedX, y: interpolatedY });
    }

    draw(myId, playerList, bullets, interpolatedBossBullets, dummy, fullDamageLog, damagePopups);
    updateHUD(myId, playerList);
    updateDiagnostics();
    requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);