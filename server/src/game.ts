import { type WebSocket } from "uWebSockets.js";
import { Player } from "./entities/player";
import { type PlayerData } from "./server";
import { type ServerEntity } from "./entities/entity";
import { Grid } from "./grid";
import { EntityPool } from "../../common/src/utils/entityPool";
import { GameConstants } from "../../common/src/constants";
import NanoTimer from "nanotimer";

export class Game {
    players = new EntityPool<Player>();

    newPlayers: Player[] = [];
    deletedPlayers: number[] = [];

    partialDirtyEntities = new Set<ServerEntity>();
    fullDirtyEntities = new Set<ServerEntity>();

    grid = new Grid(GameConstants.maxPosition, GameConstants.maxPosition);

    width = 512;
    height = 512;
    mapDirty = false;

    // TODO: id allocator
    private _currentId = 1;

    dt = 0;
    now = Date.now();

    nextId(): number {
        return this._currentId++;
    }

    timer = new NanoTimer();

    constructor() {
        this.timer.setInterval(this.tick.bind(this), "", "30m");
    }

    addPlayer(socket: WebSocket<PlayerData>): Player {
        const player = new Player(this, socket);
        this.newPlayers.push(player);
        return player;
    }

    removePlayer(player: Player): void {
        this.players.delete(player);
        this.grid.remove(player);
        this.deletedPlayers.push(player.id);
        console.log(`"${player.name}" left game`);
    }

    tick(): void {
        this.dt = (Date.now() - this.now) / 1000;
        this.now = Date.now();

        // update entities
        for (const entity of this.grid.entities.values()) {
            entity.tick();
        }

        // Cache entity serializations
        for (const entity of this.partialDirtyEntities) {
            if (this.fullDirtyEntities.has(entity)) {
                this.partialDirtyEntities.delete(entity);
                continue;
            }
            entity.serializePartial();
        }

        for (const entity of this.fullDirtyEntities) {
            entity.serializeFull();
        }

        // Second loop over players: calculate visible entities & send updates
        for (const player of this.players) {
            player.sendPackets();
        }

        // reset stuff
        for (const player of this.players) {
            for (const key in player.dirty) {
                player.dirty[key as keyof Player["dirty"]] = false;
            }
        }

        this.partialDirtyEntities.clear();
        this.fullDirtyEntities.clear();
        this.newPlayers.length = 0;
        this.deletedPlayers.length = 0;
        this.mapDirty = false;
    }
}
