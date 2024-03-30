import { GameBitStream, type ObjectType } from "../../../common/src/net";
import { ObjectSerializations, type ObjectsNetData } from "../../../common/src/packets/updatePacket";
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

    partialStream!: GameBitStream;
    fullStream!: GameBitStream;

    constructor(game: Game, pos: Vector) {
        this.game = game;
        this.id = game.nextId();
        this._position = pos;
    }

    init(): void {
        // + 3 for object id (2 bytes) and object type (1 byte)
        this.partialStream = GameBitStream.alloc(ObjectSerializations[this.type].partialSize + 3);
        this.fullStream = GameBitStream.alloc(ObjectSerializations[this.type].fullSize);
        this.serializeFull();
    }

    serializePartial(): void {
        this.partialStream.index = 0;
        this.partialStream.writeUint16(this.id);
        this.partialStream.writeUint8(this.type);
        ObjectSerializations[this.type].serializePartial(this.partialStream, this.data);
        this.partialStream.writeAlignToNextByte();
    }

    serializeFull(): void {
        this.serializePartial();
        this.fullStream.index = 0;
        ObjectSerializations[this.type].serializeFull(this.fullStream, this.data.full);
        this.fullStream.writeAlignToNextByte();
    }

    setDirty(): void {
        this.game.dirtyObjects.add(this);
    }

    setFullDirty(): void {
        this.game.fullDirtyObjects.add(this);
    }

    abstract get data(): Required<ObjectsNetData[ObjectType]>;
}
