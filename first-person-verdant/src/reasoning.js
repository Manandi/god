// Mycel's mind check: an original, adaptive reasoning test. It is a game
// estimate on the IQ scale (mean 100, SD 15), not a clinical or standardized
// IQ test; the item difficulties are the designer's estimates, not norms from
// a calibration sample.
//
// How it works:
//  - A bank of items across number and letter series, matrices, analogies,
//    vocabulary, deduction and quantitative reasoning, each with a difficulty
//    `b` on a logit scale (0 ≈ an average adult has a 50% chance).
//  - Twelve items are given adaptively: each one is chosen near the current
//    ability estimate, so right answers lead to harder items. Only someone who
//    keeps solving the hardest items reaches the top of the scale.
//  - Ability is estimated with a Rasch (1-parameter IRT) model, expected a
//    posteriori over a normal prior, and reported as IQ = 100 + 15·θ.
//  - Each item has a time limit; running out counts as wrong.

// 12 items: simulated test-takers show 8 items pull high scorers too far toward
// average (true 145 scored ~133); 12 narrows that and a perfect run reaches ~151.
export const TEST_ITEMS = 12, TIME_LIMIT = 75, TEST_VERSION = 2;

// [id, type, difficulty b, prompt, options, index of the correct option]
const BANK = [
  // Easy (b ≈ −2.2 … −1.2)
  ['s1', 'series', -2.0, 'What comes next? · 3, 7, 11, 15, ?', ['17', '18', '19', '21'], 2],
  ['a1', 'analogy', -2.0, 'Bird is to nest as bee is to…', ['Honey', 'Hive', 'Flower', 'Wing'], 1],
  ['v1', 'vocabulary', -2.2, '“Rapid” most nearly means…', ['Slow', 'Quick', 'Quiet', 'Heavy'], 1],
  ['o1', 'odd one out', -1.8, 'Which one does not belong?', ['Apple', 'Banana', 'Carrot', 'Cherry'], 2],
  ['s2', 'series', -1.5, 'What comes next? · 1, 4, 9, 16, 25, ?', ['30', '34', '36', '49'], 2],
  ['d1', 'deduction', -1.6, 'Tom is taller than Sam. Sam is taller than Ann. Who is the shortest?', ['Tom', 'Sam', 'Ann', 'Cannot tell'], 2],
  ['d2', 'deduction', -1.2, 'All bloops are razzies, and all razzies are lazzies. Are all bloops definitely lazzies?', ['Yes', 'No', 'Cannot tell'], 0],
  // Medium (b ≈ −0.6 … 0.9)
  ['q1', 'quantitative', -0.2, 'What is half of a third of a quarter of 720?', ['20', '30', '60', '90'], 1],
  ['s3', 'series', -0.6, 'What comes next? · 1, 1, 2, 3, 5, 8, 13, ?', ['18', '20', '21', '26'], 2],
  ['a2', 'analogy', -0.4, 'Telescope is to astronomer as microscope is to…', ['Biologist', 'Optician', 'Lens', 'Laboratory'], 0],
  ['s4', 'series', -0.3, 'What comes next? · 2, 6, 12, 20, 30, ?', ['38', '40', '42', '44'], 2],
  ['s5', 'series', 0.1, 'What comes next? · 1, 3, 7, 15, 31, ?', ['47', '62', '63', '64'], 2],
  ['q2', 'quantitative', 0.0, 'A lily patch doubles in size every day and covers a whole lake on day 48. On which day did it cover half the lake?', ['Day 24', 'Day 36', 'Day 46', 'Day 47'], 3],
  ['q3', 'quantitative', 0.2, 'Five machines take five minutes to make five widgets. How long do 100 machines take to make 100 widgets?', ['5 minutes', '20 minutes', '100 minutes', '500 minutes'], 0],
  ['s6', 'series', 0.2, 'What comes next? · 2, 3, 5, 9, 17, ?', ['25', '31', '33', '34'], 2],
  ['q4', 'quantitative', 0.3, 'A bat and a ball cost $1.10 together. The bat costs $1.00 more than the ball. How much does the ball cost?', ['10¢', '5¢', '1¢', '15¢'], 1],
  ['d3', 'deduction', 0.3, 'Some cats are black. Everything black absorbs heat. Does it follow that some cats absorb heat?', ['Yes, it follows', 'No, it does not follow', 'Only if all cats are black'], 0],
  ['l1', 'letter series', 0.4, 'What comes next? · A, C, F, J, O, ?', ['S', 'T', 'U', 'V'], 2],
  ['s7', 'series', 0.4, 'What comes next? · 2, 5, 11, 23, 47, ?', ['71', '94', '95', '96'], 2],
  ['m1', 'matrix', 0.5, 'Each row follows the same rule. Find the missing number.\n2   4   8\n3   9   27\n4   16   ?', ['32', '48', '64', '256'], 2],
  ['v2', 'vocabulary', 0.5, '“Ephemeral” most nearly means…', ['Lasting a very short time', 'Extremely large', 'Easily angered', 'Belonging to the sky'], 0],
  ['s8', 'series', 0.6, 'What comes next? · 1, 2, 6, 24, 120, ?', ['240', '600', '720', '840'], 2],
  ['d4', 'deduction', 0.6, 'If the day before yesterday was Thursday, what day will it be the day after tomorrow?', ['Sunday', 'Monday', 'Tuesday', 'Wednesday'], 1],
  ['m2', 'matrix', 0.6, 'Each row follows the same rule. Find the missing number.\n7   3   4\n9   5   4\n8   2   ?', ['4', '5', '6', '10'], 2],
  ['q5', 'quantitative', 0.8, 'Three painters paint three walls in three hours. How many painters are needed to paint twelve walls in six hours?', ['4', '6', '8', '12'], 1],
  ['s9', 'series', 0.9, 'What comes next? · 6, 11, 21, 36, 56, ?', ['76', '79', '81', '86'], 2],
  ['l2', 'letter series', 0.9, 'What comes next? · J4, M7, P10, S13, ?', ['U15', 'V16', 'V15', 'W16'], 1],
  // Hard (b ≈ 1.0 … 1.9)
  ['q6', 'quantitative', 1.0, 'In 5 years, Mia will be twice as old as she was 10 years ago. How old is Mia now?', ['15', '20', '25', '30'], 2],
  ['k1', 'knowledge', 1.0, 'Which element has the chemical symbol K?', ['Krypton', 'Potassium', 'Calcium', 'Carbon'], 1],
  ['s10', 'series', 1.2, 'What comes next? · 3, 4, 8, 17, 33, ?', ['49', '54', '58', '66'], 2],
  ['q7', 'quantitative', 1.2, 'Six people dig six holes in six days. How many days does it take one person to dig one hole?', ['1 day', '6 days', '36 days', '1/6 of a day'], 1],
  ['l3', 'letter series', 1.3, 'What comes next? · Z, X, U, Q, L, ?', ['E', 'F', 'G', 'H'], 1],
  ['q8', 'quantitative', 1.3, 'What is the smaller angle between the hour and minute hands of a clock at 3:15?', ['0°', '7.5°', '15°', '22.5°'], 1],
  ['a3', 'analogy', 1.4, 'Loquacious is to taciturn as gregarious is to…', ['Reclusive', 'Talkative', 'Generous', 'Graceful'], 0],
  ['q9', 'quantitative', 1.4, 'A snail climbs 3 m up a 10 m well each day and slides back 2 m each night. On which day does it first reach the top?', ['Day 7', 'Day 8', 'Day 9', 'Day 10'], 1],
  ['v3', 'vocabulary', 1.5, '“Obsequious” most nearly means…', ['Excessively eager to please', 'Hard to see', 'Stubbornly old-fashioned', 'Deeply sorrowful'], 0],
  ['m3', 'matrix', 1.5, 'Each row follows the same rule. Find the missing number.\n2   3   13\n4   1   17\n3   5   ?', ['15', '28', '34', '45'], 2],
  ['s11', 'series', 1.5, 'What comes next? · 1, 4, 27, 256, ?', ['625', '1024', '3125', '4096'], 2],
  ['d5', 'deduction', 1.6, 'Everyone always lies or always tells the truth. A says: “B is a liar.” B says: “A and I are both truthful.” Who tells the truth?', ['A only', 'B only', 'Both', 'Neither'], 0],
  ['g1', 'spatial', 1.6, 'A 3×3×3 cube is painted on every face, then cut into 27 small cubes. How many small cubes have paint on exactly two faces?', ['6', '8', '12', '24'], 2],
  ['d6', 'deduction', 1.7, 'Exactly one of these is true: (1) The prize is in box A. (2) The prize is not in box B. (3) The prize is not in box A. There are three boxes, A, B and C. Where is the prize?', ['Box A', 'Box B', 'Box C', 'Cannot tell'], 1],
  ['a4', 'analogy', 1.8, 'Ornithology is to birds as ichthyology is to…', ['Fish', 'Insects', 'Reptiles', 'Fossils'], 0],
  ['d7', 'deduction', 1.8, 'No A are B, and some C are A. Which must be true?', ['Some C are not B', 'No C are B', 'Some B are C', 'All C are A'], 0],
  ['q10', 'quantitative', 1.9, 'How many times in one day (24 hours) do the hour and minute hands of a clock overlap?', ['12', '22', '23', '24'], 1],
  // Very hard (b ≈ 2.0 … 3.2)
  ['s12', 'series', 2.0, 'What comes next? · 0, 1, 1, 2, 4, 7, 13, 24, ?', ['37', '41', '44', '48'], 2],
  ['s13', 'series', 2.0, 'What comes next? · 4, 6, 9, 14, 21, 32, ?', ['43', '45', '47', '53'], 1],
  ['v4', 'vocabulary', 2.1, '“Perspicacious” most nearly means…', ['Having keen insight', 'Sweating heavily', 'Easily persuaded', 'Clearly visible'], 0],
  ['s14', 'series', 2.2, 'What comes next? · 1, 11, 21, 1211, 111221, ?', ['112221', '312211', '1112221', '211221'], 1],
  ['s15', 'series', 2.3, 'What comes next? · 1, 2, 4, 7, 28, 33, 198, ?', ['205', '204', '1386', '231'], 0],
  ['m4', 'matrix', 2.4, 'Each row follows the same rule. Find the missing number.\n3   5   34\n2   7   53\n4   6   ?', ['48', '52', '58', '64'], 1],
  ['v5', 'vocabulary', 2.5, '“Pusillanimous” most nearly means…', ['Lacking courage', 'Extremely small', 'Full of pus', 'Overly talkative'], 0],
  ['q11', 'quantitative', 2.6, 'Three friends pay $30 for a room. The clerk then refunds $5 through a bellhop, who keeps $2 and gives each friend $1 back. Each friend has now paid $9, so $27 in total. Where is the “missing” dollar?', ['The bellhop has it', 'The clerk has it', 'There is none: the $27 already includes the bellhop’s $2', 'It was lost in change'], 2],
  ['s16', 'series', 2.8, 'What comes next? · 2, 12, 1112, 3112, 132112, ?', ['1113122112', '1131122112', '311311222', '1321131112'], 0],
  ['m5', 'matrix', 3.0, 'Each row follows the same rule. Find the missing number.\n5   2   10   3\n4   3   12   1\n6   4   ?   2', ['20', '24', '26', '30'], 1],
  ['q12', 'quantitative', 3.2, 'A rope is wrapped tightly around the Earth’s equator. It is lengthened by 1 metre and lifted evenly all the way round. Roughly how high above the ground is it now?', ['About 0.016 mm', 'About 1.6 mm', 'About 16 cm', 'About 16 m'], 2]
];
export const QUESTION_BANK = BANK.map(([id, type, b, prompt, options, answer]) => ({ id, type, b, prompt, options, answer }));

