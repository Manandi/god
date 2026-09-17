import type { State } from '../fsm/StateMachine';
import type { Player } from './Player';

// Movement state remains separate from presentation. The player texture now
// has its own palette, so states must not wash the entire character in a
// placeholder debug tint.

export class IdleState implements State<Player> {
  readonly name = 'idle';

  enter(player: Player): void {
    player.clearTint();
  }
}

export class RunState implements State<Player> {
  readonly name = 'run';

  enter(player: Player): void {
    player.clearTint();
  }
}

export class JumpState implements State<Player> {
  readonly name = 'jump';

  enter(player: Player): void {
    player.clearTint();
  }
}

export class FallState implements State<Player> {
  readonly name = 'fall';

  enter(player: Player): void {
    player.clearTint();
  }
}

export class ClimbState implements State<Player> {
  readonly name = 'climb';

  enter(player: Player): void {
    player.clearTint();
  }
}
