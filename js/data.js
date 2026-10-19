// Static plan data: training program, phase defaults, MCAT schedule, quotes.

// Exercise: reps = target reps per set, sets = number of sets,
// start = starting weight in lb (0 = bodyweight / empty machine), inc = progression step.
export const PROGRAM = {
  L1: {
    name: 'Lower 1', focus: 'Squat focus', ex: [
      { id: 'squat', name: 'Back Squat', reps: 4, sets: 4, rpe: 8, main: true, start: 130, inc: 5 },
      { id: 'rdl', name: 'Romanian Deadlift', reps: 8, sets: 3, start: 95, inc: 5 },
      { id: 'bss', name: 'Bulgarian Split Squat', reps: 10, sets: 3, perLeg: true, start: 0, inc: 5 },
      { id: 'legcurl', name: 'Leg Curl', reps: 12, sets: 3, start: 50, inc: 5 },
      { id: 'scalf', name: 'Standing Calf Raise', reps: 12, sets: 4, start: 25, inc: 5 },
      { id: 'declinesit', name: 'Weighted Decline Sit-Up', reps: 12, sets: 3, start: 0, inc: 5 },
    ],
  },
  U1: {
    name: 'Upper 1', focus: 'Bench focus', ex: [
      { id: 'bench', name: 'Bench Press', reps: 4, sets: 4, rpe: 8, main: true, start: 135, inc: 5 },
      { id: 'wpullup', name: 'Weighted Pull-Up', reps: 6, sets: 4, start: 65, inc: 5, note: 'added weight' },
      { id: 'inclinemach', name: 'Incline Machine Press', reps: 10, sets: 3, start: 5, inc: 5, note: 'seat 13, IC 5' },
      { id: 'csrow', name: 'Chest-Supported Row', reps: 12, sets: 3, start: 55, inc: 5, note: 'seat 1.5, chest 4, lower handles' },
      { id: 'lat1', name: 'Lateral Raise', reps: 15, sets: 4, start: 12.5, inc: 2.5 },
      { id: 'ohtri', name: 'Overhead Triceps Extension', reps: 12, sets: 3, start: 15, inc: 2.5 },
      { id: 'curl1', name: 'Incline or Seated DB Curl', reps: 12, sets: 3, start: 15, inc: 2.5 },
    ],
  },
  L2: {
    name: 'Lower 2', focus: 'Deadlift focus', ex: [
      { id: 'deadlift', name: 'Deadlift', reps: 3, sets: 3, rpe: 8, main: true, start: 135, inc: 10 },
      { id: 'frontsq', name: 'Front Squat or Hack Squat', reps: 8, sets: 3, start: 0, inc: 5 },
      { id: 'hipthrust', name: 'Hip Thrust', reps: 10, sets: 3, start: 95, inc: 10 },
      { id: 'legext', name: 'Leg Extension', reps: 15, sets: 3, start: 55, inc: 5 },
      { id: 'secalf', name: 'Seated Calf Raise', reps: 15, sets: 4, start: 10, inc: 5 },
      { id: 'hlr', name: 'Hanging Leg Raise', reps: 10, sets: 3, start: 0, inc: 5 },
    ],
  },
  U2: {
    name: 'Upper 2', focus: 'Press focus', ex: [
      { id: 'ohp', name: 'Overhead Press', reps: 5, sets: 4, rpe: 8, main: true, start: 90, inc: 5 },
      { id: 'row', name: 'Barbell or DB Row', reps: 8, sets: 3, start: 30, inc: 5 },
      { id: 'cgb', name: 'Close-Grip Bench or Dip', reps: 10, sets: 3, start: 45, inc: 5 },
      { id: 'pulldown', name: 'Lat Pulldown', reps: 12, sets: 3, start: 85, inc: 5 },
      { id: 'fly', name: 'Cable Fly or Pec Deck', reps: 15, sets: 3, start: 55, inc: 5 },
      { id: 'lat2', name: 'Unilateral Lateral Raise', reps: 15, sets: 4, start: 10, inc: 2.5 },
      { id: 'reardelt', name: 'Rear Delt Fly', reps: 20, sets: 3, start: 15, inc: 2.5 },
      { id: 'curl2', name: 'Incline DB Curl', reps: 12, sets: 4, start: 15, inc: 2.5 },
    ],
  },
};
export const ROTATION = ['L1', 'U1', 'L2', 'U2'];
export const MAIN_LIFTS = [['squat', 'Squat'], ['bench', 'Bench'], ['deadlift', 'Deadlift'], ['ohp', 'OHP']];
export const DELOAD_WEEKS = [8, 16, 24, 32, 40, 48];

