import { type GameBitStream, type Packet } from "../net";
import { Vec2 } from "../utils/vector";

export class InputPacket implements Packet {
    direction = Vec2.new(0, 0);
    mouseDown = false;
    shoot = false;

    serialize(stream: GameBitStream): void {
        stream.writeBoolean(this.mouseDown);
        stream.writeBoolean(this.shoot);
        stream.writeUnit(this.direction, 16);
    }

    deserialize(stream: GameBitStream): void {
        this.mouseDown = stream.readBoolean();
        this.shoot = stream.readBoolean();
        this.direction = stream.readUnit(16);
    }
}
