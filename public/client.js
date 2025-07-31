import { draw } from './renderer.js';
import { updateHUD } from './hud.js';
import { updateDiagnostics, addReceivedBytes, addSentBytes } from './diagnostics.js';

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
        bossBullets = data.bossBullets;
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
    draw(myId, playerList, bullets, bossBullets, dummy, fullDamageLog, damagePopups);
    updateHUD(myId, playerList);
    updateDiagnostics();
    requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);