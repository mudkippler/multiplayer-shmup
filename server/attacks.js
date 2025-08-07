const t = (n) => Math.round(n * 100) / 100;

let bulletIdCounter = 0;

module.exports.circularAttack = function(dummy, bossBullets, angleOffset) {
    const BULLET_VELOCITY = 3;

    const angleIncrement = Math.PI * 2 / 12;
    for (let i = 0; i < 12; i++) {
        const angle = i * angleIncrement;
        bossBullets.push({
            id: bulletIdCounter++,
            x: dummy.x,
            y: dummy.y,
            dx: t(Math.cos(angle + angleOffset) * BULLET_VELOCITY),
            dy: t(Math.sin(angle + angleOffset) * BULLET_VELOCITY),
            type: 1, // 1 for circular
            size: 6
        });
    }
}

module.exports.bigRedBallAttack = function(dummy, bossBullets) {
    bossBullets.push({
        id: bulletIdCounter++,
        x: dummy.x,
        y: dummy.y,
        dx: t((Math.random() - 0.5) * 10),
        dy: t((Math.random() - 0.5) * 10),
        type: 2, // 2 for bigRedBall
        size: 20
    });
}
