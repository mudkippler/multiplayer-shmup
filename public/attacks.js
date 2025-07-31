const t = (n) => Math.round(n * 100) / 100;

export function circularAttack(dummy, bossBullets, angleOffset) {
    const angleIncrement = Math.PI * 2 / 12;
    for (let i = 0; i < 12; i++) {
        const angle = i * angleIncrement;
        bossBullets.push({
            x: dummy.x,
            y: dummy.y,
            dx: t(Math.cos(angle + angleOffset) * 5),
            dy: t(Math.sin(angle + angleOffset) * 5),
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