export const DEFAULT_SETTINGS = {
  programStart: '2026-10-19',
  startWeight: 203.8,
  cutGoal: 180,
  cutWeeks: 18,
  reverseWeeks: 4,
  reverseRebound: 4,
  bulkRate: 0.4,
  phases: {
    cut: { kcal: 2400, protein: 180 },
    reverse: { kcal: 2900, protein: 180 },
    bulk: { kcal: 3200, protein: 180 },
  },
  meals: [
    { name: 'Beef bowl', kcal: 868, protein: 46 },
    { name: 'Protein shake', kcal: 772, protein: 98 },
  ],
  mcatWeek11Start: '2026-10-19',
  mcatDate: '2027-01-21',
  psPagesTarget: 6,
  theme: 'dark',
};

// MCAT schedule from the spreadsheet, Mon..Sun. Week 10 starts 2026-10-12.
export const MCAT_FIRST_WEEK = 10;
export const MCAT_WEEKS = [
  ['UWorld (60, untimed)', 'UWorld (60, untimed)', 'UWorld (60, untimed)', 'UWorld (60, untimed)', 'EXAM', 'Exam review', 'Rest'],
  ['UWorld (60, untimed)', 'UWorld (60, untimed)', 'UWorld (60, untimed)', 'UWorld (60, untimed)', 'EXAM', 'Exam review', 'Rest'],
  ['UWorld (60, untimed)', 'UWorld (60, untimed)', 'UWorld (60, untimed)', 'UWorld (60, untimed)', 'EXAM', 'Exam review', 'Rest'],
  ['UWorld (60, untimed)', 'UWorld (60, untimed)', 'UWorld (60, untimed)', 'UWorld (60, untimed)', 'EXAM', 'Exam review', 'Rest'],
  ['UWorld (60, untimed)', 'UWorld (60, untimed)', 'UWorld (60, untimed)', 'UWorld (60, untimed)', 'EXAM', 'Exam review', 'Rest'],
  ['UWorld (60, untimed)', 'UWorld (60, untimed)', 'UWorld (60, untimed)', 'UWorld (60, untimed)', 'EXAM', 'Exam review', 'Rest'],
  ['UWorld (60, untimed)', 'UWorld (60, untimed)', 'UWorld (60, untimed)', 'Thanksgiving', 'Catch-up / lazy', 'Rest', 'Rest'],
  ['UWorld (60, untimed)', 'UWorld (60, untimed)', 'UWorld (60, untimed)', 'UWorld (60, untimed)', 'EXAM', 'Exam review', 'Rest'],
  ['UWorld (60, untimed)', 'UWorld (60, untimed)', 'UWorld (60, untimed)', 'UWorld (60, untimed)', 'EXAM', 'Exam review', 'Rest'],
  ['Chem QP (Q1-60)', 'Physics QP (Q1-60)', 'Bio QP 1 (Q1-60)', 'Bio QP 2 (Q1-60)', 'EXAM', 'Exam review', 'Rest'],
  ['Chem QP (Q61-120)', 'Physics QP (Q61-120)', 'Bio QP 1 (Q61-120)', 'Christmas Eve (off)', 'Christmas (off)', 'Bio QP 2 (Q61-120)', 'Rest'],
  ['Sec Bank 1: C/P (Q1-50)', 'Sec Bank 1: B/B (Q1-50)', 'Sec Bank 1: P/S (Q1-50)', 'Sec Bank 1: C/P (Q51-100)', "New Year's (off)", 'EXAM', 'Exam review'],
  ['Sec Bank 1: B/B (Q51-100)', 'Sec Bank 1: P/S (Q51-100)', 'Sec Bank 2: C/P (Q1-50)', 'Sec Bank 2: B/B (Q1-50)', 'EXAM', 'Exam review', 'Rest'],
  ['Sec Bank 2: P/S (Q1-50)', 'Sec Bank 2: C/P (Q51-100)', 'Sec Bank 2: B/B (Q51-100)', 'Sec Bank 2: P/S (Q51-100)', 'Review FL mistakes', 'Light review', 'Rest'],
  ['Review weak topics', 'Review high yield', "Pray / DON'T STUDY", 'MCAT', 'Sleep', 'Rest', 'Rest'],
];
// Exams in the order they get taken. Each 'EXAM' slot on the schedule takes the next one not yet scored.
export const EXAMS = [
  { id: 'diag', name: 'Diagnostic', slot: false },
  { id: 'bp1', name: 'BP 1' }, { id: 'bp2', name: 'BP 2' }, { id: 'bp3', name: 'BP 3' }, { id: 'bp4', name: 'BP 4' },
  { id: 'aamcs', name: 'AAMC Sample' },
  { id: 'aamc1', name: 'AAMC FL 1' }, { id: 'aamc2', name: 'AAMC FL 2' }, { id: 'aamc3', name: 'AAMC FL 3' },
  { id: 'aamc4', name: 'AAMC FL 4' }, { id: 'aamc5', name: 'AAMC FL 5' }, { id: 'aamc6', name: 'AAMC FL 6 (optional)' },
  { id: 'real', name: 'Real MCAT', slot: false },
];
export const SEED_EXAMS = { diag: { date: '2026-07-25', cp: 125, cars: 126, bb: 126, ps: 127 } };
export const MCAT_KEY_DATES = [
  ['2026-11-22', '60-day reschedule deadline'],
  ['2026-12-13', 'Last UWorld day, JW CARS ends'],
  ['2026-12-14', 'AAMC phase starts (timed)'],
  ['2026-12-22', '30-day deadline: keep Jan 21?'],
  ['2027-01-11', '10-day deadline (last change)'],
  ['2027-01-21', 'MCAT'],
  ['2027-02-23', 'Scores released'],
];
// CARS history from the old sheet: [date, seconds, questions, correct]
export const SEED_CARS = [["2026-07-22",412,5,5],["2026-07-23",555,5,2],["2026-07-24",516,6,6],["2026-07-25",540,6,4],["2026-07-26",363,5,3],["2026-07-27",501,6,5],["2026-07-28",644,5,4],["2026-08-03",600,6,6],["2026-08-04",640,7,5],["2026-08-05",451,5,5],["2026-08-07",485,5,3],["2026-08-10",570,5,3],["2026-08-12",403,5,4],["2026-08-13",557,6,6],["2026-08-14",655,7,6],["2026-08-15",573,6,5],["2026-08-16",543,7,6],["2026-08-17",338,6,6],["2026-08-18",429,6,5],["2026-08-19",409,6,3],["2026-08-20",398,5,3],["2026-08-26",441,7,6],["2026-08-27",431,6,6],["2026-08-28",355,5,3],["2026-08-29",382,5,3],["2026-08-30",604,6,4],["2026-08-31",516,5,3],["2026-09-03",447,6,5],["2026-09-04",519,7,4],["2026-09-05",518,5,5],["2026-09-07",537,6,6],["2026-09-08",473,5,5]];
// Old weigh-ins from the sheet, kept as history.
export const SEED_WEIGHTS = [['2026-09-23', 208.8], ['2026-09-24', 209.0], ['2026-09-25', 207.2], ['2026-09-26', 206.2], ['2026-10-19', 203.8]];

