const t = (n) => Math.round(n * 100) / 100;

export function circularAttack(dummy, bossBullets, angleOffset) {
    const BULLET_VELOCITY = 1;

    const angleIncrement = Math.PI * 2 / 12;
    for (let i = 0; i < 12; i++) {
        const angle = i * angleIncrement;
        bossBullets.push({
            x: dummy.x,
            y: dummy.y,
            dx: t(Math.cos(angle + angleOffset) * BULLET_VELOCITY),
            dy: t(Math.sin(angle + angleOffset) * BULLET_VELOCITY),
            color: 'cyan',
            size: 6
        });
    }
}

export function bigRedBallAttack(dummy, bossBullets) {
    bossBullets.push({
        x: dummy.x,
        y: dummy.y,
        dx: t((Math.random() - 0.5) * 10),
        dy: t((Math.random() - 0.5) * 10),
        color: 'red',
        size: 20
    });
}
