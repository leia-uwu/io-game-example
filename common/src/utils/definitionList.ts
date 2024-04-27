import { type GameBitStream } from "../net";

export class DefinitionList<T extends Record<string, object>> {
    private readonly _typeToId = {} as unknown as Record<keyof T, number>;
    private readonly _idToType: Record<number, keyof T> = {};
    private _nextId = 0;
    private readonly _maxId: number;
    readonly bits: number;

    constructor(public definitions: T) {
        const keys = Object.keys(definitions);

        // Type 0 is reserved for sending optional types to the stream
        this._addType("");
        // + 1 for the the above
        this._maxId = keys.length + 1;
        this.bits = Math.ceil(Math.log2(this._maxId));

        for (let i = 0; i < keys.length; i++) {
            this._addType(keys[i]);
        }
    }

    private _addType(type: keyof T) {
        this._idToType[this._nextId] = type;
        this._typeToId[type] = this._nextId;
        this._nextId++;
    }

    typeToId(type: keyof T) {
        const id = this._typeToId[type];
        if (id === undefined) {
            throw new Error(`Invalid type: ${type.toString()}`);
        }
        return id;
    }

    idToType(id: number): keyof T {
        const type = this._idToType[id];
        if (type === undefined) {
            console.error(`Invalid id ${id}, max: ${this._maxId}`);
        }
        return type;
    }

    /**
     * Get a definition from a type
     */
    typeToDef(type: keyof T | string): T[keyof T] {
        const def = this.definitions[type];
        if (def === undefined) {
            throw new Error(`Invalid type: ${type.toString()}`);
        }
        return def;
    }

    /**
     * Write a definition to a stream
     */
    write(stream: GameBitStream, type: keyof T) {
        stream.writeBits(this.typeToId(type), this.bits);
    }

    /**
     * Read a definition from the stream
     */
    read(stream: GameBitStream): keyof T {
        return this.idToType(stream.readBits(this.bits));
    }

    [Symbol.iterator]() {
        return (Object.keys(this.definitions) as Array<keyof T>)[Symbol.iterator]();
    }
}
