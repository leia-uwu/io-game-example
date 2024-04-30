import { type GameBitStream, type Packet } from "../net";

export class GameOverPacket implements Packet {
    kills = 0;

    serialize(stream: GameBitStream): void {
        stream.writeUint8(this.kills);
    }

    deserialize(stream: GameBitStream): void {
        this.kills = stream.readUint8();
    }
}
