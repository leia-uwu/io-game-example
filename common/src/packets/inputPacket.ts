import { type GameBitStream, Packet, PacketType } from "../net";
import { Vec2 } from "../utils/vector";

export class InputPacket extends Packet {
    readonly type = PacketType.Input;
    readonly allocBytes = 32;

    direction = Vec2.new(0, 0);
    mouseDown = false;

    override serialize(stream: GameBitStream): void {
        stream.writeBoolean(this.mouseDown);
        stream.writeUnit(this.direction, 16);
    }

    override deserialize(stream: GameBitStream): void {
        this.mouseDown = stream.readBoolean();
        this.direction = stream.readUnit(16);
    }
}
