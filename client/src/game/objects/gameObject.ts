import { type ObjectType } from "../../../../common/src/net";
import { type ObjectsNetData } from "../../../../common/src/packets/updatePacket";
import { Vec2 } from "../../../../common/src/utils/vector";
import { type Game } from "../game";

export abstract class GameObject<T extends ObjectType = ObjectType> {
    abstract type: T;
    game: Game;
    id: number;
    position = Vec2.new(0, 0);

    constructor(game: Game, id: number) {
        this.game = game;
        this.id = id;
    }

    abstract updateFromData(data: ObjectsNetData[T]): void;

    abstract destroy(): void;
}
