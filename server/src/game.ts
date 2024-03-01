import { type WebSocket } from "uWebSockets.js";
import { Player } from "./objects/player";
import { type PlayerData } from "./server";
import { type GameObject } from "./objects/gameObject";
import { Grid } from "./grid";
import { ObjectPool } from "../../common/src/utils/objectPool";
import { GameConstants } from "../../common/src/constants";

const TICK_SPEED = 60;

export class Game {
    players = new Set<Player>();

    dirtyObjects = new ObjectPool<GameObject>();
    fullDirtyObjects = new ObjectPool<GameObject>();
    deletedObjects = new Set<number>();

    grid = new Grid(GameConstants.maxPosition, GameConstants.maxPosition);

    width = 512;
    height = 512;
    mapDirty = false;

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
        this.grid.remove(player);
        this.deletedObjects.add(player.id);
    }

    tick(): void {
        for (const player of this.players) {
            player.tick();
        }

        // Second loop over players: calculate visible objects & send updates
        for (const player of this.players) {
            player.sendPackets();
        }

        this.deletedObjects.clear();
        this.dirtyObjects.clear();
        this.fullDirtyObjects.clear();
        this.mapDirty = false;
    }
}
