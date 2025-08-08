import { draw } from './renderer.js';
import { updateHUD } from './hud.js';
import { updateDiagnostics, addReceivedBytes, addSentBytes } from './diagnostics.js';

const INTERPOLATION_DELAY = 50; // milliseconds

const USE_MSGPACK_COMPRESSION = true; // Must match server setting

let serializer, deserializer;

if (USE_MSGPACK_COMPRESSION) {
    serializer = msgpack.serialize;
    deserializer = msgpack.deserialize;
} else {
    serializer = JSON.stringify;
    deserializer = JSON.parse;
}

const socket = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`);

let myId = null;
let players = {};
let bullets = [];
let bossBullets = [];
let dummy = {};
let fullDamageLog = {};
const damagePopups = [];

const movementKeys = {}; // Store current state of movement keys
let movementKeysInterval;

socket.addEventListener('message', async e => {
    let data;
    if (USE_MSGPACK_COMPRESSION) {
        data = deserializer(new Uint8Array(await e.data.arrayBuffer()));
        addReceivedBytes(e.data.size);
    } else {
        data = deserializer(e.data);
        addReceivedBytes(e.data.length);
    }

    if (data.type === 'init') {
        myId = data.id;
        dummy = data.dummy;
        return;
    }

    if (data.type === 'state') {
        const now = performance.now();

        // Update players object with interpolation history
        const newPlayers = {};
        for (const p of data.players) {
            const existingPlayer = players[p.id] || {};
            const newPlayer = { ...existingPlayer, ...p, history: existingPlayer.history || [] };
            
            newPlayer.history.push({ x: p.x, y: p.y, timestamp: now });
            newPlayer.history = newPlayer.history.filter(s => now - s.timestamp < 200);
            newPlayers[p.id] = newPlayer;
        }
        players = newPlayers;

        // Update player bullets with interpolation history
        for (const newBullet of data.bullets) {
            let existingBullet = bullets.find(b => b.id === newBullet.id);
            if (!existingBullet) {
                existingBullet = { ...newBullet, history: [] };
                bullets.push(existingBullet);
            } else {
                Object.assign(existingBullet, newBullet);
            }
            existingBullet.history.push({ x: newBullet.x, y: newBullet.y, timestamp: now });
            existingBullet.history = existingBullet.history.filter(s => now - s.timestamp < 200);
        }
        bullets = bullets.filter(b => data.bullets.some(nb => nb.id === b.id));

        // Store boss bullet states with timestamps for interpolation
        for (const newBullet of data.bossBullets) {
            let existingBullet = bossBullets.find(b => b.id === newBullet.id);
            if (!existingBullet) {
                existingBullet = { ...newBullet, history: [] };
                bossBullets.push(existingBullet);
            } else {
                Object.assign(existingBullet, newBullet);
            }
            existingBullet.history.push({ x: newBullet.x, y: newBullet.y, timestamp: now });
            // Keep history clean (e.g., only last 200ms of data)
            existingBullet.history = existingBullet.history.filter(s => now - s.timestamp < 200);
        }
        // Remove bullets that are no longer in the server update
        bossBullets = bossBullets.filter(b => data.bossBullets.some(nb => nb.id === b.id));
        return;
    }

    if (data.type === 'leaderboard') {
        fullDamageLog = data.damageLog;
        return;
    }

    if (data.type === 'damage') {
        const owner = players[data.owner];
        damagePopups.push({
            x: data.x,
            y: data.y,
            amount: data.amount,
            color: data.amount > 0 ? owner?.color : 'red',
            alpha: 1,
            dy: -0.5
        });
        return;
    }

    if (data.type === 'dead') {
        document.getElementById('death-screen').style.display = 'block';
        return;
    }
});

document.addEventListener('keydown', e => {
    const movementKeysMap = {
        'w': 'ArrowUp', 'a': 'ArrowLeft', 's': 'ArrowDown', 'd': 'ArrowRight',
        'ArrowUp': 'ArrowUp', 'ArrowLeft': 'ArrowLeft', 'ArrowDown': 'ArrowDown', 'ArrowRight': 'ArrowRight'
    };

    if (movementKeysMap[e.key]) {
        movementKeys[movementKeysMap[e.key]] = true;
    } else if (e.key === ' ' || e.key === 'Space') {
        const message = serializer({ type: 'keydown', key: e.key });
        socket.send(message);
        addSentBytes(message.length);
    }
});

document.addEventListener('keyup', e => {
    const movementKeysMap = {
        'w': 'ArrowUp', 'a': 'ArrowLeft', 's': 'ArrowDown', 'd': 'ArrowRight',
        'ArrowUp': 'ArrowUp', 'ArrowLeft': 'ArrowLeft', 'ArrowDown': 'ArrowDown', 'ArrowRight': 'ArrowRight'
    };

    if (movementKeysMap[e.key]) {
        movementKeys[movementKeysMap[e.key]] = false;
    } else if (e.key === ' ' || e.key === 'Space') {
        const message = serializer({ type: 'keyup', key: e.key });
        socket.send(USE_MSGPACK_COMPRESSION ? message.buffer : message);
        addSentBytes(USE_MSGPACK_COMPRESSION ? message.byteLength : message.length);
    }
});

// Send movement keys state to server every 100ms (or server tick rate)
movementKeysInterval = setInterval(() => {
    const message = serializer({ type: 'movementUpdate', keys: movementKeys });
    socket.send(USE_MSGPACK_COMPRESSION ? message.buffer : message);
    addSentBytes(USE_MSGPACK_COMPRESSION ? message.byteLength : message.length);
}, 100); // Assuming a 100ms tick rate for movement updates

function getInterpolatedPosition(entity, now) {
    let interpolatedX = entity.x;
    let interpolatedY = entity.y;

    if (!entity.history || entity.history.length < 2) {
        return { x: interpolatedX, y: interpolatedY };
    }

    // Find the two states to interpolate between
    let stateA = null;
    let stateB = null;
    for (let i = entity.history.length - 1; i >= 0; i--) {
        if (entity.history[i].timestamp <= now - INTERPOLATION_DELAY) {
            stateA = entity.history[i];
            if (i + 1 < entity.history.length) {
                stateB = entity.history[i + 1];
            }
            break;
        }
    }

    if (stateA && stateB) {
        const t = (now - INTERPOLATION_DELAY - stateA.timestamp) / (stateB.timestamp - stateA.timestamp);
        interpolatedX = stateA.x + (stateB.x - stateA.x) * t;
        interpolatedY = stateA.y + (stateB.y - stateA.y) * t;
    } else if (stateA) {
        // Not enough history to interpolate, use the most recent valid state
        interpolatedX = stateA.x;
        interpolatedY = stateA.y;
    }

    return { x: interpolatedX, y: interpolatedY };
}

function gameLoop() {
    const now = performance.now();

    const interpolatedPlayers = Object.values(players).map(p => {
        const { x, y } = getInterpolatedPosition(p, now);
        return { ...p, x, y };
    });

    const interpolatedBullets = bullets.map(b => {
        const { x, y } = getInterpolatedPosition(b, now);
        return { ...b, x, y };
    });

    const interpolatedBossBullets = bossBullets.map(b => {
        const { x, y } = getInterpolatedPosition(b, now);
        return { ...b, x, y };
    });

    draw(myId, interpolatedPlayers, interpolatedBullets, interpolatedBossBullets, dummy, fullDamageLog, damagePopups);
    updateHUD(myId, Object.values(players));
    updateDiagnostics();
    requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);