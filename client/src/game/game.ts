import { GameBitStream, EntityType, type Packet, PacketType, PacketStream } from "../../../common/src/net";
import { type Application, Assets, Graphics } from "pixi.js";
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
import { type App } from "../main";
import { GameOverPacket } from "../../../common/src/packets/gameOverPacket";
import { GameUi } from "./gameUi";

export class Game {
    app: App;
    socket?: WebSocket;
    pixi: Application;
    ui = new GameUi(this);

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

    constructor(app: App) {
        this.app = app;
        this.pixi = app.pixi;
        this.ui.setupUi();
    }

    init(): void {
        this.pixi.ticker.add(this.render.bind(this));
        this.pixi.renderer.on("resize", this.resize.bind(this));
        this.pixi.stage.addChild(this.camera.container);
        this.camera.resize();
    }

    async loadAssets(): Promise<void> {
        await Assets.load("./game/player.svg");
        await Assets.load("./game/projectile.svg");
    }

    connect(address: string): void {
        this.app.uiManager.playButton.disabled = true;

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
                case PacketType.GameOver: {
                    const packet = new GameOverPacket();
                    packet.deserialize(stream);
                    this.ui.showGameOverScreen(packet);
                }
            }

            stream.readAlignToNextByte();
        }
    }

    startGame(): void {
        if (this.running) return;
        const ui = this.app.uiManager;
        ui.gameDiv.style.display = "";
        ui.homeDiv.style.display = "none";
        this.running = true;
    }

    endGame(): void {
        if (this.socket?.readyState !== this.socket?.CLOSED) this.socket?.close();
        const ui = this.app.uiManager;
        ui.gameDiv.style.display = "none";
        ui.homeDiv.style.display = "";
        ui.playButton.disabled = false;
        this.running = false;

        // reset stuff
        for (const entity of this.entities) {
            entity.destroy();
        }
        this.entities.clear();
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
