import { BitStream } from "bit-buffer";
import { type Vector } from "./utils/vector";
import { GameConstants } from "./constants";
import { MathUtils } from "./utils/math";

export enum PacketType {
    None,
    Join,
    Update,
    Input,
    GameOver
}

export enum EntityType {
    Player,
    Projectile
}

export class GameBitStream extends BitStream {
    static alloc(size: number): GameBitStream {
        return new GameBitStream(new ArrayBuffer(size));
    }

    /**
     * Write a floating point number to the stream
     * @param value The number
     * @param min The minimum number
     * @param max The maximum number
     * @param bitCount The number of bits to write
     */
    writeFloat(value: number, min: number, max: number, bitCount: number): void {
        if (bitCount < 0 || bitCount >= 31) {
            throw new Error(`Invalid bit count ${bitCount}`);
        }
        if (value > max || value < min) {
            throw new Error(`Value out of range: ${value}, range: ${min}, ${max}`);
        }
        const range = (1 << bitCount) - 1;
        const clamped = MathUtils.clamp(value, min, max);
        this.writeBits(((clamped - min) / (max - min)) * range + 0.5, bitCount);
    }

    /**
     * Read a floating point number from the stream
     * @param min The minimum number
     * @param max The maximum number
     * @param bitCount The number of bits to read
     * @return The floating point number
     */
    readFloat(min: number, max: number, bitCount: number): number {
        if (bitCount < 0 || bitCount >= 31) {
            throw new Error(`Invalid bit count ${bitCount}`);
        }
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

    /**
     * Write an array to the stream
     * @param arr An array containing the items to serialize
     * @param serializeFn The function to serialize each iterator item
     * @param size The iterator size (eg. array.length or set.size)
     */
    writeArray<T>(arr: T[], bits: number, serializeFn: (item: T) => void): void {
        if (bits < 0 || bits >= 31) {
            throw new Error(`Invalid bit count ${bits}`);
        }

        this.writeBits(arr.length, bits);

        const max = 1 << bits;
        for (let i = 0; i < arr.length; i++) {
            if (i > max) {
                console.warn(`writeArray: iterator overflow: ${bits} bits, ${arr.length} size`);
                break;
            }
            serializeFn(arr[i]);
        }
    }

    /**
     * Read an array from the stream
     * @param arr The array to add the deserialized elements;
     * @param serializeFn The function to de-serialize each iterator item
     * @param bits The maximum length of bits to read
     */
    readArray<T>(arr: T[], bits: number, deserializeFn: () => T): void {
        const size = this.readBits(bits);

        for (let i = 0; i < size; i++) {
            arr.push(deserializeFn());
        }
    }

    // private field L
    declare _view: {
        _view: Uint8Array
    };

    /**
     * Copy bytes from a source stream to this stream
     * !!!NOTE: Both streams index must be byte aligned
     * @param {BitStream} src
     * @param {number} offset
     * @param {number} length
     */
    writeBytes(src: GameBitStream, offset: number, length: number): void {
        if (this.index % 8 !== 0) {
            throw new Error("WriteBytes: stream must be byte aligned");
        }
        const data = new Uint8Array(src._view._view.buffer, offset, length);
        this._view._view.set(data, this.index / 8);
        this.index += length * 8;
    }

    /**
     * Writes a byte alignment to the stream
     * This is to ensure the stream index is a multiple of 8
     */
    writeAlignToNextByte(): void {
        const offset = 8 - this.index % 8;
        if (offset < 8) this.writeBits(0, offset);
    }

    /**
     * Read a byte alignment from the stream
     */
    readAlignToNextByte(): void {
        const offset = 8 - this.index % 8;
        if (offset < 8) this.readBits(offset);
    }
}

export abstract class Packet {
    abstract readonly type: PacketType;

    abstract serialize(stream: GameBitStream): void;
    abstract deserialize(stream: GameBitStream): void;
}

export class PacketStream {
    stream: GameBitStream;

    constructor(source: GameBitStream | ArrayBuffer) {
        if (source instanceof ArrayBuffer) {
            this.stream = new GameBitStream(source);
        } else {
            this.stream = source;
        }
    }

    serializePacket(packet: Packet) {
        this.stream.writeUint8(packet.type);
        packet.serialize(this.stream);
        this.stream.writeAlignToNextByte();
    }

    readPacketType(): PacketType {
        if (this.stream.length - this.stream.byteIndex * 8 >= 1) {
            return this.stream.readUint8();
        }
        return PacketType.None;
    }

    getBuffer(): ArrayBuffer {
        return this.stream.buffer.slice(0, Math.ceil(this.stream.index / 8));
    }
}
