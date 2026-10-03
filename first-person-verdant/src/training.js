// The weekly training plan behind WEEKLY QUEST. Each week is a short list of
// real-world tasks to check off; the plan climbs a step each week you finish at
// least half of it (profile.js decides that), and repeats a week you don't.
// Home workouts need no equipment, fit inside 40 minutes, and every exercise
// has an easier version beside it.

/** Home workouts. Each exercise: [name, dose, easier name, easier dose, cue]. */
export const WORKOUTS = {
  A: {
    title: 'BEGINNER FULL BODY', minutes: 30, where: 'At home · no equipment · a chair and a wall help',
    rounds: 3, rest: 'Rest 30 s between exercises and 60–90 s between rounds.',
    warmup: ['March in place · 1 min', 'Arm circles, both ways · 1 min', 'Hip hinges, hands on thighs · 1 min', 'Slow half squats · 1 min', 'Step jacks (step out, no jump) · 1 min'],
    exercises: [
      ['Bodyweight squat', '10 reps', 'Sit-to-stand from a chair', '8 reps', 'Chest up, knees follow your toes.'],
      ['Knee push-up', '8 reps', 'Wall push-up', '10 reps', 'Body in one line from knees to head.'],
      ['Glute bridge', '12 reps', 'Glute bridge, smaller range', '8 reps', 'Squeeze at the top for a second.'],
      ['Reverse lunge', '6 per leg', 'Split squat holding a chair', '5 per leg', 'Step back softly; front knee over the ankle.'],
      ['Forearm plank', '20 s', 'Hands-on-table plank', '20 s', 'Tuck the hips; do not let the back sag.'],
      ['Bird dog', '6 per side', 'Bird dog, arm or leg only', '4 per side', 'Move slowly; keep the hips level.']
    ],
    cooldown: ['Standing quad stretch · 30 s per leg', 'Seated hamstring stretch · 45 s', 'Doorway chest stretch · 30 s', "Child's pose · 1 min"]
  },
  B: {
    title: 'FOUNDATION FULL BODY', minutes: 35, where: 'At home · no equipment · a chair or couch helps',
    rounds: 3, rest: 'Rest 30 s between exercises and 60 s between rounds.',
    warmup: ['March or jog in place · 1 min', 'Arm circles and shoulder rolls · 1 min', 'Hip hinges · 1 min', 'Bodyweight squats, slow · 1 min', 'Jumping jacks or step jacks · 1 min'],
    exercises: [
      ['Bodyweight squat', '15 reps', 'Chair squat (touch and stand)', '10 reps', 'Sit back as if into a chair.'],
      ['Push-up (knees or full)', '10 reps', 'Incline push-up on a table', '8 reps', 'Lower under control, elbows about 45°.'],
      ['Alternating reverse lunge', '8 per leg', 'Supported split squat', '6 per leg', 'Tall torso; push through the front heel.'],
      ['Single-leg glute bridge', '8 per leg', 'Glute bridge', '12 reps', 'Keep the hips level at the top.'],
      ['Plank shoulder taps', '16 taps', 'Plank on knees', '25 s', 'Feet wide; stop the hips from rocking.'],
      ['Superman', '10 reps', 'Bird dog', '6 per side', 'Lift from the upper back, neck long.'],
      ['Mountain climbers', '30 s', 'Standing knee drives', '30 s', 'Steady pace, breathe out as you drive.']
    ],
    cooldown: ['Quad stretch · 30 s per leg', 'Hamstring stretch · 45 s', 'Chest stretch · 30 s', 'Cat-cow · 1 min', "Child's pose · 1 min"]
  },
  C: {
    title: 'BUILDER FULL BODY', minutes: 40, where: 'At home · no equipment · a sturdy chair or couch',
    rounds: 4, rest: 'Work 40 s, rest 20 s. Rest 90 s between rounds.',
    warmup: ['Jog in place · 1 min', 'World’s greatest stretch · 1 min', 'Inchworms · 1 min', 'Squat to reach · 1 min', 'Jumping jacks · 1 min'],
    exercises: [
      ['Jump squat', '40 s', 'Bodyweight squat', '40 s', 'Land softly, knees bent.'],
      ['Push-up', '40 s', 'Knee push-up', '40 s', 'Full range, then drop to knees if form breaks.'],
      ['Bulgarian split squat (rear foot on chair)', '8 per leg', 'Reverse lunge', '6 per leg', 'Most of the weight on the front leg.'],
      ['Pike push-up', '40 s', 'Downward-dog hold', '20 s', 'Hips high; head goes between the hands.'],
      ['Hip thrust (shoulders on couch)', '12 reps', 'Glute bridge', '12 reps', 'Chin tucked, ribs down at the top.'],
      ['Side plank', '20 s per side', 'Side plank on knees', '15 s per side', 'Stack shoulder over elbow.'],
      ['Burpee (no jump)', '8 reps', 'Step-back burpee, hands on a chair', '6 reps', 'Step or hop back; keep the back flat.']
    ],
    cooldown: ['Pigeon stretch · 45 s per side', 'Hamstring stretch · 45 s', 'Chest and shoulder stretch · 1 min', "Child's pose · 1 min"]
  },
  D: {
    title: 'ADVANCED FULL BODY', minutes: 40, where: 'At home · no equipment · a sturdy chair',
    rounds: 4, rest: 'Rest 20 s between exercises and 90 s between rounds.',
    warmup: ['Jog in place with high knees · 1 min', 'World’s greatest stretch · 1 min', 'Inchworm to push-up · 1 min', 'Jump squats, easy · 1 min', 'Skater hops · 1 min'],
    exercises: [
      ['Jump squat', '12 reps', 'Bodyweight squat', '15 reps', 'Explode up, land quietly.'],
      ['Decline push-up (feet on chair)', '10 reps', 'Push-up', '8 reps', 'Brace the core; no sagging hips.'],
      ['Bulgarian split squat', '10 per leg', 'Reverse lunge', '8 per leg', 'Slow down, fast up.'],
      ['Pike push-up', '8 reps', 'Incline pike push-up (hands on chair)', '6 reps', 'Elbows track back, not flared.'],
      ['Single-leg hip thrust', '10 per leg', 'Hip thrust', '12 reps', 'Drive through the heel.'],
      ['Hollow hold', '25 s', 'Dead bug', '8 per side', 'Lower back pressed into the floor.'],
      ['Burpee', '10 reps', 'Burpee without the jump', '8 reps', 'Smooth, steady rhythm.']
    ],
    cooldown: ['Pigeon stretch · 45 s per side', 'Hamstring stretch · 45 s', 'Thoracic twist · 30 s per side', "Child's pose · 1 min"]
  }
};
export const WORKOUT_NOTE = 'Stop if anything hurts (not the burn of effort, real pain). If you have an injury or a medical condition, check with a doctor first.';

