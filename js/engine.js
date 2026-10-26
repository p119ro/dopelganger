// Doppelganger engine: habits, dates and scoring. Pure logic, no DOM.
//
// Scores are never stored. They are replayed from the day log every time, so a
// missed day is always punished (whether or not you ever opened it) and editing
// a past day re-scores everything after it.

(function (root) {
    'use strict';

    const HABITS = [
        { id: 'reading',    name: 'Read 30 minutes',         points: 10, icon: '📚' },
        { id: 'screentime', name: 'Screen time <2 hours',    points: 15, icon: '📵' },
        { id: 'gym',        name: 'Gym session',             points: 15, icon: '💪' },
        { id: 'sleep',      name: 'Sleep 7-10 hours',        points: 10, icon: '😴' },
        { id: 'deepwork',   name: '90 min deep work',        points: 15, icon: '🎯' },
        { id: 'cardio',     name: '20 min cardio',           points: 10, icon: '🏃‍♂️' },
        { id: 'meditation', name: 'Meditate 10 min',         points: 5,  icon: '🧘' },
        { id: 'coldshower', name: 'Cold shower',             points: 5,  icon: '❄️' },
        { id: 'nutrition',  name: 'No sugar/processed food', points: 10, icon: '🍽️' }
    ];

    const POINTS = Object.fromEntries(HABITS.map(h => [h.id, h.points]));
    const MAX_DAILY = HABITS.reduce((sum, h) => sum + h.points, 0);

    const PERFECT_BONUS = 5;
    const PENALTY_POINTS = 10;          // per screen-time hour over the limit
    const DAY_CUTOFF_HOUR = 4;          // a day ends at 4:00 AM
    const STREAK_THRESHOLD = Math.ceil(HABITS.length * 0.7);
    const HABIT_GOAL_DAYS = 66;
    const MONTH_DAYS = 30;

    const TIERS = [
        { id: 'bronze',   name: 'Bronze',   min: 0,     multiplier: 0,   icon: '🥉' },
        { id: 'silver',   name: 'Silver',   min: 1000,  multiplier: 0.5, icon: '🥈' },
        { id: 'gold',     name: 'Gold',     min: 2500,  multiplier: 1,   icon: '🥇' },
        { id: 'platinum', name: 'Platinum', min: 5000,  multiplier: 2,   icon: '🏆' },
        { id: 'diamond',  name: 'Diamond',  min: 7500,  multiplier: 3,   icon: '💎' },
        { id: 'goggins',  name: 'Goggins',  min: 15000, multiplier: 4,   icon: '🔥' }
    ];

    // metric names map to the counters tracked in achievements().
    const BADGES = [
        { id: 'streak-3',      group: 'Streaks',      metric: 'bestStreak',      goal: 3,    icon: '🕯️', name: 'Warming Up',      desc: `3-day streak (${STREAK_THRESHOLD}+ habits a day)` },
        { id: 'first-week',    group: 'Streaks',      metric: 'bestStreak',      goal: 7,    icon: '🎯', name: 'First Week',      desc: '7-day streak' },
        { id: 'streak-30',     group: 'Streaks',      metric: 'bestStreak',      goal: 30,   icon: '🔥', name: 'Iron Month',      desc: '30-day streak' },
        { id: 'streak-master', group: 'Streaks',      metric: 'bestStreak',      goal: 66,   icon: '🧠', name: 'Streak Master',   desc: '66-day streak' },
        { id: 'streak-100',    group: 'Streaks',      metric: 'bestStreak',      goal: 100,  icon: '💯', name: 'Unbreakable',     desc: '100-day streak' },
        { id: 'perfect-day',   group: 'Perfect days', metric: 'perfectDays',     goal: 1,    icon: '⭐', name: 'Perfect Day',     desc: `All ${HABITS.length} habits in one day` },
        { id: 'perfect-7',     group: 'Perfect days', metric: 'perfectDays',     goal: 7,    icon: '🌟', name: 'Flawless Seven',  desc: '7 perfect days' },
        { id: 'perfect-30',    group: 'Perfect days', metric: 'perfectDays',     goal: 30,   icon: '✨', name: 'Perfectionist',   desc: '30 perfect days' },
        { id: 'perfect-100',   group: 'Perfect days', metric: 'perfectDays',     goal: 100,  icon: '🌌', name: 'Machine',         desc: '100 perfect days' },
        { id: 'habits-50',     group: 'Volume',       metric: 'totalHabits',     goal: 50,   icon: '✅', name: 'Getting Started', desc: '50 habits completed' },
        { id: 'habits-250',    group: 'Volume',       metric: 'totalHabits',     goal: 250,  icon: '📦', name: 'Committed',       desc: '250 habits completed' },
        { id: 'habits-1000',   group: 'Volume',       metric: 'totalHabits',     goal: 1000, icon: '🏗️', name: 'Builder',         desc: '1,000 habits completed' },
        { id: 'habits-2500',   group: 'Volume',       metric: 'totalHabits',     goal: 2500, icon: '🗿', name: 'Monument',        desc: '2,500 habits completed' },
        { id: 'habit-21',      group: 'Mastery',      metric: 'bestHabitStreak', goal: 21,   icon: '🌱', name: 'Habit Formed',    desc: '21-day streak on any single habit' },
        { id: 'habit-66',      group: 'Mastery',      metric: 'bestHabitStreak', goal: 66,   icon: '🌳', name: 'Automatic',       desc: '66-day streak on any single habit' },
        { id: 'month-1500',    group: 'Mastery',      metric: 'bestMonth',       goal: 1500, icon: '📈', name: 'Strong Month',    desc: '1,500+ points in 30 days' },
        { id: 'top-performer', group: 'Mastery',      metric: 'bestMonth',       goal: 2500, icon: '🏅', name: 'Top Performer',   desc: '2,500+ points in 30 days' },
        { id: 'comeback',      group: 'Mastery',      metric: 'comebacks',       goal: 1,    icon: '🔄', name: 'Comeback',        desc: 'Pull ahead of your Shadow after falling behind' },
        { id: 'tier-silver',   group: 'Tiers',        metric: 'bestTier',        goal: 1,    icon: '🥈', name: 'Silver',          desc: 'Reach Silver tier' },
        { id: 'tier-gold',     group: 'Tiers',        metric: 'bestTier',        goal: 2,    icon: '🥇', name: 'Gold',            desc: 'Reach Gold tier' },
        { id: 'tier-platinum', group: 'Tiers',        metric: 'bestTier',        goal: 3,    icon: '🏆', name: 'Platinum',        desc: 'Reach Platinum tier' },
        { id: 'tier-diamond',  group: 'Tiers',        metric: 'bestTier',        goal: 4,    icon: '💎', name: 'Diamond',         desc: 'Reach Diamond tier' },
        { id: 'tier-goggins',  group: 'Tiers',        metric: 'bestTier',        goal: 5,    icon: '🔥', name: 'Goggins',         desc: 'Reach Goggins tier' }
    ];

    // ============ DATES ============
    // Keys are 'YYYY-MM-DD'. Arithmetic is done in UTC so DST never skips or repeats a day.

    function localKey(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    function todayKey(now = new Date()) {
        const d = new Date(now);
        if (d.getHours() < DAY_CUTOFF_HOUR) d.setDate(d.getDate() - 1);
        return localKey(d);
    }

    function keyToUTC(key) {
        const [y, m, d] = key.split('-').map(Number);
        return Date.UTC(y, m - 1, d);
    }

    function addDays(key, n) {
        return new Date(keyToUTC(key) + n * 86400000).toISOString().slice(0, 10);
    }

    function daysBetween(fromKey, toKey) {
        return Math.round((keyToUTC(toKey) - keyToUTC(fromKey)) / 86400000);
    }

    function isValidKey(key) {
        return typeof key === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(key) && !isNaN(keyToUTC(key));
    }

    // ============ STATE ============
    // { version: 2, startDate, days: { key: { done: [habitId], penalties: n } }, legacyPenalty }

    function emptyState() {
        return { version: 2, startDate: null, days: {}, legacyPenalty: null };
    }

    function cleanDone(list) {
        return Array.isArray(list) ? [...new Set(list.filter(id => id in POINTS))] : [];
    }

    function earnedFor(done) {
        return done.reduce((sum, id) => sum + POINTS[id], 0);
    }

    function migrate(raw, today = todayKey()) {
        if (!raw || typeof raw !== 'object') return emptyState();
        if (raw.version === 2) return normalize(raw);

        // v1 stored running totals that were only punished for days you happened
        // to open. Rebuild from the log; the replay applies every missed day.
        const state = emptyState();
        const dailyData = raw.dailyData && typeof raw.dailyData === 'object' ? raw.dailyData : {};
        let punishedMissed = 0;

        for (const [key, day] of Object.entries(dailyData)) {
            if (!isValidKey(key) || !day) continue;
            const done = cleanDone(day.completed);
            if (day.punishmentApplied) punishedMissed += MAX_DAILY - earnedFor(done);
            if (done.length && key <= today) state.days[key] = { done };
        }

        // v1 never recorded screen-time penalties per day, only in the totals. Its
        // shadow total was exactly (missed points of punished days + penalties), so
        // the remainder recovers the penalties. They land on the migration day.
        const shadow = Number(raw.doppelganger && raw.doppelganger.powerPoints) || 0;
        const legacy = Math.round(shadow - punishedMissed);
        if (legacy > 0) state.legacyPenalty = { date: today, points: legacy };

        const keys = Object.keys(state.days).sort();
        state.startDate = keys[0] || (state.legacyPenalty ? today : null);
        return state;
    }

    function normalize(raw) {
        const state = emptyState();
        for (const [key, day] of Object.entries(raw.days || {})) {
            if (!isValidKey(key) || !day) continue;
            const done = cleanDone(day.done);
            const penalties = Math.max(0, Math.floor(Number(day.penalties) || 0));
            if (done.length || penalties) state.days[key] = penalties ? { done, penalties } : { done };
        }
        if (isValidKey(raw.startDate)) state.startDate = raw.startDate;
        const lp = raw.legacyPenalty;
        if (lp && isValidKey(lp.date) && Number(lp.points) > 0) {
            state.legacyPenalty = { date: lp.date, points: Number(lp.points) };
        }
        // The start date can only be as late as the earliest activity.
        const first = Object.keys(state.days).sort()[0];
        if (first && (!state.startDate || first < state.startDate)) state.startDate = first;
        return state;
    }

    function getDay(state, key) {
        return state.days[key] || { done: [] };
    }

    // Returns a new state; the input is untouched.
    function setHabit(state, key, habitId, completed) {
        if (!(habitId in POINTS)) return state;
        const day = getDay(state, key);
        const done = day.done.filter(id => id !== habitId);
        if (completed) done.push(habitId);
        return withDay(state, key, { ...day, done });
    }

    function changePenalty(state, key, delta) {
        const day = getDay(state, key);
        const penalties = Math.max(0, (day.penalties || 0) + delta);
        return withDay(state, key, { ...day, penalties });
    }

    function withDay(state, key, day) {
        const days = { ...state.days };
        if (day.done.length || day.penalties) {
            days[key] = day.penalties ? { done: day.done, penalties: day.penalties } : { done: day.done };
        } else {
            delete days[key];
        }
        let startDate = state.startDate;
        if (days[key] && (!startDate || key < startDate)) startDate = key;
        return { ...state, days, startDate };
    }

    // ============ SCORING ============

    function tierFor(points) {
        let tier = TIERS[0];
        for (const t of TIERS) if (points >= t.min) tier = t;
        return tier;
    }

    function nextTier(tier) {
        return TIERS[TIERS.indexOf(tier) + 1] || null;
    }

    // Replays every day from the start date through today. Each finished day:
    //   you += earned + bonus - penalties - floor(missed * tier multiplier)
    //   shadow += missed + penalties
    // Today is still open, so its punishment is only a projection.
    function simulate(state, today = todayKey()) {
        const history = [];
        const byDate = {};
        let you = 0;
        let shadow = 0;

        if (state.startDate && state.startDate <= today) {
            for (let key = state.startDate; key <= today; key = addDays(key, 1)) {
                const day = getDay(state, key);
                const earned = earnedFor(day.done);
                const perfect = day.done.length === HABITS.length;
                const bonus = perfect ? PERFECT_BONUS : 0;
                let penalty = (day.penalties || 0) * PENALTY_POINTS;
                if (state.legacyPenalty && state.legacyPenalty.date === key) penalty += state.legacyPenalty.points;

                you += earned + bonus - penalty;
                shadow += penalty;

                const missed = MAX_DAILY - earned;
                const tier = tierFor(you);
                const punishment = Math.floor(missed * tier.multiplier);
                const final = key < today;
                if (final) {
                    you -= punishment;
                    shadow += missed;
                }

                const entry = {
                    date: key, done: day.done, earned, bonus, perfect, penalty, missed,
                    punishment, tier: tier.id, final, you, shadow
                };
                history.push(entry);
                byDate[key] = entry;
            }
        }

        return { you, shadow, tier: tierFor(you), history, byDate, today };
    }

    // Projection for a day outside the replay (before the start date, or a fresh user).
    function untrackedDay(state, key, sim) {
        const day = getDay(state, key);
        const earned = earnedFor(day.done);
        const missed = MAX_DAILY - earned;
        return {
            date: key, done: day.done, earned, bonus: 0, perfect: false, penalty: 0, missed,
            punishment: Math.floor(missed * sim.tier.multiplier), tier: sim.tier.id,
            final: false, untracked: true
        };
    }

    function level(points) {
        const xp = Math.max(0, Math.floor(points));
        return { level: Math.floor(xp / 100) + 1, xp: xp % 100, next: 100 };
    }

    // Counts back from today; if today isn't met yet the streak is still alive from yesterday.
    function streakEndingToday(state, today, test) {
        let key = today;
        if (!test(getDay(state, key))) key = addDays(key, -1);
        let count = 0;
        while (test(getDay(state, key))) {
            count++;
            key = addDays(key, -1);
        }
        return count;
    }

    function habitStreak(state, habitId, today = todayKey()) {
        return streakEndingToday(state, today, day => day.done.includes(habitId));
    }

    function overallStreak(state, today = todayKey()) {
        return streakEndingToday(state, today, day => day.done.length >= STREAK_THRESHOLD);
    }

    // One pass over history: running counters for every badge metric, and the
    // first day each badge's goal was met.
    function achievements(sim) {
        const m = { bestStreak: 0, perfectDays: 0, totalHabits: 0, bestHabitStreak: 0, bestMonth: 0, comebacks: 0, bestTier: 0 };
        const unlocked = {};
        const habitRuns = Object.fromEntries(HABITS.map(h => [h.id, 0]));
        const window = [];
        let run = 0;
        let month = 0;
        let behind = false;

        for (const entry of sim.history) {
            run = entry.done.length >= STREAK_THRESHOLD ? run + 1 : 0;
            m.bestStreak = Math.max(m.bestStreak, run);
            if (entry.perfect) m.perfectDays++;
            m.totalHabits += entry.done.length;

            for (const h of HABITS) {
                habitRuns[h.id] = entry.done.includes(h.id) ? habitRuns[h.id] + 1 : 0;
                m.bestHabitStreak = Math.max(m.bestHabitStreak, habitRuns[h.id]);
            }

            const points = entry.earned + entry.bonus;
            window.push(points);
            month += points;
            if (window.length > MONTH_DAYS) month -= window.shift();
            m.bestMonth = Math.max(m.bestMonth, month);

            // Only finished days count for tiers and comebacks; today can still swing.
            if (entry.final) {
                if (entry.you < entry.shadow) behind = true;
                else if (behind && entry.you > entry.shadow) {
                    m.comebacks++;
                    behind = false;
                }
                m.bestTier = Math.max(m.bestTier, TIERS.indexOf(tierFor(entry.you)));
            }

            for (const b of BADGES) {
                if (!unlocked[b.id] && m[b.metric] >= b.goal) unlocked[b.id] = entry.date;
            }
        }

        return { metrics: m, unlocked };
    }

    function stats(state, sim) {
        const today = sim.today;
        const { metrics, unlocked } = achievements(sim);

        let monthlyPoints = 0;
        for (let i = 0; i < MONTH_DAYS; i++) {
            const entry = sim.byDate[addDays(today, -i)];
            if (entry) monthlyPoints += entry.earned + entry.bonus;
        }

        return {
            currentStreak: overallStreak(state, today),
            bestStreak: metrics.bestStreak,
            perfectDays: metrics.perfectDays,
            monthlyPoints, metrics, unlocked
        };
    }

    // 0 = nothing done, 1-4 = partial, 5 = perfect. Shared by every calendar view.
    function heatLevel(doneCount) {
        if (doneCount <= 0) return 0;
        if (doneCount >= HABITS.length) return 5;
        return Math.min(4, Math.ceil((doneCount / HABITS.length) * 4));
    }

    function yearSummary(sim, year) {
        const prefix = `${year}-`;
        const days = sim.history.filter(e => e.date.startsWith(prefix));
        let run = 0;
        const summary = { days: days.length, habits: 0, perfectDays: 0, bestStreak: 0, earned: 0, shadow: 0, net: 0 };
        for (const e of days) {
            summary.habits += e.done.length;
            if (e.perfect) summary.perfectDays++;
            run = e.done.length >= STREAK_THRESHOLD ? run + 1 : 0;
            summary.bestStreak = Math.max(summary.bestStreak, run);
            summary.earned += e.earned + e.bonus;
            if (e.final) summary.shadow += e.missed + e.penalty;
            else summary.shadow += e.penalty;
        }
        if (days.length) {
            const before = sim.byDate[addDays(days[0].date, -1)];
            summary.net = days[days.length - 1].you - (before ? before.you : 0);
        }
        summary.completion = days.length ? summary.habits / (days.length * HABITS.length) : 0;
        return summary;
    }

    const Engine = {
        HABITS, TIERS, BADGES, MAX_DAILY, PERFECT_BONUS, PENALTY_POINTS, STREAK_THRESHOLD,
        HABIT_GOAL_DAYS, MONTH_DAYS,
        todayKey, addDays, daysBetween, isValidKey,
        emptyState, migrate, getDay, setHabit, changePenalty,
        tierFor, nextTier, simulate, untrackedDay, level, habitStreak, overallStreak, stats,
        achievements, heatLevel, yearSummary
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = Engine;
    else root.Engine = Engine;
})(this);
