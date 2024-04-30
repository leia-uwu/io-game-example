import { GameConstants } from "../constants";
import { type ClassDefKey, ClassDefs } from "../defs/classDefs";
import { type GameBitStream, type Packet } from "../net";

export class JoinPacket implements Packet {
    name = "";
    class: ClassDefKey = "main";

    serialize(stream: GameBitStream): void {
        stream.writeASCIIString(this.name, GameConstants.player.nameMaxLength);
        ClassDefs.write(stream, this.class);
    }

    deserialize(stream: GameBitStream): void {
        this.name = stream.readASCIIString(GameConstants.player.nameMaxLength);
        this.class = ClassDefs.read(stream);
    }
}
