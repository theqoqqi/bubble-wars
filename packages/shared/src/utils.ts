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
