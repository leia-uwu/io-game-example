import { type WebSocket } from "uWebSockets.js";
import { GameObject } from "./gameObject";
import { type PlayerData } from "../server";
import { Vec2, type Vector } from "../../../common/src/utils/vector";
import { ObjectType, type Packet } from "../../../common/src/net";
import { type Game } from "../game";
import { UpdatePacket, type ObjectsNetData } from "../../../common/src/packets/updatePacket";
import { CircleHitbox, RectHitbox } from "../../../common/src/utils/hitbox";
import { Random } from "../../../common/src/utils/random";
import { MathUtils } from "../../../common/src/utils/math";

export class Player extends GameObject<ObjectType.Player> {
    readonly type = ObjectType.Player;
    socket: WebSocket<PlayerData>;
    name: string;
    direction = Vec2.new(0, 0);

    hitbox = new CircleHitbox(1.5);

    firstPacket = true;

    /**
    * Objects the player can see
    */
    visibleObjects = new Set<GameObject>();

    // what needs to be sent again to the client
    readonly dirty = {
        id: true,
        zoom: true
    };

    private _zoom = 64;

    get zoom(): number {
        return this._zoom;
    }

    set zoom(zoom: number) {
        if (this._zoom === zoom) return;
        this._zoom = zoom;
        this.dirty.zoom = true;
    }

    get position(): Vector {
        return this.hitbox.position;
    }

    set position(pos: Vector) {
        this.hitbox.position = pos;
        this._position = pos;
    }

    constructor(game: Game, socket: WebSocket<PlayerData>) {
        const pos = Random.vector(0, game.width, 0, game.height);
        super(game, pos);
        this.position = pos;

        this.socket = socket;

        this.name = socket.getUserData().name;

        socket.getUserData().gameObject = this;
    }

    sendPacket(packet: Packet): void {
        packet.serialize();
        const stream = packet.stream;
        const buffer = stream.buffer.slice(0, Math.ceil(stream.index / 8));
        this.socket.send(buffer, true, true);
    }

    tick(): void {
        this.position = Vec2.sub(this.position, this.direction);
        this.position.x = MathUtils.clamp(this.position.x, 0, this.game.width);
        this.position.y = MathUtils.clamp(this.position.y, 0, this.game.height);
        this.setDirty();

        for (const player of this.game.players) {
            if (player !== this) {
                this.hitbox.resolveCollision(player.hitbox);
            }
        }

        this.game.grid.updateObject(this);
    }

    sendPackets() {
        // calculate visible, deleted, and dirty objects
        // and send them to the client
        const updatePacket = new UpdatePacket();

        const radius = this.zoom + 10;
        const rect = RectHitbox.fromCircle(radius, this.position);
        const newVisibleObjects = this.game.grid.intersectHitbox(rect);

        for (const object of this.visibleObjects) {
            if (!newVisibleObjects.has(object)) {
                this.visibleObjects.delete(object);
                updatePacket.deletedObjects.push(object.id);
            }
        }

        for (const object of newVisibleObjects) {
            if (!this.visibleObjects.has(object)) {
                this.visibleObjects.add(object);
                updatePacket.fullObjects.push(object);
            }
        }

        for (const object of this.game.fullDirtyObjects) {
            if (this.visibleObjects.has(object)) {
                updatePacket.fullObjects.push(object);
            }
        }

        for (const object of this.game.dirtyObjects) {
            if (this.visibleObjects.has(object) && !updatePacket.fullObjects.includes(object)) {
                updatePacket.partialObjects.push(object);
            }
        }

        updatePacket.playerData = this;
        updatePacket.playerDataDirty = this.dirty;

        updatePacket.map.width = this.game.width;
        updatePacket.map.height = this.game.height;
        updatePacket.mapDirty = this.firstPacket ?? this.game.mapDirty;

        this.sendPacket(updatePacket);
    }

    get data(): Required<ObjectsNetData[ObjectType.Player]> {
        return {
            partial: {
                position: this.position,
                direction: this.direction

            },
            full: {
                name: this.name
            }
        };
    }
}
