import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { CollectedItems } from '../progress/CollectedItems';
import { GameSave } from '../progress/GameSave';
import {
  calculateStats,
  PlayerProgress,
  totalStats,
  type CharacterAppearance,
  type CharacterStats,
  type CloakId,
  type HairId,
  type LifeInputs
} from '../progress/PlayerProgress';

type TitleView = 'menu' | 'profile' | 'customize';

const STAT_LABELS: Array<[keyof CharacterStats, string]> = [
  ['strength', 'STR'],
  ['dexterity', 'DEX'],
  ['stamina', 'STA'],
  ['intelligence', 'INT'],
  ['insight', 'INS'],
  ['resolve', 'RES']
];

const INPUTS: Array<{ key: keyof LifeInputs; label: string; hint: string; min: number; max: number }> = [
  { key: 'pushups', label: 'Max push-ups', hint: 'Strength', min: 0, max: 200 },
  { key: 'pullups', label: 'Max pull-ups', hint: 'Strength', min: 0, max: 100 },
  { key: 'balanceSeconds', label: 'Single-leg balance', hint: 'seconds', min: 0, max: 300 },
  { key: 'coordinationDays', label: 'Skill or sport practice', hint: 'days / week', min: 0, max: 7 },
  { key: 'cardioMinutes', label: 'Cardio volume', hint: 'minutes / week', min: 0, max: 1000 },
  { key: 'continuousMinutes', label: 'Longest steady effort', hint: 'minutes', min: 0, max: 300 },
  { key: 'learningHours', label: 'Focused learning', hint: 'hours / week', min: 0, max: 100 },
  { key: 'learningDays', label: 'Learning frequency', hint: 'days / week', min: 0, max: 7 },
  { key: 'reflectionDays', label: 'Reflection or mindfulness', hint: 'days / week', min: 0, max: 7 },
  { key: 'detailRating', label: 'Attention to details', hint: '1–5', min: 1, max: 5 },
  { key: 'habitStreak', label: 'Current habit streak', hint: 'days', min: 0, max: 3650 },
  { key: 'followThroughRating', label: 'Follow-through', hint: '1–5', min: 1, max: 5 }
];

const SKIN_COLORS = ['#8d5c3c', '#b97950', '#d9a675', '#efc394', '#7a4930'];
const CLOAK_COLORS: Record<CloakId, string> = {
  moss: '#47795a',
  sunroot: '#c28b42',
  moonfern: '#4c86a8',
  guardian: '#7f4f78'
};
const HAIR_COLORS: Record<HairId, string> = { raven: '#07110b', earth: '#553522', silver: '#b9c6bd' };

export class TitleScene extends Phaser.Scene {
  private root!: HTMLDivElement;
  private view: TitleView = 'menu';

  constructor() {
    super('TitleScene');
  }

  preload(): void {
    this.load.image('title-forest', 'backgrounds/biosphere-panorama-hero.jpg');
  }

