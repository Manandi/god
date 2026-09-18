// Tracks collected chests and lore by "<zone>:<objectId>". GameSave persists
// this set and restores it before a journey starts.
export const CollectedItems = new Set<string>();
