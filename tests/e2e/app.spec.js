// End-to-end tests. Run from tests/: npx playwright test
const fs = require('fs');
const { test, expect } = require('@playwright/test');
const E = require('../../js/engine.js');

const ALL = E.HABITS.map(h => h.id);
const NOW = new Date('2026-10-26T12:00:00-04:00'); // app day: 2026-10-26
const TODAY = '2026-10-26';

function perfectDays(state, from, count) {
    for (let i = 0; i < count; i++) {
        for (const id of ALL) state = E.setHabit(state, E.addDays(from, i), id, true);
    }
    return state;
}

const pts = n => `${Math.round(n).toLocaleString('en-US')} pts`;

// Seeds localStorage once per tab (reloads keep whatever the app saved), fakes the clock, opens the app.
async function open(page, { state, raw, time = NOW, hash = '' } = {}) {
    await page.clock.install({ time });
    const seed = raw || (state && JSON.stringify(state));
    if (seed) {
        await page.addInitScript(s => {
            if (!sessionStorage.getItem('seeded')) {
                localStorage.setItem('doppelganger_data', s);
                sessionStorage.setItem('seeded', '1');
            }
        }, seed);
    }
    await page.goto(`/${hash}`);
}

let pageErrors = [];

test.beforeEach(async ({ page }) => {
    pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err.message));
    page.on('console', msg => {
        if (msg.type() === 'error') pageErrors.push(msg.text());
    });
});

test.afterEach(async () => {
    expect(pageErrors, 'console errors').toEqual([]);
});

test('fresh user can log habits from the dashboard', async ({ page }) => {
    await open(page);
    await expect(page.locator('#totalPoints')).toHaveText('0 pts');
    await expect(page.locator('#currentTier')).toContainText('Bronze');

    await page.locator('.habit-quick-item[data-habit="gym"]').click();
    await expect(page.locator('#totalPoints')).toHaveText('15 pts');
    await expect(page.locator('#completionPercentage')).toHaveText('11%');
    await expect(page).toHaveTitle('(1/9) Doppelganger');

    await page.locator('.nav-btn[data-section="habits"]').click();
    await expect(page.locator('.habit-card[data-habit="gym"] input')).toBeChecked();
    await expect(page.locator('#finalScore')).toHaveText('+15');

    // Untoggle from the dashboard again.
    await page.locator('.nav-btn[data-section="dashboard"]').click();
    await page.locator('.habit-quick-item[data-habit="gym"]').click();
    await expect(page.locator('#totalPoints')).toHaveText('0 pts');
});

test('perfect day gives the bonus, confetti and an achievement toast', async ({ page }) => {
    await open(page, { hash: '#habits' });
    for (const id of ALL) await page.locator(`.habit-card[data-habit="${id}"]`).click();
    await expect(page.locator('#totalPoints')).toHaveText('100 pts');
    await expect(page.locator('.perfect-day-congrats')).toBeVisible();
    await expect(page.locator('.toast').filter({ hasText: 'Perfect Day' })).toBeVisible();
    await expect(page.locator('#pointsEarned')).toHaveText('+95 (+5 perfect)');
});

test('missed days are punished even if they were never opened', async ({ page }) => {
    // 12 perfect days (1,200 pts, Silver), then 13 days with nothing logged.
    const state = perfectDays(E.emptyState(), '2026-10-01', 12);
    const sim = E.simulate(state, TODAY);
    expect(sim.you).toBe(965); // 5 Silver misses at -47, then Bronze
    expect(sim.shadow).toBe(13 * 95);

    await open(page, { state });
    await expect(page.locator('#totalPoints')).toHaveText('965 pts');
    await expect(page.locator('#currentTier')).toContainText('Bronze');
    await expect(page.locator('#meterShadow')).toContainText('1,235');
});

