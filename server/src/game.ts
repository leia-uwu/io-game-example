import { type WebSocket } from "uWebSockets.js";
import { Player } from "./objects/player";
import { type PlayerData } from "./server";
import { type GameObject } from "./objects/gameObject";
import { UpdatePacket } from "../../common/src/packets/updatePacket";
import { Grid } from "./grid";
import { ObjectPool } from "../../common/src/utils/objectPool";

const TICK_SPEED = 60;

export class Game {
    players = new Set<Player>();

    dirtyObjects = new ObjectPool<GameObject>();
    fullDirtyObjects = new ObjectPool<GameObject>();
    deletedObjects = new Set<number>();

    grid = new Grid<GameObject>(1024, 1024, 32);

    // TODO: id allocator
    private _currentId = 0;

    nextId(): number {
        return this._currentId++;
    }

    constructor() {
        setInterval(this.tick.bind(this), 1000 / TICK_SPEED);
    }

    addPlayer(socket: WebSocket<PlayerData>): Player {
        const player = new Player(this, socket);
        this.players.add(player);
        this.grid.addObject(player);
        return player;
    }

    removePlayer(player: Player): void {
        this.players.delete(player);
        this.grid.removeObject(player);
        this.deletedObjects.add(player.id)
    }

    tick(): void {
        for (const player of this.players) {
            player.tick();
        }

        // Second loop over players: calculate visible objects & send updates
        for (const player of this.players) {
            // if (!player.joined) continue;

            // Calculate visible objects
            player.ticksSinceLastUpdate++;
            /*  if (player.ticksSinceLastUpdate > 8 || this.updateObjects)*/
            player.updateVisibleObjects();

            // Full objects
            for (const object of this.fullDirtyObjects) {
                if (player.visibleObjects.has(object)) {
                    player.fullDirtyObjects.add(object);
                }
            }

            // Partial objects
            for (const object of this.dirtyObjects) {
                if (player.visibleObjects.has(object) && !player.fullDirtyObjects.has(object)) {
                    player.partialDirtyObjects.add(object);
                }
            }

            // Deleted objects
            for (const id of this.deletedObjects) {
                if (player.visibleObjects.hasID(id) && id !== player.id) {
                    player.deletedObjects.add(id);
                }
            }
            const updatePacket = new UpdatePacket();

            updatePacket.fullObjects = [...player.fullDirtyObjects]
            updatePacket.partialObjects = [...player.partialDirtyObjects];
            updatePacket.deletedObjects = [...player.deletedObjects];

            updatePacket.dirty.playerID = player.dirty.id;
            player.dirty.id = false;
            updatePacket.playerID = player.id;

            player.sendPacket(updatePacket);

            player.fullDirtyObjects.clear();
            player.partialDirtyObjects.clear();
            player.deletedObjects.clear();
        }

        this.deletedObjects.clear();
        this.dirtyObjects.clear();
        this.fullDirtyObjects.clear();
    }
}
