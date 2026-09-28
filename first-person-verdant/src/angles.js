// Yaw convention: the explorer faces -Z at yaw 0; creatures face +Z at heading 0.
/** Signed shortest turn from angle a to angle b, in radians (-π..π). */
export const angleTo = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
/** The explorer's yaw that faces along the direction (x, z). */
export const yawOf = (x, z) => Math.atan2(-x, -z);