test('old v1 data is migrated and backed up', async ({ page }) => {
    const v1 = {
        user: { powerPoints: 500 },
        doppelganger: { powerPoints: 165 + 30 },
        dailyData: {
            '2026-10-01': { completed: ['gym', 'reading'], punishmentApplied: true },
            '2026-10-02': { completed: [], punishmentApplied: true },
            '2026-10-05': { completed: ['sleep'], punishmentApplied: false }
        }
    };
    const expected = E.simulate(E.migrate(v1, TODAY), TODAY);
    await open(page, { raw: JSON.stringify(v1) });
    await expect(page.locator('#totalPoints')).toHaveText(pts(expected.you));
    const stored = await page.evaluate(() => ({
        data: JSON.parse(localStorage.getItem('doppelganger_data')),
        backup: localStorage.getItem('doppelganger_data_v1_backup')
    }));
    expect(stored.data.version).toBe(2);
    expect(stored.data.startDate).toBe('2026-10-01');
    expect(stored.data.legacyPenalty.points).toBe(30);
    expect(JSON.parse(stored.backup).dailyData).toBeTruthy();
});

test('date arrows stay put and keyboard navigation works', async ({ page }) => {
    await open(page, { hash: '#habits' });
    // Let the section fade-in (a short slide) finish before measuring.
    await page.locator('.section.active').evaluate(el => Promise.all(el.getAnimations().map(a => a.finished)));
    const boxes = async () => Promise.all(['#prevDay', '#nextDay'].map(s => page.locator(s).boundingBox()));
    const start = await boxes();
    expect(await page.evaluate(() => window.scrollY), 'page should not jump to the #habits anchor').toBe(0);
    await expect(page.locator('#nextDay')).toBeDisabled();
    await expect(page.locator('#todayBtn')).toBeHidden();

    for (let i = 0; i < 3; i++) await page.locator('#prevDay').click();
    await expect(page.locator('#currentDate')).toHaveText('Fri, Oct 23, 2026');
    expect(await boxes()).toEqual(start);
    await expect(page.locator('#todayBtn')).toBeVisible();

    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#currentDate')).toHaveText('Sat, Oct 24, 2026');
    await page.keyboard.press('t');
    await expect(page.locator('#currentDate')).toHaveText('Today');
    expect(await boxes()).toEqual(start);
});

test('editing a past day re-scores everything after it', async ({ page }) => {
    const state = perfectDays(E.emptyState(), '2026-10-01', 12);
    const expected = E.simulate(E.setHabit(state, '2026-10-20', 'gym', true), TODAY).you;

    await open(page, { state, hash: '#habits' });
    await page.locator('#datePickerBtn').click();
    await page.locator('#calGrid [data-date="2026-10-20"]').click();
    await expect(page.locator('#currentDate')).toHaveText('Tue, Oct 20, 2026');
    await expect(page.locator('#dateNote')).toContainText('Editing a past day');

    await page.locator('.habit-card[data-habit="gym"]').click();
    await expect(page.locator('#totalPoints')).toHaveText(pts(expected));
    await expect(page.locator('#summaryTitle')).toContainText('Oct 20');
});

test('calendar picks months and years, and closes on Escape or outside click', async ({ page }) => {
    const state = perfectDays(E.emptyState(), '2025-06-01', 3);
    await open(page, { state, hash: '#habits' });

    await page.locator('#datePickerBtn').click();
    await expect(page.locator('#calendar')).toBeVisible();
    await expect(page.locator('#calGrid .cal-day.is-today')).toHaveText('26');

    await page.locator('#calYear').selectOption('2025');
    await page.locator('#calMonth').selectOption('5'); // June
    await expect(page.locator('#calGrid [data-date="2025-06-02"]')).toHaveClass(/heat-5/);
    await expect(page.locator('#calSummary')).toContainText('30 days tracked');
    await expect(page.locator('#calSummary')).toContainText('3 perfect');
    await page.locator('#calGrid [data-date="2025-06-02"]').click();
    await expect(page.locator('#calendar')).toBeHidden();
    await expect(page.locator('#currentDate')).toHaveText('Mon, Jun 2, 2025');

    await page.locator('#datePickerBtn').click();
    await page.keyboard.press('Escape');
    await expect(page.locator('#calendar')).toBeHidden();

    await page.locator('#datePickerBtn').click();
    await page.locator('.habits-header h2').click();
    await expect(page.locator('#calendar')).toBeHidden();
});

