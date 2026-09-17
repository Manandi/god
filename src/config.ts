export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 540;

export const TILE_SIZE = 16;

export const PARTICLE_TEXTURE_KEY = 'particle';

export const PHYSICS = {
  gravityY: 900,
  moveSpeed: 180,
  runAccel: 1400,
  runDrag: 1400,
  airDrag: 400,
  jumpVelocity: -420,
  maxFallSpeed: 700,
  coyoteTimeMs: 100,
  jumpBufferMs: 120,
  climbSpeed: 185
} as const;
