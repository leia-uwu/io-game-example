import { BitStream } from "@damienvesper/bit-buffer";
import { type Vector } from "./utils/vector";
import { GameConstants } from "./constants";

export enum PacketType {
    Connected,
    Update,
    Input
}

export enum ObjectType {
    Player
}

function calculateEnumBits(e: object): number {
    return Math.ceil(Object.keys(e).length / 2);
}

export const NetConstants = {
    packetBits: calculateEnumBits(PacketType),
    objectTypeBits: calculateEnumBits(ObjectType)
};

export class GameBitStream extends BitStream {
    static alloc(size: number): GameBitStream {
        return new GameBitStream(new ArrayBuffer(size));
    }

    /**
     * Write a floating point number to the stream.
     * @param value The number.
     * @param min The minimum number.
     * @param max The maximum number.
     * @param bitCount The number of bits to write
     */
    writeFloat(value: number, min: number, max: number, bitCount: number): void {
        const range = (1 << bitCount) - 1;
        const clamped = value < max ? (value > min ? value : min) : max;
        this.writeBits(((clamped - min) / (max - min)) * range + 0.5, bitCount);
    }

    /**
     * Read a floating point number from the stream.
     * @param min The minimum number.
     * @param max The maximum number.
     * @param bitCount The number of bits to read
     * @return The floating point number.
     */
    readFloat(min: number, max: number, bitCount: number): number {
        const range = (1 << bitCount) - 1;
        return min + (max - min) * this.readBits(bitCount) / range;
    }

    /**
     * Write a position Vector to the stream.
     * @param vector The Vector.
     * @param minX The minimum X position.
     * @param minY The minimum Y position.
     * @param maxX The maximum X position.
     * @param maxY The maximum Y position.
     * @param bitCount The number of bits to write.
     */
    writeVector(vector: Vector, minX: number, minY: number, maxX: number, maxY: number, bitCount: number): void {
        this.writeVector2(vector.x, vector.y, minX, minY, maxX, maxY, bitCount);
    }

    /**
     * Write a position Vector to the stream.
     * @param x The X position.
     * @param y The Y position.
     * @param minX The minimum X position.
     * @param minY The minimum Y position.
     * @param maxX The maximum X position.
     * @param maxY The maximum Y position.
     * @param bitCount The number of bits to write.
     * @return The position Vector.
     */
    writeVector2(x: number, y: number, minX: number, minY: number, maxX: number, maxY: number, bitCount: number): void {
        this.writeFloat(x, minX, maxX, bitCount);
        this.writeFloat(y, minY, maxY, bitCount);
    }

    /**
     * Read a position Vector from the stream.
     * @param minX The minimum X position.
     * @param minY The minimum Y position.
     * @param maxX The maximum X position.
     * @param maxY The maximum Y position.
     * @param bitCount The number of bits to read
     */
    readVector(minX: number, minY: number, maxX: number, maxY: number, bitCount: number): Vector {
        return {
            x: this.readFloat(minX, maxX, bitCount),
            y: this.readFloat(minY, maxY, bitCount)
        };
    }

    /**
     * Write a position Vector to the stream with the game default max and minimum X and Y.
     * @param vector The Vector to write.
     */
    writePosition(vector: Vector): void {
        this.writePosition2(vector.x, vector.y);
    }

    /**
     * Write a position Vector to the stream with the game default max and minimum X and Y.
     * @param x The x-coordinate of the vector to write
     * @param y The y-coordinate of the vector to write
     */
    writePosition2(x: number, y: number): void {
        this.writeVector2(x, y, 0, 0, GameConstants.maxPosition, GameConstants.maxPosition, 16);
    }

    /**
     * Read a position Vector from stream with the game default max and minimum X and Y.
     * @return the position Vector.
     */
    readPosition(): Vector {
        return this.readVector(0, 0, GameConstants.maxPosition, GameConstants.maxPosition, 16);
    }

    /**
    * Write an unit vector to the stream
    * @param vector The Vector to write.
    * @param bitCount The number of bits to write.
    */
    writeUnit(vector: Vector, bitCount: number): void {
        this.writeVector(vector, -1, -1, 1, 1, bitCount);
    }

    /**
     * Read an unit vector from the stream
     * @param bitCount The number of bits to read.
     * @return the unit Vector.
     */
    readUnit(bitCount: number): Vector {
        return this.readVector(-1, -1, 1, 1, bitCount);
    }
}

export abstract class Packet {
    abstract readonly type: PacketType;

    abstract readonly allocBytes: number;

    stream!: GameBitStream;

    serialize(): void {
        this.stream = GameBitStream.alloc(this.allocBytes);
        this.stream.writeBits(this.type, NetConstants.packetBits);
    }
    abstract deserialize(stream: GameBitStream): void;
}
