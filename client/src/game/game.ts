import { GameBitStream, EntityType, type Packet, PacketType, PacketStream } from "../../../common/src/net";
import { Application, Assets, Graphics } from "pixi.js";
import { getElem } from "../utils";
import { UpdatePacket } from "../../../common/src/packets/updatePacket";
import { EntityPool } from "../../../common/src/utils/entityPool";
import { type ClientEntity } from "./entities/entity";
import { Player } from "./entities/player";
import { Camera } from "./camera";
import { InputManager } from "./inputManager";
import { InputPacket } from "../../../common/src/packets/inputPacket";
import { JoinPacket } from "../../../common/src/packets/joinPacket";
import { Projectile } from "./entities/projectile";

export class Game {
    socket?: WebSocket;

    running = false;

    entities = new EntityPool<ClientEntity>();

    activePlayerID = -1;

    get activePlayer(): Player | undefined {
        return this.entities.get(this.activePlayerID) as Player;
    }

    playerNames = new Map<number, string>();

    camera = new Camera(this);
    inputManager = new InputManager(this);

    mapGraphics = new Graphics({
        zIndex: -99
    });

    pixi = new Application();

    constructor() {
        void (async() => {
            await this.pixi.init({
                canvas: getElem<HTMLCanvasElement>("#game-canvas"),
                resizeTo: window,
                resolution: window.devicePixelRatio ?? 1,
                antialias: true,
                preference: "webgl",
                background: 0x000000
            });

            this.pixi.ticker.add(this.render.bind(this));
            this.pixi.renderer.on("resize", this.resize.bind(this));
            this.pixi.stage.addChild(this.camera.container);
            this.camera.resize();

            this.pixi.canvas.addEventListener("contextmenu", (e) => {
                e.preventDefault();
                e.stopImmediatePropagation();
                e.stopPropagation();
            });

            // TODO: assets loader
            await Assets.load("./game/player.svg");
            await Assets.load("./game/projectile.svg");

            getElem<HTMLButtonElement>("#play-btn").disabled = false;
        })();
    }

    connect(address: string): void {
        this.socket = new WebSocket(address);

        this.socket.binaryType = "arraybuffer";

        this.socket.onmessage = (msg) => {
            this.onMessage(msg.data);
        };

        this.socket.onopen = () => {
            const joinPacket = new JoinPacket();
            joinPacket.name = (getElem<HTMLInputElement>("#name-input")).value;
            this.sendPacket(joinPacket);
        };

        this.socket.onclose = () => {
            this.endGame();
        };

        this.socket.onerror = (error) => {
            console.error(error);
            this.endGame();
        };
    }

    onMessage(data: ArrayBuffer): void {
        const packetStream = new PacketStream(data);
        while (true) {
            const packetType = packetStream.readPacketType();
            if (packetType === PacketType.None) break;

            const stream = packetStream.stream;
            switch (packetType) {
                case PacketType.Update: {
                    const packet = new UpdatePacket();
                    packet.deserialize(stream);
                    this.updateFromPacket(packet);
                    this.startGame();
                    break;
                }
            }

            stream.readAlignToNextByte();
        }
    }

    startGame(): void {
        if (this.running) return;
        this.running = true;
        getElem("#game").style.display = "";
        getElem("#home").style.display = "none";
    }

    endGame(): void {
        getElem("#game").style.display = "none";
        getElem("#home").style.display = "";
        this.running = false;

        // reset stuff
        this.camera.clear();
    }

    lastUpdateTime = 0;
    serverDt = 0;

    /**
     * Process a game update packet
     */
    updateFromPacket(packet: UpdatePacket): void {
        this.serverDt = (Date.now() - this.lastUpdateTime) / 1000;
        this.lastUpdateTime = Date.now();

        if (packet.playerDataDirty.id) {
            this.activePlayerID = packet.playerData.id;
        }

        if (packet.playerDataDirty.zoom) {
            this.camera.zoom = packet.playerData.zoom;
        }

        for (const id of packet.deletedEntities) {
            this.entities.get(id)?.destroy();
            this.entities.deleteByID(id);
        }

        for (const newPlayer of packet.newPlayers) {
            this.playerNames.set(newPlayer.id, newPlayer.name);
        }
        for (const id of packet.deletedPlayers) {
            this.playerNames.delete(id);
        }

        for (const entityData of packet.fullEntities) {
            let entity = this.entities.get(entityData.id);
            let isNew = false;
            if (!entity) {
                isNew = true;
                switch (entityData.type) {
                    case EntityType.Player: {
                        entity = new Player(this, entityData.id);
                        break;
                    }
                    case EntityType.Projectile: {
                        entity = new Projectile(this, entityData.id);
                    }
                }
                this.entities.add(entity);
            }
            entity.updateFromData(entityData.data, isNew);
        }

        for (const entityPartialData of packet.partialEntities) {
            const entity = this.entities.get(entityPartialData.id);

            if (!entity) {
                console.warn(`Unknown partial dirty entity with ID ${entityPartialData.id}`);
                continue;
            }
            entity.updateFromData(entityPartialData.data, false);
        }

        if (packet.mapDirty) {
            const ctx = this.mapGraphics;
            ctx.clear();
            this.camera.addObject(ctx);

            const gridSize = 16 * Camera.scale;
            const gridWidth = packet.map.width * Camera.scale;
            const gridHeight = packet.map.height * Camera.scale;
            for (let x = 0; x <= gridWidth; x += gridSize) {
                ctx.moveTo(x, 0);
                ctx.lineTo(x, gridHeight);
            }

            for (let y = 0; y <= gridHeight; y += gridSize) {
                ctx.moveTo(0, y);
                ctx.lineTo(gridWidth, y);
            }

            ctx.stroke({
                color: 0xffffff,
                alpha: 0.1,
                width: 2
            });
        }
    }

    sendPacket(packet: Packet) {
        if (this.socket && this.socket.readyState === this.socket.OPEN) {
            const packetStream = new PacketStream(GameBitStream.alloc(128));
            packetStream.serializePacket(packet);
            this.socket.send(packetStream.getBuffer());
        }
    }

    resize(): void {
        this.camera.resize();
    }

    dt = Date.now();

    render(): void {
        if (!this.running) return;

        const dt = (Date.now() - this.dt) / 1000;
        this.dt = Date.now();

        for (const entity of this.entities) {
            entity.render(dt);
        }

        this.camera.render();

        const inputPacket = new InputPacket();
        inputPacket.mouseDown = this.inputManager.isInputDown("Mouse0");
        inputPacket.shoot = this.inputManager.isInputDown("Mouse2");
        inputPacket.direction = this.inputManager.mouseDir;
        this.sendPacket(inputPacket);
    }
}
