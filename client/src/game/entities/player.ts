import { Color, Container, Graphics, Sprite, Text } from "pixi.js";
import { type Game } from "../game";
import { ClientEntity } from "./entity";
import { EntityType } from "../../../../common/src/net";
import { type EntitiesNetData } from "../../../../common/src/packets/updatePacket";
import { Vec2 } from "../../../../common/src/utils/vector";
import { Camera } from "../camera";
import { GameConstants } from "../../../../common/src/constants";
import { EasinFunctions, MathUtils } from "../../../../common/src/utils/math";
import { Random } from "../../../../common/src/utils/random";

export class Player extends ClientEntity {
    readonly type = EntityType.Player;

    image = Sprite.from("player.svg");

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
    oldDirection = Vec2.new(0, 0);

    constructor(game: Game, id: number) {
        super(game, id);

        this.container.addChild(this.image);
        this.container.zIndex = 2;
        this.image.anchor.set(0.5);
        this.nameText.anchor.set(0.5);

        this.image.tint = GameConstants.player[this.id === game.activePlayerID ? "activeTint" : "enemyTint"];

        this.staticContainer.zIndex = 3;
        this.game.camera.addObject(this.staticContainer);

        this.nameText.text = this.game.playerNames.get(this.id) ?? "Unknown Player";
        this.nameText.position.set(0, 60);
        this.healthBar.position.set(0, -60);

        this.staticContainer.addChild(this.nameText, this.healthBar);
        this.redrawHealthBar();
    }

    override updateFromData(data: EntitiesNetData[EntityType.Player], isNew: boolean): void {
        super.updateFromData(data, isNew);

        this.oldPosition = isNew ? data.position : Vec2.clone(this.position);
        this.position = data.position;
        this.oldDirection = Vec2.clone(this.direction);
        this.direction = data.direction;

        if (data.full) {
            if (this.health !== data.full.health) {
                this.health = data.full.health;
                this.redrawHealthBar();
            }
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

    override render(dt: number): void {
        super.render(dt);
        const pos = Camera.vecToScreen(
            Vec2.lerp(this.oldPosition, this.position, this.interpolationFactor)
        );
        this.container.position = pos;
        this.staticContainer.position = pos;

        const direction = Vec2.lerp(this.oldDirection, this.direction, this.interpolationFactor);
        this.container.rotation = Math.atan2(direction.y, direction.x);

        const dir = Math.atan2(-this.direction.y, -this.direction.x);
        this.game.particleManager.spawnParticles(3, () => {
            return {
                position: this.position,
                lifeTime: { min: 0.5, max: 2 },
                blendMode: "add",
                tint: new Color(`hsl(${Random.int(0, 360)}, 100%, 50%)`),
                sprite: "particle.svg",
                rotation: { value: 0 },
                alpha: { start: 1, end: 0, easing: EasinFunctions.sineIn },
                scale: { start: 2, end: 0 },
                speed: { start: 10, end: 0 },
                direction: { min: dir - 0.2, max: dir + 0.2 }
            };
        });
    }

    override destroy(): void {
        this.container.destroy({
            children: true
        });
        this.staticContainer.destroy({
            children: true
        });
    }
}
