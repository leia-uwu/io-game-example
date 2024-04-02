import { GameConstants } from "../constants";
import { type GameBitStream, Packet, PacketType } from "../net";

export class JoinPacket extends Packet {
    readonly type = PacketType.Join;

    name = "";

    override serialize(stream: GameBitStream): void {
        stream.writeASCIIString(this.name, GameConstants.player.nameMaxLength);
    }

    override deserialize(stream: GameBitStream): void {
        this.name = stream.readASCIIString(GameConstants.player.nameMaxLength);
    }
}
