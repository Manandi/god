// Placeholder for the real Phase 4 progression system (XP derived from logged
// real-world effort). Kept separate from the Phaser game loop on purpose: the
// game world only ever reads `level` from here, it never writes to it.
export const PlayerProgress = {
  level: 1
};