// Each step of the plan. Items: id, kind (the activity it logs), how many days, and what one check logs.
const steps = (n, count) => ({ id: 'steps', kind: 'steps', label: `Reach ${n.toLocaleString('en-US')} steps`, amount: n, count, unit: 'day' });
const home = (w, count) => ({ id: 'home', kind: 'workout', workout: w, label: `${WORKOUTS[w].title[0]}${WORKOUTS[w].title.slice(1).toLowerCase()} · home workout`, amount: 1, count, unit: 'session' });
// Distances come in round numbers for both systems: km for metric, miles for US units.
const move = (km, mi, count = 1) => ({ id: 'run', kind: 'run', label: `Walk or run ${km} km in one go`, labelUS: `Walk or run ${mi} mile${mi === 1 ? '' : 's'} in one go`, amount: km, amountUS: mi * 1.609, count, unit: 'outing' });
const learn = (min, count) => ({ id: 'study', kind: 'study', label: `Learn something for ${min} minutes`, note: 'Anything counts: a hobby, cooking a new dish, an instrument, a language, a book, a skill for work.', amount: min, count, unit: 'session' });
export const PLAN = [
  { tier: 'BEGINNER', items: [steps(5000, 2), home('A', 2), learn(20, 1)] },   // week 1: one 20-minute session of learning
  { tier: 'BEGINNER', items: [steps(5000, 3), home('A', 2), learn(20, 2)] },
  { tier: 'FOUNDATION', items: [steps(6000, 3), home('B', 3), move(2, 1.25), learn(20, 2)] },
  { tier: 'FOUNDATION', items: [steps(7000, 3), home('B', 3), move(3, 2), learn(30, 2)] },
  { tier: 'BUILDER', items: [steps(8000, 4), home('C', 3), move(3, 2), learn(30, 2)] },
  { tier: 'BUILDER', items: [steps(8000, 4), home('C', 3), move(4, 2.5), learn(30, 3)] },
  { tier: 'ADVANCED', items: [steps(10000, 4), home('D', 3), move(5, 3), learn(30, 3)] }
];
export const PLAN_BONUS = 300;   // XP for finishing a whole week
export const planStep = n => PLAN[Math.max(0, Math.min(PLAN.length - 1, n - 1))];

