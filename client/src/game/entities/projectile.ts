import { Container, Sprite } from "pixi.js";
import { type Game } from "../game";
import { ClientEntity } from "./entity";
import { EntityType } from "../../../../common/src/net";
import { type EntitiesNetData } from "../../../../common/src/packets/updatePacket";
import { Vec2 } from "../../../../common/src/utils/vector";
import { Camera } from "../camera";

export class Projectile extends ClientEntity<EntityType.Projectile> {
    readonly type = EntityType.Projectile;

    container = new Container();
    trail = Sprite.from("./game/projectile.svg");

    direction = Vec2.new(0, 0);

    constructor(game: Game, id: number) {
        super(game, id);

        this.container.addChild(this.trail);
        this.game.camera.addObject(this.container);
        this.trail.anchor.set(1, 0.5);
    }

    override updateFromData(data: EntitiesNetData[EntityType.Projectile], isNew: boolean): void {
        this.interpolationTick = 0;
        this.oldPosition = isNew ? data.position : Vec2.clone(this.position);
        this.position = data.position;

        if (data.full) {
            this.container.rotation = Math.atan2(data.full.direction.y, data.full.direction.x);
        }
    }

    override render(dt: number): void {
        super.render(dt);
        const pos = Camera.vecToScreen(
            Vec2.lerp(this.oldPosition, this.position, this.interpolationFactor)
        );
        this.container.position.copyFrom(pos);
    }

    override destroy(): void {
        this.container.destroy({
            children: true
        });
    }
}