test('logging before the start date asks first', async ({ page }) => {
    const state = perfectDays(E.emptyState(), '2026-10-20', 2);
    const before = E.simulate(state, TODAY).you;
    const after = E.simulate(E.setHabit(state, '2026-10-10', 'gym', true), TODAY).you;

    await open(page, { state, hash: '#habits' });
    await page.locator('#datePickerBtn').click();
    await page.locator('#calGrid [data-date="2026-10-10"]').click();
    await expect(page.locator('#dateNote')).toContainText('Before your start date');

    page.once('dialog', d => d.dismiss());
    await page.locator('.habit-card[data-habit="gym"]').click();
    await expect(page.locator('.habit-card[data-habit="gym"] input')).not.toBeChecked();
    await expect(page.locator('#totalPoints')).toHaveText(pts(before));

    page.once('dialog', d => {
        expect(d.message()).toContain('9 days in between');
        d.accept();
    });
    await page.locator('.habit-card[data-habit="gym"]').click();
    await expect(page.locator('#totalPoints')).toHaveText(pts(after));
});

test('screen time penalty can be added and undone', async ({ page }) => {
    await open(page, { hash: '#habits' });
    await expect(page.locator('#penaltyRemove')).toBeDisabled();
    await page.locator('#penaltyAdd').click();
    await page.locator('#penaltyAdd').click();
    await expect(page.locator('#penaltyCount')).toHaveText('2');
    await expect(page.locator('#totalPoints')).toHaveText('-20 pts');
    await expect(page.locator('#penaltyPoints')).toHaveText('−20');
    await page.locator('#penaltyRemove').click();
    await expect(page.locator('#totalPoints')).toHaveText('-10 pts');
});

test('day rolls over at 4 AM and the finished day gets scored', async ({ page }) => {
    const state = perfectDays(E.emptyState(), '2026-10-01', 12);
    const time = new Date('2026-10-26T03:58:00-04:00'); // still Oct 25 in the app
    await open(page, { state, time });

    await expect(page.locator('#totalPoints')).toHaveText(pts(E.simulate(state, '2026-10-25').you));
    await expect(page.locator('#dayCountdown')).toHaveText('Day ends in 2m');
    await expect(page.locator('#dayCountdown')).toHaveClass(/urgent/);

    await page.clock.runFor(3 * 60 * 1000);
    await expect(page.locator('#totalPoints')).toHaveText(pts(E.simulate(state, TODAY).you));
    await expect(page.locator('#dayCountdown')).toHaveText(/Day ends in (23h 5\dm|24h 0m)/);
});

