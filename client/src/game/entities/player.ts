import { Container, Graphics, Sprite, Text } from "pixi.js";
import { type Game } from "../game";
import { ClientEntity } from "./entity";
import { EntityType } from "../../../../common/src/net";
import { type EntitiesNetData } from "../../../../common/src/packets/updatePacket";
import { Vec2 } from "../../../../common/src/utils/vector";
import { Camera } from "../camera";
import { GameConstants } from "../../../../common/src/constants";
import { MathUtils } from "../../../../common/src/utils/math";

export class Player extends ClientEntity<EntityType.Player> {
    readonly type = EntityType.Player;

    container = new Container();
    image = Sprite.from("./game/player.svg");

    // container for stuff that doesn't rotate
    staticContainer = new Container();
    nameText = new Text({
        style: {
            align: "center",
            fill: "white"
        }
    });

    health = GameConstants.player.defaultHealth;
    healthBar = new Graphics();

    direction = Vec2.new(0, 0);

    constructor(game: Game, id: number) {
        super(game, id);

        this.container.addChild(this.image);
        this.image.anchor.set(0.5);
        this.nameText.anchor.set(0.5);

        this.image.tint = GameConstants.player[this.id === game.activePlayerID ? "activeTint" : "enemyTint"];

        this.game.camera.addObject(this.container);
        this.game.camera.addObject(this.staticContainer);

        this.nameText.text = this.game.playerNames.get(this.id) ?? "Unknown Player";
        this.nameText.position.set(0, 60);
        this.healthBar.position.set(0, -60);

        this.staticContainer.addChild(this.nameText, this.healthBar);
        this.redrawHealthBar();
    }

    updateFromData(data: EntitiesNetData[EntityType.Player]): void {
        this.position = data.position;
        this.direction = data.direction;

        this.container.position.copyFrom(Camera.vecToScreen(this.position));
        this.staticContainer.position.copyFrom(this.container.position);

        this.container.rotation = Math.atan2(this.direction.y, this.direction.x);

        if (this.id === this.game.activePlayerID) {
            this.game.camera.position = this.container.position;
        }
        if (data.full) {
            if (this.health !== data.full.health) {
                this.redrawHealthBar();
            }
            this.health = data.full.health;
        }
    }

    redrawHealthBar(): void {
        const healthbarWidth = 80;
        const fillWidth = MathUtils.remap(this.health, 0, GameConstants.player.maxHealth, 0, healthbarWidth);
        this.healthBar.visible = this.health < GameConstants.player.maxHealth;
        this.healthBar.clear()
            .rect(-healthbarWidth / 2, 0, healthbarWidth, 10)
            .fill({
                color: 0xffffff,
                alpha: 0.2
            })
            .rect(-healthbarWidth / 2, 0, fillWidth, 10)
            .fill("green");
    }

    destroy(): void {
        this.container.destroy();
        this.nameText.destroy();
    }
}
