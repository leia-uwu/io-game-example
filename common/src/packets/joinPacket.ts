import { GameConstants } from "../constants";
import { type GameBitStream, Packet, PacketType } from "../net";

export class JoinPacket extends Packet {
    readonly type = PacketType.Join;
    readonly allocBytes = 32;

    name = "";

    override serialize(stream: GameBitStream): void {
        stream.writeASCIIString(this.name, GameConstants.nameMaxLength);
    }

    override deserialize(stream: GameBitStream): void {
        this.name = stream.readASCIIString(GameConstants.nameMaxLength);
    }
}