test('progress: heatmap, ranges, legend and chart clicks', async ({ page }) => {
    let state = E.emptyState();
    for (let i = 0; i < 400; i++) {
        const key = E.addDays(TODAY, -i);
        for (const id of ALL.slice(0, i % 10)) state = E.setHabit(state, key, id, true);
    }
    await open(page, { state, hash: '#progress' });

    await expect(page.locator('#yearLabel')).toHaveText('2026');
    await expect(page.locator('#yearStats')).toContainText('days tracked');
    await page.locator('#yearPrev').click();
    await expect(page.locator('#yearLabel')).toHaveText('2025');
    await expect(page.locator('#yearPrev')).toBeDisabled();
    await page.locator('#yearNext').click();

    await page.locator('#rangeChips [data-range="365"]').click();
    await expect(page.locator('#habitsSub')).toContainText('Weekly average');
    await page.locator('#rangeChips [data-range="7"]').click();
    await expect(page.locator('#habitsSub')).toContainText('last 7 days');
    await expect(page.locator('#habitsChart .chart-hit rect')).toHaveCount(7);

    await page.locator('.legend-btn[data-series="shadow"]').click();
    await expect(page.locator('.legend-btn[data-series="shadow"]')).toHaveAttribute('aria-pressed', 'false');
    await page.reload();
    await expect(page.locator('.legend-btn[data-series="shadow"]')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#rangeChips [data-range="7"]')).toHaveClass(/active/);

    await expect(page.locator('#badgeSummary')).toContainText('unlocked');
    await expect(page.locator('.badge.unlocked').first()).toContainText('Unlocked');

    // Clicking a bar opens that day.
    await page.locator('#habitsChart .chart-hit rect').nth(5).click();
    await expect(page).toHaveURL(/#habits$/);
    await expect(page.locator('#currentDate')).toHaveText('Sun, Oct 25, 2026');

    // Clicking a heatmap day opens it too.
    await page.goto('/#progress');
    await page.locator('#heatmap [data-date="2026-10-05"]').click();
    await expect(page.locator('#currentDate')).toHaveText('Mon, Oct 5, 2026');
});

test('week strip on the dashboard opens a day', async ({ page }) => {
    await open(page);
    await expect(page.locator('#weekStrip .week-day')).toHaveCount(7);
    await page.locator('#weekStrip [data-date="2026-10-24"]').click();
    await expect(page.locator('#currentDate')).toHaveText('Sat, Oct 24, 2026');
});

test('backup export and import round-trip', async ({ page }) => {
    await open(page, { hash: '#habits' });
    await page.locator('.habit-card[data-habit="reading"]').click();
    await page.locator('.habit-card[data-habit="screentime"]').click();
    await expect(page.locator('#totalPoints')).toHaveText('25 pts');

    const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#exportBtn').click()]);
    expect(download.suggestedFilename()).toBe(`doppelganger-backup-${TODAY}.json`);
    const file = await download.path();
    expect(JSON.parse(fs.readFileSync(file, 'utf8')).days[TODAY].done).toEqual(['reading', 'screentime']);

    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await expect(page.locator('#totalPoints')).toHaveText('0 pts');

    page.once('dialog', d => d.accept());
    await page.locator('#importFile').setInputFiles(file);
    await expect(page.locator('#totalPoints')).toHaveText('25 pts');
    await expect(page.locator('.toast').filter({ hasText: 'Backup imported' })).toBeVisible();

    // Junk files are rejected without touching data.
    await page.locator('#importFile').setInputFiles({ name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{"nope":1}') });
    await expect(page.locator('.toast').filter({ hasText: "Couldn't import" })).toBeVisible();
    await expect(page.locator('#totalPoints')).toHaveText('25 pts');
});

test('no horizontal overflow on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const state = perfectDays(E.emptyState(), '2026-09-01', 20);
    await open(page, { state });
    for (const hash of ['#dashboard', '#habits', '#progress']) {
        await page.goto(`/${hash}`);
        await page.waitForTimeout(350);
        const [scroll, width] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
        expect(scroll, hash).toBeLessThanOrEqual(width);
    }
    await page.goto('/#habits');
    await page.locator('#datePickerBtn').click();
    const box = await page.locator('#calendar').boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(375);
});

test.describe('touch', () => {
    test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

    test('first tap on a bar shows the tooltip, second tap opens the day', async ({ page }) => {
        const state = perfectDays(E.emptyState(), '2026-10-10', 10);
        await open(page, { state, hash: '#progress' });
        const bar = page.locator('#habitsChart .chart-hit rect').nth(10);
        await bar.tap();
        await expect(page.locator('#habitsChart .chart-tooltip')).toHaveClass(/visible/);
        await expect(page).toHaveURL(/#progress$/);
        await bar.tap();
        await expect(page).toHaveURL(/#habits$/);
        await expect(page.locator('#currentDate')).toHaveText('Tue, Oct 20, 2026');
    });
});
