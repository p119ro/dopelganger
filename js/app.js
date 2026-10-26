// Doppelganger UI. All state lives in localStorage; scoring is in engine.js.

(function () {
    'use strict';

    const E = window.Engine;
    const STORAGE_KEY = 'doppelganger_data';
    const MAX_DAYS_BACK = 365;
    const SECTIONS = ['dashboard', 'habits', 'progress'];
    const COLORS = { you: '#1a9fca', shadow: '#e5534b' };

    const $ = id => document.getElementById(id);
    const fmt = n => Math.round(n).toLocaleString('en-US');
    const signed = n => (n > 0 ? `+${fmt(n)}` : n < 0 ? `−${fmt(-n)}` : '0');

    function longDate(key) {
        const [y, m, d] = key.split('-').map(Number);
        return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    }

    class App {
        constructor() {
            this.state = this.load();
            this.today = E.todayKey();
            this.viewing = this.today;
            this.section = 'dashboard';

            this.buildHabitCards();
            this.buildQuickList();
            this.buildTierLadder();
            this.buildBadges();
            this.bindEvents();
            this.showSection(this.sectionFromHash(), false);
            this.render();
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
            }
        }

        commit(state) {
            this.state = state;
            this.save();
            this.render();
        }

        // ============ STATIC MARKUP ============

        buildHabitCards() {
            $('habitsGrid').innerHTML = E.HABITS.map(h => `
                <label class="habit-card" data-habit="${h.id}">
                    <input type="checkbox" class="habit-checkbox" data-habit="${h.id}">
                    <div class="habit-header">
                        <div class="habit-icon">${h.icon}</div>
                        <div class="habit-info">
                            <h3>${h.name.replace('<', '&lt;')}</h3>
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
                    <span class="habit-name">${h.name.replace('<', '&lt;')}</span>
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

        buildBadges() {
            $('badgesGrid').innerHTML = E.BADGES.map(b => `
                <div class="badge locked" data-badge="${b.id}">
                    <div class="badge-icon">${b.icon}</div>
                    <div class="badge-name">${b.name}</div>
                    <div class="badge-desc">${b.desc}</div>
                </div>`).join('');
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

            document.addEventListener('keydown', e => {
                if (this.section !== 'habits' || e.altKey || e.ctrlKey || e.metaKey) return;
                if (e.target.closest('input:not([type=checkbox]), textarea')) return;
                if (e.key === 'ArrowLeft') this.goToDay(E.addDays(this.viewing, -1));
                if (e.key === 'ArrowRight') this.goToDay(E.addDays(this.viewing, 1));
            });

            $('penaltyAdd').addEventListener('click', () => this.changePenalty(1));
            $('penaltyRemove').addEventListener('click', () => this.changePenalty(-1));

            // Day rollover (4 AM), returning to a backgrounded tab, and edits from another tab.
            setInterval(() => this.checkDayChange(), 30000);
            document.addEventListener('visibilitychange', () => {
                if (!document.hidden) this.checkDayChange();
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
            this.section = id;
            document.querySelectorAll('.section').forEach(s => s.classList.toggle('active', s.id === id));
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
            return E.addDays(this.today, -MAX_DAYS_BACK);
        }

        goToDay(key) {
            if (key > this.today || key < this.minViewableDay() || key === this.viewing) return;
            this.viewing = key;
            this.render();
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

            this.renderHeader(sim);
            if (this.section === 'dashboard') this.renderDashboard(sim, stats);
            if (this.section === 'habits') this.renderHabits(sim);
            if (this.section === 'progress') this.renderProgress(sim, stats);
        }

        dayEntry(sim, key) {
            return sim.byDate[key] || E.untrackedDay(this.state, key, sim);
        }

        renderHeader(sim) {
            const tier = $('currentTier');
            tier.textContent = sim.tier.name;
            tier.className = `current-tier ${sim.tier.id}`;
            $('totalPoints').textContent = `${fmt(sim.you)} pts`;
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
            $('avatarLevel').textContent = `Level ${lvl.level}`;
            $('avatarExp').textContent = `${lvl.xp} / ${lvl.next} XP`;
            $('doppelgangerLevel').textContent = `Level ${E.level(sim.shadow).level}`;
            $('doppelgangerPower').textContent = `${100 - youPct}% Influence`;

            $('currentStreak').textContent = stats.currentStreak;
            $('monthlyPoints').textContent = fmt(stats.monthlyPoints);
            $('perfectDays').textContent = stats.perfectDays;
            const next = E.nextTier(sim.tier);
            if (next) {
                const pct = ((sim.you - sim.tier.min) / (next.min - sim.tier.min)) * 100;
                $('tierProgress').textContent = `${Math.round(Math.max(0, Math.min(100, pct)))}%`;
                $('tierProgressLabel').textContent = `To ${next.name}`;
            } else {
                $('tierProgress').textContent = 'MAX';
                $('tierProgressLabel').textContent = 'Top tier';
            }

            document.querySelectorAll('.habit-quick-item').forEach(item => {
                const isDone = done.includes(item.dataset.habit);
                item.classList.toggle('completed', isDone);
                item.setAttribute('aria-pressed', isDone);
            });
            const pct = Math.round(ratio * 100);
            $('completionPercentage').textContent = `${pct}%`;
            $('dailyCompletion').style.setProperty('--pct', `${pct}%`);
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
                card.querySelector('[data-streak]').textContent = `${streak} day${streak === 1 ? '' : 's'}`;
                card.querySelector('[data-progress]').style.width = `${Math.min(100, (streak / E.HABIT_GOAL_DAYS) * 100)}%`;
            });

            const penalties = E.getDay(this.state, key).penalties || 0;
            $('penaltyCount').textContent = penalties;
            $('penaltyRemove').disabled = penalties === 0;

            // Summary
            $('summaryTitle').textContent = isToday ? "Today's Summary" : `Summary · ${longDate(key)}`;
            $('completedCount').textContent = `${entry.done.length}/${E.HABITS.length}`;
            $('pointsEarned').textContent = entry.bonus
                ? `${signed(entry.earned)} (+${entry.bonus} perfect)`
                : signed(entry.earned);
            $('penaltyPoints').textContent = signed(-entry.penalty);

            let punishment = entry.punishment;
            let label = 'Missed-habit punishment';
            if (!entry.final) label = entry.untracked && !isToday ? 'Punishment (not tracked)' : 'Punishment if the day ended now';
            if (entry.untracked && !isToday) punishment = 0;
            $('punishmentLabel').textContent = label;
            $('punishmentPoints').textContent = signed(-punishment);

            const shadowGain = entry.penalty + (entry.final || isToday ? entry.missed : 0);
            $('shadowGain').textContent = signed(shadowGain);

            const net = entry.earned + entry.bonus - entry.penalty - punishment;
            const final = $('finalScore');
            final.textContent = signed(net);
            final.classList.toggle('negative', net < 0);
        }

        renderProgress(sim, stats) {
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

            document.querySelectorAll('.badge').forEach(b => {
                b.classList.toggle('locked', !stats.achievements[b.dataset.badge]);
            });

            this.renderCharts(sim);
        }

        renderCharts(sim) {
            if (!sim) return;
            const recent = sim.history.slice(-E.MONTH_DAYS);
            const labels = recent.map(d => d.date);
            const emptyMessage = 'No history yet. Check off a habit to start.';

            window.Charts.line($('powerChart'), {
                labels,
                emptyMessage,
                series: [
                    { name: 'You', color: COLORS.you, values: recent.map(d => d.you) },
                    { name: 'Shadow', color: COLORS.shadow, values: recent.map(d => d.shadow) }
                ]
            });

            window.Charts.columns($('habitsChart'), {
                labels,
                emptyMessage,
                values: recent.map(d => d.done.length),
                max: E.HABITS.length,
                color: COLORS.you,
                dimmed: i => !recent[i].final,
                reference: { value: E.STREAK_THRESHOLD, label: `Streak line (${E.STREAK_THRESHOLD})` },
                describe: i => {
                    const d = recent[i];
                    const pts = d.earned + d.bonus;
                    return `<div class="tt-title">${window.Charts.shortDate(d.date)}${d.final ? '' : ' (today)'}</div>` +
                        `<div class="tt-row">Habits<b>${d.done.length}/${E.HABITS.length}</b></div>` +
                        `<div class="tt-row">Earned<b>+${pts}</b></div>` +
                        (d.final ? `<div class="tt-row">Shadow got<b>+${d.missed + d.penalty}</b></div>` : '');
                }
            });
        }

        // ============ CONFETTI ============

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
