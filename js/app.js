// Doppelganger UI. All state lives in localStorage; scoring is in engine.js.

(function () {
    'use strict';

    const E = window.Engine;
    const Charts = window.Charts;
    const STORAGE_KEY = 'doppelganger_data';
    const PREFS_KEY = 'doppelganger_prefs';
    const DAYS_BEFORE_START = 365;      // how far before your start date you can browse/backfill
    const WEEKLY_AFTER = 120;           // habits chart switches to weekly bars past this many days
    const SECTIONS = ['dashboard', 'habits', 'progress'];
    const RANGES = ['7', '30', '90', '365', 'all'];
    const COLORS = { you: '#1a9fca', shadow: '#e5534b' };
    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
        'August', 'September', 'October', 'November', 'December'];

    const $ = id => document.getElementById(id);
    const fmt = n => Math.round(n).toLocaleString('en-US');
    const signed = n => (n > 0 ? `+${fmt(n)}` : n < 0 ? `−${fmt(-n)}` : '0');
    const plural = (n, word) => `${fmt(n)} ${word}${n === 1 ? '' : 's'}`;
    const escapeHtml = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

    function keyDate(key) {
        const [y, m, d] = key.split('-').map(Number);
        return new Date(y, m - 1, d);
    }

    function longDate(key) {
        return keyDate(key).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    }

    function weekday(key) {
        return keyDate(key).getDay();
    }

    class App {
        constructor() {
            this.state = this.load();
            this.prefs = this.loadPrefs();
            this.today = E.todayKey();
            this.viewing = this.today;
            this.section = 'dashboard';
            this.heatYear = Number(this.today.slice(0, 4));
            this.calMonth = this.today.slice(0, 7);
            this.heat = [0, 1, 2, 3, 4, 5].map(i => getComputedStyle(document.body).getPropertyValue(`--heat-${i}`).trim());

            this.buildHabitCards();
            this.buildQuickList();
            this.buildTierLadder();
            this.bindEvents();
            this.showSection(this.sectionFromHash(), false);
            this.render();
            this.updateCountdown();
        }

        // ============ STORAGE ============

        load() {
            let text = null;
            try {
                text = localStorage.getItem(STORAGE_KEY);
                const raw = text ? JSON.parse(text) : null;
                const state = E.migrate(raw, E.todayKey());
                if (raw && raw.version !== 2) {
                    // Keep the original v1 data around in case the migration needs a second look.
                    localStorage.setItem(`${STORAGE_KEY}_v1_backup`, text);
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
                }
                return state;
            } catch (error) {
                console.error('Could not read saved data:', error);
                if (text) {
                    try { localStorage.setItem(`${STORAGE_KEY}_corrupt_backup`, text); } catch (_) { /* storage full */ }
                }
                return E.emptyState();
            }
        }

        save() {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
            } catch (error) {
                console.error('Save failed:', error);
                this.toast('⚠️ Could not save. Your browser storage may be full or blocked.');
            }
        }

        loadPrefs() {
            const prefs = { range: '30', hidden: [] };
            try {
                const saved = JSON.parse(localStorage.getItem(PREFS_KEY));
                if (saved && RANGES.includes(saved.range)) prefs.range = saved.range;
                if (saved && Array.isArray(saved.hidden)) prefs.hidden = saved.hidden.filter(s => s in COLORS);
            } catch (_) { /* defaults */ }
            return prefs;
        }

        savePrefs() {
            try { localStorage.setItem(PREFS_KEY, JSON.stringify(this.prefs)); } catch (_) { /* not critical */ }
        }

        commit(state) {
            const before = this.lastStats ? this.lastStats.unlocked : {};
            this.state = state;
            this.save();
            this.render();
            for (const badge of E.BADGES) {
                if (this.lastStats.unlocked[badge.id] && !before[badge.id]) {
                    this.toast(`${badge.icon} Achievement unlocked: <b>${badge.name}</b>`);
                }
            }
        }

        // ============ STATIC MARKUP ============

        buildHabitCards() {
            $('habitsGrid').innerHTML = E.HABITS.map(h => `
                <label class="habit-card" data-habit="${h.id}">
                    <input type="checkbox" class="habit-checkbox" data-habit="${h.id}">
                    <div class="habit-header">
                        <div class="habit-icon">${h.icon}</div>
                        <div class="habit-info">
                            <h3>${escapeHtml(h.name)}</h3>
                            <span class="habit-points">+${h.points} points</span>
                        </div>
                        <span class="habit-toggle" aria-hidden="true"></span>
                    </div>
                    <div class="habit-details">
                        <div class="habit-streak">Streak: <span data-streak>0 days</span></div>
                        <div class="progress-bar" title="${E.HABIT_GOAL_DAYS}-day habit goal">
                            <div class="progress-fill" data-progress></div>
                        </div>
                    </div>
                </label>`).join('');
        }

        buildQuickList() {
            $('habitQuickList').innerHTML = E.HABITS.map(h => `
                <button class="habit-quick-item" data-habit="${h.id}" aria-pressed="false">
                    <span class="habit-icon">${h.icon}</span>
                    <span class="habit-name">${escapeHtml(h.name)}</span>
                    <span class="habit-pts">+${h.points}</span>
                    <span class="habit-check" aria-hidden="true"></span>
                </button>`).join('');
        }

        buildTierLadder() {
            $('tierLadder').innerHTML = [...E.TIERS].reverse().map(t => {
                const next = E.nextTier(t);
                const range = next ? `${fmt(t.min)} – ${fmt(next.min)} pts` : `${fmt(t.min)}+ pts`;
                const rule = t.multiplier ? `Missed points ×${t.multiplier} off you` : 'No penalty for misses';
                return `
                    <div class="tier ${t.id}" data-tier="${t.id}">
                        <div class="tier-icon">${t.icon}</div>
                        <div class="tier-info">
                            <div class="tier-name">${t.name}</div>
                            <div class="tier-range">${range} · ${rule}</div>
                        </div>
                        <div class="tier-status"></div>
                    </div>`;
            }).join('');
        }

        // ============ EVENTS ============

        bindEvents() {
            window.addEventListener('hashchange', () => this.showSection(this.sectionFromHash()));

            $('habitsGrid').addEventListener('change', e => {
                if (e.target.matches('.habit-checkbox')) {
                    this.toggleHabit(this.viewing, e.target.dataset.habit, e.target.checked);
                }
            });

            $('habitQuickList').addEventListener('click', e => {
                const item = e.target.closest('.habit-quick-item');
                if (!item) return;
                const done = E.getDay(this.state, this.today).done.includes(item.dataset.habit);
                this.toggleHabit(this.today, item.dataset.habit, !done);
            });

            $('prevDay').addEventListener('click', () => this.goToDay(E.addDays(this.viewing, -1)));
            $('nextDay').addEventListener('click', () => this.goToDay(E.addDays(this.viewing, 1)));
            $('todayBtn').addEventListener('click', () => this.goToDay(this.today));

            // Calendar popover
            $('datePickerBtn').addEventListener('click', () => this.toggleCalendar());
            $('calPrev').addEventListener('click', () => this.shiftCalMonth(-1));
            $('calNext').addEventListener('click', () => this.shiftCalMonth(1));
            $('calMonth').addEventListener('change', e => {
                this.calMonth = `${this.calMonth.slice(0, 4)}-${String(Number(e.target.value) + 1).padStart(2, '0')}`;
                this.renderCalendar();
            });
            $('calYear').addEventListener('change', e => {
                this.calMonth = `${e.target.value}-${this.calMonth.slice(5)}`;
                this.renderCalendar();
            });
            $('calToday').addEventListener('click', () => {
                this.goToDay(this.today);
                this.closeCalendar();
            });
            $('calGrid').addEventListener('click', e => {
                const cell = e.target.closest('[data-date]');
                if (!cell || cell.disabled) return;
                this.goToDay(cell.dataset.date);
                this.closeCalendar();
            });
            document.addEventListener('pointerdown', e => {
                if (!$('calendar').hidden && !e.target.closest('.date-nav-wrap')) this.closeCalendar();
            });

            document.addEventListener('keydown', e => {
                if (e.key === 'Escape' && !$('calendar').hidden) {
                    this.closeCalendar();
                    $('datePickerBtn').focus();
                    return;
                }
                if (this.section !== 'habits' || e.altKey || e.ctrlKey || e.metaKey) return;
                if (e.target.closest('input:not([type=checkbox]), textarea, select')) return;
                if (e.key === 'ArrowLeft') this.goToDay(E.addDays(this.viewing, -1));
                if (e.key === 'ArrowRight') this.goToDay(E.addDays(this.viewing, 1));
                if (e.key === 't') this.goToDay(this.today);
            });

            $('penaltyAdd').addEventListener('click', () => this.changePenalty(1));
            $('penaltyRemove').addEventListener('click', () => this.changePenalty(-1));

            // Day cells anywhere (week strip, heatmap) open that day on the Habits page.
            $('weekStrip').addEventListener('click', e => this.openDayFromCell(e));
            $('heatmap').addEventListener('click', e => this.openDayFromCell(e));
            document.addEventListener('mouseover', e => this.showCellTip(e));
            document.addEventListener('mouseout', e => {
                if (e.target.closest('[data-date]')) $('floatTip').classList.remove('visible');
            });

            // Progress controls
            $('yearPrev').addEventListener('click', () => this.shiftYear(-1));
            $('yearNext').addEventListener('click', () => this.shiftYear(1));
            $('rangeChips').addEventListener('click', e => {
                const btn = e.target.closest('[data-range]');
                if (!btn) return;
                this.prefs.range = btn.dataset.range;
                this.savePrefs();
                this.renderProgress(this.lastSim, this.lastStats);
            });
            document.querySelectorAll('.legend-btn').forEach(btn => btn.addEventListener('click', () => {
                const id = btn.dataset.series;
                const hidden = new Set(this.prefs.hidden);
                hidden.has(id) ? hidden.delete(id) : hidden.add(id);
                this.prefs.hidden = [...hidden];
                this.savePrefs();
                this.renderCharts(this.lastSim);
            }));

            // Backup
            $('exportBtn').addEventListener('click', () => this.exportData());
            $('importBtn').addEventListener('click', () => $('importFile').click());
            $('importFile').addEventListener('change', e => this.importData(e.target.files[0]));

            // Day rollover (4 AM), returning to a backgrounded tab, and edits from another tab.
            setInterval(() => {
                this.checkDayChange();
                this.updateCountdown();
            }, 30000);
            document.addEventListener('visibilitychange', () => {
                if (!document.hidden) {
                    this.checkDayChange();
                    this.updateCountdown();
                }
            });
            window.addEventListener('storage', e => {
                if (e.key === STORAGE_KEY) {
                    this.state = this.load();
                    this.render();
                }
            });

            let resizeTimer;
            window.addEventListener('resize', () => {
                clearTimeout(resizeTimer);
                resizeTimer = setTimeout(() => {
                    if (this.section === 'progress') this.renderCharts(this.lastSim);
                }, 150);
            });
        }

        sectionFromHash() {
            const id = location.hash.slice(1);
            return SECTIONS.includes(id) ? id : 'dashboard';
        }

        showSection(id, render = true) {
            const changed = id !== this.section;
            this.section = id;
            this.closeCalendar();
            $('floatTip').classList.remove('visible');
            document.querySelectorAll('.section').forEach(s => s.classList.toggle('active', s.dataset.view === id));
            if (changed) window.scrollTo({ top: 0 });
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.section === id));
            if (render) this.render();
        }

        checkDayChange() {
            const today = E.todayKey();
            if (today === this.today) return;
            if (this.viewing === this.today) this.viewing = today;
            this.today = today;
            this.render();
        }

        minViewableDay() {
            const from = this.state.startDate && this.state.startDate < this.today ? this.state.startDate : this.today;
            return E.addDays(from, -DAYS_BEFORE_START);
        }

        canView(key) {
            return key <= this.today && key >= this.minViewableDay();
        }

        goToDay(key) {
            if (!this.canView(key) || key === this.viewing) return;
            this.viewing = key;
            this.render();
        }

        openDay(key) {
            if (!this.canView(key)) return;
            this.viewing = key;
            $('floatTip').classList.remove('visible');
            if (this.section === 'habits') this.render();
            else location.hash = '#habits';
        }

        openDayFromCell(e) {
            const cell = e.target.closest('[data-date]');
            if (cell && !cell.disabled) this.openDay(cell.dataset.date);
        }

        // Logging a day before your start date pulls every unlogged day in between into
        // your history as missed days. That can cost a lot, so confirm first.
        confirmBackfill(key) {
            const ref = this.state.startDate || this.today;
            const gap = E.daysBetween(key, ref) - 1;
            if (key >= ref || gap < 1) return true;
            return window.confirm(
                `Logging ${longDate(key)} moves your start date back to that day.\n\n` +
                `The ${gap} day${gap === 1 ? '' : 's'} in between will count as missed ` +
                `(points go to your Shadow) unless you log them too. Continue?`
            );
        }

        toggleHabit(key, habitId, completed) {
            if (key > this.today) return;
            if (completed && !this.confirmBackfill(key)) {
                this.render();
                return;
            }
            const wasPerfect = E.getDay(this.state, key).done.length === E.HABITS.length;
            this.commit(E.setHabit(this.state, key, habitId, completed));
            const isPerfect = E.getDay(this.state, key).done.length === E.HABITS.length;
            if (isPerfect && !wasPerfect && key === this.today) this.showConfetti();
        }

        changePenalty(delta) {
            if (delta > 0 && !this.confirmBackfill(this.viewing)) return;
            this.commit(E.changePenalty(this.state, this.viewing, delta));
        }

        // ============ RENDER ============

        render() {
            const sim = E.simulate(this.state, this.today);
            const stats = E.stats(this.state, sim);
            this.lastSim = sim;
            this.lastStats = stats;

            this.renderHeader(sim);
            if (this.section === 'dashboard') this.renderDashboard(sim, stats);
            if (this.section === 'habits') this.renderHabits(sim);
            if (this.section === 'progress') this.renderProgress(sim, stats);
            if (!$('calendar').hidden) this.renderCalendar();
        }

        dayEntry(sim, key) {
            return sim.byDate[key] || E.untrackedDay(this.state, key, sim);
        }

        // CSS class for a day cell in any calendar view.
        cellClass(key, sim) {
            if (key > this.today) return 'future';
            const entry = sim.byDate[key];
            if (!entry) return 'untracked';
            if (!entry.done.length) return entry.final ? 'heat-miss' : 'heat-0';
            return `heat-${E.heatLevel(entry.done.length)}`;
        }

        cellTip(key, sim) {
            const entry = sim.byDate[key];
            let detail;
            if (key > this.today) detail = 'Future';
            else if (!entry) detail = 'Not tracked';
            else {
                const parts = [`${entry.done.length}/${E.HABITS.length} habits`, `+${entry.earned + entry.bonus} pts`];
                if (entry.perfect) parts.push('perfect ⭐');
                if (entry.final) parts.push(`Shadow +${entry.missed + entry.penalty}`);
                else parts.push('in progress');
                detail = parts.join(' · ');
            }
            return `<b>${longDate(key)}</b><br>${detail}`;
        }

        showCellTip(e) {
            const cell = e.target.closest('[data-date]');
            if (!cell || !this.lastSim) return;
            const tip = $('floatTip');
            tip.innerHTML = this.cellTip(cell.dataset.date, this.lastSim);
            tip.classList.add('visible');
            const r = cell.getBoundingClientRect();
            const w = tip.offsetWidth;
            const left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2));
            const top = r.top - tip.offsetHeight - 8;
            tip.style.left = `${left}px`;
            tip.style.top = `${top < 8 ? r.bottom + 8 : top}px`;
        }

        renderHeader(sim) {
            const tier = $('currentTier');
            tier.textContent = `${sim.tier.icon} ${sim.tier.name}`;
            document.body.dataset.tier = sim.tier.id;
            $('totalPoints').textContent = `${fmt(sim.you)} pts`;
            const done = E.getDay(this.state, this.today).done.length;
            document.title = `(${done}/${E.HABITS.length}) Doppelganger`;
        }

        updateCountdown() {
            const now = new Date();
            const end = new Date(now);
            end.setHours(4, 0, 0, 0);
            if (now >= end) end.setDate(end.getDate() + 1);
            const mins = Math.max(0, Math.ceil((end - now) / 60000));
            const h = Math.floor(mins / 60);
            const m = mins % 60;
            const done = E.getDay(this.state, this.today).done.length;
            const el = $('dayCountdown');
            el.textContent = `Day ends in ${h ? `${h}h ` : ''}${m}m`;
            el.classList.toggle('urgent', mins <= 120 && done < E.HABITS.length);
        }

        renderDashboard(sim, stats) {
            const done = E.getDay(this.state, this.today).done;
            const ratio = done.length / E.HABITS.length;

            // Balance of power. Negative points count as zero share.
            const you = Math.max(0, sim.you);
            const total = you + sim.shadow;
            const youPct = total ? Math.round((you / total) * 100) : 50;
            $('strengthMeter').style.width = `${youPct}%`;
            $('meterYou').textContent = `You: ${fmt(sim.you)} (${youPct}%)`;
            $('meterShadow').textContent = `Shadow: ${fmt(sim.shadow)} (${100 - youPct}%)`;

            $('avatarGlow').style.opacity = ratio >= 0.8 ? 0.8 : ratio >= 0.5 ? 0.4 : 0;
            $('avatarAura').style.opacity = ratio >= 0.8 ? 0.6 : ratio >= 0.5 ? 0.3 : 0;
            $('doppelgangerShadow').style.opacity = Math.min(1, 1 - ratio + 0.3);
            $('doppelgangerCorruption').style.opacity = 1 - ratio;

            const lvl = E.level(sim.you);
            const shadowLvl = E.level(sim.shadow);
            $('avatarLevel').textContent = `Level ${lvl.level}`;
            $('avatarExp').textContent = `${lvl.xp} / ${lvl.next} XP`;
            $('avatarXpFill').style.width = `${lvl.xp}%`;
            $('doppelgangerLevel').textContent = `Level ${shadowLvl.level}`;
            $('shadowXpFill').style.width = `${shadowLvl.xp}%`;
            $('doppelgangerPower').textContent = `${100 - youPct}% Influence`;

            // Last 7 days
            const week = [];
            for (let i = 6; i >= 0; i--) week.push(E.addDays(this.today, -i));
            $('weekStrip').innerHTML = week.map(key => {
                const isToday = key === this.today;
                const label = isToday ? 'Today' : keyDate(key).toLocaleDateString('en-US', { weekday: 'short' });
                const count = (sim.byDate[key] || { done: [] }).done.length;
                return `<button class="week-day ${isToday ? 'is-today' : ''}" data-date="${key}" ${this.canView(key) ? '' : 'disabled'}>
                    <span class="week-label">${label}</span>
                    <span class="heat-cell big ${this.cellClass(key, sim)}">${count || ''}</span>
                </button>`;
            }).join('');

            // Stats
            $('currentStreak').textContent = stats.currentStreak;
            $('bestStreak').textContent = `Best: ${stats.bestStreak}`;
            $('monthlyPoints').textContent = fmt(stats.monthlyPoints);
            const monthDays = Math.min(E.MONTH_DAYS, sim.history.length) || 1;
            $('monthlyAvg').textContent = `${fmt(stats.monthlyPoints / monthDays)} / day`;
            $('perfectDays').textContent = stats.perfectDays;
            const unlocked = Object.keys(stats.unlocked).length;
            $('achievementCount').textContent = `${unlocked}/${E.BADGES.length} badges`;

            const next = E.nextTier(sim.tier);
            $('tierIcon').textContent = (next || sim.tier).icon;
            if (next) {
                const pct = ((sim.you - sim.tier.min) / (next.min - sim.tier.min)) * 100;
                $('tierProgress').textContent = `${Math.round(Math.max(0, Math.min(100, pct)))}%`;
                $('tierProgressLabel').textContent = `To ${next.name}`;
                $('tierPointsLeft').textContent = `${fmt(next.min - sim.you)} pts to go`;
            } else {
                $('tierProgress').textContent = 'MAX';
                $('tierProgressLabel').textContent = 'Top tier';
                $('tierPointsLeft').textContent = 'Stay there';
            }

            document.querySelectorAll('.habit-quick-item').forEach(item => {
                const isDone = done.includes(item.dataset.habit);
                item.classList.toggle('completed', isDone);
                item.setAttribute('aria-pressed', isDone);
            });
            const pct = Math.round(ratio * 100);
            $('completionPercentage').textContent = `${pct}%`;
            $('dailyCompletion').style.setProperty('--pct', `${pct}%`);
            this.updateCountdown();
        }

        renderHabits(sim) {
            const key = this.viewing;
            const isToday = key === this.today;
            const entry = this.dayEntry(sim, key);

            $('currentDate').textContent = isToday ? 'Today' : longDate(key);
            $('prevDay').disabled = key <= this.minViewableDay();
            $('nextDay').disabled = isToday;
            $('todayBtn').classList.toggle('hidden', isToday);

            let note = '';
            if (entry.untracked && !isToday) note = 'Before your start date. Logging here moves your start date back.';
            else if (!isToday) note = 'Editing a past day. Your points are recalculated from this day on.';
            $('dateNote').textContent = note;

            document.querySelectorAll('.habit-card').forEach(card => {
                const id = card.dataset.habit;
                const done = entry.done.includes(id);
                const streak = E.habitStreak(this.state, id, this.today);
                card.classList.toggle('completed', done);
                card.querySelector('.habit-checkbox').checked = done;
                card.querySelector('[data-streak]').textContent = plural(streak, 'day');
                card.querySelector('[data-progress]').style.width = `${Math.min(100, (streak / E.HABIT_GOAL_DAYS) * 100)}%`;
            });

            const penalties = E.getDay(this.state, key).penalties || 0;
            $('penaltyCount').textContent = penalties;
            $('penaltyRemove').disabled = penalties === 0;

            // Summary
            const untrackedPast = entry.untracked && !isToday;
            const punishment = untrackedPast ? 0 : entry.punishment;
            let label = 'Missed-habit punishment';
            if (!entry.final) label = untrackedPast ? 'Punishment (not tracked)' : 'Punishment if the day ended now';
            const shadowGain = entry.penalty + (entry.final || isToday ? entry.missed : 0);
            const net = entry.earned + entry.bonus - entry.penalty - punishment;

            $('summaryTitle').textContent = isToday ? "Today's Summary" : `Summary · ${longDate(key)}`;
            $('completedCount').textContent = `${entry.done.length}/${E.HABITS.length}`;
            this.setValue('pointsEarned', entry.earned + entry.bonus,
                entry.bonus ? `${signed(entry.earned)} (+${entry.bonus} perfect)` : signed(entry.earned));
            this.setValue('penaltyPoints', -entry.penalty);
            $('punishmentLabel').textContent = label;
            this.setValue('punishmentPoints', -punishment);
            this.setValue('shadowGain', -shadowGain, signed(shadowGain));
            this.setValue('finalScore', net);
        }

        // Signed value with good/bad coloring. `tone` is the number whose sign picks the color.
        setValue(id, tone, text = signed(tone)) {
            const el = $(id);
            el.textContent = text;
            el.classList.toggle('positive', tone > 0);
            el.classList.toggle('negative', tone < 0);
            el.classList.toggle('zero', tone === 0);
        }

        // ============ CALENDAR POPOVER ============

        toggleCalendar() {
            if ($('calendar').hidden) this.openCalendar();
            else this.closeCalendar();
        }

        openCalendar() {
            this.calMonth = this.viewing.slice(0, 7);
            $('calendar').hidden = false;
            $('datePickerBtn').setAttribute('aria-expanded', 'true');
            this.renderCalendar();
        }

        closeCalendar() {
            if ($('calendar').hidden) return;
            $('calendar').hidden = true;
            $('datePickerBtn').setAttribute('aria-expanded', 'false');
            $('floatTip').classList.remove('visible');
        }

        shiftCalMonth(delta) {
            const [y, m] = this.calMonth.split('-').map(Number);
            const d = new Date(y, m - 1 + delta, 1);
            this.calMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            this.renderCalendar();
        }

        renderCalendar() {
            const sim = this.lastSim;
            const minKey = this.minViewableDay();
            const [y, m] = this.calMonth.split('-').map(Number);
            const minYear = Number(minKey.slice(0, 4));
            const maxYear = Number(this.today.slice(0, 4));

            $('calMonth').innerHTML = MONTHS.map((name, i) => `<option value="${i}" ${i === m - 1 ? 'selected' : ''}>${name}</option>`).join('');
            let years = '';
            for (let yr = maxYear; yr >= minYear; yr--) years += `<option ${yr === y ? 'selected' : ''}>${yr}</option>`;
            $('calYear').innerHTML = years;

            const first = `${this.calMonth}-01`;
            const daysInMonth = new Date(y, m, 0).getDate();
            let html = '<span class="cal-blank"></span>'.repeat(weekday(first));
            let tracked = 0;
            let habits = 0;
            let perfect = 0;
            for (let d = 1; d <= daysInMonth; d++) {
                const key = `${this.calMonth}-${String(d).padStart(2, '0')}`;
                const classes = ['cal-day', this.cellClass(key, sim)];
                if (key === this.viewing) classes.push('selected');
                if (key === this.today) classes.push('is-today');
                html += `<button class="${classes.join(' ')}" data-date="${key}" ${this.canView(key) ? '' : 'disabled'}>${d}</button>`;
                const entry = sim.byDate[key];
                if (entry) {
                    tracked++;
                    habits += entry.done.length;
                    if (entry.perfect) perfect++;
                }
            }
            $('calGrid').innerHTML = html;
            $('calSummary').textContent = tracked
                ? `${MONTHS[m - 1]}: ${plural(tracked, 'day')} tracked · ${Math.round((habits / (tracked * E.HABITS.length)) * 100)}% done · ${perfect} perfect`
                : `${MONTHS[m - 1]}: nothing tracked`;

            $('calPrev').disabled = first <= minKey.slice(0, 7) + '-01';
            $('calNext').disabled = this.calMonth >= this.today.slice(0, 7);
        }

        // ============ PROGRESS ============

        renderProgress(sim, stats) {
            this.renderHeatmap(sim);

            document.querySelectorAll('#rangeChips [data-range]').forEach(b => {
                b.classList.toggle('active', b.dataset.range === this.prefs.range);
                b.setAttribute('aria-pressed', b.dataset.range === this.prefs.range);
            });

            const tierIndex = E.TIERS.indexOf(sim.tier);
            document.querySelectorAll('.tier').forEach(el => {
                const t = E.TIERS.find(x => x.id === el.dataset.tier);
                const idx = E.TIERS.indexOf(t);
                const status = el.querySelector('.tier-status');
                el.classList.toggle('active', idx === tierIndex);
                el.classList.toggle('reached', idx < tierIndex);
                if (idx === tierIndex) status.textContent = 'Current';
                else if (idx < tierIndex) status.textContent = '✓';
                else status.textContent = `${fmt(t.min - sim.you)} to go`;
            });

            this.renderCharts(sim);
            this.renderBreakdown(sim);
            this.renderBadges(stats);
        }

        yearBounds() {
            const max = Number(this.today.slice(0, 4));
            const min = this.state.startDate ? Math.min(max, Number(this.state.startDate.slice(0, 4))) : max;
            return { min, max };
        }

        shiftYear(delta) {
            const { min, max } = this.yearBounds();
            this.heatYear = Math.max(min, Math.min(max, this.heatYear + delta));
            this.renderHeatmap(this.lastSim);
        }

        renderHeatmap(sim) {
            const { min, max } = this.yearBounds();
            this.heatYear = Math.max(min, Math.min(max, this.heatYear));
            const year = this.heatYear;
            $('yearLabel').textContent = year;
            $('yearPrev').disabled = year <= min;
            $('yearNext').disabled = year >= max;

            const jan1 = `${year}-01-01`;
            const dec31 = `${year}-12-31`;
            const start = E.addDays(jan1, -weekday(jan1));
            const end = E.addDays(dec31, 6 - weekday(dec31));
            const weeks = (E.daysBetween(start, end) + 1) / 7;

            let months = '';
            for (let mo = 0; mo < 12; mo++) {
                const first = `${year}-${String(mo + 1).padStart(2, '0')}-01`;
                const col = Math.floor(E.daysBetween(start, first) / 7) + 1;
                months += `<span style="grid-column:${col}">${MONTHS[mo].slice(0, 3)}</span>`;
            }

            let cells = '';
            for (let key = start; key <= end; key = E.addDays(key, 1)) {
                if (key < jan1 || key > dec31) {
                    cells += '<span class="heat-cell blank"></span>';
                } else {
                    const today = key === this.today ? ' is-today' : '';
                    cells += `<button class="heat-cell ${this.cellClass(key, sim)}${today}" data-date="${key}" ${this.canView(key) ? '' : 'disabled'} aria-label="${longDate(key)}"></button>`;
                }
            }

            $('heatmap').innerHTML = `
                <div class="heatmap-months" style="grid-template-columns:repeat(${weeks}, var(--cell))">${months}</div>
                <div class="heatmap-body">
                    <div class="heatmap-days"><span></span><span>Mon</span><span></span><span>Wed</span><span></span><span>Fri</span><span></span></div>
                    <div class="heatmap-grid" style="grid-template-columns:repeat(${weeks}, var(--cell))">${cells}</div>
                </div>`;

            // Show the most recent weeks first on narrow screens.
            const scroller = $('heatmapScroll');
            scroller.scrollLeft = year === max ? scroller.scrollWidth : 0;

            const s = E.yearSummary(sim, year);
            const stat = (value, label, cls = '') => `<div class="year-stat ${cls}"><b>${value}</b><span>${label}</span></div>`;
            $('yearStats').innerHTML = s.days
                ? stat(fmt(s.days), 'days tracked') +
                  stat(`${Math.round(s.completion * 100)}%`, 'habits done') +
                  stat(fmt(s.perfectDays), 'perfect days') +
                  stat(fmt(s.bestStreak), 'best streak') +
                  stat(`+${fmt(s.earned)}`, 'points earned', 'positive') +
                  stat(`+${fmt(s.shadow)}`, 'to your Shadow', 'negative') +
                  stat(signed(s.net), 'net change', s.net >= 0 ? 'positive' : 'negative')
                : `<p class="muted">Nothing tracked in ${year}.</p>`;
        }

        rangeEntries(sim) {
            const r = this.prefs.range;
            return r === 'all' ? sim.history : sim.history.slice(-Number(r));
        }

        rangeLabel(entries) {
            const r = this.prefs.range;
            if (r === 'all') return entries.length ? `since ${longDate(entries[0].date)}` : 'all time';
            return r === '365' ? 'last year' : `last ${r} days`;
        }

        renderCharts(sim) {
            if (!sim) return;
            const entries = this.rangeEntries(sim);
            const labels = entries.map(d => d.date);
            const emptyMessage = 'No history yet. Check off a habit to start.';
            const longSpan = entries.length > 200;
            const openDay = key => this.openDay(key);

            $('powerSub').textContent = `Total points at the end of each day · ${this.rangeLabel(entries)}`;
            document.querySelectorAll('.legend-btn').forEach(btn => {
                const on = !this.prefs.hidden.includes(btn.dataset.series);
                btn.setAttribute('aria-pressed', on);
                btn.classList.toggle('off', !on);
            });
            const series = [
                { id: 'you', name: 'You', color: COLORS.you, values: entries.map(d => d.you) },
                { id: 'shadow', name: 'Shadow', color: COLORS.shadow, values: entries.map(d => d.shadow) }
            ].filter(s => !this.prefs.hidden.includes(s.id));

            Charts.line($('powerChart'), {
                labels, series, emptyMessage,
                title: longDate,
                xLabel: longSpan ? Charts.monthYear : Charts.shortDate,
                onSelect: i => openDay(labels[i])
            });

            const max = E.HABITS.length;
            if (entries.length > WEEKLY_AFTER) {
                // Weekly buckets ending today, so the last bar is always the current week.
                const weeks = [];
                for (let endIdx = entries.length; endIdx > 0; endIdx -= 7) {
                    weeks.unshift(entries.slice(Math.max(0, endIdx - 7), endIdx));
                }
                const avg = w => w.reduce((s, d) => s + d.done.length, 0) / w.length;
                $('habitsSub').textContent = `Weekly average per day · ${this.rangeLabel(entries)}`;
                Charts.columns($('habitsChart'), {
                    labels: weeks.map(w => w[0].date),
                    values: weeks.map(avg),
                    max, emptyMessage,
                    xLabel: longSpan ? Charts.monthYear : Charts.shortDate,
                    ariaLabel: `Average habits per day for each of ${weeks.length} weeks`,
                    colorFor: i => this.heat[E.heatLevel(Math.round(avg(weeks[i])))] || this.heat[0],
                    reference: { value: E.STREAK_THRESHOLD, label: `Streak line (${E.STREAK_THRESHOLD})` },
                    describe: i => {
                        const w = weeks[i];
                        const perfect = w.filter(d => d.perfect).length;
                        return `<div class="tt-title">Week of ${Charts.shortDate(w[0].date)}</div>` +
                            `<div class="tt-row">Avg habits<b>${avg(w).toFixed(1)}/${max}</b></div>` +
                            `<div class="tt-row">Perfect days<b>${perfect}</b></div>`;
                    },
                    onSelect: i => openDay(weeks[i][0].date)
                });
            } else {
                $('habitsSub').textContent = `Per day · ${this.rangeLabel(entries)} · today is faded until it's over`;
                Charts.columns($('habitsChart'), {
                    labels, emptyMessage, max,
                    values: entries.map(d => d.done.length),
                    ariaLabel: `Habits completed per day, ${this.rangeLabel(entries)}`,
                    colorFor: i => this.heat[E.heatLevel(entries[i].done.length)],
                    dimmed: i => !entries[i].final,
                    reference: { value: E.STREAK_THRESHOLD, label: `Streak line (${E.STREAK_THRESHOLD})` },
                    describe: i => {
                        const d = entries[i];
                        return `<div class="tt-title">${longDate(d.date)}${d.final ? '' : ' (today)'}</div>` +
                            `<div class="tt-row">Habits<b>${d.done.length}/${max}</b></div>` +
                            `<div class="tt-row">Earned<b>+${d.earned + d.bonus}</b></div>` +
                            (d.final ? `<div class="tt-row">Shadow got<b>+${d.missed + d.penalty}</b></div>` : '');
                    },
                    onSelect: i => openDay(labels[i])
                });
            }
        }

        renderBreakdown(sim) {
            const entries = this.rangeEntries(sim);
            $('breakdownRange').textContent = this.rangeLabel(entries).replace(/^./, c => c.toUpperCase());
            if (!entries.length) {
                $('breakdownList').innerHTML = '<p class="muted">No history yet.</p>';
                return;
            }

            const rows = E.HABITS.map(h => {
                const count = entries.filter(d => d.done.includes(h.id)).length;
                let best = 0;
                let run = 0;
                for (const d of sim.history) {
                    run = d.done.includes(h.id) ? run + 1 : 0;
                    best = Math.max(best, run);
                }
                return { h, count, pct: count / entries.length, streak: E.habitStreak(this.state, h.id, this.today), best };
            });
            const pcts = rows.map(r => r.pct);
            const showTags = entries.length >= 7 && Math.max(...pcts) > Math.min(...pcts);

            $('breakdownList').innerHTML = rows.map(r => {
                let tag = '';
                if (showTags && r.pct === Math.max(...pcts)) tag = '<span class="tag good">Strongest</span>';
                else if (showTags && r.pct === Math.min(...pcts)) tag = '<span class="tag bad">Weakest</span>';
                const color = this.heat[Math.max(1, E.heatLevel(Math.round(r.pct * E.HABITS.length)))];
                return `
                    <div class="breakdown-row">
                        <span class="breakdown-icon">${r.h.icon}</span>
                        <div class="breakdown-main">
                            <div class="breakdown-top">
                                <span class="breakdown-name">${escapeHtml(r.h.name)} ${tag}</span>
                                <span class="breakdown-pct">${Math.round(r.pct * 100)}%</span>
                            </div>
                            <div class="breakdown-bar"><div style="width:${r.pct * 100}%;background:${color}"></div></div>
                            <div class="breakdown-sub">${r.count}/${plural(entries.length, 'day')} · streak ${r.streak} · best ${r.best}</div>
                        </div>
                    </div>`;
            }).join('');
        }

        renderBadges(stats) {
            const unlockedCount = Object.keys(stats.unlocked).length;
            $('badgeSummary').textContent = `${unlockedCount} / ${E.BADGES.length} unlocked`;
            $('badgeTotalFill').style.width = `${(unlockedCount / E.BADGES.length) * 100}%`;

            const groups = [...new Set(E.BADGES.map(b => b.group))];
            $('badgeGroups').innerHTML = groups.map(group => {
                const badges = E.BADGES.filter(b => b.group === group);
                return `
                    <div class="badge-group">
                        <h4>${group}</h4>
                        <div class="badges-grid">${badges.map(b => this.badgeHtml(b, stats)).join('')}</div>
                    </div>`;
            }).join('');
        }

        badgeHtml(b, stats) {
            const date = stats.unlocked[b.id];
            const value = stats.metrics[b.metric];
            let footer;
            if (date) {
                footer = `<div class="badge-date">Unlocked ${longDate(date)}</div>`;
            } else {
                const progress = Math.min(1, value / b.goal);
                const text = b.metric === 'bestTier'
                    ? `Best so far: ${E.TIERS[value].name}`
                    : `${fmt(Math.min(value, b.goal))} / ${fmt(b.goal)}`;
                footer = `<div class="badge-progress"><div style="width:${progress * 100}%"></div></div><div class="badge-date">${text}</div>`;
            }
            return `
                <div class="badge ${date ? 'unlocked' : 'locked'}" data-badge="${b.id}">
                    <div class="badge-icon">${b.icon}</div>
                    <div class="badge-name">${b.name}</div>
                    <div class="badge-desc">${b.desc}</div>
                    ${footer}
                </div>`;
        }

        // ============ BACKUP ============

        exportData() {
            const data = { app: 'doppelganger', exportedAt: new Date().toISOString(), ...this.state };
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `doppelganger-backup-${this.today}.json`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            this.toast('💾 Backup downloaded');
        }

        async importData(file) {
            $('importFile').value = '';
            if (!file) return;
            let state;
            try {
                const raw = JSON.parse(await file.text());
                if (!raw || (raw.version !== 2 && !raw.dailyData)) throw new Error('not a Doppelganger backup');
                state = E.migrate(raw, this.today);
            } catch (error) {
                this.toast(`⚠️ Couldn't import that file: ${escapeHtml(error.message)}`);
                return;
            }
            const current = Object.keys(this.state.days).length;
            const incoming = Object.keys(state.days).length;
            const ok = window.confirm(
                `Replace your current data (${plural(current, 'logged day')}) with this backup ` +
                `(${plural(incoming, 'logged day')}${state.startDate ? `, starting ${longDate(state.startDate)}` : ''})?`
            );
            if (!ok) return;
            try { localStorage.setItem(`${STORAGE_KEY}_before_import`, JSON.stringify(this.state)); } catch (_) { /* best effort */ }
            this.lastStats = null;
            this.state = state;
            this.save();
            this.render();
            this.toast('✅ Backup imported');
        }

        // ============ FEEDBACK ============

        toast(html) {
            const el = document.createElement('div');
            el.className = 'toast';
            el.innerHTML = html;
            $('toasts').appendChild(el);
            setTimeout(() => el.classList.add('leaving'), 3200);
            setTimeout(() => el.remove(), 3600);
        }

        showConfetti() {
            document.querySelectorAll('.confetti-container, .perfect-day-congrats').forEach(el => el.remove());

            const container = document.createElement('div');
            container.className = 'confetti-container';
            const colors = ['#00d4ff', '#00ff88', '#9945ff', '#ffd700', '#ff4444'];
            for (let i = 0; i < 100; i++) {
                const piece = document.createElement('div');
                piece.className = `confetti-piece${Math.random() > 0.5 ? ' round' : ''}`;
                const size = 5 + Math.random() * 10;
                piece.style.cssText =
                    `left:${Math.random() * 100}%;width:${size}px;height:${size}px;` +
                    `background:${colors[i % colors.length]};` +
                    `animation-duration:${2 + Math.random() * 2}s;animation-delay:${Math.random() * 0.5}s;` +
                    `--drift:${Math.random() * 200 - 100}px;--spin:${Math.random() * 720 - 360}deg`;
                container.appendChild(piece);
            }

            const congrats = document.createElement('div');
            congrats.className = 'perfect-day-congrats';
            congrats.innerHTML = `
                <div class="perfect-day-emoji">🎉</div>
                <div class="perfect-day-title">PERFECT DAY!</div>
                <div class="perfect-day-bonus">+${E.PERFECT_BONUS} Bonus Points</div>`;

            document.body.append(container, congrats);
            setTimeout(() => {
                container.remove();
                congrats.remove();
            }, 4000);
        }
    }

    window.app = new App();
})();
