import { GameBitStream, NetConstants, ObjectType, type Packet, PacketType } from "../../../common/src/net";
import { Application, Assets, Graphics } from "pixi.js";
import { getElem } from "../utils";
import { UpdatePacket } from "../../../common/src/packets/updatePacket";
import { ObjectPool } from "../../../common/src/utils/objectPool";
import { type GameObject } from "./objects/gameObject";
import { Player } from "./objects/player";
import { Camera } from "./camera";
import { InputManager } from "./inputManager";
import { InputPacket } from "../../../common/src/packets/inputPacket";
import { JoinPacket } from "../../../common/src/packets/joinPacket";

export class Game {
    socket?: WebSocket;

    running = false;

    objects = new ObjectPool<GameObject>();

    activePlayerID = -1;

    get activePlayer(): Player | undefined {
        return this.objects.get(this.activePlayerID) as Player;
    }

    camera = new Camera(this);
    inputManager = new InputManager(this);

    mapGraphics = new Graphics({
        zIndex: -99
    });

    pixi = new Application();

    constructor() {
        void (async() => {
            await this.pixi.init({
                view: getElem("#game-canvas") as HTMLCanvasElement,
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

            await Assets.load("./game/player-blue.svg");
        })();
    }

    connect(address: string): void {
        this.socket = new WebSocket(address);

        this.socket.binaryType = "arraybuffer";

        this.socket.onmessage = (msg) => {
            const data = msg.data as ArrayBuffer;
            const stream = new GameBitStream(data);

            switch (stream.readBits(NetConstants.packetBits)) {
                case PacketType.Update: {
                    const packet = new UpdatePacket();
                    packet.deserialize(stream);
                    this.updateFromPacket(packet);
                    this.running = true;
                    break;
                }
            }
        };

        this.socket.onopen = () => {
            getElem("#game").style.display = "";
            getElem("#home").style.display = "none";
            const joinPacket = new JoinPacket();
            joinPacket.name = (getElem("#name-input") as HTMLInputElement).value;
            this.sendPacket(joinPacket);
        };

        this.socket.onclose = () => {
            this.end();
        };
    }

    end(): void {
        getElem("#game").style.display = "none";
        getElem("#home").style.display = "";
        this.running = false;

        // reset stuff
        this.camera.clear();
    }

    /**
     * Process a game update packet
     */
    updateFromPacket(packet: UpdatePacket): void {
        if (packet.playerDataDirty.id) {
            this.activePlayerID = packet.playerData.id;
        }

        if (packet.playerDataDirty.zoom) {
            this.camera.zoom = packet.playerData.zoom;
        }

        for (const id of packet.deletedObjects) {
            this.objects.get(id)?.destroy();
            this.objects.deleteByID(id);
        }

        for (const fullObject of packet.fullObjects) {
            let object = this.objects.get(fullObject.id);

            if (!object) {
                switch (fullObject.type) {
                    case ObjectType.Player: {
                        object = new Player(this, fullObject.id);
                        break;
                    }
                }
                this.objects.add(object);
            }
            object.updateFromData(fullObject.data);
        }

        for (const partialObject of packet.partialObjects) {
            const object = this.objects.get(partialObject.id);

            if (!object) {
                console.warn(`Unknown partial dirty object with ID ${partialObject.id}`);
                continue;
            }
            object.updateFromData(partialObject.data);
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
            packet.serialize();
            this.socket.send(packet.getBuffer());
        }
    }

    resize(): void {
        this.camera.resize();
    }

    render(): void {
        if (!this.running) return;
        this.camera.render();

        const inputPacket = new InputPacket();
        inputPacket.mouseDown = this.inputManager.isInputDown("Mouse0");
        inputPacket.direction = this.inputManager.mouseAngle;
        this.sendPacket(inputPacket);
    }
}