export const QUOTES = [
  'To become a star, you must burn.',
  'The price of progress is pain.',
  'Discipline is choosing what you want most over what you want now.',
  'The iron never lies.',
  'Comfort is the enemy of greatness.',
  'Bleed now. Shine later.',
  'You do not rise to the occasion. You fall to the level of your training.',
  'Pain is temporary. Quitting lasts forever.',
  'Nobody is coming. Save yourself.',
  'Every rep is a vote for who you are becoming.',
  'The obstacle is the way.',
  'Hunger is a weapon. Keep it sharp.',
  'Be the storm.',
  'Suffer the work or suffer the regret.',
  'Fire forges steel.',
  'Kill the version of you that wants to quit.',
  'Calm seas never made a skilled sailor.',
  'Show up. Especially when you do not want to.',
  'What stands in the way becomes the way.',
  'No one cares. Work harder.',
  'The dragon is slain one swing at a time.',
  'Earn the rest.',
  'Motivation fades. Discipline remains.',
  'Become the thing you fear.',
  'Small daily wins build empires.',
  'Embrace the grind. It is shaping you.',
  'Pressure makes diamonds.',
  'Out of the ashes, rise.',
  'You were not built to be average.',
  'Do it tired. Do it scared. Do it anyway.',
  'The mind quits before the body does.',
  'Sweat is the price of the crown.',
  'Iron sharpens iron.',
  'Through pain, wisdom.',
  'Be relentless.',
  'Hard choices, easy life. Easy choices, hard life.',
  'The cave you fear to enter holds the treasure you seek.',
  'Stay hungry. Stay dangerous.',
  'Win the morning, win the day.',
  'Darkness is where the light is forged.',
];
