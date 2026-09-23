export const QUESTIONS_PER_ROUND = 10;
export const TIME_LIMIT = 10;
export const BASE_POINTS = 100;
export const SPEED_BONUS_MULTIPLIER = 10;

export const OPERATIONS = {
  add: { symbol: '+', label: 'Addition' },
  sub: { symbol: '−', label: 'Subtraktion' },
  mul: { symbol: '×', label: 'Multiplikation' },
  div: { symbol: '÷', label: 'Division' },
};

export const RANGE_OPTIONS = [
  { value: 10, label: '1–10' },
  { value: 100, label: '1–100' },
  { value: 1000, label: '1–1000' },
];

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function createSeed(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) || 1;
}

function seededShuffle(items, seed) {
  const copy = [...items];
  let state = seed;

  for (let i = copy.length - 1; i > 0; i -= 1) {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    const j = Math.floor((state / 0x7fffffff) * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
}

function questionKey(question) {
  return question.prompt;
}

export function generateQuestion(operation, rangeMax, column = 1) {
  const op = OPERATIONS[operation];
  if (!op) throw new Error(`Unknown operation: ${operation}`);

  if (operation === 'add') {
    const a = randomInt(1, rangeMax);
    const b = randomInt(1, rangeMax);
    return {
      operation,
      rangeMax,
      column,
      prompt: `${a} ${op.symbol} ${b} = ?`,
      answer: a + b,
    };
  }

  if (operation === 'sub') {
    const a = randomInt(1, rangeMax);
    const b = randomInt(1, rangeMax);
    const min = Math.min(a, b);
    const max = Math.max(a, b);
    return {
      operation,
      rangeMax,
      column,
      prompt: `${max} ${op.symbol} ${min} = ?`,
      answer: max - min,
    };
  }

  if (operation === 'mul') {
    const a = randomInt(1, rangeMax);
    return {
      operation,
      rangeMax,
      column,
      prompt: `${a} ${op.symbol} ${column} = ?`,
      answer: a * column,
    };
  }

  const quotient = randomInt(1, rangeMax);
  const dividend = quotient * column;
  return {
    operation,
    rangeMax,
    column,
    prompt: `${dividend} ${op.symbol} ${column} = ?`,
    answer: quotient,
  };
}

function buildUniquePool(operation, rangeMax, column, targetCount = QUESTIONS_PER_ROUND) {
  const pool = [];
  const seen = new Set();
  const maxAttempts = 300;
  const maxUnique = (operation === 'mul' || operation === 'div') ? rangeMax : targetCount;

  for (let attempt = 0; attempt < maxAttempts && pool.length < maxUnique; attempt += 1) {
    const question = generateQuestion(operation, rangeMax, column);
    const key = questionKey(question);
    if (seen.has(key)) continue;
    seen.add(key);
    pool.push(question);
  }

  return pool;
}

export function buildRound(config) {
  const { operation, rangeMax, column = 1 } = config;
  const pool = buildUniquePool(operation, rangeMax, column);
  const seed = createSeed(`${operation}-${rangeMax}-${column}-${Date.now()}-${Math.random()}`);
  const shuffled = seededShuffle(pool.length ? pool : [generateQuestion(operation, rangeMax, column)], seed);

  const questions = [];
  for (let i = 0; i < QUESTIONS_PER_ROUND; i += 1) {
    questions.push({ ...shuffled[i % shuffled.length], roundIndex: i });
  }

  return {
    ...config,
    questions,
    roundId: `round-${Date.now()}`,
  };
}

function offsetScale(rangeMax) {
  if (rangeMax <= 10) return 3;
  if (rangeMax <= 100) return 10;
  return 100;
}

export function generateMcOptions(answer, rangeMax) {
  const scale = offsetScale(rangeMax);
  const offsets = [1, 2, 3, -1, -2, -3, scale, -scale, scale * 2, -scale * 2, 10, -10];
  const shuffledOffsets = seededShuffle(
    offsets,
    createSeed(`offsets-${answer}-${Date.now()}-${Math.random()}`)
  );

  const wrong = new Set();
  for (const offset of shuffledOffsets) {
    if (wrong.size >= 3) break;
    const candidate = answer + offset;
    if (candidate >= 0 && candidate !== answer) {
      wrong.add(candidate);
    }
  }

  while (wrong.size < 3) {
    const candidate = answer + randomInt(-scale, scale);
    if (candidate >= 0 && candidate !== answer) {
      wrong.add(candidate);
    }
  }

  const values = seededShuffle(
    [answer, ...wrong],
    createSeed(`mc-${answer}-${Date.now()}-${Math.random()}`)
  );
  return {
    values,
    correctIndex: values.indexOf(answer),
  };
}

export function calculatePoints(isCorrect, secondsRemaining) {
  if (!isCorrect) return 0;
  return BASE_POINTS + Math.max(0, secondsRemaining) * SPEED_BONUS_MULTIPLIER;
}

export function getAccuracyRate(stats) {
  if (!stats.totalQuestions) return 0;
  return Math.round((stats.totalCorrect / stats.totalQuestions) * 100);
}

export function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function getOperationLabel(operation) {
  return OPERATIONS[operation]?.label ?? operation;
}

export function needsColumn(operation) {
  return operation === 'mul' || operation === 'div';
}

export const DEFAULT_PREFS = {
  operation: 'add',
  rangeMax: 10,
  column: 8,
  answerMode: 'choice',
  timed: false,
};
