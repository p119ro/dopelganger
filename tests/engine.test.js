// Run with: node --test tests/
const test = require('node:test');
const assert = require('node:assert');
const E = require('../js/engine.js');

const all = E.HABITS.map(h => h.id);

test('date math crosses months, years and DST', () => {
    assert.strictEqual(E.addDays('2026-03-31', 1), '2026-04-01');
    assert.strictEqual(E.addDays('2026-01-01', -1), '2025-12-31');
    assert.strictEqual(E.addDays('2026-03-08', 1), '2026-03-09');
    assert.strictEqual(E.daysBetween('2026-10-01', '2026-10-26'), 25);
});

test('4 AM cutoff', () => {
    assert.strictEqual(E.todayKey(new Date(2026, 9, 26, 3, 59)), '2026-10-25');
    assert.strictEqual(E.todayKey(new Date(2026, 9, 26, 4, 0)), '2026-10-26');
});

test('every missed day is punished, even ones never opened', () => {
    let s = E.emptyState();
    s = E.setHabit(s, '2026-10-01', 'gym', true);
    const sim = E.simulate(s, '2026-10-11');
    // Oct 1: +15, missed 80 (bronze, no loss). Oct 2..10: missed 95 each. Oct 11 open.
    assert.strictEqual(sim.history.length, 11);
    assert.strictEqual(sim.you, 15);
    assert.strictEqual(sim.shadow, 80 + 9 * 95);
});

test('tier multiplier comes off your points on each missed day', () => {
    let s = E.emptyState();
    // 1200 points up front via perfect days.
    for (let i = 0; i < 12; i++) for (const id of all) s = E.setHabit(s, E.addDays('2026-10-01', i), id, true);
    const sim = E.simulate(s, E.addDays('2026-10-01', 14)); // two empty finished days after
    // 12 perfect days = 1200 (silver), day 13 miss: -floor(95*.5)=47, day 14 miss: -47
    assert.strictEqual(sim.you, 1200 - 47 - 47);
    assert.strictEqual(sim.shadow, 190);
});

test('perfect day bonus and penalties', () => {
    let s = E.emptyState();
    for (const id of all) s = E.setHabit(s, '2026-10-26', id, true);
    s = E.changePenalty(s, '2026-10-26', 2);
    const sim = E.simulate(s, '2026-10-26');
    assert.strictEqual(sim.you, 95 + 5 - 20);
    assert.strictEqual(sim.shadow, 20);
    s = E.changePenalty(s, '2026-10-26', -5);
    assert.strictEqual(E.getDay(s, '2026-10-26').penalties, undefined);
});

test('v1 migration applies missed days retroactively and keeps penalties', () => {
    const v1 = {
        user: { powerPoints: 500 },
        doppelganger: { powerPoints: 95 + 30 }, // one punished empty day + 3 penalty presses
        dailyData: {
            '2026-10-01': { completed: ['gym', 'reading'], punishmentApplied: true, perfectDayBonus: false },
            '2026-10-02': { completed: [], punishmentApplied: true },
            '2026-10-05': { completed: ['sleep', 'bogus'], punishmentApplied: false }
        }
    };
    // punishmentApplied days: Oct1 missed 70, Oct2 missed 95 -> 165 > 125, so no legacy
    let s = E.migrate(v1, '2026-10-10');
    assert.strictEqual(s.startDate, '2026-10-01');
    assert.deepStrictEqual(s.days['2026-10-05'].done, ['sleep']);
    assert.strictEqual(s.legacyPenalty, null);

    v1.doppelganger.powerPoints = 165 + 30;
    s = E.migrate(v1, '2026-10-10');
    assert.deepStrictEqual(s.legacyPenalty, { date: '2026-10-10', points: 30 });
    const sim = E.simulate(s, '2026-10-10');
    // Oct1..9 finished: missed = 70 + 95*3 + 85 + 95*4
    assert.strictEqual(sim.shadow, 70 + 95 * 3 + 85 + 95 * 4 + 30);
    assert.strictEqual(E.migrate(JSON.parse(JSON.stringify(s))).startDate, '2026-10-01');
});

test('streaks survive an unfinished today', () => {
    let s = E.emptyState();
    for (const d of ['2026-10-23', '2026-10-24', '2026-10-25']) s = E.setHabit(s, d, 'gym', true);
    assert.strictEqual(E.habitStreak(s, 'gym', '2026-10-26'), 3);
    s = E.setHabit(s, '2026-10-26', 'gym', true);
    assert.strictEqual(E.habitStreak(s, 'gym', '2026-10-26'), 4);
    assert.strictEqual(E.habitStreak(s, 'gym', '2026-10-28'), 0);
});

test('unchecking keeps the start date', () => {
    let s = E.setHabit(E.emptyState(), '2026-10-20', 'gym', true);
    s = E.setHabit(s, '2026-10-20', 'gym', false);
    assert.strictEqual(s.startDate, '2026-10-20');
    assert.deepStrictEqual(s.days, {});
});
