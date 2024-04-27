import { GameConstants } from "../constants";
import { type ClassDefKey, ClassDefs } from "../defs/classDefs";
import { type GameBitStream, Packet, ClientToServerPackets } from "../net";

export class JoinPacket extends Packet {
    name = "";
    class: ClassDefKey = "main";

    override serialize(stream: GameBitStream): void {
        stream.writeASCIIString(this.name, GameConstants.player.nameMaxLength);
        ClassDefs.write(stream, this.class);
    }

    override deserialize(stream: GameBitStream): void {
        this.name = stream.readASCIIString(GameConstants.player.nameMaxLength);
        this.class = ClassDefs.read(stream);
    }
}

ClientToServerPackets.register(JoinPacket);
