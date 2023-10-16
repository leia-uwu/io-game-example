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
                    direction: stream.readUnit(16),
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

export class UpdatePacket extends Packet {
    type = PacketType.Update;
    allocBytes = 2 ** 16;

    deletedObjects: number[] = [];
    partialObjects: GameObject[] = [];
    fullObjects: Array<GameObject & { data: Required<ObjectsNetData[GameObject["type"]]> }> = [];

    dirty = {
        playerID: false
    };

    playerID!: number;

    override serialize(): void {
        super.serialize();
        const stream = this.stream;

        const deletedObjectsDirty = this.deletedObjects.length > 0;
        const fullObjectsDirty = this.fullObjects.length > 0;
        const partialObjectsDirty = this.partialObjects.length > 0;

        stream.writeBoolean(deletedObjectsDirty);
        stream.writeBoolean(fullObjectsDirty);
        stream.writeBoolean(partialObjectsDirty);
        stream.writeBoolean(this.dirty.playerID);

        if (deletedObjectsDirty) {
            stream.writeUint16(this.deletedObjects.length);
            for (const id of this.deletedObjects) {
                stream.writeUint16(id);
            }
        }

        if (fullObjectsDirty) {
            stream.writeUint16(this.fullObjects.length);

            for (const object of this.fullObjects) {
                stream.writeUint16(object.id);
                stream.writeBits(object.type, NetConstants.objectTypeBits);
                ObjectSerializations[object.type].serializeFull(stream, object.data);
            }
        }

        if (partialObjectsDirty) {
            stream.writeUint16(this.partialObjects.length);

            for (const object of this.partialObjects) {
                stream.writeUint16(object.id);
                stream.writeBits(object.type, NetConstants.objectTypeBits);
                ObjectSerializations[object.type].serializePartial(stream, object.data);
            }
        }

        if (this.dirty.playerID) {
            stream.writeUint16(this.playerID);
        }
    }

    override deserialize(stream: GameBitStream): void {
        const deletedObjectsDirty = stream.readBoolean();
        const fullObjectsDirty = stream.readBoolean();
        const partialObjectsDirty = stream.readBoolean();
        this.dirty.playerID = stream.readBoolean();

        if (deletedObjectsDirty) {
            const count = stream.readUint16();
            for (let i = 0; i < count; i++) {
                this.deletedObjects.push(stream.readUint16());
            }
        }

        if (fullObjectsDirty) {
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

        if (partialObjectsDirty) {
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

        if (this.dirty.playerID) {
            this.playerID = stream.readUint16();
        }
    }
}
