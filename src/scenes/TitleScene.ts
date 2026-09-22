import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { CollectedItems } from '../progress/CollectedItems';
import { GameSave } from '../progress/GameSave';
import { GameAudio } from '../audio/GameAudio';
import { DevMode, type DevPreset } from '../dev/DevMode';
import { QUIZ_LENGTH, QUIZ_SECONDS, quizForToday, quizScore, type QuizQuestion } from '../progress/ReasoningQuiz';
import {
  activityStreak,
  addActivity,
  applyWeeklyCheckIn,
  calculateStats,
  checkInDue,
  currentLevelXp,
  currentWeekKey,
  DEFAULT_INPUTS,
  IMPERIAL_UNITS,
  INPUT_BOUNDS,
  KM_PER_MILE,
  PlayerProgress,
  scoreMetric,
  totalStats,
  weeklyGoals,
  xpForLevel,
  type ActivityKind,
  type CharacterAppearance,
  type CharacterStats,
  type CloakId,
  type StatKey,
  type HairId,
  type LifeInputs
} from '../progress/PlayerProgress';

type TitleView = 'dialogue' | 'weekly' | 'menu' | 'create' | 'questions' | 'quiz' | 'summary' | 'customize' | 'checkin' | 'character' | 'leaderboard';

const STAT_LABELS: Array<[keyof CharacterStats, string, string]> = [
  ['strength', 'STR', 'Strength'],
  ['speed', 'SPD', 'Speed'],
  ['stamina', 'STA', 'Stamina'],
  ['defense', 'DEF', 'Defense'],
  ['intelligence', 'INT', 'Intelligence'],
  ['discipline', 'DIS', 'Discipline']
];

interface Question {
  key: keyof LifeInputs;
  stat: keyof CharacterStats;
  prompt: string;
  help: string;
  unit: string;
  step: number;
  /** Percentage of its stat this metric carries, shown so the split is visible. */
  share: number;
  /** Asked as minutes + seconds rather than one raw seconds field. */
  asDuration?: boolean;
  optional?: boolean;
}

/** Intelligence's second input comes from the reasoning quiz that runs after
 * these, and Discipline has no question at all — it reads off consistency. */
const QUESTIONS: Question[] = [
  { key: 'pushups', stat: 'strength', prompt: 'How many push-ups can you do?', help: 'Strict form, one unbroken set, going to failure.', unit: 'reps', step: 1, share: 60 },
  { key: 'pullups', stat: 'strength', prompt: 'How many pull-ups can you do?', help: 'Dead hang to chin over the bar. Zero is a normal answer.', unit: 'reps', step: 1, share: 40 },
  { key: 'dashSeconds', stat: 'speed', prompt: 'How fast is your 40-yard dash?', help: 'Roughly 37 metres from a standing start. An untrained adult is around 5.5 seconds; NFL combine times run near 4.4.', unit: 'seconds', step: 0.1, share: 70 },
  { key: 'verticalJumpCm', stat: 'speed', prompt: 'How high can you jump?', help: 'Standing vertical leap. Chalk your fingers, reach up against a wall, then jump and measure the gap.', unit: 'cm', step: 1, share: 30 },
  { key: 'mileSeconds', stat: 'stamina', prompt: 'What is your one-mile time?', help: 'Best effort over a mile, roughly four laps of a running track.', unit: '', step: 1, asDuration: true, share: 70 },
  { key: 'restingHeartRate', stat: 'stamina', prompt: 'What is your resting heart rate?', help: 'Beats per minute, measured sitting still. Lower means better conditioning.', unit: 'bpm', step: 1, share: 30 },
  { key: 'plankSeconds', stat: 'defense', prompt: 'How long can you hold a plank?', help: 'Forearm plank, flat back, held until form breaks.', unit: 'seconds', step: 1, share: 60 },
  { key: 'benchPressKg', stat: 'defense', prompt: 'What is your best bench press?', help: 'Heaviest single rep with good form, bar included. Enter 0 if you have never tested it.', unit: 'kg', step: 2.5, share: 40 },
  { key: 'sleepHours', stat: 'intelligence', prompt: 'How many hours do you sleep?', help: 'On an average night. Sleep is what consolidates everything you learn.', unit: 'hours', step: 0.5, share: 30 }
];

const NARRATOR_NAME = 'MYCEL';

const INTRO_LINES = [
  'Ah. Another one stirs beneath the roots.',
  'Welcome to the Hollow Roots — what is left of a world that grew too fast and forgot how to stop.',
  'I am Mycel. I have kept the Heartseed since before your grandparents had a name for the sky.',
  'Listen closely, because this place does not work the way other worlds do.',
  'Here you will not grow strong by killing things. Slay every creature in the canopy and your arms will be exactly as they were this morning.',
  'In the Hollow Roots, your strength is YOUR strength. What you lift out there, you lift in here.',
  'What you can run, you can run. How you sleep decides how clearly you think. What you have practised, you know.',
  'And it cuts both ways. Let the days slip past and the roots take it back — you will weaken here exactly as you weaken there.',
  'So before you take another step down, I must take your measure.',
  'Show me what you are, and I will show you what you could become.'
];

const WEEKLY_LINES = [
  'You are back. Good — a week has turned while you were away.',
  'The roots keep their own ledger, but they cannot see what you did up there. Only you can tell me that.',
  'So account for it. What you trained, how far you moved, how you slept, what you put in your head.',
  'Answer straight. Inflate it and you only cheat the numbers you carry.'
];

