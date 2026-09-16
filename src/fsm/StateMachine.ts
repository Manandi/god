export interface State<TOwner> {
  readonly name: string;
  enter?(owner: TOwner, previous: string | null): void;
  execute?(owner: TOwner, delta: number): void;
  exit?(owner: TOwner, next: string): void;
}

export class StateMachine<TOwner> {
  private states = new Map<string, State<TOwner>>();
  private current: State<TOwner> | null = null;

  constructor(private readonly owner: TOwner) {}

  add(state: State<TOwner>): this {
    this.states.set(state.name, state);
    return this;
  }

  get currentName(): string | null {
    return this.current?.name ?? null;
  }

  is(name: string): boolean {
    return this.current?.name === name;
  }

  transition(name: string): void {
    if (this.current?.name === name) return;
    const next = this.states.get(name);
    if (!next) {
      throw new Error(`Unknown state "${name}"`);
    }
    const previousName = this.current?.name ?? null;
    this.current?.exit?.(this.owner, name);
    this.current = next;
    next.enter?.(this.owner, previousName);
  }

  update(delta: number): void {
    this.current?.execute?.(this.owner, delta);
  }
}
