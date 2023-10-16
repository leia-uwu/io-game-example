import { type Hitbox } from "../../common/src/utils/hitbox";
import { MathUtils } from "../../common/src/utils/math";
import { Vec2, type Vector } from "../../common/src/utils/vector";

interface GameObject {
    id: number
    hitbox: Hitbox
}

/**
 * A Grid to filter collision detection of game objects
 */
export class Grid<T extends GameObject> {
    readonly width: number;
    readonly height: number;
    readonly cellSize: number;

    //              X     Y         Object ID
    readonly _grid: Array<Array<Map<number, T>>>;

    // store the cells each game object is occupying
    // so removing the object from the grid is faster
    private readonly _objectsCells = new Map<number, Vector[]>();

    constructor(width: number, height: number, cellSize: number) {
        this.width = Math.floor(width / cellSize);
        this.height = Math.floor(height / cellSize);
        this.cellSize = cellSize;

        // fill the grid X row with arrays for the Y column
        // maps are created on demand to save memory usage
        this._grid = Array.from({ length: width }, () => []);
    }

    /**
     * Add an object to the grid system
     */
    addObject(object: T): void {
        this.removeObject(object);
        // get the bounds of the hitbox
        const rect = object.hitbox.toRectangle();
        // round it to the grid cells
        const min = this._roundToCells(rect.min);
        const max = this._roundToCells(rect.max);

        const cells: Vector[] = [];

        // add it to all grid cells that it intersects
        for (let x = min.x; x <= max.x; x++) {
            const xRow = this._grid[x];
            for (let y = min.y; y <= max.y; y++) {
                if (xRow[y] === undefined) xRow[y] = new Map();

                xRow[y].set(object.id, object);
                cells.push(Vec2.new(x, y));
            }
        }
        // store the cells this object is occupying
        this._objectsCells.set(object.id, cells);
    }

    /**
     * Remove an object from the grid system
     */
    removeObject(object: T): void {
        const cells = this._objectsCells.get(object.id);
        if (!cells) return;

        for (const cell of cells) {
            this._grid[cell.x][cell.y].delete(object.id);
        }
        cells.length = 0;
    }

    /**
     * Get all objects near this hitbox
     * This transforms the hitbox into a rectangle
     * and gets all objects intersecting it after rounding it to grid cells
     * @param hitbox The hitbox
     * @return A set with the objects near this hitbox
     */
    intersectsHitbox(hitbox: Hitbox): Set<T> {
        const rect = hitbox.toRectangle();

        const min = this._roundToCells(rect.min);
        const max = this._roundToCells(rect.max);

        const objects = new Set<T>();

        for (let x = min.x; x <= max.x; x++) {
            const xRow = this._grid[x];
            for (let y = min.y; y <= max.y; y++) {
                const objectsMap = xRow[y];
                if (objectsMap) {
                    for (const object of xRow[y].values()) {
                        objects.add(object);
                    }
                }

            }
        }
        return objects;
    }

    /**
     * Rounds a position to this grid cells
     */
    private _roundToCells(vector: Vector): Vector {
        return {
            x: MathUtils.clamp(Math.floor(vector.x / this.cellSize), 0, this.width),
            y: MathUtils.clamp(Math.floor(vector.y / this.cellSize), 0, this.height)
        };
    }
}
