export enum EntityType {
    Player,
    Projectile,
    Asteroid
}

export const GameConstants = {
    maxPosition: 1024,
    player: {
        nameMaxLength: 16,
        radius: 2,
        defaultName: "Player",
        activeTint: 0x0567d7,
        enemyTint: 0xff3838,
        speed: 25,
        maxHealth: 100,
        defaultHealth: 100
    },
    projectile: {
        radius: 0.8,
        trailMaxLength: 25
    },
    asteroid: {
        maxRadius: 3,
        minRadius: 0.5,
        splitMaxRadius: 1.2,
        variations: 3,
        maxHealth: 150,
        minHealth: 20
    },
    explosion: {
        minRadius: 1,
        maxRadius: 25
    }
};
