export const TEST_LEVEL_COLS = 100;
export const TEST_LEVEL_ROWS = 44;

/**
 * Hand-built placeholder level for Phase 1 verification: a flat starting plateau,
 * a jumpable gap, rising stepping-stone platforms, a tall wall, and a floating
 * platform chain over a long gap. Replaced by real Tiled-authored zones in Phase 2.
 */
export function generateTestLevel(): number[][] {
  const grid: number[][] = Array.from({ length: TEST_LEVEL_ROWS }, () =>
    new Array<number>(TEST_LEVEL_COLS).fill(0)
  );

  const fillRect = (x: number, y: number, w: number, h: number): void => {
    for (let row = y; row < y + h; row++) {
      for (let col = x; col < x + w; col++) {
        if (row >= 0 && row < TEST_LEVEL_ROWS && col >= 0 && col < TEST_LEVEL_COLS) {
          grid[row][col] = 1;
        }
      }
    }
  };

  const R = TEST_LEVEL_ROWS;

  // Continuous ground floor (three tiles thick).
  fillRect(0, R - 3, TEST_LEVEL_COLS, 3);

  // Carve a jumpable gap in the floor's top two tiles; the bottom tile stays
  // solid as a safety net so nothing can fall into the void.
  for (let col = 14; col < 18; col++) {
    grid[R - 3][col] = 0;
    grid[R - 2][col] = 0;
  }

  // Rising stepping-stone platforms.
  fillRect(24, R - 7, 4, 1);
  fillRect(30, R - 11, 4, 1);
  fillRect(36, R - 15, 4, 1);

  // Tall wall to give the level some verticality.
  fillRect(44, R - 20, 3, 17);

  // Upper platform reached after the stepping stones / wall.
  fillRect(50, R - 15, 12, 1);

  // Floating platform chain over a long gap.
  fillRect(66, R - 9, 5, 1);
  fillRect(74, R - 12, 5, 1);
  fillRect(82, R - 9, 5, 1);

  // Final plateau.
  fillRect(90, R - 3, 10, 3);

  return grid;
}