  create(): void {
    GameSave.load();
    GameSave.installAutosave();

    const background = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT, 'title-forest').setOrigin(0.5, 1);
    background.setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x03110d, 0.55).setOrigin(0);
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x071913, 0.28).setOrigin(0);

    this.root = document.createElement('div');
    this.root.className = 'title-root';
    this.add.dom(GAME_WIDTH / 2, GAME_HEIGHT / 2, this.root);
    this.view = PlayerProgress.profileCompleted ? 'menu' : 'profile';
    this.render();
  }

  private render(): void {
    if (this.view === 'profile') this.renderProfile();
    else if (this.view === 'customize') this.renderCustomize();
    else this.renderMenu();
  }

  private renderMenu(): void {
    const savedAt = GameSave.updatedAt();
    const saveLabel = savedAt
      ? `AUTOSAVE ON · ${new Date(savedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`
      : 'AUTOSAVE ON · New profile';
    this.root.innerHTML = `
      <section class="title-card title-menu" aria-label="The Hollow Roots title menu">
        <p class="eyebrow">A REAL-LIFE STAT RPG</p>
        <h1>THE HOLLOW ROOTS</h1>
        <p class="title-copy">Your habits shape the explorer. Your choices shape the world.</p>
        <div class="stat-rune-row">${this.statRunes(PlayerProgress.stats)}</div>
        <div class="title-actions">
          <button class="primary" data-action="continue">${PlayerProgress.currentSpawn === 'start' && CollectedItems.size === 0 ? 'BEGIN JOURNEY' : 'CONTINUE JOURNEY'}</button>
          <button data-action="profile">REAL-LIFE PROFILE</button>
          <button data-action="customize">CUSTOMIZE CHARACTER</button>
          <button class="quiet" data-action="new">START NEW JOURNEY</button>
        </div>
        <p class="save-note">${saveLabel} · saved on this device</p>
      </section>
      <aside class="title-character" aria-label="Current character preview">
        <canvas data-preview width="180" height="260"></canvas>
        <strong>LV ${PlayerProgress.level} EXPLORER</strong>
        <span>${PlayerProgress.appearance.cloak.toUpperCase()} CLOAK</span>
      </aside>`;
    this.drawPreview();
    this.root.querySelector('[data-action="continue"]')?.addEventListener('click', () => this.startGame());
    this.root.querySelector('[data-action="profile"]')?.addEventListener('click', () => { this.view = 'profile'; this.render(); });
    this.root.querySelector('[data-action="customize"]')?.addEventListener('click', () => { this.view = 'customize'; this.render(); });
    this.root.querySelector('[data-action="new"]')?.addEventListener('click', () => {
      if (!window.confirm('Start a new journey? Your profile and appearance stay, but world progress resets.')) return;
      GameSave.startNewJourney();
      this.renderMenu();
    });
  }

  private renderProfile(): void {
    this.root.innerHTML = `
      <section class="title-card profile-card" aria-label="Real-life character profile">
        <div class="panel-heading">
          <div><p class="eyebrow">CHARACTER ORIGIN</p><h2>REAL-LIFE PROFILE</h2></div>
          ${PlayerProgress.profileCompleted ? '<button class="back" data-action="back">← TITLE</button>' : ''}
        </div>
        <p class="panel-copy">Use honest current numbers. These are game attributes, not medical or psychological scores. Intelligence reflects learning practice, not innate IQ.</p>
        <form data-profile-form>
          <div class="profile-grid">
            ${INPUTS.map(field => `
              <label><span>${field.label}<small>${field.hint}</small></span>
                <input name="${field.key}" type="number" min="${field.min}" max="${field.max}" step="1" value="${PlayerProgress.inputs[field.key]}">
              </label>`).join('')}
          </div>
          <div class="live-stats" data-live-stats>${this.statRunes(PlayerProgress.stats)}</div>
          <div class="form-actions"><button class="primary" type="submit">FORGE CHARACTER</button></div>
        </form>
      </section>`;
    const form = this.root.querySelector<HTMLFormElement>('[data-profile-form]');
    const update = (): void => {
      if (!form) return;
      const stats = calculateStats(this.readInputs(form));
      const display = this.root.querySelector<HTMLElement>('[data-live-stats]');
      if (display) display.innerHTML = this.statRunes(stats);
    };
    form?.addEventListener('input', update);
    form?.addEventListener('submit', (event) => {
      event.preventDefault();
      PlayerProgress.inputs = this.readInputs(form);
      PlayerProgress.stats = calculateStats(PlayerProgress.inputs);
      PlayerProgress.profileCompleted = true;
      GameSave.save();
      this.view = 'menu';
      this.render();
    });
    this.root.querySelector('[data-action="back"]')?.addEventListener('click', () => { this.view = 'menu'; this.render(); });
  }

  private renderCustomize(): void {
    const collected = CollectedItems.size;
    const scoreTotal = totalStats();
    const cloakOptions: Array<{ id: CloakId; label: string; unlocked: boolean; requirement: string }> = [
      { id: 'moss', label: 'Moss', unlocked: true, requirement: 'Starter cloak' },
      { id: 'sunroot', label: 'Sunroot', unlocked: scoreTotal >= 72, requirement: '72 total stats' },
      { id: 'moonfern', label: 'Moonfern', unlocked: collected >= 2, requirement: 'Recover 2 relics' },
      { id: 'guardian', label: 'Guardian', unlocked: PlayerProgress.guardianDefeated, requirement: 'Defeat the guardian' }
    ];
    const hairOptions: Array<{ id: HairId; label: string; unlocked: boolean; requirement: string }> = [
      { id: 'raven', label: 'Raven', unlocked: true, requirement: 'Available' },
      { id: 'earth', label: 'Earth', unlocked: true, requirement: 'Available' },
      { id: 'silver', label: 'Silver', unlocked: PlayerProgress.level >= 3, requirement: 'Reach level 3' }
    ];
    this.root.innerHTML = `
      <section class="title-card customize-card" aria-label="Character customization">
        <div class="panel-heading"><div><p class="eyebrow">EQUIPMENT ALTAR</p><h2>CUSTOMIZE</h2></div><button class="back" data-action="back">← TITLE</button></div>
        <div class="custom-section"><h3>SKIN TONE</h3><div class="choice-row">
          ${SKIN_COLORS.map((color, index) => `<button class="swatch ${PlayerProgress.appearance.skinIndex === index ? 'selected' : ''}" style="--swatch:${color}" data-skin="${index}" aria-label="Skin tone ${index + 1}"></button>`).join('')}
        </div></div>
        <div class="custom-section"><h3>CLOAK</h3><div class="option-grid">
          ${cloakOptions.map(option => this.customOption('cloak', option.id, option.label, option.unlocked, option.requirement, PlayerProgress.appearance.cloak === option.id)).join('')}
        </div></div>
        <div class="custom-section"><h3>HAIR</h3><div class="option-grid">
          ${hairOptions.map(option => this.customOption('hair', option.id, option.label, option.unlocked, option.requirement, PlayerProgress.appearance.hair === option.id)).join('')}
        </div></div>
        <p class="save-note">Selections save immediately. More relics and victories unlock more styles.</p>
      </section>
      <aside class="title-character custom-preview"><canvas data-preview width="180" height="260"></canvas><strong>YOUR EXPLORER</strong><span>${scoreTotal} TOTAL STATS · ${collected} RELICS</span></aside>`;
    this.drawPreview();
    this.root.querySelector('[data-action="back"]')?.addEventListener('click', () => { this.view = 'menu'; this.render(); });
    for (const button of this.root.querySelectorAll<HTMLButtonElement>('[data-skin]')) {
      button.addEventListener('click', () => {
        PlayerProgress.appearance.skinIndex = Number(button.dataset.skin);
        GameSave.save();
        this.renderCustomize();
      });
    }
    for (const button of this.root.querySelectorAll<HTMLButtonElement>('[data-cloak]:not([disabled])')) {
      button.addEventListener('click', () => {
        PlayerProgress.appearance.cloak = button.dataset.cloak as CloakId;
        GameSave.save();
        this.renderCustomize();
      });
    }
    for (const button of this.root.querySelectorAll<HTMLButtonElement>('[data-hair]:not([disabled])')) {
      button.addEventListener('click', () => {
        PlayerProgress.appearance.hair = button.dataset.hair as HairId;
        GameSave.save();
        this.renderCustomize();
      });
    }
  }

  private readInputs(form: HTMLFormElement): LifeInputs {
    const data = new FormData(form);
    return Object.fromEntries(INPUTS.map(field => {
      const value = Number(data.get(field.key));
      return [field.key, Phaser.Math.Clamp(Number.isFinite(value) ? value : 0, field.min, field.max)];
    })) as unknown as LifeInputs;
  }

  private statRunes(stats: CharacterStats): string {
    return STAT_LABELS.map(([key, label]) => `<span><b>${label}</b><strong>${stats[key]}</strong></span>`).join('');
  }

  private customOption(type: 'cloak' | 'hair', id: string, label: string, unlocked: boolean, requirement: string, selected: boolean): string {
    return `<button class="custom-option ${selected ? 'selected' : ''} ${unlocked ? '' : 'locked'}" data-${type}="${id}" ${unlocked ? '' : 'disabled'}>
      <strong>${unlocked ? label : '◆ ' + label}</strong><small>${unlocked ? requirement : 'LOCKED · ' + requirement}</small>
    </button>`;
  }

  private startGame(): void {
    if (!PlayerProgress.profileCompleted) {
      this.view = 'profile';
      this.render();
      return;
    }
    GameSave.save();
    this.scene.start('ZoneScene', { zoneKey: PlayerProgress.currentZone, spawnName: PlayerProgress.currentSpawn });
  }

  private drawPreview(): void {
    const canvas = this.root.querySelector<HTMLCanvasElement>('[data-preview]');
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    const appearance: CharacterAppearance = PlayerProgress.appearance;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingEnabled = false;
    const scale = 6;
    const ox = 24;
    const oy = 18;
    const rect = (color: string, x: number, y: number, width: number, height: number): void => {
      context.fillStyle = color;
      context.fillRect(ox + x * scale, oy + y * scale, width * scale, height * scale);
    };
    const skin = SKIN_COLORS[appearance.skinIndex] ?? SKIN_COLORS[1];
    const cloak = CLOAK_COLORS[appearance.cloak];
    const hair = HAIR_COLORS[appearance.hair];
    context.shadowColor = 'rgba(151, 239, 182, .35)';
    context.shadowBlur = 22;
    rect(cloak, 4, 12, 14, 16);
    context.shadowBlur = 0;
    rect(skin, 7, 3, 9, 9);
    rect(hair, 6, 0, 11, 4);
    rect(hair, 4, 2, 4, 9);
    rect('#c9ffd7', 14, 6, 2, 2);
    rect(cloak, 2, 15, 3, 11);
    rect(cloak, 17, 15, 3, 11);
    rect('#17241c', 5, 28, 5, 7);
    rect('#17241c', 13, 28, 5, 7);
    rect('#d8ffe4', 4, 34, 6, 2);
    rect('#d8ffe4', 13, 34, 6, 2);
  }
}
