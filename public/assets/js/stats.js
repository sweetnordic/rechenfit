const STORAGE_KEY = "rechenfit_stats";

function defaultStats() {
  return {
    roundsPlayed: 0,
    perfectRounds: 0,
    totalCorrect: 0,
    totalQuestions: 0,
    bestTimedScore: 0,
    bestAccuracy: 0,
    recentScores: [],
  };
}

export function loadStats() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultStats();
    return { ...defaultStats(), ...JSON.parse(raw) };
  } catch {
    return defaultStats();
  }
}

export function saveStats(stats) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  } catch {
    // ignore quota / private browsing errors
  }
}

export function recordResult(stats, { correctCount, totalQuestions, score, timed }) {
  const next = {
    ...stats,
    recentScores: timed
      ? [...stats.recentScores, score].slice(-20)
      : stats.recentScores,
  };

  next.roundsPlayed += 1;
  next.totalCorrect += correctCount;
  next.totalQuestions += totalQuestions;

  if (correctCount === totalQuestions) {
    next.perfectRounds += 1;
  }

  if (correctCount > next.bestAccuracy) {
    next.bestAccuracy = correctCount;
  }

  if (timed && score > next.bestTimedScore) {
    next.bestTimedScore = score;
  }

  return next;
}

export function getAccuracyRate(stats) {
  if (!stats.totalQuestions) return 0;
  return Math.round((stats.totalCorrect / stats.totalQuestions) * 100);
}