// θ grid and prior for the ability estimate.
const GRID = Array.from({ length: 161 }, (_, i) => -4 + i * .05);
const PRIOR_SD = 2.0;
// Chance of a right answer: a lucky guess (1 in the number of options) plus the
// Rasch curve for the rest (a 3-parameter model with a = 1 and c = 1/options).
const p = (theta, b, c = 0) => c + (1 - c) / (1 + Math.exp(-(theta - b)));

/** Expected a posteriori ability from [{b, c, correct}] responses. */
export function estimateAbility(responses) {
  let sum = 0, mean = 0, sq = 0;
  const post = GRID.map(t => {
    let w = Math.exp(-t * t / (2 * PRIOR_SD * PRIOR_SD));
    for (const r of responses) { const q = p(t, r.b, r.c || 0); w *= r.correct ? q : 1 - q; }
    return w;
  });
  for (let i = 0; i < GRID.length; i++) { sum += post[i]; mean += post[i] * GRID[i]; }
  mean /= sum;
  for (let i = 0; i < GRID.length; i++) sq += post[i] * (GRID[i] - mean) ** 2;
  return { theta: mean, se: Math.sqrt(sq / sum) };
}
/** The IQ-scale score for an ability estimate. */
export const iqFromTheta = theta => Math.round(Math.max(55, Math.min(160, 100 + 15 * theta)));

