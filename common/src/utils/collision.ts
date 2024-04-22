import { MathUtils } from "./math";
import { Vec2, type Vector } from "./vector";

export type CollisionResponse = { dir: Vector, pen: number } | null;
export type LineIntersection = { point: Vector, normal: Vector } | null;

export const Collision = {
    /**
    * Check whether two circles collide
    * @param pos1 The center of the first circle
    * @param r1 The radius of the first circle
    * @param pos2 The center of the second circle
    * @param r2 The radius of the second circle
    */
    checkCircleCircle(pos1: Vector, r1: number, pos2: Vector, r2: number): boolean {
        const a = r1 + r2;
        const x = pos1.x - pos2.x;
        const y = pos1.y - pos2.y;

        return a * a > x * x + y * y;
    },

    /**
    * Check whether a rectangle and a circle collide
    * @param min The min Vector of the rectangle
    * @param max The max vector of the rectangle
    * @param pos The center of the circle
    * @param rad The radius of the circle
    */
    checkRectCircle(min: Vector, max: Vector, pos: Vector, rad: number): boolean {
        const cpt = {
            x: MathUtils.clamp(pos.x, min.x, max.x),
            y: MathUtils.clamp(pos.y, min.y, max.y)
        };

        const distX = pos.x - cpt.x;
        const distY = pos.y - cpt.y;
        const distSquared = distX * distX + distY * distY;

        return (distSquared < rad * rad) || (pos.x >= min.x && pos.x <= max.x && pos.y >= min.y && pos.y <= max.y);
    },

    /**
    * Check whether two rectangles collide
    * @param min The min Vector of the first rectangle
    * @param max The max vector of the first rectangle
    * @param min2 The min Vector of the second rectangle
    * @param max2 The max vector of the second rectangle
    */
    checkRectRect(min1: Vector, max1: Vector, min2: Vector, max2: Vector): boolean {
        return min2.x < max1.x && min2.y < max1.y && min1.x < max2.x && min1.y < max2.y;
    },

    /**
     * Checks if a line intersects another line
     * @param a0 The start of the first line
     * @param a1 The end of the first line
     * @param b0 The start of the second line
     * @param b1 The end of the second line
     * @return The intersection position if it happened, if not returns null
    */
    lineIntersectsLine(a0: Vector, a1: Vector, b0: Vector, b1: Vector): Vector | null {
        const x1 = MathUtils.signedAreaTri(a0, a1, b1);
        const x2 = MathUtils.signedAreaTri(a0, a1, b0);
        if (x1 !== 0 && x2 !== 0 && x1 * x2 < 0) {
            const x3 = MathUtils.signedAreaTri(b0, b1, a0);
            const x4 = x3 + x2 - x1;
            if (x3 * x4 < 0) {
                const t = x3 / (x3 - x4);
                return Vec2.add(a0, Vec2.mul(Vec2.sub(a1, a0), t));
            }
        }
        return null;
    },

    /**
     * Checks if a line intersects a circle
     * @param s0 The start of the line
     * @param s1 The end of the line
     * @param pos The position of the circle
     * @param rad The radius of the circle
     * @return An intersection response with the intersection position and normal Vectors, returns null if they don't intersect
    */
    lineIntersectsCircle(s0: Vector, s1: Vector, pos: Vector, rad: number): LineIntersection {
        let d = Vec2.sub(s1, s0);
        const len = Math.max(Vec2.length(d), 0.000001);
        d = Vec2.div(d, len);
        const m = Vec2.sub(s0, pos);
        const b = Vec2.dot(m, d);
        const c = Vec2.dot(m, m) - rad * rad;
        if (c > 0 && b > 0.0) {
            return null;
        }
        const discSq = b * b - c;
        if (discSq < 0) {
            return null;
        }
        const disc = Math.sqrt(discSq);
        let t = -b - disc;
        if (t < 0) {
            t = -b + disc;
        }
        if (t <= len) {
            const point = Vec2.add(s0, Vec2.mul(d, t));
            return {
                point,
                normal: Vec2.normalize(Vec2.sub(point, pos))
            };
        }
        return null;
    },

    /**
     * Checks if a line intersects a rectangle
     * @param s0 The start of the line
     * @param s1 The end of the line
     * @param min The min Vector of the rectangle
     * @param max The max Vector of the rectangle
     * @return An intersection response with the intersection position and normal Vectors, returns null if they don't intersect
    */
    lineIntersectsRect(s0: Vector, s1: Vector, min: Vector, max: Vector): LineIntersection {
        let tmin = 0;
        let tmax = Number.MAX_VALUE;
        const eps = 0.00001;
        const r = s0;
        let d = Vec2.sub(s1, s0);
        const dist = Vec2.length(d);
        d = dist > eps ? Vec2.div(d, dist) : Vec2.new(1, 0);

        let absDx = Math.abs(d.x);
        let absDy = Math.abs(d.y);

        if (absDx < eps) {
            d.x = eps * 2;
            absDx = d.x;
        }
        if (absDy < eps) {
            d.y = eps * 2;
            absDy = d.y;
        }

        if (absDx > eps) {
            const tx1 = (min.x - r.x) / d.x;
            const tx2 = (max.x - r.x) / d.x;
            tmin = Math.max(tmin, Math.min(tx1, tx2));
            tmax = Math.min(tmax, Math.max(tx1, tx2));
            if (tmin > tmax) {
                return null;
            }
        }
        if (absDy > eps) {
            const ty1 = (min.y - r.y) / d.y;
            const ty2 = (max.y - r.y) / d.y;
            tmin = Math.max(tmin, Math.min(ty1, ty2));
            tmax = Math.min(tmax, Math.max(ty1, ty2));
            if (tmin > tmax) {
                return null;
            }
        }
        if (tmin > dist) {
            return null;
        }
        // Hit
        const point = Vec2.add(s0, Vec2.mul(d, tmin));
        // Intersection normal
        const c = Vec2.add(min, Vec2.mul(Vec2.sub(max, min), 0.5));
        const p0 = Vec2.sub(point, c);
        const d0 = Vec2.mul(Vec2.sub(min, max), 0.5);

        const x = p0.x / Math.abs(d0.x) * 1.001;
        const y = p0.y / Math.abs(d0.y) * 1.001;
        const normal = Vec2.normalizeSafe({
            x: x < 0 ? Math.ceil(x) : Math.floor(x),
            y: y < 0 ? Math.ceil(y) : Math.floor(y)
        }, Vec2.new(1, 0));
        return {
            point,
            normal
        };
    },

    /**
     * Checks if circle intersects another circle
     * @param pos0 The position of the first circle
     * @param rad0 The radius of the first circle
     * @param pos1 The position of the second circle
     * @param rad1 The radius of the second circle
     * @return An intersection response with the intersection direction and pen, returns null if they don't intersect
    */
    circleCircleIntersection(pos0: Vector, rad0: number, pos1: Vector, rad1: number): CollisionResponse {
        const r = rad0 + rad1;
        const toP1 = Vec2.sub(pos1, pos0);
        const distSqr = Vec2.lengthSqr(toP1);
        if (distSqr < r * r) {
            const dist = Math.sqrt(distSqr);
            return {
                dir: dist > 0.00001 ? Vec2.div(toP1, dist) : Vec2.new(1.0, 0.0),
                pen: r - dist
            };
        }
        return null;
    },

    /**
     * Checks if circle intersects a rectangle
     * @param min The min Vector of the rectangle
     * @param max The max Vector of the rectangle
     * @param pos The position of the circle
     * @param radius The radius of the circle
     * @return An intersection response with the intersection direction and pen, returns null if they don't intersect
    */
    rectCircleIntersection(min: Vector, max: Vector, pos: Vector, radius: number): CollisionResponse {
        if (pos.x >= min.x && pos.x <= max.x && pos.y >= min.y && pos.y <= max.y) {
            const e = Vec2.mul(Vec2.sub(max, min), 0.5);
            const c = Vec2.add(min, e);
            const p = Vec2.sub(pos, c);
            const xp = Math.abs(p.x) - e.x - radius;
            const yp = Math.abs(p.y) - e.y - radius;
            if (xp > yp) {
                return {
                    dir: Vec2.new(p.x > 0.0 ? 1.0 : -1.0, 0.0),
                    pen: -xp
                };
            }
            return {
                dir: Vec2.new(0.0, p.y > 0.0 ? 1.0 : -1.0),
                pen: -yp
            };
        }
        const cpt = Vec2.new(
            MathUtils.clamp(pos.x, min.x, max.x),
            MathUtils.clamp(pos.y, min.y, max.y)
        );
        let dir = Vec2.sub(pos, cpt);

        dir = Vec2.sub(pos, cpt);

        const dstSqr = Vec2.lengthSqr(dir);
        if (dstSqr < radius * radius) {
            const dst = Math.sqrt(dstSqr);
            return {
                dir: dst > 0.0001 ? Vec2.div(dir, dst) : Vec2.new(1.0, 0.0),
                pen: radius - dst
            };
        }

        return null;
    },

    /**
    * Checks if a rectangle intersects a rectangle
    * @param min The min Vector of the first rectangle
    * @param max The max vector of the first rectangle
    * @param min2 The min Vector of the second rectangle
    * @param max2 The max vector of the second rectangle
    * @return An intersection response with the intersection direction and pen, returns null if they don't intersect
    */
    rectRectIntersection(min0: Vector, max0: Vector, min1: Vector, max1: Vector): CollisionResponse {
        const e0 = Vec2.mul(Vec2.sub(max0, min0), 0.5);
        const c0 = Vec2.add(min0, e0);
        const e1 = Vec2.mul(Vec2.sub(max1, min1), 0.5);
        const c1 = Vec2.add(min1, e1);
        const n = Vec2.sub(c1, c0);
        const xo = e0.x + e1.x - Math.abs(n.x);
        if (xo > 0.0) {
            const yo = e0.y + e1.y - Math.abs(n.y);
            if (yo > 0.0) {
                if (xo > yo) {
                    return {
                        dir: n.x < 0.0 ? Vec2.new(-1.0, 0.0) : Vec2.new(1.0, 0.0),
                        pen: xo
                    };
                }
                return {
                    dir: n.y < 0.0 ? Vec2.new(0.0, -1.0) : Vec2.new(0.0, 1.0),
                    pen: yo
                };
            }
        }
        return null;
    }
};
