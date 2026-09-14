import { describe, test, expect } from 'vitest';
import {
  toFraction,
  toDisplayValue,
  toGrams,
  unitLabel,
  describePortion,
  defaultMode,
  stepFor,
} from '../portion.js';

const egg = { name: 'Eggs', household: { label: 'egg', grams: 50, kind: 'count' } };
const banana = { name: 'Banana', household: { label: 'medium banana', grams: 118, kind: 'count' } };
const rice = { name: 'Rice', household: { label: 'cup', grams: 160, kind: 'measure' } };
const oil = { name: 'Olive oil', household: { label: 'tsp', grams: 5, kind: 'measure' } };
const milk = { name: 'Milk', household: { label: 'glass', grams: 250, kind: 'liquid' } };
const plain = { name: 'Mystery mix' }; // no household unit

describe('toFraction', () => {
  test('whole numbers pass through', () => {
    expect(toFraction(2)).toBe('2');
    expect(toFraction(0)).toBe('0');
  });
  test('clean quarters use vulgar fractions', () => {
    expect(toFraction(0.5)).toBe('½');
    expect(toFraction(1.5)).toBe('1½');
    expect(toFraction(0.25)).toBe('¼');
    expect(toFraction(2.75)).toBe('2¾');
  });
  test('messy values fall back to one decimal', () => {
    expect(toFraction(1.333)).toBe('1.3');
  });
});

describe('toDisplayValue / toGrams round-trip', () => {
  test('eggs: 100 g -> 2 -> 100 g', () => {
    expect(toDisplayValue(egg, 100, 'household')).toBe(2);
    expect(toGrams(egg, 2, 'household')).toBe(100);
  });
  test('half units are allowed for counts', () => {
    expect(toDisplayValue(egg, 75, 'household')).toBe(1.5);
    expect(toGrams(egg, 1.5, 'household')).toBe(75);
  });
  test('rice: 240 g -> 1½ cups -> 240 g', () => {
    expect(toDisplayValue(rice, 240, 'household')).toBe(1.5);
    expect(toGrams(rice, 1.5, 'household')).toBe(240);
  });
  test('oil: 5 g -> 1 tsp', () => {
    expect(toDisplayValue(oil, 5, 'household')).toBe(1);
    expect(toGrams(oil, 2, 'household')).toBe(10);
  });
  test('liquid shows ml, ~1:1 with grams, 10 ml steps', () => {
    expect(toDisplayValue(milk, 250, 'household')).toBe(250);
    expect(toDisplayValue(milk, 244, 'household')).toBe(240);
    expect(toGrams(milk, 200, 'household')).toBe(200);
  });
  test('grams mode is a pass-through', () => {
    expect(toDisplayValue(rice, 173, 'grams')).toBe(173);
    expect(toGrams(rice, 173, 'grams')).toBe(173);
  });
  test('foods without a household unit always use grams', () => {
    expect(toDisplayValue(plain, 90, 'household')).toBe(90);
    expect(toGrams(plain, 90, 'household')).toBe(90);
  });
});

describe('unitLabel', () => {
  test('pluralises counts', () => {
    expect(unitLabel(egg, 1, 'household')).toBe('egg');
    expect(unitLabel(egg, 2, 'household')).toBe('eggs');
    expect(unitLabel(banana, 2, 'household')).toBe('medium bananas');
  });
  test('never pluralises tsp/tbsp/ml', () => {
    expect(unitLabel(oil, 3, 'household')).toBe('tsp');
    expect(unitLabel(milk, 2, 'household')).toBe('ml');
  });
  test('grams mode -> "g"', () => {
    expect(unitLabel(rice, 3, 'grams')).toBe('g');
  });
});

describe('describePortion', () => {
  test('reads like a person would say it', () => {
    expect(describePortion(egg, 100)).toBe('2 eggs');
    expect(describePortion(egg, 50)).toBe('1 egg');
    expect(describePortion(banana, 118)).toBe('1 medium banana');
    expect(describePortion(rice, 240)).toBe('1½ cups');
    expect(describePortion(oil, 10)).toBe('2 tsp');
    expect(describePortion(milk, 250)).toBe('250 ml');
  });
  test('grams mode or no unit -> grams', () => {
    expect(describePortion(rice, 173, 'grams')).toBe('173 g');
    expect(describePortion(plain, 90)).toBe('90 g');
  });
});

describe('defaultMode / stepFor', () => {
  test('auto uses household when available, grams otherwise', () => {
    expect(defaultMode(egg, 'auto')).toBe('household');
    expect(defaultMode(plain, 'auto')).toBe('grams');
    expect(defaultMode(egg, 'grams')).toBe('grams');
  });
  test('step sizes', () => {
    expect(stepFor(egg, 'household')).toBe(0.5);
    expect(stepFor(rice, 'household')).toBe(0.25);
    expect(stepFor(egg, 'grams')).toBe(1);
    expect(stepFor(plain, 'grams')).toBe(5);
  });
});
