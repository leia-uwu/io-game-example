import { EntityType } from "../../../common/src/net";
import { type EntitiesNetData } from "../../../common/src/packets/updatePacket";
import { CircleHitbox } from "../../../common/src/utils/hitbox";
import { MathUtils } from "../../../common/src/utils/math";
import { Vec2, type Vector } from "../../../common/src/utils/vector";
import { type Game } from "../game";
import { ServerEntity } from "./entity";

export class Projectile extends ServerEntity {
    readonly type = EntityType.Projectile;
    hitbox: CircleHitbox;
    direction: Vector;

    speed = 100;
    damage = 15;

    get position(): Vector {
        return this.hitbox.position;
    }

    set position(pos: Vector) {
        this.hitbox.position = pos;
        this._position = pos;
    }

    constructor(game: Game, position: Vector, direction: Vector) {
        super(game, position);
        this.direction = direction;
        this.hitbox = new CircleHitbox(1, position);
    }

    tick(): void {
        if (this.position.x <= 0 || this.position.x >= this.game.width ||
            this.position.y <= 0 || this.position.y >= this.game.height
        ) {
            this.destroy();
            return;
        }

        const speed = Vec2.mul(this.direction, this.speed);
        this.position = Vec2.add(this.position, Vec2.mul(speed, this.game.dt));
        this.game.grid.updateEntity(this);
        this.setDirty();

        for (const player of this.game.players) {
            if (player.hitbox.collidesWith(this.hitbox)) {
                player.damage(15);
                this.destroy();
            }
        }
        this.position.x = MathUtils.clamp(this.position.x, 0, this.game.width);
        this.position.y = MathUtils.clamp(this.position.y, 0, this.game.height);
    }

    destroy() {
        this.game.grid.remove(this);
    }

    get data(): Required<EntitiesNetData[EntityType.Projectile]> {
        return {
            position: this.position,
            full: {
                direction: this.direction
            }
        };
    }
}
