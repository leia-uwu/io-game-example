import { type ObjectType } from "../../../common/src/net";
import { type ObjectsNetData } from "../../../common/src/packets/updatePacket";
import { type Hitbox } from "../../../common/src/utils/hitbox";
import { type Vector } from "../../../common/src/utils/vector";
import { type Game } from "../game";

export abstract class GameObject<T extends ObjectType = ObjectType> {
    abstract type: T;
    game: Game;
    id: number;

    _position: Vector;
    get position(): Vector { return this._position; }
    set position(pos: Vector) { this._position = pos; }

    abstract hitbox: Hitbox;

    constructor(game: Game, pos: Vector) {
        this.game = game;
        this.id = game.nextId();
        this._position = pos;
    }

    setDirty(): void {
        this.game.dirtyObjects.add(this);
    }

    setFullDirty(): void {
        this.game.fullDirtyObjects.add(this);
    }

    abstract get data(): Required<ObjectsNetData[ObjectType]>;
}
