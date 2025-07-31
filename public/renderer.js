const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

export function draw(myId, players, bullets, bossBullets, dummy, fullDamageLog, damagePopups) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Dummy
    ctx.fillStyle = 'gray';
    ctx.beginPath();
    ctx.arc(dummy.x, dummy.y, dummy.radius, 0, Math.PI * 2);
    ctx.fill();

    // Players
    for (const p of players) {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
        ctx.fill();

        // Health bar
        const healthPercentage = p.health / 100;
        const hue = healthPercentage * 120;
        ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
        ctx.fillRect(p.x - 15, p.y - 20, 30 * healthPercentage, 5);
        ctx.strokeStyle = 'black';
        ctx.strokeRect(p.x - 15, p.y - 20, 30, 5);
    }

    // Bullets
    for (const b of bullets) {
        const owner = players.find(p => p.id === b.owner);
        ctx.fillStyle = owner?.color || 'white';
        ctx.beginPath();
        ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
        ctx.fill();
    }

    // Boss Bullets
    for (const b of bossBullets) {
        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2);
        ctx.fill();
    }

    // Damage Popups
    for (let i = damagePopups.length - 1; i >= 0; i--) {
        const d = damagePopups[i];
        ctx.globalAlpha = d.alpha;
        ctx.font = '24px impact';
        ctx.fillStyle = d.color; // shadow color
        ctx.shadowColor = 'black';
        ctx.shadowBlur = 1;
        ctx.fillText(d.amount, d.x, d.y);
        ctx.fillStyle = 'white'; // main dmg number color
        ctx.fillText(d.amount, d.x - 2, d.y - 2);
        ctx.shadowBlur = 0;
        d.y += d.dy * 2;
        d.alpha -= 0.01;
        if (d.alpha <= 0) damagePopups.splice(i, 1);
    }
    ctx.globalAlpha = 1; // Reset alpha

    // Leaderboard
    ctx.font = '2rem calibri ';
    ctx.textAlign = 'left';
    ctx.fillStyle = 'white';
    ctx.fillText('Damage Leaderboard', 10, 35);

    let rankY = 65;
    for (const [id, dmg] of Object.entries(fullDamageLog).sort((a, b) => b[1] - a[1])) {
        const player = players.find(p => p.id === id);
        const color = player?.color || 'white';
        ctx.fillStyle = color;
        ctx.fillText(`${Math.floor(dmg)} dmg`, 10, rankY);
        rankY += 25;
    }

    // Draw self indicator (bottom center)
    const me = players.find(p => p.id === myId);
    if (me) {
        ctx.font = '16px impact';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = 'white';
        ctx.fillText('You are', canvas.width / 2, canvas.height - 15);

        // Draw a circle in your color
        ctx.beginPath();
        ctx.arc(canvas.width / 2 + 40, canvas.height - 25, 8, 0, Math.PI * 2);
        ctx.fillStyle = me.color;
        ctx.fill();
    }
}