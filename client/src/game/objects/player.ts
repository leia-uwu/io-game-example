import { Container, Sprite, Text } from "pixi.js";
import { type Game } from "../game";
import { GameObject } from "./gameObject";
import { ObjectType } from "../../../../common/src/net";
import { type ObjectsNetData } from "../../../../common/src/packets/updatePacket";
import { Vec2 } from "../../../../common/src/utils/vector";
import { Camera } from "../camera";

export class Player extends GameObject<ObjectType.Player> {
    readonly type = ObjectType.Player;

    container = new Container();
    image = Sprite.from("./game/player-blue.svg");
    nameText = new Text("", {
        align: "center",
        fill: "white"
    });

    direction = Vec2.new(0, 0);

    constructor(game: Game, id: number) {
        super(game, id);

        this.container.addChild(this.image);
        this.image.anchor.set(0.5);
        this.nameText.anchor.set(0.5);
        this.game.camera.addObject(this.container);
        this.game.camera.addObject(this.nameText);
    }

    updateFromData(data: ObjectsNetData[ObjectType.Player]): void {
        this.position = data.partial.position;
        this.direction = data.partial.direction;

        this.container.position.copyFrom(Camera.vecToScreen(this.position));
        this.nameText.position.copyFrom(Vec2.add(this.container.position, Vec2.new(0, 60)));

        this.container.rotation = Math.atan2(this.direction.y, this.direction.x);

        if (this.id === this.game.activePlayerID) {
            this.game.camera.position = this.container.position;
        }
        if (data.full) {
            this.nameText.text = data.full.name;
        }
    }

    destroy(): void {
        this.container.destroy();
        this.nameText.destroy();
    }
}
