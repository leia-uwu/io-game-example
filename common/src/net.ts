import { BitStream } from "bit-buffer";
import { type Vector } from "./utils/vector";
import { GameConstants } from "./constants";
import { MathUtils } from "./utils/math";

export enum PacketType {
    Join,
    Update,
    Input
}

export enum ObjectType {
    Player
}

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
        if (bitCount <= 0 || bitCount > 31) {
            throw new Error(`BitCount ${bitCount} is out of range {1, 31}`);
        }
        if (value < min || value > max) {
            throw new Error(`Value ${value} out of range [${min}, ${max}]`);
        }
        const range = (1 << bitCount) - 1;
        const v = (MathUtils.clamp(value, min, max) - min) / (max - min) * range + 0.5;
        this.writeBits(v, bitCount);
    }

    /**
     * Read a floating point number from the stream.
     * @param min The minimum number.
     * @param max The maximum number.
     * @param bitCount The number of bits to read
     * @return The floating point number.
     */
    readFloat(min: number, max: number, bitCount: number): number {
        if (bitCount <= 0 || bitCount > 31) {
            throw new Error(`BitCount ${bitCount} out of range {1, 31}`);
        }
        const range = (1 << bitCount) - 1;
        return min + this.readBits(bitCount) / range * (max - min);
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

    static unitEps = 1.0001;
    /**
    * Write an unit vector to the stream
    * @param vector The Vector to write.
    * @param bitCount The number of bits to write.
    */
    writeUnit(vector: Vector, bitCount: number): void {
        this.writeVector(
            vector,
            -GameBitStream.unitEps,
            -GameBitStream.unitEps,
            GameBitStream.unitEps,
            GameBitStream.unitEps,
            bitCount
        );
    }

    /**
     * Read an unit vector from the stream
     * @param bitCount The number of bits to read.
     * @return the unit Vector.
     */
    readUnit(bitCount: number): Vector {
        return this.readVector(
            -GameBitStream.unitEps,
            -GameBitStream.unitEps,
            GameBitStream.unitEps,
            GameBitStream.unitEps,
            bitCount
        );
    }
}

export abstract class Packet {
    abstract readonly type: PacketType;

    abstract readonly allocBytes: number;

    stream!: GameBitStream;

    serialize(): void {
        this.stream = GameBitStream.alloc(this.allocBytes);
        this.stream.writeUint8(this.type);
    }

    getBuffer(): ArrayBuffer {
        return this.stream.buffer.slice(0, this.stream.index);
    }
    abstract deserialize(stream: GameBitStream): void;
}
