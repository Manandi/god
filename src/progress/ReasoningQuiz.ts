export interface QuizQuestion {
  prompt: string;
  options: string[];
  /** Index into options. */
  answer: number;
}

export const QUIZ_SECONDS = 360;
export const QUIZ_LENGTH = 12;

/** Two full sets so a monthly retake is not the same paper twice. Every item
 * is text-only on purpose: figure-matrix questions need artwork, and a
 * hand-drawn one would test eyesight more than reasoning. */
const QUESTION_SETS: QuizQuestion[][] = [
  [
    { prompt: 'What comes next?\n\n2, 4, 8, 16, ?', options: ['24', '30', '32', '36'], answer: 2 },
    { prompt: 'What comes next?\n\n1, 1, 2, 3, 5, 8, ?', options: ['11', '12', '13', '15'], answer: 2 },
    { prompt: 'Which one does not belong?', options: ['Square', 'Circle', 'Triangle', 'Cube'], answer: 3 },
    { prompt: 'Hand is to Glove as Foot is to ?', options: ['Shoe lace', 'Sock', 'Leg', 'Floor'], answer: 1 },
    { prompt: 'What comes next?\n\n3, 6, 11, 18, 27, ?', options: ['36', '38', '40', '44'], answer: 1 },
    { prompt: 'A bat and a ball cost $1.10 together.\nThe bat costs $1.00 more than the ball.\n\nHow much does the ball cost?', options: ['$0.01', '$0.05', '$0.10', '$0.11'], answer: 1 },
    { prompt: 'If 5 machines take 5 minutes to make 5 widgets,\nhow long do 100 machines take to make 100 widgets?', options: ['5 minutes', '20 minutes', '100 minutes', '500 minutes'], answer: 0 },
    { prompt: 'What comes next?\n\nA, C, F, J, O, ?', options: ['R', 'S', 'T', 'U'], answer: 3 },
    { prompt: 'Which one does not belong?', options: ['16', '25', '36', '51'], answer: 3 },
    { prompt: 'All roses are flowers.\nSome flowers fade quickly.\n\nWhich must be true?', options: ['All roses fade quickly', 'No roses fade quickly', 'Some roses are flowers', 'Most flowers are roses'], answer: 2 },
    { prompt: 'A lily pad patch doubles in size every day\nand covers the lake on day 48.\n\nWhich day is it half covered?', options: ['Day 24', 'Day 36', 'Day 46', 'Day 47'], answer: 3 },
    { prompt: 'What comes next?\n\n100, 96, 88, 76, 60, ?', options: ['36', '40', '44', '48'], answer: 1 }
  ],
  [
    { prompt: 'What comes next?\n\n5, 10, 20, 40, ?', options: ['50', '60', '70', '80'], answer: 3 },
    { prompt: 'What comes next?\n\n2, 3, 5, 7, 11, 13, ?', options: ['15', '16', '17', '19'], answer: 2 },
    { prompt: 'Which one does not belong?', options: ['Copper', 'Iron', 'Granite', 'Silver'], answer: 2 },
    { prompt: 'Author is to Novel as Composer is to ?', options: ['Orchestra', 'Symphony', 'Piano', 'Audience'], answer: 1 },
    { prompt: 'What comes next?\n\n1, 4, 9, 16, 25, ?', options: ['30', '33', '36', '42'], answer: 2 },
    { prompt: 'A shirt is marked up 20%, then discounted 20%.\n\nCompared with the original price it is now:', options: ['The same', '4% cheaper', '4% dearer', '20% cheaper'], answer: 1 },
    { prompt: 'It takes 3 painters 6 hours to paint a wall.\n\nHow long would 9 painters take, working the same way?', options: ['1 hour', '2 hours', '3 hours', '18 hours'], answer: 1 },
    { prompt: 'What comes next?\n\nZ, W, S, N, ?', options: ['G', 'H', 'I', 'J'], answer: 1 },
    { prompt: 'Which one does not belong?', options: ['8', '27', '64', '100'], answer: 3 },
    { prompt: 'No mammals are reptiles.\nAll whales are mammals.\n\nWhich must be true?', options: ['Some whales are reptiles', 'No whales are reptiles', 'All reptiles are whales', 'Some reptiles are mammals'], answer: 1 },
    { prompt: 'You have a 3-litre jug and a 5-litre jug.\n\nWhat is the smallest amount you cannot measure exactly?', options: ['1 litre', '4 litres', '7 litres', 'Every amount up to 8 is possible'], answer: 3 },
    { prompt: 'What comes next?\n\n1, 2, 6, 24, 120, ?', options: ['240', '600', '720', '840'], answer: 2 }
  ]
];

/** Rotates by calendar month so a retake a month later draws the other paper. */
export function quizForToday(date = new Date()): QuizQuestion[] {
  return QUESTION_SETS[(date.getUTCFullYear() * 12 + date.getUTCMonth()) % QUESTION_SETS.length];
}

/** Maps correct answers onto the 70-135 band the Intelligence anchors expect.
 * This is a reasoning estimate, not a clinically validated IQ, and the UI says
 * so wherever the number is shown. */
export function quizScore(correct: number, total = QUIZ_LENGTH): number {
  return Math.round(70 + (Math.max(0, Math.min(total, correct)) / total) * 65);
}

/** True once a month has passed, so the baseline cannot be farmed by retaking. */
export function canRetakeQuiz(takenAt: string, now = new Date()): boolean {
  if (!takenAt) return true;
  const previous = Date.parse(`${takenAt}T00:00:00Z`);
  if (Number.isNaN(previous)) return true;
  return now.getTime() - previous >= 30 * 24 * 60 * 60 * 1000;
}
