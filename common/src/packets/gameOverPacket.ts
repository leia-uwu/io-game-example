import { type GameBitStream, Packet, ServerToClientPackets } from "../net";

export class GameOverPacket extends Packet {
    kills = 0;

    override serialize(stream: GameBitStream): void {
        stream.writeUint8(this.kills);
    }

    override deserialize(stream: GameBitStream): void {
        this.kills = stream.readUint8();
    }
}

ServerToClientPackets.register(GameOverPacket);
