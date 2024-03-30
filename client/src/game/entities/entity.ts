import { type EntityType } from "../../../../common/src/net";
import { type EntitiesNetData } from "../../../../common/src/packets/updatePacket";
import { MathUtils } from "../../../../common/src/utils/math";
import { Vec2 } from "../../../../common/src/utils/vector";
import { type Game } from "../game";

export abstract class ClientEntity<T extends EntityType = EntityType> {
    abstract type: T;
    game: Game;
    id: number;
    position = Vec2.new(0, 0);

    constructor(game: Game, id: number) {
        this.game = game;
        this.id = id;
    }

    abstract updateFromData(data: EntitiesNetData[T], isNew: boolean): void;

    abstract destroy(): void;

    oldPosition = Vec2.new(0, 0);
    interpolationTick = 0;
    interpolationFactor = 0;

    render(dt: number): void {
        this.interpolationTick += dt;
        this.interpolationFactor = MathUtils.clamp(this.interpolationTick / this.game.serverDt, 0, 1);
    }
}