const SKIN_COLORS = ['#8d5c3c', '#b97950', '#d9a675', '#efc394', '#7a4930'];
const CLOAK_COLORS: Record<CloakId, string> = { moss: '#47795a', sunroot: '#c28b42', moonfern: '#4c86a8', guardian: '#7f4f78' };
const HAIR_COLORS: Record<HairId, string> = { raven: '#07110b', earth: '#553522', silver: '#b9c6bd' };

export class TitleScene extends Phaser.Scene {
  private root!: HTMLDivElement;
  private view: TitleView = 'menu';
  private feedback = '';
  private questionIndex = 0;
  private draft: LifeInputs = { ...PlayerProgress.inputs };
  private introLine = 0;
  private dialogueLines: string[] = INTRO_LINES;
  private dialogueFinishLabel = 'BEGIN →';
  private dialogueOnDone: () => void = () => {};
  private quizCorrect = 0;
  private quizSecondsUsed = 0;
  private confirmingReset = false;
  private checkInDeltas?: Partial<Record<StatKey, number>>;
  private devNote = '';
  private introTyper?: Phaser.Time.TimerEvent;
  private introTyping = false;
  private quizIndex = 0;
  private quizAnswers: number[] = [];
  private quizDeadline = 0;
  private quizTicker?: Phaser.Time.TimerEvent;

  constructor() { super('TitleScene'); }

  preload(): void { this.load.image('title-forest', 'backgrounds/biosphere-panorama-hero.jpg'); }

