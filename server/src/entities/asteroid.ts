import { EntityType, GameConstants } from "../../../common/src/constants";
import { type EntitiesNetData } from "../../../common/src/packets/updatePacket";
import { CircleHitbox } from "../../../common/src/utils/hitbox";
import { MathUtils } from "../../../common/src/utils/math";
import { Random } from "../../../common/src/utils/random";
import { Vec2, type Vector } from "../../../common/src/utils/vector";
import { type Game } from "../game";
import { ServerEntity } from "./entity";

export class Asteroid extends ServerEntity {
    readonly type = EntityType.Asteroid;
    hitbox: CircleHitbox;

    variation = Random.int(0, GameConstants.asteroid.variations - 1);

    health: number;

    get position(): Vector {
        return this.hitbox.position;
    }

    set position(pos: Vector) {
        this.hitbox.position = pos;
        this._position = pos;
    }

    constructor(game: Game, position: Vector, radius: number) {
        super(game, position);
        this.hitbox = new CircleHitbox(radius, position);

        const def = GameConstants.asteroid;
        this.health = MathUtils.remap(radius, def.minRadius, def.maxRadius, def.minHealth, def.maxHealth);
    }

    tick(): void {
        const oldPos = Vec2.clone(this.position);

        const entities = this.game.grid.intersectsHitbox(this.hitbox);
        for (const entity of entities) {
            if (!(entity instanceof Asteroid)) continue;
            if (entity === this) continue;

            const collision = this.hitbox.getIntersection(entity.hitbox);
            if (collision) {
                this.position = Vec2.sub(this.position, Vec2.mul(collision.dir, collision.pen));
            }
        }

        const rad = this.hitbox.radius;
        this.position.x = MathUtils.clamp(this.position.x, rad, this.game.width - rad);
        this.position.y = MathUtils.clamp(this.position.y, rad, this.game.height - rad);

        if (!Vec2.equals(oldPos, this.position)) {
            this.setDirty();
            this.game.grid.updateEntity(this);
        }
    }

    damage(amount: number): void {
        this.health -= amount;
        if (this.health <= 0) {
            this.kill();
        }
    }

    kill(): void {
        if (this.hitbox.radius > GameConstants.asteroid.splitMaxRadius) {
            const radius = this.hitbox.radius / 2;
            for (let i = 0; i < 2; i++) {
                const asteroid = new Asteroid(this.game, this.position, radius);
                this.game.grid.addEntity(asteroid);
            }
        }
        this.game.explosions.push({
            position: this.position,
            radius: MathUtils.clamp(this.hitbox.radius, GameConstants.explosion.minRadius, GameConstants.explosion.maxRadius)
        });
        this.game.grid.remove(this);
    }

    get data(): Required<EntitiesNetData[EntityType.Asteroid]> {
        return {
            position: this.position,
            full: {
                variation: this.variation,
                radius: this.hitbox.radius
            }
        };
    }
}
