import { GameConstants } from "../constants";
import { type GameBitStream, EntityType, Packet, ServerToClientPackets } from "../net";
import { type Vector } from "../utils/vector";

export interface EntitiesNetData {
    [EntityType.Player]: {
        // Partial data should be used for data that changes often
        position: Vector
        direction: Vector

        // while full data for data that rarely changes
        full?: {
            health: number
        }
    }
    [EntityType.Projectile]: {
        position: Vector
        full?: {
            direction: Vector
            shooterId: number
        }
    }
    [EntityType.Asteroid]: {
        position: Vector
        full?: {
            radius: number
            variation: number
        }
    }
}

interface EntitySerialization<T extends EntityType> {
    // how many bytes to alloc for the entity serialized data cache
    partialSize: number
    fullSize: number
    serializePartial: (stream: GameBitStream, data: EntitiesNetData[T]) => void
    serializeFull: (stream: GameBitStream, data: Required<EntitiesNetData[T]>["full"]) => void
    deserializePartial: (stream: GameBitStream) => EntitiesNetData[T]
    deserializeFull: (stream: GameBitStream) => Required<EntitiesNetData[T]>["full"]
}

export const EntitySerializations: { [K in EntityType]: EntitySerialization<K> } = {
    [EntityType.Player]: {
        partialSize: 8,
        fullSize: 2,
        serializePartial(stream, data): void {
            stream.writePosition(data.position);
            stream.writeUnit(data.direction, 16);
        },
        serializeFull(stream, data): void {
            stream.writeFloat(data.health, 0, GameConstants.player.maxHealth, 12);
        },
        deserializePartial(stream) {
            return {
                position: stream.readPosition(),
                direction: stream.readUnit(16)
            };
        },
        deserializeFull(stream) {
            return {
                health: stream.readFloat(0, GameConstants.player.maxHealth, 12)
            };
        }
    },
    [EntityType.Projectile]: {
        partialSize: 6,
        fullSize: 6,
        serializePartial(stream, data) {
            stream.writePosition(data.position);
        },
        serializeFull(stream, data) {
            stream.writeUnit(data.direction, 16);
            stream.writeUint16(data.shooterId);
        },
        deserializePartial(stream) {
            return {
                position: stream.readPosition()
            };
        },
        deserializeFull(stream) {
            return {
                direction: stream.readUnit(16),
                shooterId: stream.readUint16()
            };
        }
    },
    [EntityType.Asteroid]: {
        partialSize: 6,
        fullSize: 3,
        serializePartial(stream, data) {
            stream.writePosition(data.position);
        },
        serializeFull(stream, data) {
            stream.writeUint8(data.variation);
            stream.writeFloat(data.radius, GameConstants.asteroid.minRadius, GameConstants.asteroid.maxRadius, 8);
        },
        deserializePartial(stream) {
            return {
                position: stream.readPosition()
            };
        },
        deserializeFull(stream) {
            return {
                variation: stream.readUint8(),
                radius: stream.readFloat(GameConstants.asteroid.minRadius, GameConstants.asteroid.maxRadius, 8)
            };
        }
    }
};

interface Entity {
    id: number
    type: EntityType
    data: EntitiesNetData[Entity["type"]]
}

export interface Explosion {
    position: Vector
    radius: number
}

enum UpdateFlags {
    DeletedEntities = 1 << 0,
    FullEntities = 1 << 1,
    PartialEntities = 1 << 2,
    NewPlayers = 1 << 3,
    DeletedPlayers = 1 << 4,
    PlayerData = 1 << 5,
    Explosions = 1 << 6,
    Map = 1 << 7
}

export class UpdatePacket extends Packet {
    deletedEntities: number[] = [];
    partialEntities: Entity[] = [];
    fullEntities: Array<Entity & { data: Required<EntitiesNetData[Entity["type"]]> }> = [];

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

    explosions: Explosion[] = [];

    mapDirty = false;
    map = {
        width: 0,
        height: 0
    };

    // server side cached entity serializations
    serverPartialEntities: Array<{
        partialStream: GameBitStream
    }> = [];

