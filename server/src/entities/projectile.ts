import { GameConstants } from "../../../common/src/constants";
import { ClassDefs } from "../../../common/src/defs/classDefs";
import { EntityType } from "../../../common/src/net";
import { type EntitiesNetData } from "../../../common/src/packets/updatePacket";
import { CircleHitbox } from "../../../common/src/utils/hitbox";
import { MathUtils } from "../../../common/src/utils/math";
import { Vec2, type Vector } from "../../../common/src/utils/vector";
import { type Game } from "../game";
import { Asteroid } from "./asteroid";
import { ServerEntity } from "./entity";
import { Player } from "./player";

export class Projectile extends ServerEntity {
    readonly type = EntityType.Projectile;
    hitbox: CircleHitbox;
    direction: Vector;
    dead = false;

    get position(): Vector {
        return this.hitbox.position;
    }

    set position(pos: Vector) {
        this.hitbox.position = pos;
        this._position = pos;
    }

    source: Player;

    constructor(game: Game, position: Vector, direction: Vector, source: Player) {
        super(game, position);
        this.direction = direction;
        this.hitbox = new CircleHitbox(GameConstants.projectile.radius, position);
        this.source = source;
    }

    tick(): void {
        if (this.dead) {
            this.destroy();
            return;
        }

        const classDef = ClassDefs.typeToDef(this.source.class);

        const speed = Vec2.mul(this.direction, classDef.bulletSpeed);
        this.position = Vec2.add(this.position, Vec2.mul(speed, this.game.dt));
        this.game.grid.updateEntity(this);
        this.setDirty();

        const entities = this.game.grid.intersectsHitbox(this.hitbox);
        for (const entity of entities) {
            if (!(entity instanceof Player || entity instanceof Asteroid)) continue;
            if (entity === this.source) continue;

            if (entity.hitbox.collidesWith(this.hitbox)) {
                entity.damage(classDef.damage, this.source);
                this.dead = true;
            }
        }

        if (this.position.x <= 0 || this.position.x >= this.game.width
            || this.position.y <= 0 || this.position.y >= this.game.height) {
            this.dead = true;
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
                direction: this.direction,
                shooterId: this.source.id
            }
        };
    }
}
