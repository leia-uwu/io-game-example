import { type WebSocket } from "uWebSockets.js";
import { ServerEntity } from "./entity";
import { type PlayerData } from "../server";
import { Vec2, type Vector } from "../../../common/src/utils/vector";
import { GameBitStream, EntityType, PacketType, type Packet, PacketStream } from "../../../common/src/net";
import { type Game } from "../game";
import { UpdatePacket, type EntitiesNetData } from "../../../common/src/packets/updatePacket";
import { CircleHitbox, RectHitbox } from "../../../common/src/utils/hitbox";
import { Random } from "../../../common/src/utils/random";
import { MathUtils } from "../../../common/src/utils/math";
import { InputPacket } from "../../../common/src/packets/inputPacket";
import { JoinPacket } from "../../../common/src/packets/joinPacket";
import { GameConstants } from "../../../common/src/constants";

export class Player extends ServerEntity<EntityType.Player> {
    readonly type = EntityType.Player;
    socket: WebSocket<PlayerData>;
    name = "";
    direction = Vec2.new(0, 0);
    mouseDown = false;

    hitbox = new CircleHitbox(1.5);

    health = 100;

    firstPacket = true;

    /**
    * Entities the player can see
    */
    visibleEntities = new Set<ServerEntity>();

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

        this.game.grid.updateEntity(this);
    }

    sendPackets() {
        // calculate visible, deleted, and dirty entities
        // and send them to the client
        const updatePacket = new UpdatePacket();

        const radius = this.zoom + 10;
        const rect = RectHitbox.fromCircle(radius, this.position);
        const newVisibleEntities = this.game.grid.intersectHitbox(rect);

        for (const entity of this.visibleEntities) {
            if (!newVisibleEntities.has(entity)) {
                updatePacket.deletedEntities.push(entity.id);
            }
        }

        for (const entity of newVisibleEntities) {
            if (!this.visibleEntities.has(entity)) {
                updatePacket.serverFullEntities.push(entity);
            }
        }

        for (const entity of this.game.fullDirtyEntities) {
            if (this.visibleEntities.has(entity) && !updatePacket.serverFullEntities.includes(entity)) {
                updatePacket.serverFullEntities.push(entity);
            }
        }

        for (const entity of this.game.partialDirtyEntities) {
            if (this.visibleEntities.has(entity) && !updatePacket.serverFullEntities.includes(entity)) {
                updatePacket.serverPartialEntities.push(entity);
            }
        }
        this.visibleEntities = newVisibleEntities;

        updatePacket.playerData = this;
        updatePacket.playerDataDirty = this.dirty;

        updatePacket.newPlayers = this.firstPacket ? [...this.game.players] : this.game.newPlayers;
        updatePacket.deletedPlayers = this.game.deletedPlayers;

        updatePacket.map.width = this.game.width;
        updatePacket.map.height = this.game.height;
        updatePacket.mapDirty = this.firstPacket ?? this.game.mapDirty;

        this.firstPacket = false;

        this.packetStream.stream.index = 0;

        this.packetStream.serializePacket(updatePacket);

        for (const packet of this._packetsToSend) {
            this.packetStream.serializePacket(packet);
        }
        const buffer = this.packetStream.getBuffer();
        this.sendData(buffer);
    }

    packetStream = new PacketStream(GameBitStream.alloc(1 << 16));
    private readonly _packetsToSend: Packet[] = [];

    sendPacket(packet: Packet): void {
        this._packetsToSend.push(packet);
    }

    sendData(data: ArrayBuffer): void {
        try {
            this.socket.send(data, true, false);
        } catch (error) {
            console.error("Error sending data:", error);
        }
    }

    processMessage(message: ArrayBuffer): void {
        const packetStream = new PacketStream(message);
        const stream = packetStream.stream;
        const packetType = packetStream.readPacketType();

        switch (packetType) {
            case PacketType.Join: {
                const packet = new JoinPacket();
                packet.deserialize(stream);
                this.name = packet.name.trim();
                if (!this.name) this.name = GameConstants.defaultName;
                this.socket.getUserData().joined = true;
                this.game.players.add(this);
                this.game.grid.addEntity(this);

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

    get data(): Required<EntitiesNetData[EntityType.Player]> {
        return {
            position: this.position,
            direction: this.direction,
            full: {
                health: this.health
            }
        };
    }
}