    serverFullEntities: Array<{
        partialStream: GameBitStream
        fullStream: GameBitStream
    }> = [];

    override serialize(stream: GameBitStream): void {
        let flags = 0;
        // save the stream index for writing flags
        const flagsIdx = stream.index;
        stream.writeUint8(flags);

        if (this.deletedEntities.length) {
            stream.writeArray(this.deletedEntities, 16, (id) => {
                stream.writeUint16(id);
            });

            flags |= UpdateFlags.DeletedEntities;
        }

        if (this.serverFullEntities.length) {
            stream.writeArray(this.serverFullEntities, 16, (entity) => {
                stream.writeBytes(entity.partialStream, 0, entity.partialStream.byteIndex);
                stream.writeBytes(entity.fullStream, 0, entity.fullStream.byteIndex);
            });

            flags |= UpdateFlags.FullEntities;
        }

        if (this.serverPartialEntities.length) {
            stream.writeArray(this.serverPartialEntities, 16, (entity) => {
                stream.writeBytes(entity.partialStream, 0, entity.partialStream.byteIndex);
            });

            flags |= UpdateFlags.PartialEntities;
        }

        if (this.newPlayers.length) {
            stream.writeArray(this.newPlayers, 8, (player) => {
                stream.writeUint16(player.id);
                stream.writeASCIIString(player.name, GameConstants.player.nameMaxLength);
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

        if (this.explosions.length) {
            stream.writeArray(this.explosions, 8, (explosion) => {
                stream.writePosition(explosion.position);
                stream.writeFloat(
                    explosion.radius,
                    GameConstants.explosion.minRadius,
                    GameConstants.explosion.maxRadius,
                    8
                );
            });

            flags |= UpdateFlags.Explosions;
        }

        if (this.mapDirty) {
            stream.writeUint16(this.map.width);
            stream.writeUint16(this.map.height);

            flags |= UpdateFlags.Map;
        }

        // write flags and restore stream index
        const idx = stream.index;
        stream.index = flagsIdx;
        stream.writeUint8(flags);
        stream.index = idx;
    }

    override deserialize(stream: GameBitStream): void {
        const flags = stream.readUint8();

        if (flags & UpdateFlags.DeletedEntities) {
            stream.readArray(this.deletedEntities, 16, () => {
                return stream.readUint16();
            });
        }

        if (flags & UpdateFlags.FullEntities) {
            stream.readArray(this.fullEntities, 16, () => {
                const id = stream.readUint16();
                const entityType = stream.readUint8() as EntityType;
                const data = EntitySerializations[entityType].deserializePartial(stream);
                stream.readAlignToNextByte();
                data.full = EntitySerializations[entityType].deserializeFull(stream);
                stream.readAlignToNextByte();
                return {
                    id,
                    type: entityType,
                    data
                };
            });
        }

        if (flags & UpdateFlags.PartialEntities) {
            stream.readArray(this.partialEntities, 16, () => {
                const id = stream.readUint16();
                const entityType = stream.readUint8() as EntityType;
                const data = EntitySerializations[entityType].deserializePartial(stream);
                stream.readAlignToNextByte();
                return {
                    id,
                    type: entityType,
                    data
                };
            });
        }

        if (flags & UpdateFlags.NewPlayers) {
            stream.readArray(this.newPlayers, 8, () => {
                return {
                    id: stream.readUint16(),
                    name: stream.readASCIIString(GameConstants.player.nameMaxLength)
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

        if (flags & UpdateFlags.Explosions) {
            stream.readArray(this.explosions, 8, () => {
                return {
                    position: stream.readPosition(),
                    radius: stream.readFloat(GameConstants.explosion.minRadius, GameConstants.explosion.maxRadius, 8)
                };
            });
        }

        if (flags & UpdateFlags.Map) {
            this.mapDirty = true;
            this.map.width = stream.readUint16();
            this.map.height = stream.readUint16();
        }
    }
}

ServerToClientPackets.register(UpdatePacket);
