import { type GameBitStream, Packet, ClientToServerPackets } from "../net";
import { Vec2 } from "../utils/vector";

export class InputPacket extends Packet {
    direction = Vec2.new(0, 0);
    mouseDown = false;
    shoot = false;

    override serialize(stream: GameBitStream): void {
        stream.writeBoolean(this.mouseDown);
        stream.writeBoolean(this.shoot);
        stream.writeUnit(this.direction, 16);
    }

    override deserialize(stream: GameBitStream): void {
        this.mouseDown = stream.readBoolean();
        this.shoot = stream.readBoolean();
        this.direction = stream.readUnit(16);
    }
}

ClientToServerPackets.register(InputPacket);
