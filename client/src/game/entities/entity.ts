import { Container } from "pixi.js";
import { type EntitiesNetData } from "../../../../common/src/packets/updatePacket";
import { MathUtils } from "../../../../common/src/utils/math";
import { EntityType } from "../../../../common/src/constants";
import { Vec2 } from "../../../../common/src/utils/vector";
import { type Game } from "../game";

export abstract class ClientEntity<T extends EntityType = EntityType> {
    abstract type: T;
    game: Game;
    id: number;
    position = Vec2.new(0, 0);

    container = new Container();

    constructor(game: Game, id: number) {
        this.game = game;
        this.id = id;

        this.game.camera.addObject(this.container);
    }

    updateFromData(_data: EntitiesNetData[T], _isNew: boolean): void {
        this.interpolationTick = 0;
    }

    abstract destroy(): void;

    oldPosition = Vec2.new(0, 0);
    interpolationTick = 0;
    interpolationFactor = 0;

    render(dt: number): void {
        this.interpolationTick += dt;
        this.interpolationFactor = MathUtils.clamp(this.interpolationTick / this.game.serverDt, 0, 1);
    }
}
