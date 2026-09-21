import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { CollectedItems } from '../progress/CollectedItems';
import { GameSave } from '../progress/GameSave';
import { GameAudio } from '../audio/GameAudio';
import {
  activityStreak,
  addActivity,
  calculateStats,
  currentLevelXp,
  PlayerProgress,
  totalStats,
  weeklyGoals,
  xpForLevel,
  type ActivityKind,
  type CharacterAppearance,
  type CharacterStats,
  type CloakId,
  type HairId,
  type LifeInputs
} from '../progress/PlayerProgress';

type TitleView = 'menu' | 'profile' | 'customize' | 'checkin' | 'character' | 'leaderboard';

const STAT_LABELS: Array<[keyof CharacterStats, string, string]> = [
  ['strength', 'STR', 'Strength'],
  ['speed', 'SPD', 'Speed'],
  ['stamina', 'STA', 'Stamina'],
  ['defense', 'DEF', 'Defense'],
  ['intelligence', 'INT', 'Intelligence'],
  ['discipline', 'DIS', 'Discipline']
];

const INPUTS: Array<{ key: keyof LifeInputs; label: string; hint: string; min: number; max: number; step?: number }> = [
  { key: 'pushups', label: 'Strict push-ups', hint: 'Strength · max clean reps', min: 0, max: 200 },
  { key: 'sprintSeconds', label: '100 m sprint', hint: 'Speed · seconds', min: 8, max: 60, step: .1 },
  { key: 'mileSeconds', label: 'One-mile run', hint: 'Stamina · total seconds', min: 240, max: 1800 },
  { key: 'plankSeconds', label: 'Forearm plank', hint: 'Defense · max seconds', min: 0, max: 600 },
  { key: 'iqScore', label: 'Validated IQ score', hint: 'IQ · optional', min: 55, max: 160 }
];

const SKIN_COLORS = ['#8d5c3c', '#b97950', '#d9a675', '#efc394', '#7a4930'];
const CLOAK_COLORS: Record<CloakId, string> = { moss: '#47795a', sunroot: '#c28b42', moonfern: '#4c86a8', guardian: '#7f4f78' };
const HAIR_COLORS: Record<HairId, string> = { raven: '#07110b', earth: '#553522', silver: '#b9c6bd' };

export class TitleScene extends Phaser.Scene {
  private root!: HTMLDivElement;
  private view: TitleView = 'menu';
  private feedback = '';

  constructor() { super('TitleScene'); }

  preload(): void { this.load.image('title-forest', 'backgrounds/biosphere-panorama-hero.jpg'); }

