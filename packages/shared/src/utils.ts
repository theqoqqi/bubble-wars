/**
 * Round number to 1 decimal place (0.1 precision for network snapshots)
 */
export function round1(v: number): number {
    return Math.round(v * 10) / 10;
}

/**
 * Round number to 2 decimal places (0.01 precision for angles, recoil, wobbles)
 */
export function round2(v: number): number {
    return Math.round(v * 100) / 100;
}

/**
 * Transforms a local 2D point (localOffsetX, localOffsetY) into parent space
 * given parent origin (parentX, parentY) and parent rotation angle.
 */
export function transformLocalPoint(
    parentX: number,
    parentY: number,
    parentAngle: number,
    localOffsetX: number,
    localOffsetY: number
): { x: number; y: number } {
    const cos = Math.cos(parentAngle);
    const sin = Math.sin(parentAngle);
    return {
        x: parentX + localOffsetX * cos - localOffsetY * sin,
        y: parentY + localOffsetX * sin + localOffsetY * cos,
    };
}
