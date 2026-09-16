import type { State } from '../fsm/StateMachine';
import type { Player } from './Player';

// Each state's enter() sets a placeholder tint so state changes are visible
// without real art; swap for player.anims.play(...) once sprite sheets land (Phase 5).

export class IdleState implements State<Player> {
  readonly name = 'idle';

  enter(player: Player): void {
    player.setTint(0x38bdf8);
  }
}

export class RunState implements State<Player> {
  readonly name = 'run';

  enter(player: Player): void {
    player.setTint(0x4ade80);
  }
}

export class JumpState implements State<Player> {
  readonly name = 'jump';

  enter(player: Player): void {
    player.setTint(0xfacc15);
  }
}

export class FallState implements State<Player> {
  readonly name = 'fall';

  enter(player: Player): void {
    player.setTint(0xfb923c);
  }
}
