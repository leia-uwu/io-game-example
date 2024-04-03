import { type GameBitStream, Packet, PacketType } from "../net";

export class GameOverPacket extends Packet {
    readonly type = PacketType.GameOver;

    kills = 0;

    override serialize(stream: GameBitStream): void {
        stream.writeUint8(this.kills);
    }

    override deserialize(stream: GameBitStream): void {
        this.kills = stream.readUint8();
    }
}
