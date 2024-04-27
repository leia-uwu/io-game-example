import { GameBitStream, EntityType, type Packet, PacketStream } from "../../../common/src/net";
import { type Application, Assets, Graphics, Color } from "pixi.js";
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
import { Asteroid } from "./entities/asteroid";
import { ParticleManager } from "./particle";
import { Random } from "../../../common/src/utils/random";
import { EasinFunctions } from "../../../common/src/utils/math";
import { type ClassDefKey } from "../../../common/src/defs/classDefs";
import { AudioManager } from "./audioManager";

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
    audioManager = new AudioManager(this);
    particleManager = new ParticleManager(this);

    mapGraphics = new Graphics({
        zIndex: -99
    });

    constructor(app: App) {
        this.app = app;
        this.pixi = app.pixi;
        this.ui.setupUi();
    }

    async init(): Promise<void> {
        await this.loadAssets();
        this.pixi.ticker.add(this.render.bind(this));
        this.pixi.renderer.on("resize", this.resize.bind(this));
        this.pixi.stage.addChild(this.camera.container);
        this.camera.resize();
    }

    async loadAssets(): Promise<void> {
        // imports all svg assets from public dir
        // and sets an alias with the file name
        // so for example you can just do:
        // new Sprite("player.svg")
        // instead of:
        // new Sprite("/img/player.svg")

        const promises: Array<ReturnType<typeof Assets["load"]>> = [];
        const imgs = import.meta.glob("/public/img/**/*.svg");

        for (const file in imgs) {
            const path = file.split("/");
            const name = path[path.length - 1];

            promises.push(Assets.load({
                alias: name,
                src: file.replace("/public", "")
            }));
        }

        await Promise.all(promises);
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
            joinPacket.name = this.app.uiManager.nameInput.value;
            joinPacket.class = this.app.uiManager.classSelect.value as ClassDefKey;
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
            const packet = packetStream.deserializeServerPacket();
            if (packet === undefined) break;

            switch (true) {
                case packet instanceof UpdatePacket: {
                    this.updateFromPacket(packet);
                    this.startGame();
                    break;
                }
                case packet instanceof GameOverPacket: {
                    this.ui.showGameOverScreen(packet);
                }
            }
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

    static typeToEntity = {
        [EntityType.Player]: Player,
        [EntityType.Projectile]: Projectile,
        [EntityType.Asteroid]: Asteroid
    };

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
                entity = new Game.typeToEntity[entityData.type](this, entityData.id);
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

        for (const explosion of packet.explosions) {
            this.particleManager.spawnParticles(explosion.radius * 10, () => {
                return {
                    position: explosion.position,
                    lifeTime: { min: 0.5, max: 1.5 },
                    blendMode: "add",
                    tint: new Color(`hsl(${Random.int(0, 25)}, 100%, 50%)`),
                    sprite: "particle.svg",
                    rotation: { value: 0 },
                    alpha: { start: 1, end: 0, easing: EasinFunctions.sineIn },
                    scale: { start: 2, end: 0 },
                    speed: { min: 5, max: 10 },
                    direction: { value: Random.float(-Math.PI, Math.PI) }
                };
            });
        }

        for (const shot of packet.shots) {
            this.audioManager.play("shot_01.mp3", {
                position: shot,
                maxRange: 96
            });
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
            packetStream.serializeClientPacket(packet);
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
        this.particleManager.render(dt);

        if (this.activePlayer) {
            this.camera.position = this.activePlayer.container.position;
        }
        this.audioManager.update();
        this.camera.render();

        const inputPacket = new InputPacket();
        inputPacket.mouseDown = this.inputManager.isInputDown("Mouse0");
        inputPacket.shoot = this.inputManager.isInputDown("Mouse2");
        inputPacket.direction = this.inputManager.mouseDir;
        this.sendPacket(inputPacket);
    }
}
