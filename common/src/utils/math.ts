import { Vec2, type Vector } from "./vector";
export type Orientation = 0 | 1 | 2 | 3;

export const MathUtils = {

    /**
     * Draws a line between two points and returns that line's angle
     * @param a The first point, used as the head of the vector
     * @param b The second point, used as the tail of the vector
     * @returns The angle, in radians, of the line going from b to a
     */
    angleBetweenPoints(a: Vector, b: Vector): number {
        const dy = a.y - b.y;
        const dx = a.x - b.x;
        return Math.atan2(dy, dx);
    },

    /**
     * Converts degrees to radians
     * @param degrees An angle in degrees
     * @return The angle in radians
     */
    degreesToRadians(degrees: number): number {
        return degrees * (Math.PI / 180);
    },

    /**
     * Converts radians to degrees
     * @param radians An angle in radians
     * @return The angle in degrees
     */
    radiansToDegrees(radians: number): number {
        return (radians / Math.PI) * 180;
    },

    /**
     * Interpolate between two values
     * @param start The start value
     * @param end The end value
     * @param interpFactor The interpolation factor ranging from 0 to 1
     *
     */
    lerp(start: number, end: number, interpFactor: number): number {
        return start * (1 - interpFactor) + end * interpFactor;
    },

    /**
     * Remap a number from a range to another
     * @param v The value
     * @param a The initial range minimum value
     * @param b The initial range maximum value
     * @param x The targeted range minimum value
     * @param y The targeted range maximum value
     */
    remap(v: number, a: number, b: number, x: number, y: number) {
        const t = MathUtils.clamp((v - a) / (b - a), 0.0, 1.0);
        return MathUtils.lerp(x, y, t);
    },
    /**
     * Conform a number to specified bounds
     * @param a The number to conform
     * @param min The minimum value the number can hold
     * @param max The maximum value the number can hold
     */
    clamp(a: number, min: number, max: number): number {
        return a < max ? a > min ? a : min : max;
    },

    /**
     * Add two orientations
     * @param n1 The first orientation
     * @param n2 The second orientation
     * @return Both orientations added
     */
    addOrientations(n1: Orientation, n2: Orientation): Orientation {
        return (n1 + n2) % 4 as Orientation;
    },

    /**
     * Add a Vector to another one and rotate it by the given orientation
     * @param position1 The initial Vector
     * @param position2 The Vector to add to the first one
     * @param orientation The orientation to rotate it
     * @return A new Vector
     */
    addAdjust(position1: Vector, position2: Vector, orientation: Orientation): Vector {
        if (orientation === 0) return Vec2.add(position1, position2);
        let xOffset: number, yOffset: number;
        switch (orientation) {
            case 1:
                // noinspection JSSuspiciousNameCombination
                xOffset = position2.y;
                yOffset = -position2.x;
                break;
            case 2:
                xOffset = -position2.x;
                yOffset = -position2.y;
                break;
            case 3:
                xOffset = -position2.y;
                // noinspection JSSuspiciousNameCombination
                yOffset = position2.x;
                break;
        }
        return Vec2.add(position1, Vec2.new(xOffset, yOffset));
    },

    /**
     * Transform a rectangle by a given position and orientation
     * @param pos The position to transform the rectangle by
     * @param min The rectangle min Vector
     * @param max The rectangle max Vector
     * @param scale The scale
     * @param orientation The orientation to rotate it
     * @return A new Rectangle transformed by the given position and orientation
     */
    transformRectangle(pos: Vector, min: Vector, max: Vector, scale: number, orientation: Orientation): { min: Vector, max: Vector } {
        min = Vec2.mul(min, scale);
        max = Vec2.mul(max, scale);
        if (orientation !== 0) {
            const minX = min.x; const minY = min.y;
            const maxX = max.x; const maxY = max.y;
            switch (orientation) {
                case 1:
                    min = Vec2.new(maxX, minY);
                    max = Vec2.new(minX, maxY);
                    break;
                case 2:
                    min = Vec2.new(maxX, maxY);
                    max = Vec2.new(minX, minY);
                    break;
                case 3:
                    min = Vec2.new(minX, maxY);
                    max = Vec2.new(maxX, minY);
                    break;
            }
        }
        return {
            min: MathUtils.addAdjust(pos, min, orientation),
            max: MathUtils.addAdjust(pos, max, orientation)
        };
    },

    signedAreaTri(a: Vector, b: Vector, c: Vector): number {
        return (a.x - c.x) * (b.y - c.y) - (a.y - c.y) * (b.x - c.x);
    }

};
