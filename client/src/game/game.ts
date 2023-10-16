import { GameBitStream, NetConstants, ObjectType, PacketType } from "../../../common/src/net";
import { Application } from "pixi.js";
import { getElem } from "../utils";
import { UpdatePacket } from "../../../common/src/packets/updatePacket";
import { ObjectPool } from "../../../common/src/utils/objectPool";
import { type GameObject } from "./objects/gameObject";
import { Player } from "./objects/player";
import { Camera } from "./camera";
import { InputManager } from "./inputManager";

export class Game {
    socket?: WebSocket;

    running = false;

    objects = new ObjectPool<GameObject>();

    activePlayerID = -1;

    get activePlayer(): Player | undefined {
        return this.objects.get(this.activePlayerID) as Player;
    }

    pixi: Application;

    camera: Camera;
    inputManager: InputManager;

    constructor() {
        this.pixi = new Application<HTMLCanvasElement>({
            view: getElem("#game-canvas") as HTMLCanvasElement,
            resizeTo: window,
            resolution: window.devicePixelRatio ?? 1,
            antialias: true,
            background: 0x6d5693
        });

        this.pixi.ticker.add(this.render.bind(this));

        this.camera = new Camera(this);
        this.inputManager = new InputManager(this);

        this.pixi.renderer.on("resize", this.resize.bind(this));
    }

    connect(address: string): void {
        this.socket = new WebSocket(address);

        this.socket.binaryType = "arraybuffer";

        this.socket.onmessage = (msg) => {
            const data = msg.data as ArrayBuffer;
            const stream = new GameBitStream(data);

            switch (stream.readBits(NetConstants.packetBits)) {
                case PacketType.Connected: {
                    break;
                }
                case PacketType.Update: {
                    const packet = new UpdatePacket();
                    packet.deserialize(stream);
                    this.updateFromPacket(packet);
                    break;
                }
            }
        };

        this.socket.onopen = () => {
            getElem("#game").style.display = "";
            getElem("#home").style.display = "none";
            this.running = true;
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
        if (packet.dirty.playerID) {
            this.activePlayerID = packet.playerID;
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

    }

    resize(): void {
        this.camera.resize();
    }

    render(): void {
        if (!this.running) return;
        this.camera.render();
    }
}