  create(): void {
    GameSave.load();
    GameSave.installAutosave();
    DevMode.init();
    this.input.keyboard?.on('keydown-D', (event: KeyboardEvent) => {
      if (!event.ctrlKey || !event.shiftKey) return;
      this.devNote = DevMode.toggle() ? 'Dev mode on.' : '';
      this.root.querySelector('.dev-panel')?.remove();
      this.render();
    });
    const background = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT, 'title-forest').setOrigin(0.5, 1);
    background.setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x03110d, 0.63).setOrigin(0);
    this.root = document.createElement('div');
    this.root.className = 'title-root';
    this.add.dom(GAME_WIDTH / 2, GAME_HEIGHT / 2, this.root);
    if (PlayerProgress.profileCompleted) {
      if (checkInDue()) {
        this.startDialogue(WEEKLY_LINES, 'REPORT →', () => { this.view = 'weekly'; this.render(); });
      } else {
        this.view = 'menu';
        this.render();
      }
    } else {
      this.startDialogue(INTRO_LINES, 'BEGIN →', () => this.beginCreation());
    }
  }

  /** A corner panel that skips whatever the tester does not need this run.
   * It is re-mounted after every render because each view rewrites the root. */
  private mountDevPanel(): void {
    if (!DevMode.enabled || this.root.querySelector('.dev-panel')) return;
    const panel = document.createElement('aside');
    panel.className = 'dev-panel';
    panel.innerHTML = `
      <p>DEV · CTRL+SHIFT+D</p>
      <div class="dev-row"><button data-dev="beginner">Beginner</button><button data-dev="average">Average</button><button data-dev="athlete">Athlete</button></div>
      <div class="dev-row"><button data-dev="go-menu">Menu</button><button data-dev="go-game">Game</button></div>
      <div class="dev-row"><button data-dev="go-intro">Intro</button><button data-dev="go-quiz">Quiz</button><button data-dev="go-weekly">Reckoning</button></div>
      <div class="dev-row"><input data-dev-days type="number" min="0" max="400" step="1" value="14"><button data-dev="idle">Idle days</button></div>
      <p data-dev-note>${this.devNote}</p>
      <div class="dev-row"><button data-dev="wipe">Wipe save</button></div>`;
    this.root.appendChild(panel);

    const seedThen = (preset: DevPreset, after: () => void): void => {
      DevMode.seedProfile(preset);
      this.draft = { ...PlayerProgress.inputs };
      this.devNote = `Seeded ${preset}.`;
      after();
    };
    const actions: Record<string, () => void> = {
      beginner: () => seedThen('beginner', () => { this.view = 'menu'; this.render(); }),
      average: () => seedThen('average', () => { this.view = 'menu'; this.render(); }),
      athlete: () => seedThen('athlete', () => { this.view = 'menu'; this.render(); }),
      'go-menu': () => { this.view = 'menu'; this.render(); },
      'go-game': () => {
        if (!PlayerProgress.profileCompleted) DevMode.seedProfile('average');
        this.startGame();
      },
      'go-intro': () => this.startDialogue(INTRO_LINES, 'BEGIN →', () => this.beginCreation()),
      'go-quiz': () => { this.draft = { ...PlayerProgress.inputs }; this.startQuiz(); },
      'go-weekly': () => { this.checkInDeltas = undefined; this.view = 'weekly'; this.render(); },
      idle: () => {
        const days = Number(panel.querySelector<HTMLInputElement>('[data-dev-days]')?.value ?? 0);
        if (!PlayerProgress.profileCompleted) DevMode.seedProfile('average');
        const lost = DevMode.simulateIdleDays(days);
        this.devNote = lost > 0 ? `${days}d idle · −${lost} stat XP` : `${days}d idle · within grace`;
        this.view = 'menu';
        this.render();
      },
      wipe: () => {
        DevMode.wipe();
        this.devNote = 'Save wiped.';
        this.startDialogue(INTRO_LINES, 'BEGIN →', () => this.beginCreation());
      }
    };
    for (const button of panel.querySelectorAll<HTMLButtonElement>('[data-dev]')) {
      button.addEventListener('click', () => actions[button.dataset.dev!]?.());
    }
  }

  private render(): void {
    if (this.view !== 'quiz') this.stopQuizTicker();
    if (this.view === 'dialogue') this.renderDialogue();
    else if (this.view === 'weekly') this.renderWeekly();
    else if (this.view === 'quiz') this.renderQuiz();
    else if (this.view === 'create') this.renderCreate();
    else if (this.view === 'questions') this.renderQuestion();
    else if (this.view === 'summary') this.renderSummary();
    else if (this.view === 'customize') this.renderCustomize();
    else if (this.view === 'checkin') this.renderCheckIn();
    else if (this.view === 'character') this.renderCharacter();
    else if (this.view === 'leaderboard') this.renderLeaderboard();
    else this.renderMenu();
    this.mountDevPanel();
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
          <button class="${this.confirmingReset ? 'danger' : 'quiet'}" data-action="reset">${this.confirmingReset ? 'ERASE EVERYTHING — TAP AGAIN' : 'NEW GAME'}</button>
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

  /** Mycel's scenes, opening and closing, share one renderer: a portrait, a
   * typed line, and a click that either finishes the typing or moves on. */
  private renderDialogue(): void {
    const lines = this.dialogueLines;
    const isLast = this.introLine === lines.length - 1;
    this.root.innerHTML = `
      <section class="intro-stage" aria-label="Introduction">
        <canvas data-narrator width="220" height="220"></canvas>
        <div class="intro-box">
          <p class="intro-name">${NARRATOR_NAME}</p>
          <p class="intro-line" data-intro-text></p>
          <div class="intro-nav">
            <button class="quiet" data-action="skip-intro">SKIP</button>
            <button class="primary" data-action="advance">${isLast ? this.dialogueFinishLabel : 'NEXT ▸'}</button>
          </div>
        </div>
      </section>`;
    this.drawNarrator();
    this.typeIntroLine(lines[this.introLine]);

    const finish = (): void => {
      this.introTyper?.remove(false);
      this.introTyping = false;
      this.dialogueOnDone();
    };
    const advance = (): void => {
      const target = this.root.querySelector<HTMLElement>('[data-intro-text]');
      if (this.introTyping) {
        this.introTyper?.remove(false);
        this.introTyping = false;
        if (target) target.textContent = lines[this.introLine];
        return;
      }
      if (isLast) { finish(); return; }
      this.introLine += 1;
      this.render();
    };
    // Browsers only allow audio after a gesture, so the drone starts on the
    // first click rather than silently failing on scene load.
    GameAudio.startIntro();
    this.root.querySelector('[data-action="advance"]')?.addEventListener('click', () => { GameAudio.startIntro(); advance(); });
    this.root.querySelector<HTMLElement>('.intro-box')?.addEventListener('click', event => {
      if (!(event.target as HTMLElement).closest('button')) advance();
    });
    this.root.querySelector('[data-action="skip-intro"]')?.addEventListener('click', finish);
  }

  private startDialogue(lines: string[], finishLabel: string, onDone: () => void): void {
    this.dialogueLines = lines;
    this.dialogueFinishLabel = finishLabel;
    this.dialogueOnDone = onDone;
    this.introLine = 0;
    this.view = 'dialogue';
    this.render();
  }

  /** Once a week Mycel asks what the player actually did, and the answers move
   * the stats. Skipping is allowed — it just banks nothing for the week. */
  private renderWeekly(): void {
    const imperial = PlayerProgress.unitSystem === 'imperial';
    const deltas = this.checkInDeltas;
    if (deltas) {
      const moved = STAT_LABELS.filter(([key]) => deltas[key] !== undefined);
      this.root.innerHTML = `
        <section class="intro-stage" aria-label="Weekly reckoning result">
          <canvas data-narrator width="220" height="220"></canvas>
          <div class="intro-box">
            <p class="intro-name">${NARRATOR_NAME}</p>
            <p class="intro-line">${moved.length
              ? `The roots felt that.<br><span class="delta-row">${moved.map(([key, short]) => `<b>${short} ${deltas[key]! > 0 ? '+' : ''}${deltas[key]}</b>`).join('')}</span>`
              : 'Nothing moved. A week is a long time to stand still — the roots noticed that too.'}</p>
            <div class="intro-nav"><span></span><button class="primary" data-action="weekly-done">CONTINUE →</button></div>
          </div>
        </section>`;
      this.drawNarrator();
      this.root.querySelector('[data-action="weekly-done"]')?.addEventListener('click', () => {
        this.checkInDeltas = undefined;
        this.view = 'menu';
        this.render();
      });
      return;
    }

    this.root.innerHTML = `
      <section class="title-card full-card question-card" aria-label="Weekly reckoning">
        <div class="panel-heading">
          <div><p class="eyebrow">THE WEEKLY RECKONING</p><h2>What did you do with the week?</h2></div>
        </div>
        <p class="panel-copy">Answer honestly. Mycel has no way of checking, and neither do the roots — but the numbers you carry are only worth what the answers were.</p>
        <div class="weekly-form">
          <label><span>Days trained<small>Any real session</small></span><input data-week="trainingDays" type="number" min="0" max="7" step="1" value="0"><b>of 7</b></label>
          <label><span>Distance covered<small>Running or walking</small></span><input data-week="distance" type="number" min="0" max="${imperial ? 300 : 500}" step="0.5" value="0"><b>${imperial ? 'mi' : 'km'}</b></label>
          <label><span>Average sleep<small>Per night this week</small></span><input data-week="sleepHours" type="number" min="0" max="14" step="0.5" value="${PlayerProgress.inputs.sleepHours}"><b>hrs</b></label>
          <label><span>Time learning<small>Deliberate study or practice</small></span><input data-week="studyHours" type="number" min="0" max="80" step="0.5" value="0"><b>hrs</b></label>
        </div>
        <div class="question-nav">
          <button class="quiet" data-action="weekly-skip">SKIP THIS WEEK</button>
          <span></span>
          <button class="primary" data-action="weekly-submit">REPORT →</button>
        </div>
      </section>`;

    const read = (name: string): number => {
      const raw = Number(this.root.querySelector<HTMLInputElement>(`[data-week="${name}"]`)?.value ?? 0);
      return Number.isFinite(raw) ? raw : 0;
    };
    this.root.querySelector('[data-action="weekly-submit"]')?.addEventListener('click', () => {
      const distance = read('distance');
      this.checkInDeltas = applyWeeklyCheckIn({
        trainingDays: read('trainingDays'),
        distanceKm: imperial ? distance * KM_PER_MILE : distance,
        sleepHours: read('sleepHours'),
        studyHours: read('studyHours')
      });
      GameSave.save();
      this.render();
    });
    this.root.querySelector('[data-action="weekly-skip"]')?.addEventListener('click', () => {
      PlayerProgress.lastCheckInWeek = currentWeekKey();
      GameSave.save();
      this.view = 'menu';
      this.render();
    });
  }

  /** Mycel's send-off, which reacts to how the assessment actually went. */
  private outroLines(): string[] {
    const total = totalStats();
    const read = total >= 90
      ? 'You are stronger than most who come down here. That will matter less than you think, but it is a start.'
      : total >= 60
      ? 'Unremarkable. That is not an insult — most of the world is unremarkable, and most of the world never comes this far down.'
      : 'You are weak. I say it plainly because the roots will say it louder, and sooner.';
    return [
      'There. I have your measure.',
      read,
      'These numbers are not a verdict. They are only where you happen to stand this morning.',
      'Train out there and you will feel it in here — in what you can lift, how far you can run, how clearly you read the dark.',
      'But do not fall away from the journey. Go quiet for long enough and the roots take back everything you brought, until you are less than you were when you arrived.',
      'Mind the drop. The canopy is a very long way up once you are beneath it.',
      'Good luck, explorer. Come back stronger than you left.'
    ];
  }

  private typeIntroLine(text: string): void {
    const target = this.root.querySelector<HTMLElement>('[data-intro-text]');
    if (!target) return;
    this.introTyper?.remove(false);
    this.introTyping = true;
    target.textContent = '';
    let shown = 0;
    this.introTyper = this.time.addEvent({
      delay: 24,
      repeat: Math.max(0, text.length - 1),
      callback: () => {
        shown += 1;
        target.textContent = text.slice(0, shown);
        if (shown >= text.length) this.introTyping = false;
      }
    });
  }

  private beginCreation(): void {
    this.introTyper?.remove(false);
    this.introTyping = false;
    this.view = 'create';
    this.render();
  }

  /** A short timed reasoning paper standing in for a formal IQ test. The copy
   * never calls the result a real IQ, because it is not one. */
  private renderQuiz(): void {
    const questions = quizForToday();
    const question = questions[this.quizIndex];
    const chosen = this.quizAnswers[this.quizIndex];
    this.root.innerHTML = `
      <section class="title-card full-card quiz-card" aria-label="Reasoning assessment">
        <div class="panel-heading">
          <div><p class="eyebrow">REASONING · ${this.quizIndex + 1} OF ${questions.length}</p><h2>Take your measure</h2></div>
          <p class="quiz-clock" data-clock>${this.clockText()}</p>
        </div>
        <i class="question-progress"><b style="width:${(this.quizIndex + 1) / questions.length * 100}%"></b></i>
        <pre class="quiz-prompt">${question.prompt}</pre>
        <div class="quiz-options">
          ${question.options.map((option, index) => `<button class="quiz-option ${chosen === index ? 'selected' : ''}" data-option="${index}">${option}</button>`).join('')}
        </div>
        <div class="question-nav">
          <button data-action="prev" ${this.quizIndex === 0 ? 'disabled' : ''}>← BACK</button>
          <span class="quiz-note">Estimates reasoning only — not a clinical IQ score.</span>
          <button class="primary" data-action="next">${this.quizIndex === questions.length - 1 ? 'FINISH' : 'NEXT →'}</button>
        </div>
      </section>`;
    for (const button of this.root.querySelectorAll<HTMLButtonElement>('[data-option]')) {
      button.addEventListener('click', () => {
        this.quizAnswers[this.quizIndex] = Number(button.dataset.option);
        if (this.quizIndex < questions.length - 1) { this.quizIndex += 1; this.render(); return; }
        this.render();
      });
    }
    this.root.querySelector('[data-action="next"]')?.addEventListener('click', () => {
      if (this.quizIndex === questions.length - 1) { this.finishQuiz(questions); return; }
      this.quizIndex += 1;
      this.render();
    });
    this.root.querySelector('[data-action="prev"]')?.addEventListener('click', () => {
      if (this.quizIndex === 0) return;
      this.quizIndex -= 1;
      this.render();
    });
    this.startQuizTicker(questions);
  }

  private clockText(): string {
    const remaining = Math.max(0, Math.ceil((this.quizDeadline - Date.now()) / 1000));
    return `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`;
  }

  private startQuizTicker(questions: QuizQuestion[]): void {
    this.quizTicker?.remove(false);
    this.quizTicker = this.time.addEvent({
      delay: 250,
      loop: true,
      callback: () => {
        const clock = this.root.querySelector<HTMLElement>('[data-clock]');
        if (clock) clock.textContent = this.clockText();
        if (Date.now() >= this.quizDeadline) this.finishQuiz(questions);
      }
    });
  }

  private stopQuizTicker(): void {
    this.quizTicker?.remove(false);
    this.quizTicker = undefined;
  }

  private finishQuiz(questions: QuizQuestion[]): void {
    this.stopQuizTicker();
    const correct = questions.reduce((total, question, index) => total + (this.quizAnswers[index] === question.answer ? 1 : 0), 0);
    const secondsLeft = Math.max(0, (this.quizDeadline - Date.now()) / 1000);
    this.draft.iqScore = quizScore(correct, questions.length, secondsLeft, QUIZ_SECONDS);
    this.quizCorrect = correct;
    this.quizSecondsUsed = Math.round(QUIZ_SECONDS - secondsLeft);
    PlayerProgress.iqTakenAt = new Date().toISOString().slice(0, 10);
    this.finishAssessment();
  }

  private startQuiz(): void {
    this.quizIndex = 0;
    this.quizAnswers = new Array(QUIZ_LENGTH).fill(-1);
    this.quizDeadline = Date.now() + QUIZ_SECONDS * 1000;
    this.view = 'quiz';
    this.render();
  }

  /** A fungal keeper of the Heartseed, drawn in the same blocky idiom as the
   * player preview so the two read as the same world. */
  private drawNarrator(): void {
    const canvas = this.root.querySelector<HTMLCanvasElement>('[data-narrator]');
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingEnabled = false;
    const scale = 6;
    const rect = (color: string, x: number, y: number, width: number, height: number): void => {
      context.fillStyle = color;
      context.fillRect(x * scale, y * scale, width * scale, height * scale);
    };
    const cap = '#c7d98a', capLit = '#e2efb4', capDark = '#8da05c', body = '#2c4a36', bodyDark = '#17291e', glow = '#eaffd0';
    const center = 18;
    const band = (color: string, y: number, width: number, height = 1): void => rect(color, center - width / 2, y, width, height);

    context.shadowColor = 'rgba(190, 240, 150, .4)';
    context.shadowBlur = 24;
    band(capLit, 2, 10);
    context.shadowBlur = 0;
    band(capLit, 3, 14);
    band(cap, 4, 18);
    band(cap, 5, 21);
    band(cap, 6, 23);
    band(capDark, 7, 23);
    band(capDark, 8, 19);
    band(bodyDark, 9, 15);

    band(body, 10, 11, 9);
    band(bodyDark, 19, 11);
    band(body, 20, 9);
    band(bodyDark, 21, 7);

    rect(glow, 14, 13, 2, 2);
    rect(glow, 20, 13, 2, 2);
    // Freckles of spore-light across the cap.
    rect(capLit, 12, 5, 2, 1);
    rect(capLit, 22, 4, 2, 1);
    rect(capLit, 17, 3, 2, 1);

    // Root tendrils, tapering as they fall.
    for (const [x, length, width] of [[13, 7, 2], [16, 10, 2], [19, 8, 2], [21, 5, 1]] as Array<[number, number, number]>) {
      rect(body, x, 22, width, length);
      rect(bodyDark, x, 22 + length, width, 2);
    }
  }

  /** Step one of character creation: decide who you are before the game asks
   * what you can do. Returning players reach the same controls via CUSTOMIZE. */
  private renderCreate(): void {
    const { cloaks, hairs } = this.appearanceOptions();
    this.root.innerHTML = `
      <section class="title-card customize-card" aria-label="Create your explorer">
        <div class="panel-heading"><div><p class="eyebrow">STEP 1 OF 2 · WHO YOU ARE</p><h2>CREATE EXPLORER</h2></div></div>
        <div class="custom-section"><h3>SKIN TONE</h3><div class="choice-row">${SKIN_COLORS.map((color, index) => `<button class="swatch ${PlayerProgress.appearance.skinIndex === index ? 'selected' : ''}" style="--swatch:${color}" data-skin="${index}" aria-label="Skin tone ${index + 1}"></button>`).join('')}</div></div>
        <div class="custom-section"><h3>CLOAK</h3><div class="option-grid">${cloaks.map(option => this.customOption('cloak', option.id, option.label, option.unlocked, option.requirement, PlayerProgress.appearance.cloak === option.id)).join('')}</div></div>
        <div class="custom-section"><h3>HAIR</h3><div class="option-grid">${hairs.map(option => this.customOption('hair', option.id, option.label, option.unlocked, option.requirement, PlayerProgress.appearance.hair === option.id)).join('')}</div></div>
        <div class="question-nav"><span></span><button class="primary" data-action="begin">BEGIN ASSESSMENT →</button></div>
      </section>
      <aside class="title-character custom-preview"><canvas data-preview width="180" height="260"></canvas><strong>YOUR EXPLORER</strong><span>MORE UNLOCKS AS YOU TRAIN</span></aside>`;
    this.drawPreview();
    this.bindAppearanceButtons(() => this.renderCreate());
    this.root.querySelector('[data-action="begin"]')?.addEventListener('click', () => {
      this.draft = { ...PlayerProgress.inputs };
      this.questionIndex = 0;
      this.view = 'questions';
      this.render();
    });
  }

  /** Step two: one question per screen, each showing what it does to the stat
   * it feeds, so the number on screen always means something. */
  private renderQuestion(): void {
    const question = QUESTIONS[this.questionIndex];
    const [min, max] = INPUT_BOUNDS[question.key];
    const value = this.draft[question.key];
    const preview = calculateStats(this.draft, PlayerProgress.statXp);
    const statName = STAT_LABELS.find(([key]) => key === question.stat)?.[2] ?? '';
    const imperial = PlayerProgress.unitSystem === 'imperial' ? IMPERIAL_UNITS[question.key] : undefined;
    const shownValue = imperial ? Math.round(value * imperial.perMetric * 10) / 10 : value;
    const field = question.asDuration
      ? `<span class="duration-input"><input data-minutes type="number" min="0" max="${Math.floor(max / 60)}" step="1" value="${Math.floor(value / 60)}" aria-label="Minutes"><b>min</b><input data-seconds type="number" min="0" max="59" step="1" value="${Math.round(value % 60)}" aria-label="Seconds"><b>sec</b></span>`
      : `<span class="single-input"><input data-answer type="number" min="${imperial ? Math.floor(min * imperial.perMetric) : min}" max="${imperial ? Math.ceil(max * imperial.perMetric) : max}" step="${imperial ? imperial.step : question.step}" value="${shownValue}" aria-label="${question.prompt}"><b>${imperial ? imperial.unit : question.unit}</b></span>`;
    this.root.innerHTML = `
      <section class="title-card full-card question-card" aria-label="Baseline assessment">
        <div class="panel-heading">
          <div><p class="eyebrow">QUESTION ${this.questionIndex + 1} OF ${QUESTIONS.length}</p><h2>${question.prompt}</h2></div>
          <div class="panel-tools"><button data-action="units">${PlayerProgress.unitSystem === 'imperial' ? 'US · LB / IN' : 'METRIC · KG / CM'}</button>${PlayerProgress.profileCompleted ? this.backButton() : ''}</div>
        </div>
        <i class="question-progress"><b style="width:${(this.questionIndex + 1) / QUESTIONS.length * 100}%"></b></i>
        <p class="panel-copy">${question.help}</p>
        <div class="question-answer">
          ${field}
          <p class="question-feeds">${question.share}% OF <b>${statName.toUpperCase()}</b> · NOW <em data-stat-preview>${preview[question.stat]}</em></p>
        </div>
        <div class="live-stats" data-live-stats>${this.statRunes(preview)}</div>
        <div class="question-nav">
          <button data-action="prev" ${this.questionIndex === 0 ? 'disabled' : ''}>← BACK</button>
          <span>${question.optional ? '<button class="quiet" data-action="skip">SKIP THIS</button>' : ''}</span>
          <button class="primary" data-action="next">${this.questionIndex === QUESTIONS.length - 1 ? 'SEE RESULTS' : 'NEXT →'}</button>
        </div>
      </section>`;

    const readAnswer = (): number => {
      if (question.asDuration) {
        const minutes = Number(this.root.querySelector<HTMLInputElement>('[data-minutes]')?.value ?? 0);
        const seconds = Number(this.root.querySelector<HTMLInputElement>('[data-seconds]')?.value ?? 0);
        return (Number.isFinite(minutes) ? minutes : 0) * 60 + (Number.isFinite(seconds) ? seconds : 0);
      }
      const raw = Number(this.root.querySelector<HTMLInputElement>('[data-answer]')?.value ?? 0);
      if (!Number.isFinite(raw)) return 0;
      return imperial ? raw / imperial.perMetric : raw;
    };
    const commit = (): void => {
      this.draft[question.key] = Phaser.Math.Clamp(readAnswer(), min, max);
    };
    for (const input of this.root.querySelectorAll<HTMLInputElement>('input')) {
      input.addEventListener('input', () => {
        commit();
        const live = calculateStats(this.draft, PlayerProgress.statXp);
        const runes = this.root.querySelector<HTMLElement>('[data-live-stats]');
        const single = this.root.querySelector<HTMLElement>('[data-stat-preview]');
        if (runes) runes.innerHTML = this.statRunes(live);
        if (single) single.textContent = String(live[question.stat]);
      });
    }
    this.root.querySelector<HTMLInputElement>('input')?.focus();

    const step = (delta: number): void => {
      commit();
      const next = this.questionIndex + delta;
      if (next < 0) return;
      // The typed questions are followed by the reasoning quiz, which supplies
      // Intelligence's second input before the summary can be shown.
      if (next >= QUESTIONS.length) { this.startQuiz(); return; }
      this.questionIndex = next;
      this.render();
    };
    this.root.querySelector('[data-action="next"]')?.addEventListener('click', () => step(1));
    this.root.querySelector('[data-action="prev"]')?.addEventListener('click', () => step(-1));
    this.root.querySelector('[data-action="units"]')?.addEventListener('click', () => {
      // Commit first: the typed number means something different afterwards.
      commit();
      PlayerProgress.unitSystem = PlayerProgress.unitSystem === 'imperial' ? 'metric' : 'imperial';
      GameSave.save();
      this.render();
    });
    this.root.querySelector('[data-action="skip"]')?.addEventListener('click', () => {
      this.draft[question.key] = DEFAULT_INPUTS[question.key];
      const next = this.questionIndex + 1;
      if (next >= QUESTIONS.length) { this.startQuiz(); return; }
      this.questionIndex = next;
      this.render();
    });
    this.bindBack();
  }

  private finishAssessment(): void {
    PlayerProgress.inputs = { ...this.draft };
    PlayerProgress.stats = calculateStats(PlayerProgress.inputs, PlayerProgress.statXp);
    PlayerProgress.profileCompleted = true;
    PlayerProgress.lastCheckInWeek = currentWeekKey();
    PlayerProgress.profileCreatedAt = new Date().toISOString().slice(0, 10);
    GameSave.save();
    this.view = 'summary';
    this.render();
  }

  /** The payoff: what every answer added up to, and where each number came from. */
  private renderSummary(): void {
    const stats = PlayerProgress.stats;
    const sources: Record<keyof CharacterStats, Question[]> = {
      strength: [], speed: [], stamina: [], defense: [], intelligence: [], discipline: []
    };
    for (const question of QUESTIONS) sources[question.stat].push(question);
    const detail = (key: keyof CharacterStats): string => {
      if (key === 'discipline') return 'Starts at 10 · rises and falls with your consistency';
      const parts = sources[key].map(question => this.answerSummary(question));
      if (key === 'intelligence') {
        const clock = `${Math.floor(this.quizSecondsUsed / 60)}:${String(this.quizSecondsUsed % 60).padStart(2, '0')}`;
        const iq = PlayerProgress.inputs.iqScore;
        // The quiz is the heavier half, so it leads the line.
        parts.unshift(`quiz ${this.quizCorrect}/${QUIZ_LENGTH} in ${clock} → ${iq} → ${scoreMetric('iqScore', iq)} (70%)`);
      }
      return parts.join(' · ');
    };
    this.root.innerHTML = `
      <section class="title-card full-card character-card" aria-label="Your starting attributes">
        <div class="panel-heading"><div><p class="eyebrow">ASSESSMENT COMPLETE</p><h2>YOUR BASELINE</h2></div></div>
        <p class="panel-copy">This is where you start. Every stat moves only when you log real effort — and slides back when you stop, so these numbers stay honest.</p>
        <div class="stat-list summary-list">
          ${STAT_LABELS.map(([key, short, name]) => `<div><b>${short}</b><span><strong>${name}</strong><small>${detail(key)}</small></span><em>${stats[key]}</em></div>`).join('')}
        </div>
        <div class="question-nav">
          <button data-action="redo">← REDO ASSESSMENT</button>
          <span></span>
          <button class="primary" data-action="enter">ENTER THE HOLLOW ROOTS →</button>
        </div>
      </section>`;
    this.root.querySelector('[data-action="redo"]')?.addEventListener('click', () => {
      this.draft = { ...PlayerProgress.inputs };
      this.questionIndex = 0;
      this.view = 'questions';
      this.render();
    });
    this.root.querySelector('[data-action="enter"]')?.addEventListener('click', () => {
      this.startDialogue(this.outroLines(), 'ENTER THE ROOTS →', () => { this.view = 'menu'; this.render(); });
    });
  }

  /** "15 reps → 10" — the answer next to the points it earned, so the summary
   * shows why a stat landed where it did rather than just asserting a number. */
  private answerSummary(question: Question): string {
    const value = PlayerProgress.inputs[question.key];
    const imperial = PlayerProgress.unitSystem === 'imperial' ? IMPERIAL_UNITS[question.key] : undefined;
    const shown = question.asDuration
      ? `${Math.floor(value / 60)}:${String(Math.round(value % 60)).padStart(2, '0')}`
      : imperial
      ? `${Math.round(value * imperial.perMetric * 10) / 10} ${imperial.unit}`
      : `${value}${question.unit ? ` ${question.unit}` : ''}`;
    return `${shown} → ${scoreMetric(question.key, value)}`;
  }

  private appearanceOptions(): {
    cloaks: Array<{ id: CloakId; label: string; unlocked: boolean; requirement: string }>;
    hairs: Array<{ id: HairId; label: string; unlocked: boolean; requirement: string }>;
  } {
    const scoreTotal = totalStats();
    return {
      cloaks: [
        { id: 'moss', label: 'Moss', unlocked: true, requirement: 'Starter' },
        { id: 'sunroot', label: 'Sunroot', unlocked: scoreTotal >= 72, requirement: '72 total stats' },
        { id: 'moonfern', label: 'Moonfern', unlocked: CollectedItems.size >= 2, requirement: '2 relics' },
        { id: 'guardian', label: 'Guardian', unlocked: PlayerProgress.guardianDefeated, requirement: 'Defeat guardian' }
      ],
      hairs: [
        { id: 'raven', label: 'Raven', unlocked: true, requirement: 'Available' },
        { id: 'earth', label: 'Earth', unlocked: true, requirement: 'Available' },
        { id: 'silver', label: 'Silver', unlocked: PlayerProgress.level >= 3, requirement: 'Reach level 3' }
      ]
    };
  }

  private bindAppearanceButtons(rerender: () => void): void {
    for (const button of this.root.querySelectorAll<HTMLButtonElement>('[data-skin]')) button.addEventListener('click', () => { PlayerProgress.appearance.skinIndex = Number(button.dataset.skin); GameSave.save(); rerender(); });
    for (const button of this.root.querySelectorAll<HTMLButtonElement>('[data-cloak]:not([disabled])')) button.addEventListener('click', () => { PlayerProgress.appearance.cloak = button.dataset.cloak as CloakId; GameSave.save(); rerender(); });
    for (const button of this.root.querySelectorAll<HTMLButtonElement>('[data-hair]:not([disabled])')) button.addEventListener('click', () => { PlayerProgress.appearance.hair = button.dataset.hair as HairId; GameSave.save(); rerender(); });
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
          <label><strong>RUN / WALK</strong><small>Distance builds SPD / STA</small><span><input data-amount="run" type="number" min="0.1" max="100" step="0.1" value="2"> ${PlayerProgress.unitSystem === 'imperial' ? 'mi' : 'km'} <button data-log="run">LOG</button></span></label>
          <label><strong>LEARN / STUDY</strong><small>Learning builds IQ</small><span><input data-amount="study" type="number" min="5" max="480" step="5" value="30"> min <button data-log="study">LOG</button></span></label>
          <button data-log="goal"><strong>DAILY GOAL</strong><small>+60 XP<br>builds automatic Discipline</small></button>
        </div>
        <div class="recent-log"><h3>RECENT</h3>${recent.length ? recent.map(entry => `<span><b>${entry.kind.toUpperCase()}</b><em>+${entry.xp} XP</em><small>${entry.date}</small></span>`).join('') : '<p>No effort logged yet.</p>'}</div>
      </section>`;
    for (const button of this.root.querySelectorAll<HTMLButtonElement>('[data-log]')) {
      button.addEventListener('click', () => {
        const kind = button.dataset.log as ActivityKind;
        const input = this.root.querySelector<HTMLInputElement>(`[data-amount="${kind}"]`);
        let amount = input ? Number(input.value) : 1;
        // Distance is logged in km whatever the player typed it in.
        if (kind === 'run' && PlayerProgress.unitSystem === 'imperial') amount *= KM_PER_MILE;
        const result = addActivity(kind, amount);
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
        <div class="panel-heading"><div><p class="eyebrow">REAL LIFE → GAMEPLAY</p><h2>EXPLORER</h2></div><div class="panel-tools"><button data-action="assessment">BASELINE</button><button data-action="customize">APPEARANCE</button>${this.backButton()}</div></div>
        <div class="character-layout">
          <div class="stat-list">${STAT_LABELS.map(([key, short, name]) => `<div><b>${short}</b><span><strong>${name}</strong><small>${key === 'discipline' ? 'Automatic · 28-day consistency + streak' : `${PlayerProgress.statXp[key] % 250} / 250 toward next point`}</small></span><em>${s[key]}</em></div>`).join('')}</div>
          <div class="unlock-list"><h3>ARSENAL & SKILLS</h3>${unlocks.map(([name, type, unlocked, requirement]) => `<div class="${unlocked ? 'ready' : 'locked'}"><span><strong>${name}</strong><small>${type}</small></span><b>${unlocked ? 'UNLOCKED' : requirement}</b></div>`).join('')}</div>
        </div>
        <p class="panel-copy character-note">Enemies give challenge and world progress. Character XP comes from logged real effort.</p>
      </section>`;
    this.bindBack();
    this.root.querySelector('[data-action="assessment"]')?.addEventListener('click', () => this.openAssessment());
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
    const scoreTotal = totalStats();
    const { cloaks, hairs } = this.appearanceOptions();
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
    this.bindAppearanceButtons(() => this.renderCustomize());
  }

  private bindViewButtons(): void {
    this.root.querySelector('[data-action="continue"]')?.addEventListener('click', () => this.startGame());
    this.root.querySelector('[data-action="assessment"]')?.addEventListener('click', () => this.openAssessment());
    this.root.querySelector('[data-action="reset"]')?.addEventListener('click', () => this.resetSave());
    for (const view of ['customize', 'checkin', 'character', 'leaderboard'] as TitleView[]) {
      this.root.querySelector(`[data-action="${view}"]`)?.addEventListener('click', () => {
        this.view = view;
        this.feedback = '';
        this.confirmingReset = false;
        this.render();
      });
    }
  }

  /** Erasing a save is unrecoverable, so the first press only arms the button. */
  private resetSave(): void {
    if (!this.confirmingReset) {
      this.confirmingReset = true;
      this.render();
      return;
    }
    GameSave.reset();
    this.confirmingReset = false;
    this.questionIndex = 0;
    this.draft = { ...PlayerProgress.inputs };
    this.startDialogue(INTRO_LINES, 'BEGIN →', () => this.beginCreation());
  }

  private openAssessment(): void {
    this.draft = { ...PlayerProgress.inputs };
    this.questionIndex = 0;
    this.feedback = '';
    this.view = 'questions';
    this.render();
  }

  private bindBack(): void { this.root.querySelector('[data-action="back"]')?.addEventListener('click', () => { this.view = 'menu'; this.feedback = ''; this.render(); }); }
  private backButton(): string { return PlayerProgress.profileCompleted ? '<button class="back" data-action="back">← TITLE</button>' : ''; }

  private statRunes(stats: CharacterStats): string { return STAT_LABELS.map(([key, label]) => `<span><b>${label}</b><strong>${stats[key]}</strong></span>`).join(''); }

  private customOption(type: 'cloak' | 'hair', id: string, label: string, unlocked: boolean, requirement: string, selected: boolean): string {
    return `<button class="custom-option ${selected ? 'selected' : ''} ${unlocked ? '' : 'locked'}" data-${type}="${id}" ${unlocked ? '' : 'disabled'}><strong>${label}</strong><small>${unlocked ? requirement : 'LOCKED · ' + requirement}</small></button>`;
  }

  private startGame(): void {
    if (!PlayerProgress.profileCompleted) { this.view = 'create'; this.render(); return; }
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
