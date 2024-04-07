import { type Vector } from "./vector";

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

    signedAreaTri(a: Vector, b: Vector, c: Vector): number {
        return (a.x - c.x) * (b.y - c.y) - (a.y - c.y) * (b.x - c.x);
    }

};
