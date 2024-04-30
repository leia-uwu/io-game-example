import { Sprite, Texture } from "pixi.js";
import { type Game } from "../game";
import { ClientEntity } from "./entity";
import { type EntitiesNetData } from "../../../../common/src/packets/updatePacket";
import { Vec2 } from "../../../../common/src/utils/vector";
import { Camera } from "../camera";
import { EntityType } from "../../../../common/src/constants";

export class Asteroid extends ClientEntity {
    readonly type = EntityType.Asteroid;

    image = new Sprite();

    direction = Vec2.new(0, 0);

    constructor(game: Game, id: number) {
        super(game, id);

        this.container.addChild(this.image);
        this.image.anchor.set(0.5);
    }

    override updateFromData(data: EntitiesNetData[EntityType.Asteroid], isNew: boolean): void {
        super.updateFromData(data, isNew);

        this.oldPosition = isNew ? data.position : Vec2.clone(this.position);
        this.position = data.position;

        if (data.full) {
            this.image.texture = Texture.from(`asteroid-${data.full.variation}.svg`);
            this.image.width = this.image.height = Camera.unitToScreen(data.full.radius * 2);
        }
    }

    override render(dt: number): void {
        super.render(dt);
        const pos = Camera.vecToScreen(
            Vec2.lerp(this.oldPosition, this.position, this.interpolationFactor)
        );
        this.container.position.copyFrom(pos);

        this.container.rotation += 0.3 * dt;
    }

    override destroy(): void {
        this.container.destroy({
            children: true
        });
    }
}