/**
 * A new adaptive session. `avoid` is a list of item ids from the last test, so a
 * retake does not repeat them. Each next() picks an unused item near the current
 * estimate (a little randomness keeps tests from being identical).
 */
export function createMindCheck(avoid = [], random = Math.random) {
  const used = new Set(), responses = [], skip = new Set(avoid);
  const pool = () => QUESTION_BANK.filter(q => !used.has(q.id) && !skip.has(q.id));
  let lastType = '';
  return {
    get count() { return responses.length; },
    get done() { return responses.length >= TEST_ITEMS; },
    get ids() { return [...used]; },
    estimate() { return estimateAbility(responses); },
    next() {
      const { theta } = estimateAbility(responses), target = theta + (random() - .5) * .5;
      let items = pool(); if (items.length < 3) { skip.clear(); items = pool(); }
      const ranked = items.map(q => ({ q, d: Math.abs(q.b - target) + (q.type === lastType ? .35 : 0) })).sort((a, b) => a.d - b.d);
      const q = ranked[Math.floor(random() * Math.min(2, ranked.length))].q;
      used.add(q.id); lastType = q.type;
      // Shuffle the options so positions can't be memorised.
      const order = q.options.map((_, i) => i).sort(() => random() - .5);
      return { ...q, options: order.map(i => q.options[i]), answer: order.indexOf(q.answer) };
    },
    answer(q, choice) { responses.push({ id: q.id, b: q.b, c: 1 / q.options.length, correct: choice === q.answer }); return choice === q.answer; }
  };
}

export function canTakeReasoning(date = '') {
  if (!date) return true;
  const previous = Date.parse(`${date}T00:00:00Z`);
  return !Number.isFinite(previous) || Date.now() - previous >= 30 * 86400000;
}
