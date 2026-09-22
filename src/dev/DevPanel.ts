import { DevMode } from './DevMode';

export interface DevButton {
  label: string;
  run: () => void;
  /** When present the label is rewritten from the returned state after a click. */
  state?: () => string;
}

export interface DevGroup {
  title: string;
  buttons?: DevButton[];
  /** A number field plus the button that consumes it. */
  numberField?: { value: number; min: number; max: number; label: string; run: (value: number) => void };
}

let bar: HTMLDivElement | undefined;
let note = '';

function ensureBar(): HTMLDivElement {
  if (bar?.isConnected) return bar;
  bar = document.createElement('div');
  bar.className = 'dev-bar';
  // Attached to the document rather than the Phaser DOM container, so it sits
  // in the letterbox below the canvas instead of covering the game.
  document.body.appendChild(bar);
  return bar;
}

/** One shared toolbar outside the game frame. Each scene republishes its own
 * groups on create; nothing renders at all unless dev mode is switched on. */
export const DevPanel = {
  setNote(text: string): void {
    note = text;
    const slot = bar?.querySelector<HTMLElement>('[data-dev-note]');
    if (slot) slot.textContent = text;
  },

  clear(): void {
    bar?.remove();
    bar = undefined;
  },

  render(groups: DevGroup[]): void {
    if (!DevMode.enabled) {
      this.clear();
      return;
    }
    const element = ensureBar();
    element.innerHTML = '';

    const collapse = document.createElement('button');
    collapse.className = 'dev-collapse';
    collapse.textContent = 'DEV −';
    collapse.addEventListener('click', () => {
      const hidden = element.classList.toggle('dev-bar-collapsed');
      collapse.textContent = hidden ? 'DEV +' : 'DEV −';
    });
    element.appendChild(collapse);

    const body = document.createElement('div');
    body.className = 'dev-bar-body';
    element.appendChild(body);

    for (const group of groups) {
      const section = document.createElement('section');
      section.className = 'dev-group';
      const heading = document.createElement('p');
      heading.textContent = group.title;
      section.appendChild(heading);
      const row = document.createElement('div');
      row.className = 'dev-group-row';
      section.appendChild(row);

      for (const button of group.buttons ?? []) {
        const element2 = document.createElement('button');
        element2.textContent = button.label;
        element2.addEventListener('click', () => {
          button.run();
          if (button.state) element2.textContent = button.state();
          focusGame();
        });
        row.appendChild(element2);
      }

      if (group.numberField) {
        const field = group.numberField;
        const input = document.createElement('input');
        input.type = 'number';
        input.value = String(field.value);
        input.min = String(field.min);
        input.max = String(field.max);
        const go = document.createElement('button');
        go.textContent = field.label;
        go.addEventListener('click', () => {
          field.run(Number(input.value));
          focusGame();
        });
        row.append(input, go);
      }
      body.appendChild(section);
    }

    const noteSlot = document.createElement('p');
    noteSlot.className = 'dev-note';
    noteSlot.dataset.devNote = '';
    noteSlot.textContent = note;
    body.appendChild(noteSlot);
  }
};

/** Clicking a button steals focus, which would otherwise kill movement keys. */
function focusGame(): void {
  document.querySelector<HTMLCanvasElement>('#app canvas')?.focus();
  window.focus();
}
