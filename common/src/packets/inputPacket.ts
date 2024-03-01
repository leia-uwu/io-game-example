import { type GameBitStream, Packet, PacketType } from "../net";
import { type Vector } from "../utils/vector";

export class InputPacket extends Packet {
    readonly type = PacketType.Input;
    readonly allocBytes = 32;

    direction!: Vector;

    override serialize(): void {
        super.serialize();
        this.stream.writeUnit(this.direction, 16);
    }

    override deserialize(stream: GameBitStream): void {
        this.direction = stream.readUnit(16);
    }
}
