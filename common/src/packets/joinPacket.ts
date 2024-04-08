import { GameConstants } from "../constants";
import { type GameBitStream, Packet, ClientToServerPackets } from "../net";

export class JoinPacket extends Packet {
    name = "";

    override serialize(stream: GameBitStream): void {
        stream.writeASCIIString(this.name, GameConstants.player.nameMaxLength);
    }

    override deserialize(stream: GameBitStream): void {
        this.name = stream.readASCIIString(GameConstants.player.nameMaxLength);
    }
}

ClientToServerPackets.register(JoinPacket);
