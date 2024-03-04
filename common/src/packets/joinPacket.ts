import { GameConstants } from "../constants";
import { type GameBitStream, Packet, PacketType } from "../net";
import { Vec2, type Vector } from "../utils/vector";

export class JoinPacket extends Packet {
    readonly type = PacketType.Join;
    readonly allocBytes = 32;

    name = "";

    override serialize(): void {
        super.serialize();
        const stream = this.stream;
        stream.writeASCIIString(this.name, GameConstants.nameMaxLength)
    }

    override deserialize(stream: GameBitStream): void {
        this.name = stream.readASCIIString(GameConstants.nameMaxLength)
    }
}
