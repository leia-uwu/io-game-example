import { GameConstants } from "../constants";
import { type GameBitStream, ObjectType, Packet, PacketType } from "../net";
import { type Vector } from "../utils/vector";

export interface ObjectsNetData {
    [ObjectType.Player]: {
        // Partial data should be used for data that changes often
        position: Vector
        direction: Vector

        // while full data for data that rarely changes
        full?: {
            health: number
        }
    }
}

interface ObjectSerialization<T extends ObjectType> {
    // how many bytes to alloc for the object serialized data cache
    partialSize: number
    fullSize: number
    serializePartial: (stream: GameBitStream, data: ObjectsNetData[T]) => void
    serializeFull: (stream: GameBitStream, data: Required<ObjectsNetData[T]>["full"]) => void
    deserializePartial: (stream: GameBitStream) => ObjectsNetData[T]
    deserializeFull: (stream: GameBitStream) => Required<ObjectsNetData[T]>["full"]
}

export const ObjectSerializations: { [K in ObjectType]: ObjectSerialization<K> } = {
    [ObjectType.Player]: {
        partialSize: 8,
        fullSize: 2,
        serializePartial(stream, data): void {
            stream.writePosition(data.position);
            stream.writeUnit(data.direction, 16);
        },
        serializeFull(stream, data): void {
            stream.writeFloat(data.health, 0, 100, 8);
        },
        deserializePartial(stream) {
            return {
                position: stream.readPosition(),
                direction: stream.readUnit(16)
            };
        },
        deserializeFull(stream) {
            return {
                health: stream.readFloat(0, 100, 8)
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
    DeletedObjects = 1 << 0,
    FullObjects = 1 << 1,
    PartialObjects = 1 << 2,
    NewPlayers = 1 << 3,
    DeletedPlayers = 1 << 4,
    PlayerData = 1 << 5,
    Map = 1 << 6
}

export class UpdatePacket extends Packet {
    readonly type = PacketType.Update;
    readonly allocBytes = 2 ** 16;

    deletedObjects: number[] = [];
    partialObjects: GameObject[] = [];
    fullObjects: Array<GameObject & { data: Required<ObjectsNetData[GameObject["type"]]> }> = [];

    newPlayers: Array<{
        name: string
        id: number
    }> = [];

    deletedPlayers: number[] = [];

    playerDataDirty = {
        id: false,
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

    // server side cached object serializations
    serverPartialObjs: Array<{
        partialStream: GameBitStream
    }> = [];

    serverFullObjs: Array<{
        partialStream: GameBitStream
        fullStream: GameBitStream
    }> = [];

    override serialize(): void {
        super.serialize();
        const stream = this.stream;

        let flags = 0;
        const flagIdx = this.stream.index;
        stream.writeUint8(flags);

        if (this.deletedObjects.length) {
            stream.writeArray(this.deletedObjects, 16, (id) => {
                stream.writeUint16(id);
            });

            flags |= UpdateFlags.DeletedObjects;
        }

        if (this.serverFullObjs.length) {
            stream.writeArray(this.serverFullObjs, 16, (obj) => {
                stream.writeBytes(obj.partialStream, 0, obj.partialStream.byteIndex);
                stream.writeBytes(obj.fullStream, 0, obj.fullStream.byteIndex);
            });

            flags |= UpdateFlags.FullObjects;
        }

        if (this.serverPartialObjs.length) {
            stream.writeArray(this.serverPartialObjs, 16, (obj) => {
                stream.writeBytes(obj.partialStream, 0, obj.partialStream.byteIndex);
            });

            flags |= UpdateFlags.PartialObjects;
        }

        if (this.newPlayers.length) {
            stream.writeArray(this.newPlayers, 8, (player) => {
                stream.writeUint16(player.id);
                stream.writeASCIIString(player.name, GameConstants.nameMaxLength);
            });

            flags |= UpdateFlags.NewPlayers;
        }

        if (this.deletedPlayers.length) {
            stream.writeArray(this.deletedPlayers, 8, (id) => {
                stream.writeUint16(id);
            });

            flags |= UpdateFlags.DeletedPlayers;
        }

        if (Object.values(this.playerDataDirty).includes(true)) {
            stream.writeBoolean(this.playerDataDirty.id);
            if (this.playerDataDirty.id) {
                stream.writeUint16(this.playerData.id);
            }

            stream.writeBoolean(this.playerDataDirty.zoom);
            if (this.playerDataDirty.zoom) {
                stream.writeUint8(this.playerData.zoom);
            }
            stream.writeAlignToNextByte();

            flags |= UpdateFlags.PlayerData;
        }

        if (this.mapDirty) {
            stream.writeUint16(this.map.width);
            stream.writeUint16(this.map.height);

            flags |= UpdateFlags.Map;
        }

        const idx = stream.index;
        stream.index = flagIdx;
        stream.writeUint8(flags);
        stream.index = idx;
    }

    override deserialize(stream: GameBitStream): void {
        const flags = stream.readUint8();

        if (flags & UpdateFlags.DeletedObjects) {
            const count = stream.readUint16();
            for (let i = 0; i < count; i++) {
                this.deletedObjects.push(stream.readUint16());
            }
        }

        if (flags & UpdateFlags.FullObjects) {
            stream.readArray(this.fullObjects, 16, () => {
                const id = stream.readUint16();
                const objectType = stream.readUint8() as ObjectType;
                const data = ObjectSerializations[objectType].deserializePartial(stream);
                stream.readAlignToNextByte();
                data.full = ObjectSerializations[objectType].deserializeFull(stream);
                stream.readAlignToNextByte();
                return {
                    id,
                    type: objectType,
                    data
                };
            });
        }

        if (flags & UpdateFlags.PartialObjects) {
            stream.readArray(this.partialObjects, 16, () => {
                const id = stream.readUint16();
                const objectType = stream.readUint8() as ObjectType;
                const data = ObjectSerializations[objectType].deserializePartial(stream);
                stream.readAlignToNextByte();
                return {
                    id,
                    type: objectType,
                    data
                };
            });
        }

        if (flags & UpdateFlags.NewPlayers) {
            stream.readArray(this.newPlayers, 8, () => {
                return {
                    id: stream.readUint16(),
                    name: stream.readASCIIString(GameConstants.nameMaxLength)
                };
            });
        }

        if (flags & UpdateFlags.DeletedPlayers) {
            stream.readArray(this.deletedPlayers, 8, () => {
                return stream.readUint16();
            });
        }

        if (flags & UpdateFlags.PlayerData) {
            if (stream.readBoolean()) {
                this.playerDataDirty.id = true;
                this.playerData.id = stream.readUint16();
            }

            if (stream.readBoolean()) {
                this.playerDataDirty.zoom = true;
                this.playerData.zoom = stream.readUint8();
            }

            stream.readAlignToNextByte();
        }

        if (flags & UpdateFlags.Map) {
            this.mapDirty = true;
            this.map.width = stream.readUint16();
            this.map.height = stream.readUint16();
        }
    }
}
