import { Sprite } from "pixi.js";
import { type Game } from "../game";
import { ClientEntity } from "./entity";
import { type EntitiesNetData } from "../../../../common/src/packets/updatePacket";
import { Vec2 } from "../../../../common/src/utils/vector";
import { Camera } from "../camera";
import { EntityType, GameConstants } from "../../../../common/src/constants";

export class Projectile extends ClientEntity {
    readonly type = EntityType.Projectile;

    trail = Sprite.from("projectile.svg");

    direction = Vec2.new(0, 0);

    initialPosition = Vec2.new(0, 0);

    constructor(game: Game, id: number) {
        super(game, id);

        this.container.addChild(this.trail);
        this.trail.anchor.set(1, 0.5);
        this.trail.height = Camera.unitToScreen(GameConstants.projectile.radius);
    }

    override updateFromData(data: EntitiesNetData[EntityType.Projectile], isNew: boolean): void {
        super.updateFromData(data, isNew);

        if (isNew) {
            this.initialPosition = Vec2.clone(data.position);
        }

        this.oldPosition = isNew ? data.position : Vec2.clone(this.position);
        this.position = data.position;

        if (data.full) {
            this.direction = data.full.direction;
            this.container.rotation = Math.atan2(this.direction.y, this.direction.x);

            const isEnemy = data.full.shooterId !== this.game.activePlayerID;
            this.trail.tint = GameConstants.player[isEnemy ? "enemyTint" : "activeTint"];
        }
    }

    override render(dt: number): void {
        super.render(dt);
        const pos = Camera.vecToScreen(
            Vec2.lerp(this.oldPosition, this.position, this.interpolationFactor)
        );

        this.trail.width = Camera.unitToScreen(
            Math.min(
                Vec2.distance(this.initialPosition, this.position),
                GameConstants.projectile.trailMaxLength)
        );

        this.container.position = pos;
    }

    override destroy(): void {
        this.container.destroy({
            children: true
        });
    }
}
