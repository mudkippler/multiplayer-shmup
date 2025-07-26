import { draw } from './renderer.js';

const socket = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`);

let myId = null;
let players = {};
let bullets = [];
let dummy = {};
let fullDamageLog = {};
const damagePopups = [];

socket.addEventListener('message', e => {
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
    }
});

document.addEventListener('keydown', e => {
    socket.send(JSON.stringify({ type: 'keydown', key: e.key }));
});
document.addEventListener('keyup', e => {
    socket.send(JSON.stringify({ type: 'keyup', key: e.key }));
});

function gameLoop() {
    draw(myId, Object.values(players), bullets, dummy, fullDamageLog, damagePopups);
    requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);