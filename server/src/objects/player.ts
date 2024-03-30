import { type WebSocket } from "uWebSockets.js";
import { GameObject } from "./gameObject";
import { type PlayerData } from "../server";
import { Vec2, type Vector } from "../../../common/src/utils/vector";
import { type GameBitStream, ObjectType, PacketType, type Packet } from "../../../common/src/net";
import { type Game } from "../game";
import { UpdatePacket, type ObjectsNetData } from "../../../common/src/packets/updatePacket";
import { CircleHitbox, RectHitbox } from "../../../common/src/utils/hitbox";
import { Random } from "../../../common/src/utils/random";
import { MathUtils } from "../../../common/src/utils/math";
import { InputPacket } from "../../../common/src/packets/inputPacket";
import { JoinPacket } from "../../../common/src/packets/joinPacket";
import { GameConstants } from "../../../common/src/constants";

export class Player extends GameObject<ObjectType.Player> {
    readonly type = ObjectType.Player;
    socket: WebSocket<PlayerData>;
    name = "";
    direction = Vec2.new(0, 0);
    mouseDown = false;

    hitbox = new CircleHitbox(1.5);

    health = 100;

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
    }

    sendPacket(packet: Packet): void {
        packet.serialize();
        this.socket.send(packet.getBuffer(), true, false);
    }

    tick(): void {
        if (this.mouseDown) {
            this.position = Vec2.sub(this.position, this.direction);
        }
        this.setDirty();

        for (const player of this.game.players) {
            if (player !== this) {
                this.hitbox.resolveCollision(player.hitbox);
            }
        }
        this.position.x = MathUtils.clamp(this.position.x, 0, this.game.width);
        this.position.y = MathUtils.clamp(this.position.y, 0, this.game.height);

        this.game.grid.updateObject(this);
    }

    sendPackets() {
        // calculate visible, deleted, and dirty objects
        // and send them to the client
        const updatePacket = new UpdatePacket();

        const radius = this.zoom + 10;
        const rect = RectHitbox.fromCircle(radius, this.position);
        const newVisibleObjects = this.game.grid.intersectHitbox(rect);

        for (const obj of this.visibleObjects) {
            if (!newVisibleObjects.has(obj)) {
                updatePacket.deletedObjects.push(obj.id);
            }
        }

        for (const obj of newVisibleObjects) {
            if (!this.visibleObjects.has(obj)) {
                updatePacket.serverFullObjs.push(obj);
            }
        }

        for (const obj of this.game.fullDirtyObjects) {
            if (this.visibleObjects.has(obj) && !updatePacket.serverFullObjs.includes(obj)) {
                updatePacket.serverFullObjs.push(obj);
            }
        }

        for (const obj of this.game.dirtyObjects) {
            if (this.visibleObjects.has(obj) && !updatePacket.serverFullObjs.includes(obj)) {
                updatePacket.serverPartialObjs.push(obj);
            }
        }
        this.visibleObjects = newVisibleObjects;

        updatePacket.playerData = this;
        updatePacket.playerDataDirty = this.dirty;

        updatePacket.newPlayers = this.firstPacket ? [...this.game.players] : this.game.newPlayers;
        updatePacket.deletedPlayers = this.game.deletedPlayers;

        updatePacket.map.width = this.game.width;
        updatePacket.map.height = this.game.height;
        updatePacket.mapDirty = this.firstPacket ?? this.game.mapDirty;

        this.sendPacket(updatePacket);
        this.firstPacket = false;
    }

    processPacket(stream: GameBitStream): void {
        const packetType = stream.readUint8();
        switch (packetType) {
            case PacketType.Join: {
                const packet = new JoinPacket();
                packet.deserialize(stream);
                this.name = packet.name.trim();
                if (!this.name) this.name = GameConstants.defaultName;
                this.socket.getUserData().joined = true;
                this.game.players.add(this);
                this.game.grid.addObject(this);

                console.log(`"${this.name}" joined the game`);
                break;
            }
            case PacketType.Input: {
                const packet = new InputPacket();
                packet.deserialize(stream);
                this.direction = packet.direction;
                this.mouseDown = packet.mouseDown;
                this.setDirty();
                break;
            }
        }
    }

    get data(): Required<ObjectsNetData[ObjectType.Player]> {
        return {
            position: this.position,
            direction: this.direction,
            full: {
                health: this.health
            }
        };
    }
}
