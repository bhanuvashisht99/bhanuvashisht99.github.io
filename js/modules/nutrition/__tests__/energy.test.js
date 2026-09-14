import { describe, test, expect } from 'vitest';
import {
  bmrMifflin,
  bmrKatchMcArdle,
  trainingBurn,
  computeTdee,
  calorieTarget,
  energySummary,
} from '../energy.js';
import { BASE_PROFILE } from './fixtures.js';

describe('bmrMifflin', () => {
  test('matches the known formula for a male', () => {
    // 10*70 + 6.25*175 - 5*30 + 5 = 700 + 1093.75 - 150 + 5 = 1648.75
    expect(bmrMifflin({ weightKg: 70, heightCm: 175, age: 30, sex: 'male' })).toBeCloseTo(1648.75, 2);
  });

  test('female is 166 kcal lower than male at the same size', () => {
    const m = bmrMifflin({ weightKg: 70, heightCm: 175, age: 30, sex: 'male' });
    const f = bmrMifflin({ weightKg: 70, heightCm: 175, age: 30, sex: 'female' });
    expect(m - f).toBe(166);
  });

  test('throws on non-positive inputs', () => {
    expect(() => bmrMifflin({ weightKg: 0, heightCm: 175, age: 30, sex: 'male' })).toThrow();
  });
});

describe('bmrKatchMcArdle', () => {
  test('uses lean mass', () => {
    // lean = 80 * 0.8 = 64; 370 + 21.6*64 = 1752.4
    expect(bmrKatchMcArdle({ weightKg: 80, bodyFatPct: 20 })).toBeCloseTo(1752.4, 1);
  });
  test('rejects absurd body fat', () => {
    expect(() => bmrKatchMcArdle({ weightKg: 80, bodyFatPct: 90 })).toThrow();
  });
});

describe('trainingBurn', () => {
  test('zero sessions burns nothing', () => {
    expect(trainingBurn({ weightKg: 70, sessionsPerWeek: 0, avgMinutes: 60 })).toEqual({
      perWeek: 0,
      perDay: 0,
    });
  });

  test('strength, 4x60min at 70kg is a plausible weekly burn', () => {
    const { perWeek, perDay } = trainingBurn({
      weightKg: 70,
      sessionsPerWeek: 4,
      avgMinutes: 60,
      modalities: ['strength'],
      intensity: 'moderate',
    });
    // MET 5 * 3.5 * 70 / 200 * 60 = 367.5 per session -> 1470/wk
    expect(perWeek).toBe(1470);
    expect(perDay).toBe(210);
  });

  test('hard intensity burns more than easy', () => {
    const easy = trainingBurn({ weightKg: 70, sessionsPerWeek: 3, avgMinutes: 45, intensity: 'easy' });
    const hard = trainingBurn({ weightKg: 70, sessionsPerWeek: 3, avgMinutes: 45, intensity: 'hard' });
    expect(hard.perWeek).toBeGreaterThan(easy.perWeek);
  });

  test('modality mix averages the METs', () => {
    const mixed = trainingBurn({
      weightKg: 70, sessionsPerWeek: 3, avgMinutes: 45,
      modalities: ['strength', 'hiit'], // avg MET (5+8)/2 = 6.5
    });
    const strengthOnly = trainingBurn({
      weightKg: 70, sessionsPerWeek: 3, avgMinutes: 45, modalities: ['strength'],
    });
    expect(mixed.perWeek).toBeGreaterThan(strengthOnly.perWeek);
  });
});

describe('computeTdee', () => {
  test('adds resting expenditure and training burn', () => {
    const t = computeTdee(BASE_PROFILE);
    expect(t.bmr).toBe(1649);
    // resting = 1648.75 * 1.3 = 2143.4 -> 2143
    expect(t.restingExpenditure).toBe(2143);
    expect(t.trainingKcalDay).toBe(210);
    expect(t.tdee).toBe(2143 + 210);
  });
});

describe('calorieTarget', () => {
  test('maintain leaves TDEE unchanged', () => {
    const r = calorieTarget({ tdee: 2500, bmr: 1700, goal: 'maintain', sex: 'male' });
    expect(r.calories).toBe(2500);
    expect(r.clamped).toBe(false);
  });

  test('moderate cut is a 20% deficit', () => {
    const r = calorieTarget({ tdee: 2500, bmr: 1700, goal: 'lose_weight', goalRate: 'moderate', sex: 'male' });
    expect(r.calories).toBe(2000);
    expect(r.delta).toBe(-500);
  });

  test('gain adds a surplus', () => {
    const r = calorieTarget({ tdee: 2500, bmr: 1700, goal: 'gain_muscle', goalRate: 'moderate', sex: 'male' });
    expect(r.calories).toBe(2750);
  });

  test('aggressive cut is clamped to the safety floor', () => {
    const r = calorieTarget({ tdee: 1800, bmr: 1600, goal: 'lose_weight', goalRate: 'aggressive', sex: 'male' });
    // raw = 1800 * 0.72 = 1296; floor = max(1760, 1500) = 1760
    expect(r.clamped).toBe(true);
    expect(r.calories).toBe(1760);
  });
});

describe('energySummary', () => {
  test('returns a merged energy + target object', () => {
    const s = energySummary({ ...BASE_PROFILE, goal: 'lose_weight', goalRate: 'moderate' });
    expect(s).toHaveProperty('bmr');
    expect(s).toHaveProperty('tdee');
    expect(s).toHaveProperty('calories');
    expect(s.calories).toBeLessThan(s.tdee);
  });
});