// ------------------------------------------------------------- lift log
// The personal lift log on WEEKLY QUEST, for lifters who follow their own
// program. It earns no XP (XP comes only from the plan and the weekly tasks);
// it tracks personal records and unlocks cosmetic titles.
export const EXERCISES = [
  // Chest
  'Barbell Bench Press', 'Incline Barbell Bench Press', 'Decline Bench Press', 'Dumbbell Bench Press', 'Incline Dumbbell Press', 'Dumbbell Fly', 'Cable Fly', 'Machine Chest Press', 'Push-up', 'Weighted Dip',
  // Back
  'Deadlift', 'Romanian Deadlift', 'Sumo Deadlift', 'Barbell Row', 'Pendlay Row', 'Dumbbell Row', 'T-Bar Row', 'Seated Cable Row', 'Lat Pulldown', 'Pull-up', 'Chin-up', 'Weighted Pull-up', 'Face Pull', 'Shrug', 'Rack Pull',
  // Legs
  'Back Squat', 'Front Squat', 'Goblet Squat', 'Bulgarian Split Squat', 'Walking Lunge', 'Leg Press', 'Hack Squat', 'Leg Extension', 'Leg Curl', 'Hip Thrust', 'Glute Bridge', 'Standing Calf Raise', 'Seated Calf Raise', 'Step-up', 'Good Morning',
  // Shoulders
  'Overhead Press', 'Seated Dumbbell Press', 'Arnold Press', 'Push Press', 'Lateral Raise', 'Front Raise', 'Rear Delt Fly', 'Upright Row',
  // Arms
  'Barbell Curl', 'Dumbbell Curl', 'Hammer Curl', 'Preacher Curl', 'Cable Curl', 'Tricep Pushdown', 'Skull Crusher', 'Overhead Tricep Extension', 'Close-Grip Bench Press', 'Dip',
  // Core
  'Plank', 'Hanging Leg Raise', 'Cable Crunch', 'Ab Wheel Rollout', 'Russian Twist', 'Pallof Press',
  // Olympic and power
  'Power Clean', 'Hang Clean', 'Clean and Jerk', 'Snatch', 'Kettlebell Swing', 'Farmer’s Carry', 'Sled Push', 'Box Jump',
  // Machines and other
  'Smith Machine Squat', 'Pec Deck', 'Assisted Pull-up', 'Back Extension', 'Battle Ropes'
];
/** Estimated one-rep max (Epley): weight × (1 + reps/30); a single counts as itself. */
export const e1rm = (kg, reps) => reps <= 1 ? kg : kg * (1 + reps / 30);
// Cosmetic titles: shown next to your name on the leaderboard. [id, label, how to earn, test(stats)]
export const TITLES = [
  ['first-rep', 'First Rep', 'Log your first set', s => s.sets >= 1],
  ['iron-apprentice', 'Iron Apprentice', 'Log 25 sets', s => s.sets >= 25],
  ['iron-regular', 'Iron Regular', 'Log 100 sets', s => s.sets >= 100],
  ['iron-veteran', 'Iron Veteran', 'Log 300 sets', s => s.sets >= 300],
  ['consistent', 'Consistent', 'Lift on 12 different days', s => s.days >= 12],
  ['well-rounded', 'Well-Rounded', 'Log 15 different exercises', s => s.exercises >= 15],
  ['record-breaker', 'Record Breaker', 'Set 10 personal records', s => s.prs >= 10],
  ['two-plate', 'Two-Plate Club', 'Lift 225 lb / 102 kg in any exercise', s => s.heaviest >= 102],
  ['three-plate', 'Three-Plate Club', 'Lift 315 lb / 143 kg in any exercise', s => s.heaviest >= 143]
].map(([id, label, need, test]) => ({ id, label, need, test }));