  create(): void {
    GameSave.load();
    GameSave.installAutosave();
    const background = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT, 'title-forest').setOrigin(0.5, 1);
    background.setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x03110d, 0.63).setOrigin(0);
    this.root = document.createElement('div');
    this.root.className = 'title-root';
    this.add.dom(GAME_WIDTH / 2, GAME_HEIGHT / 2, this.root);
    this.view = PlayerProgress.profileCompleted ? 'menu' : 'profile';
    this.render();
  }

  private render(): void {
    if (this.view === 'profile') this.renderProfile();
    else if (this.view === 'customize') this.renderCustomize();
    else if (this.view === 'checkin') this.renderCheckIn();
    else if (this.view === 'character') this.renderCharacter();
    else if (this.view === 'leaderboard') this.renderLeaderboard();
    else this.renderMenu();
  }

  private renderMenu(): void {
    const levelXp = currentLevelXp();
    const levelCap = xpForLevel(PlayerProgress.level);
    this.root.innerHTML = `
      <section class="title-card title-menu" aria-label="The Hollow Roots title menu">
        <p class="eyebrow">REAL EFFORT. IN-GAME POWER.</p>
        <h1>THE HOLLOW ROOTS</h1>
        <p class="title-copy">Real effort becomes power.</p>
        <div class="progress-strip"><strong>LV ${PlayerProgress.level}</strong><span>${levelXp} / ${levelCap} XP</span><i><b style="width:${Math.min(100, levelXp / levelCap * 100)}%"></b></i></div>
        <div class="title-actions">
          <button class="primary" data-action="continue">CONTINUE</button>
          <button data-action="customize">CUSTOMIZE</button>
          <button class="effort" data-action="checkin">WEEKLY QUEST</button>
          <button data-action="leaderboard">LEADERBOARD</button>
        </div>
        <p class="save-note">AUTOSAVE ON · ${activityStreak()}-DAY ACTIVE STREAK</p>
      </section>
      <aside class="title-character" aria-label="Current character preview">
        <canvas data-preview width="180" height="260"></canvas>
        <strong>LV ${PlayerProgress.level} EXPLORER</strong>
        <span>${PlayerProgress.totalXp} REAL-WORLD XP</span>
      </aside>`;
    this.drawPreview();
    this.bindViewButtons();
  }

  private renderProfile(): void {
    this.root.innerHTML = `
      <section class="title-card full-card profile-card" aria-label="Real-life baseline">
        <div class="panel-heading"><div><p class="eyebrow">STARTING ATTRIBUTES</p><h2>YOUR BASELINE</h2></div>${this.backButton()}</div>
        <p class="panel-copy">Five repeatable benchmarks set your starting power. Discipline is calculated automatically from your logged consistency.</p>
        <form data-profile-form>
          <div class="profile-grid">
            ${INPUTS.map(field => `<label><span>${field.label}<small>${field.hint}</small></span><input name="${field.key}" type="number" min="${field.min}" max="${field.max}" step="${field.step ?? 1}" value="${PlayerProgress.inputs[field.key]}"></label>`).join('')}
          </div>
          <div class="live-stats" data-live-stats>${this.statRunes(PlayerProgress.stats)}</div>
          <div class="form-actions"><button class="primary" type="submit">SAVE BASELINE</button></div>
        </form>
      </section>`;
    const form = this.root.querySelector<HTMLFormElement>('[data-profile-form]');
    form?.addEventListener('input', () => {
      const display = this.root.querySelector<HTMLElement>('[data-live-stats]');
      if (display) display.innerHTML = this.statRunes(calculateStats(this.readInputs(form), PlayerProgress.statXp));
    });
    form?.addEventListener('submit', event => {
      event.preventDefault();
      PlayerProgress.inputs = this.readInputs(form);
      PlayerProgress.stats = calculateStats(PlayerProgress.inputs, PlayerProgress.statXp);
      PlayerProgress.profileCompleted = true;
      GameSave.save();
      this.view = 'menu';
      this.render();
    });
    this.bindBack();
  }

  private renderCheckIn(): void {
    const recent = [...PlayerProgress.activities].reverse().slice(0, 4);
    const goals = weeklyGoals();
    this.root.innerHTML = `
      <section class="title-card full-card checkin-card" aria-label="Log real-world effort">
        <div class="panel-heading"><div><p class="eyebrow">RESETS EVERY MONDAY</p><h2>WEEKLY QUEST</h2></div>${this.backButton()}</div>
        <div class="checkin-summary"><span><b>${activityStreak()}</b> day streak</span><span><b>${PlayerProgress.totalXp}</b> total XP</span></div>
        ${this.feedback ? `<p class="feedback">${this.feedback}</p>` : ''}
        <p class="weekly-label">THIS WEEK</p>
        <div class="weekly-goals">${goals.map(goal => `<div class="${goal.claimed ? 'complete' : ''}"><span><strong>${goal.label}</strong><small>+${goal.reward} XP</small></span><i><b style="width:${goal.current / goal.target * 100}%"></b></i><em>${goal.current}/${goal.target} ${goal.unit}</em></div>`).join('')}</div>
        <p class="weekly-label">ACTIVITY LOG</p><div class="effort-grid">
          <button data-log="workout"><strong>WORKOUT</strong><small>+100 XP · STR / DEF</small></button>
          <button data-log="steps"><strong>5,000+ STEPS</strong><small>+50 XP · STA<br>once per day</small></button>
          <label><strong>RUN / WALK</strong><small>Distance builds SPD / STA</small><span><input data-amount="run" type="number" min="0.1" max="100" step="0.1" value="2"> km <button data-log="run">LOG</button></span></label>
          <label><strong>LEARN / STUDY</strong><small>Learning builds IQ</small><span><input data-amount="study" type="number" min="5" max="480" step="5" value="30"> min <button data-log="study">LOG</button></span></label>
          <button data-log="goal"><strong>DAILY GOAL</strong><small>+60 XP<br>builds automatic Discipline</small></button>
        </div>
        <div class="recent-log"><h3>RECENT</h3>${recent.length ? recent.map(entry => `<span><b>${entry.kind.toUpperCase()}</b><em>+${entry.xp} XP</em><small>${entry.date}</small></span>`).join('') : '<p>No effort logged yet.</p>'}</div>
      </section>`;
    for (const button of this.root.querySelectorAll<HTMLButtonElement>('[data-log]')) {
      button.addEventListener('click', () => {
        const kind = button.dataset.log as ActivityKind;
        const input = this.root.querySelector<HTMLInputElement>(`[data-amount="${kind}"]`);
        const result = addActivity(kind, input ? Number(input.value) : 1);
        this.feedback = result.ok ? `${result.message} +${result.xp} XP` : result.message;
        if (result.ok) GameSave.save();
        this.renderCheckIn();
      });
    }
    this.bindBack();
  }

  private renderCharacter(): void {
    const s = PlayerProgress.stats;
    const unlocks = [
      ['Iron Greatblade', 'Weapon', s.strength >= 14, 'STR 14'],
      ['Gale Daggers', 'Weapon', s.speed >= 14, 'SPD 14'],
      ['Runebound Staff', 'Weapon', s.intelligence >= 14, 'INT 14'],
      ['Bastion Shield', 'Weapon', s.defense >= 14, 'DEF 14'],
      ['Second Wind', 'Skill', s.stamina >= 15, 'STA 15'],
      ['Unbroken Will', 'Skill', s.discipline >= 15, 'DIS 15']
    ] as const;
    this.root.innerHTML = `
      <section class="title-card full-card character-card" aria-label="Character stats and unlocks">
        <div class="panel-heading"><div><p class="eyebrow">REAL LIFE → GAMEPLAY</p><h2>EXPLORER</h2></div><div class="panel-tools"><button data-action="profile">BASELINE</button><button data-action="customize">APPEARANCE</button>${this.backButton()}</div></div>
        <div class="character-layout">
          <div class="stat-list">${STAT_LABELS.map(([key, short, name]) => `<div><b>${short}</b><span><strong>${name}</strong><small>${key === 'discipline' ? 'Automatic · 28-day consistency + streak' : `${PlayerProgress.statXp[key] % 250} / 250 toward next point`}</small></span><em>${s[key]}</em></div>`).join('')}</div>
          <div class="unlock-list"><h3>ARSENAL & SKILLS</h3>${unlocks.map(([name, type, unlocked, requirement]) => `<div class="${unlocked ? 'ready' : 'locked'}"><span><strong>${name}</strong><small>${type}</small></span><b>${unlocked ? 'UNLOCKED' : requirement}</b></div>`).join('')}</div>
        </div>
        <p class="panel-copy character-note">Enemies give challenge and world progress. Character XP comes from logged real effort.</p>
      </section>`;
    this.bindBack();
    this.root.querySelector('[data-action="profile"]')?.addEventListener('click', () => { this.view = 'profile'; this.render(); });
    this.root.querySelector('[data-action="customize"]')?.addEventListener('click', () => { this.view = 'customize'; this.render(); });
  }

  private renderLeaderboard(): void {
    const stats = PlayerProgress.stats;
    this.root.innerHTML = `
      <section class="title-card full-card character-card" aria-label="Online explorer leaderboard">
        <div class="panel-heading"><div><p class="eyebrow">ONLINE EXPLORERS</p><h2>LEADERBOARD</h2></div>${this.backButton()}</div>
        <div class="checkin-summary"><span><b>${totalStats()}</b> total stats</span><span><b>LV ${PlayerProgress.level}</b> explorer level</span><span><b>${activityStreak()}</b> day streak</span></div>
        <div class="leaderboard-table" role="table" aria-label="Explorer rankings">
          <div class="leaderboard-head" role="row"><span>RANK</span><span>EXPLORER</span><span>LEVEL</span><span>TOTAL</span></div>
          <div class="leaderboard-self" role="row"><b>—</b><span><strong>YOU</strong><small>Saved on this device</small></span><b>LV ${PlayerProgress.level}</b><b>${totalStats()}</b></div>
        </div>
        <div class="live-stats leaderboard-stats">${this.statRunes(stats)}</div>
        <p class="panel-copy character-note">No other explorers have synced yet. Online rankings will list shared Strength, IQ, Stamina, Speed, Defense, and overall totals here.</p>
      </section>`;
    this.bindBack();
  }

  private renderCustomize(): void {
    const collected = CollectedItems.size;
    const scoreTotal = totalStats();
    const cloaks: Array<{ id: CloakId; label: string; unlocked: boolean; requirement: string }> = [
      { id: 'moss', label: 'Moss', unlocked: true, requirement: 'Starter' },
      { id: 'sunroot', label: 'Sunroot', unlocked: scoreTotal >= 72, requirement: '72 total stats' },
      { id: 'moonfern', label: 'Moonfern', unlocked: collected >= 2, requirement: '2 relics' },
      { id: 'guardian', label: 'Guardian', unlocked: PlayerProgress.guardianDefeated, requirement: 'Defeat guardian' }
    ];
    const hairs: Array<{ id: HairId; label: string; unlocked: boolean; requirement: string }> = [
      { id: 'raven', label: 'Raven', unlocked: true, requirement: 'Available' },
      { id: 'earth', label: 'Earth', unlocked: true, requirement: 'Available' },
      { id: 'silver', label: 'Silver', unlocked: PlayerProgress.level >= 3, requirement: 'Reach level 3' }
    ];
    this.root.innerHTML = `
      <section class="title-card customize-card" aria-label="Character customization">
        <div class="panel-heading"><div><p class="eyebrow">EQUIPMENT ALTAR</p><h2>CUSTOMIZE</h2></div>${this.backButton()}</div>
        <div class="custom-section"><h3>SKIN TONE</h3><div class="choice-row">${SKIN_COLORS.map((color, index) => `<button class="swatch ${PlayerProgress.appearance.skinIndex === index ? 'selected' : ''}" style="--swatch:${color}" data-skin="${index}" aria-label="Skin tone ${index + 1}"></button>`).join('')}</div></div>
        <div class="custom-section"><h3>CLOAK</h3><div class="option-grid">${cloaks.map(option => this.customOption('cloak', option.id, option.label, option.unlocked, option.requirement, PlayerProgress.appearance.cloak === option.id)).join('')}</div></div>
        <div class="custom-section"><h3>HAIR</h3><div class="option-grid">${hairs.map(option => this.customOption('hair', option.id, option.label, option.unlocked, option.requirement, PlayerProgress.appearance.hair === option.id)).join('')}</div></div>
        <p class="save-note">Selections save immediately.</p>
      </section>
      <aside class="title-character custom-preview"><canvas data-preview width="180" height="260"></canvas><strong>YOUR EXPLORER</strong><span>${scoreTotal} TOTAL STATS</span></aside>`;
    this.drawPreview();
    this.bindBack();
    for (const button of this.root.querySelectorAll<HTMLButtonElement>('[data-skin]')) button.addEventListener('click', () => { PlayerProgress.appearance.skinIndex = Number(button.dataset.skin); GameSave.save(); this.renderCustomize(); });
    for (const button of this.root.querySelectorAll<HTMLButtonElement>('[data-cloak]:not([disabled])')) button.addEventListener('click', () => { PlayerProgress.appearance.cloak = button.dataset.cloak as CloakId; GameSave.save(); this.renderCustomize(); });
    for (const button of this.root.querySelectorAll<HTMLButtonElement>('[data-hair]:not([disabled])')) button.addEventListener('click', () => { PlayerProgress.appearance.hair = button.dataset.hair as HairId; GameSave.save(); this.renderCustomize(); });
  }

  private bindViewButtons(): void {
    this.root.querySelector('[data-action="continue"]')?.addEventListener('click', () => this.startGame());
    for (const view of ['profile', 'customize', 'checkin', 'character', 'leaderboard'] as TitleView[]) this.root.querySelector(`[data-action="${view}"]`)?.addEventListener('click', () => { this.view = view; this.feedback = ''; this.render(); });
  }

  private bindBack(): void { this.root.querySelector('[data-action="back"]')?.addEventListener('click', () => { this.view = 'menu'; this.feedback = ''; this.render(); }); }
  private backButton(): string { return PlayerProgress.profileCompleted ? '<button class="back" data-action="back">← TITLE</button>' : ''; }

  private readInputs(form: HTMLFormElement): LifeInputs {
    const data = new FormData(form);
    return Object.fromEntries(INPUTS.map(field => {
      const value = Number(data.get(field.key));
      return [field.key, Phaser.Math.Clamp(Number.isFinite(value) ? value : 0, field.min, field.max)];
    })) as unknown as LifeInputs;
  }

  private statRunes(stats: CharacterStats): string { return STAT_LABELS.map(([key, label]) => `<span><b>${label}</b><strong>${stats[key]}</strong></span>`).join(''); }

  private customOption(type: 'cloak' | 'hair', id: string, label: string, unlocked: boolean, requirement: string, selected: boolean): string {
    return `<button class="custom-option ${selected ? 'selected' : ''} ${unlocked ? '' : 'locked'}" data-${type}="${id}" ${unlocked ? '' : 'disabled'}><strong>${label}</strong><small>${unlocked ? requirement : 'LOCKED · ' + requirement}</small></button>`;
  }

  private startGame(): void {
    if (!PlayerProgress.profileCompleted) { this.view = 'profile'; this.render(); return; }
    GameSave.save();
    GameAudio.unlock();
    GameAudio.startAmbient();
    this.scene.start('ZoneScene', { zoneKey: PlayerProgress.currentZone, spawnName: PlayerProgress.currentSpawn });
  }

  private drawPreview(): void {
    const canvas = this.root.querySelector<HTMLCanvasElement>('[data-preview]');
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    const appearance: CharacterAppearance = PlayerProgress.appearance;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingEnabled = false;
    const scale = 6, ox = 24, oy = 18;
    const rect = (color: string, x: number, y: number, width: number, height: number): void => { context.fillStyle = color; context.fillRect(ox + x * scale, oy + y * scale, width * scale, height * scale); };
    const skin = SKIN_COLORS[appearance.skinIndex] ?? SKIN_COLORS[1];
    const cloak = CLOAK_COLORS[appearance.cloak], hair = HAIR_COLORS[appearance.hair];
    context.shadowColor = 'rgba(151, 239, 182, .35)'; context.shadowBlur = 22; rect(cloak, 4, 12, 14, 16); context.shadowBlur = 0;
    rect(skin, 7, 3, 9, 9); rect(hair, 6, 0, 11, 4); rect(hair, 4, 2, 4, 9); rect('#c9ffd7', 14, 6, 2, 2);
    rect(cloak, 2, 15, 3, 11); rect(cloak, 17, 15, 3, 11); rect('#17241c', 5, 28, 5, 7); rect('#17241c', 13, 28, 5, 7); rect('#d8ffe4', 4, 34, 6, 2); rect('#d8ffe4', 13, 34, 6, 2);
  }
}
