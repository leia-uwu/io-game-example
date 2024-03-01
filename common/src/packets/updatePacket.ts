import { GameConstants } from "../constants";
import { type GameBitStream, NetConstants, ObjectType, Packet, PacketType } from "../net";
import { type Vector } from "../utils/vector";

export interface ObjectsNetData {
    [ObjectType.Player]: {
        // Partial data should be used for data that changes often
        partial: {
            position: Vector
            direction: Vector
        }
        // while full data for data that rarely changes
        full?: {
            name: string
        }
    }
}

interface ObjectSerialization<T extends ObjectType> {
    serializePartial: (stream: GameBitStream, data: ObjectsNetData[T]) => void
    serializeFull: (stream: GameBitStream, data: Required<ObjectsNetData[T]>) => void
    deserializePartial: (stream: GameBitStream) => ObjectsNetData[T]
    deserializeFull: (stream: GameBitStream) => Required<ObjectsNetData[T]>
}

export const ObjectSerializations: { [K in ObjectType]: ObjectSerialization<K> } = {
    [ObjectType.Player]: {
        serializePartial(stream, data): void {
            stream.writePosition(data.partial.position);
            stream.writeUnit(data.partial.direction, 16);
        },
        serializeFull(stream, data): void {
            this.serializePartial(stream, data);
            stream.writeUTF8String(data.full.name, GameConstants.nameMaxLength);
        },
        deserializePartial(stream) {
            return {
                partial: {
                    position: stream.readPosition(),
                    direction: stream.readUnit(16)
                }
            };
        },
        deserializeFull(stream) {
            const partial = this.deserializePartial(stream);
            return {
                ...partial,
                full: {
                    name: stream.readUTF8String(GameConstants.nameMaxLength)
                }
            };
        }

    }
};

interface GameObject {
    id: number
    type: ObjectType
    data: ObjectsNetData[GameObject["type"]]
}

enum UpdateFlags {
    PlayerData = 1 << 0,
    DeletedObjects = 1 << 1,
    FullObjects = 1 << 2,
    PartialObjects = 1 << 3,
    Map = 1 << 4
}

export class UpdatePacket extends Packet {
    readonly type = PacketType.Update;
    readonly allocBytes = 2 ** 16;

    deletedObjects: number[] = [];
    partialObjects: GameObject[] = [];
    fullObjects: Array<GameObject & { data: Required<ObjectsNetData[GameObject["type"]]> }> = [];

    playerDataDirty = {
        activeId: false,
        zoom: false
    };

    playerData = {
        id: 0,
        zoom: 0
    };

    mapDirty = false;
    map = {
        width: 0,
        height: 0
    };

    override serialize(): void {
        super.serialize();
        const stream = this.stream;

        let flags = 0;
        if (Object.values(this.playerDataDirty).includes(true)) { flags += UpdateFlags.PlayerData; }

        if (this.deletedObjects.length > 0) { flags += UpdateFlags.DeletedObjects; }

        if (this.fullObjects.length > 0) { flags += UpdateFlags.FullObjects; }

        if (this.partialObjects.length > 0) { flags += UpdateFlags.PartialObjects; }

        if (this.mapDirty) { flags += UpdateFlags.Map; }

        stream.writeUint8(flags);

        if (flags & UpdateFlags.PlayerData) {
            stream.writeBoolean(this.playerDataDirty.activeId);
            if (this.playerDataDirty.activeId) {
                stream.writeUint16(this.playerData.id);
            }
            stream.writeBoolean(this.playerDataDirty.zoom);
            if (this.playerDataDirty.zoom) {
                stream.writeUint8(this.playerData.zoom);
            }
        }

        if (flags & UpdateFlags.DeletedObjects) {
            stream.writeUint16(this.deletedObjects.length);
            for (const id of this.deletedObjects) {
                stream.writeUint16(id);
            }
        }

        if (flags & UpdateFlags.FullObjects) {
            stream.writeUint16(this.fullObjects.length);

            for (const object of this.fullObjects) {
                stream.writeUint16(object.id);
                stream.writeBits(object.type, NetConstants.objectTypeBits);
                ObjectSerializations[object.type].serializeFull(stream, object.data);
            }
        }

        if (flags & UpdateFlags.PartialObjects) {
            stream.writeUint16(this.partialObjects.length);

            for (const object of this.partialObjects) {
                stream.writeUint16(object.id);
                stream.writeBits(object.type, NetConstants.objectTypeBits);
                ObjectSerializations[object.type].serializePartial(stream, object.data);
            }
        }

        if (flags & UpdateFlags.Map) {
            stream.writeUint16(this.map.width);
            stream.writeUint16(this.map.height);
        }
    }

    override deserialize(stream: GameBitStream): void {
        const flags = stream.readUint8();

        if (flags & UpdateFlags.PlayerData) {
            if (stream.readBoolean()) {
                this.playerDataDirty.activeId = true;
                this.playerData.id = stream.readUint16();
            }

            if (stream.readBoolean()) {
                this.playerDataDirty.zoom = true;
                this.playerData.zoom = stream.readUint8();
            }
        }

        if (flags & UpdateFlags.DeletedObjects) {
            const count = stream.readUint16();
            for (let i = 0; i < count; i++) {
                this.deletedObjects.push(stream.readUint16());
            }
        }

        if (flags & UpdateFlags.FullObjects) {
            const count = stream.readUint16();

            for (let i = 0; i < count; i++) {
                const id = stream.readUint16();
                const objectType = stream.readBits(NetConstants.objectTypeBits) as ObjectType;
                const data = ObjectSerializations[objectType].deserializeFull(stream);
                this.fullObjects.push({
                    id,
                    type: objectType,
                    data
                });
            }
        }

        if (flags & UpdateFlags.PartialObjects) {
            const count = stream.readUint16();

            for (let i = 0; i < count; i++) {
                const id = stream.readUint16();
                const objectType = stream.readBits(NetConstants.objectTypeBits) as ObjectType;
                const data = ObjectSerializations[objectType].deserializePartial(stream);
                this.partialObjects.push({
                    id,
                    type: objectType,
                    data
                });
            }
        }

        if (flags & UpdateFlags.Map) {
            this.mapDirty = true;
            this.map.width = stream.readUint16();
            this.map.height = stream.readUint16();
        }
    }
}
