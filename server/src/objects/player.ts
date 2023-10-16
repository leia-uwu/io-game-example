import { type WebSocket } from "uWebSockets.js";
import { GameObject } from "./gameObject";
import { type PlayerData } from "../server";
import { Vec2, type Vector } from "../../../common/src/utils/vector";
import { ObjectType, type Packet } from "../../../common/src/net";
import { type Game } from "../game";
import { type ObjectsNetData } from "../../../common/src/packets/updatePacket";
import { CircleHitbox, RectHitbox } from "../../../common/src/utils/hitbox";
import { ObjectPool } from "../../../common/src/utils/objectPool";
import { Random } from "../../../common/src/utils/random";

export class Player extends GameObject<ObjectType.Player> {
    readonly type = ObjectType.Player;
    socket: WebSocket<PlayerData>;
    name: string;
    direction = Vec2.new(0, 0);

    hitbox = new CircleHitbox(5);

    /**
    * Objects the player can see
    */
    visibleObjects = new ObjectPool<GameObject>();
    /**
     * Objects the player can see with a 1x scope
     */
    nearObjects = new ObjectPool<GameObject>();
    /**
     * Objects that need to be partially updated
     */
    partialDirtyObjects = new ObjectPool<GameObject>();
    /**
     * Objects that need to be fully updated
     */
    fullDirtyObjects = new ObjectPool<GameObject>();
    /**
     * Objects that need to be deleted
     */
    deletedObjects = new Set<number>();
    /**
     * Ticks since last visible objects update
     */
    ticksSinceLastUpdate = 0;

    // what needs to be sent again to the client
    readonly dirty = {
        id: true,
        zoom: true
    }

    private _zoom = 0;
    xCullDist!: number;
    yCullDist!: number;
    get zoom(): number {
        return this._zoom;
    }

    set zoom(zoom: number) {
        if (this._zoom === zoom) return;
        this._zoom = zoom;
        this.xCullDist = this._zoom * 96;
        this.yCullDist = this._zoom * 64;
        this.dirty.zoom = true;
        this.updateVisibleObjects();
    }

    get position(): Vector {
        return this.hitbox.position;
    }

    set position(pos: Vector) {
        this.hitbox.position = pos;
    }

    constructor(game: Game, socket: WebSocket<PlayerData>) {
        const pos = Random.vector(0, 10, 0, 10);
        super(game, pos);
        this.position = pos;

        this.socket = socket;

        this.name = socket.getUserData().name;

        this.zoom = 10;

        socket.getUserData().gameObject = this;
    }

    sendPacket(packet: Packet): void {
        packet.serialize();
        const stream = packet.stream;
        const buffer = stream.buffer.slice(0, Math.ceil(stream.index / 8));
        this.socket.send(buffer, true, true);
    }

    tick(): void {

    }

    updateVisibleObjects(): void {
        this.ticksSinceLastUpdate = 0;
        const minX = this.position.x - this.xCullDist;
        const minY = this.position.y - this.yCullDist;
        const maxX = this.position.x + this.xCullDist;
        const maxY = this.position.y + this.yCullDist;
        const rect = new RectHitbox(Vec2.new(minX, minY), Vec2.new(maxX, maxY));

        const newVisibleObjects = this.game.grid.intersectsHitbox(rect);

        for (const object of this.visibleObjects) {
            if (!newVisibleObjects.has(object)) {
                this.visibleObjects.delete(object);
                this.deletedObjects.add(object.id);
            }
        }

        for (const object of newVisibleObjects) {
            if (!this.visibleObjects.has(object)) {
                this.visibleObjects.add(object);
                this.fullDirtyObjects.add(object);
            }
        }
    }

    get data(): Required<ObjectsNetData[ObjectType.Player]> {
        return {
            partial: {
                position: this.position,
                direction: this.direction,

            },
            full: {
                name: this.name
            }
        };
    }
}
