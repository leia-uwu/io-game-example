import { Collision, type CollisionResponse, type lineIntersection } from "./collision";
import { MathUtils, type Orientation } from "./math";
import { Random } from "./random";
import { Vec2, type Vector } from "./vector";

export abstract class Hitbox {
    /**
     * Checks if this `Hitbox` collides with another one
     * @param that The other `Hitbox`
     * @return True if both `Hitbox`es collide
     */
    abstract collidesWith(that: Hitbox): boolean;

    /**
     * Resolve collision between this and another `Hitbox`
     * @param that The other `Hitbox`
     */
    abstract resolveCollision(that: Hitbox): void;

    /**
     * Clone this `Hitbox`.
     * @return a new `Hitbox` cloned from this one
     */
    abstract clone(): Hitbox;

    /**
     * Transform this `Hitbox` and returns a new `Hitbox`.
     * NOTE: This doesn't change the initial `Hitbox`
     * @param position The position to transform the `Hitbox` by
     * @param scale The scale to transform the `Hitbox`
     * @param orientation The orientation to transform the `Hitbox`
     * @return A new `Hitbox` transformed by the parameters
     */
    abstract transform(position: Vector, scale?: number, orientation?: Orientation): Hitbox;

    /**
     * Scale this `Hitbox`.
     * NOTE: This does change the initial `Hitbox`
     * @param scale The scale
     */
    abstract scale(scale: number): void;

    /**
     * Check if a line intersects with this `Hitbox`.
     * @param a the start point of the line
     * @param b the end point of the line
     * @return An intersection response containing the intersection position and normal
     */
    abstract intersectsLine(a: Vector, b: Vector): lineIntersection;

    /**
     * Get a random position inside this `Hitbox`.
     * @return A Vector of a random position inside this `Hitbox`
     */
    abstract randomPoint(): Vector;

    /**
     * Gets this hitbox rectangle bounds
     * @returns A rectangle hitbox
     */
    abstract toRectangle(): RectHitbox;

    /**
     * Checks if a Vector is inside this hitbox
     * @param point The vector
     */
    abstract isPointInside(point: Vector): boolean;
}

export class CircleHitbox extends Hitbox {
    position: Vector;
    radius: number;
    rectBounds: RectHitbox;

    constructor(radius: number, position = Vec2.new(0, 0)) {
        super();

        this.position = position;
        this.radius = radius;
        this.rectBounds = RectHitbox.fromCircle(radius, position);
    }

    collidesWith(that: Hitbox): boolean {
        if (that instanceof CircleHitbox) {
            return Collision.checkCircleCircle(that.position, that.radius, this.position, this.radius);
        } else if (that instanceof RectHitbox) {
            return Collision.checkRectCircle(that.min, that.max, this.position, this.radius);
        }
        return false;
    }

    resolveCollision(that: Hitbox): void {
        let collision: CollisionResponse = null;
        if (that instanceof RectHitbox) {
            collision = Collision.rectCircleIntersection(that.min, that.max, this.position, this.radius);
        } else if (that instanceof CircleHitbox) {
            collision = Collision.circleCircleIntersection(this.position, this.radius, that.position, that.radius);
        }
        if (collision) this.position = Vec2.sub(this.position, Vec2.mul(collision.dir, collision.pen));
    }

    clone(): CircleHitbox {
        return new CircleHitbox(this.radius, Vec2.clone(this.position));
    }

    transform(position: Vector, scale = 1, orientation = 0 as Orientation): CircleHitbox {
        return new CircleHitbox(this.radius * scale, MathUtils.addAdjust(position, this.position, orientation));
    }

    scale(scale: number): void {
        this.radius *= scale;
    }

    intersectsLine(a: Vector, b: Vector): lineIntersection {
        return Collision.lineIntersectsCircle(a, b, this.position, this.radius);
    }

    randomPoint(): Vector {
        return Random.pointInsideCircle(this.position, this.radius);
    }

    toRectangle(): RectHitbox {
        return this.rectBounds;
    }

    isPointInside(point: Vector): boolean {
        return Vec2.distance(point, this.position) < this.radius;
    }
}

/**
 * An axis aligned rectangle Hitbox
 */
export class RectHitbox extends Hitbox {
    /**
     * The top left corner of the rectangle
     */
    min: Vector;
    /**
     * The bottom right corner of the rectangle
     */
    max: Vector;

    constructor(min: Vector, max: Vector) {
        super();

        this.min = min;
        this.max = max;
    }

    /**
     * Creates a new rectangle hitbox from the bounds of a circle
     */
    static fromCircle(radius: number, position: Vector): RectHitbox {
        return new RectHitbox(
            Vec2.new(position.x - radius, position.y - radius),
            Vec2.new(position.x + radius, position.y + radius));
    }

    /**
     * Creates a new rectangle hitbox from the bounds of a line segment
     */
    static fromLine(a: Vector, b: Vector): RectHitbox {
        return new RectHitbox(
            Vec2.new(a.x < b.x ? a.x : b.x, a.y < b.y ? a.y : b.y),
            Vec2.new(a.x > b.x ? a.x : b.x, a.y > b.y ? a.y : b.y));
    }

    /**
     * Creates a new rectangle hitbox based on a width, height and position
     */
    static fromRect(width: number, height: number, pos = Vec2.new(0, 0)): RectHitbox {
        const size = Vec2.new(width / 2, height / 2);
        const min = Vec2.sub(pos, size);
        const max = Vec2.add(pos, size);
        return new RectHitbox(min, max);
    }

    collidesWith(that: Hitbox): boolean {
        if (that instanceof CircleHitbox) {
            return Collision.checkRectCircle(this.min, this.max, that.position, that.radius);
        } else if (that instanceof RectHitbox) {
            return Collision.checkRectRect(that.min, that.max, this.min, this.max);
        }
        return false;
    }

    resolveCollision(that: Hitbox): void {
        let collision: CollisionResponse = null;
        if (that instanceof CircleHitbox) {
            collision = Collision.rectCircleIntersection(this.min, this.max, that.position, that.radius);
        } else if (that instanceof RectHitbox) {
            collision = Collision.rectRectIntersection(this.min, this.max, that.min, that.max);
        }
        if (collision) {
            this.transform(Vec2.mul(collision.dir, collision.pen), 1);
        }
    }

    clone(): RectHitbox {
        return new RectHitbox(Vec2.clone(this.min), Vec2.clone(this.max));
    }

    transform(position: Vector, scale = 1, orientation = 0 as Orientation): RectHitbox {
        const rect = MathUtils.transformRectangle(position, this.min, this.max, scale, orientation);

        return new RectHitbox(rect.min, rect.max);
    }

    scale(scale: number): void {
        const centerX = (this.min.x + this.max.x) / 2;
        const centerY = (this.min.y + this.max.y) / 2;
        this.min = Vec2.new((this.min.x - centerX) * scale + centerX, (this.min.y - centerY) * scale + centerY);
        this.max = Vec2.new((this.max.x - centerX) * scale + centerX, (this.max.y - centerY) * scale + centerY);
    }

    intersectsLine(a: Vector, b: Vector): lineIntersection {
        return Collision.lineIntersectsRect(a, b, this.min, this.max);
    }

    randomPoint(): Vector {
        return {
            x: Random.float(this.min.x, this.max.x),
            y: Random.float(this.min.y, this.max.y)
        };
    }

    toRectangle(): this {
        return this;
    }

    isPointInside(point: Vector): boolean {
        return point.x > this.min.x && point.y > this.min.y && point.x < this.max.x && point.y < this.max.y;
    }
}
