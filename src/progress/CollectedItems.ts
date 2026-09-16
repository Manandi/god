// Tracks which interactables (chests/lore) have already been triggered this
// session, keyed "<zone>:<objectId>". Decoupled from Phaser on purpose, same
// as PlayerProgress — real persistence (save/load) is Phase 7.
export const CollectedItems = new Set<string>();
