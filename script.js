// Doppelganger App - local-only habit tracker (no accounts, no server)

class DoppelgangerApp {
    constructor() {
        this.habits = {
            reading: { name: 'Read 30 minutes', points: 10, icon: '📚' },
            screentime: { name: 'Screen time <2 hours', points: 15, icon: '📵' },
            gym: { name: 'Gym session', points: 15, icon: '💪' },
            sleep: { name: 'Sleep 7-10 hours', points: 10, icon: '😴' },
            deepwork: { name: '90 min deep work', points: 15, icon: '🎯' },
            cardio: { name: '20 min cardio', points: 10, icon: '🏃‍♂️' },
            meditation: { name: 'Meditate 10 min', points: 5, icon: '🧘' },
            coldshower: { name: 'Cold shower', points: 5, icon: '❄️' },
            nutrition: { name: 'No sugar/processed food', points: 10, icon: '🍽️' }
        };

        this.user = {
            level: 1,
            experience: 0,
            totalPoints: 0,
            monthlyPoints: 0,
            tier: 'bronze',
            powerPoints: 0,
            currentStreak: 0
        };

        this.doppelganger = {
            level: 1,
            powerPoints: 0
        };

        this.achievements = {
            'first-week': false,
            'perfect-day': false,
            'streak-master': false,
            'top-performer': false
        };

        this.currentSection = 'dashboard';

        // SIMPLE DATE SYSTEM - NO CACHING, NO COMPLEX LOGIC
        this.viewingDateKey = this.getRealTodayKey();
        this.lastProcessedDateKey = null; // Track what we've processed

        // Data: { 'YYYY-MM-DD': { completed: [], punishmentApplied: false } }
        this.dailyData = {};

        this.init();
    }

    // ============ ROCK SOLID DATE FUNCTIONS (4:00 AM CUTOFF) ============
    getRealTodayKey() {
        const now = new Date();
        // If it's before 4:00 AM, use yesterday's date
        if (now.getHours() < 4) {
            now.setDate(now.getDate() - 1);
        }
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    isRealToday(dateKey) {
        return dateKey === this.getRealTodayKey();
    }

    getDayData(dateKey) {
        if (!this.dailyData[dateKey]) {
            this.dailyData[dateKey] = {
                completed: [],
                punishmentApplied: false,
                perfectDayBonus: false
            };
        }
        return this.dailyData[dateKey];
    }

    // Process ONLY completed days that haven't been processed yet
    processCompletedDays() {
        const realToday = this.getRealTodayKey();
        const allDates = Object.keys(this.dailyData).sort();

        for (const dateKey of allDates) {
            // Skip today - never process today until it's actually over
            if (dateKey >= realToday) continue;

            const dayData = this.dailyData[dateKey];

            // Skip already processed days
            if (dayData.punishmentApplied) continue;

            // This day is in the past and not processed - apply punishment
            this.applyEndOfDayPunishment(dateKey);
        }

        // Track what we've processed
        this.lastProcessedDateKey = realToday;
    }

    applyEndOfDayPunishment(dateKey) {
        const dayData = this.getDayData(dateKey);

        // Prevent double processing
        if (dayData.punishmentApplied) return;

        const completedHabits = dayData.completed || [];
        const allHabits = Object.keys(this.habits);
        const missedHabits = allHabits.filter(habitId => !completedHabits.includes(habitId));

        // Calculate punishment
        const missedPoints = missedHabits.reduce((sum, habitId) => {
            return sum + this.habits[habitId].points;
        }, 0);

        const tier = this.getCurrentTier();
        const multiplier = this.getTierMultiplier(tier);
        const punishment = Math.floor(missedPoints * multiplier);

        // Apply punishment
        this.user.powerPoints -= punishment;
        this.doppelganger.powerPoints += missedPoints;

        // Mark as processed
        dayData.punishmentApplied = true;
    }

    init() {
        this.loadFromStorage();

        // CRITICAL: Always set viewing to real today on startup
        this.viewingDateKey = this.getRealTodayKey();

        // Process any days that need processing
        this.processCompletedDays();

        this.setupEventListeners();
        this.calculateStats();
        this.updateDisplay();
        this.startDayChangeDetection();
    }

    // ============ STORAGE ============
    saveToStorage() {
        const data = {
            user: this.user,
            doppelganger: this.doppelganger,
            achievements: this.achievements,
            dailyData: this.dailyData,
            viewingDateKey: this.viewingDateKey,
            lastProcessedDateKey: this.lastProcessedDateKey
        };

        try {
            localStorage.setItem('doppelganger_data', JSON.stringify(data));
        } catch (error) {
            console.error('Save failed:', error);
        }
    }

    loadFromStorage() {
        try {
            const saved = localStorage.getItem('doppelganger_data');
            if (saved) {
                const data = JSON.parse(saved);

                this.user = { ...this.user, ...data.user };
                this.doppelganger = { ...this.doppelganger, ...data.doppelganger };
                this.achievements = { ...this.achievements, ...data.achievements };
                this.dailyData = data.dailyData || {};
                this.viewingDateKey = data.viewingDateKey || this.getRealTodayKey();
                this.lastProcessedDateKey = data.lastProcessedDateKey || null;

                // Ensure power points exist
                if (this.user.powerPoints === undefined) this.user.powerPoints = 0;
                if (this.doppelganger.powerPoints === undefined) this.doppelganger.powerPoints = 0;
            }
        } catch (error) {
            console.error('Load failed:', error);
            this.resetData();
        }
    }

    resetData() {
        localStorage.removeItem('doppelganger_data');
        this.dailyData = {};
        this.viewingDateKey = this.getRealTodayKey();
        this.lastProcessedDateKey = null;
        this.user.powerPoints = 0;
        this.doppelganger.powerPoints = 0;
    }

    // ============ TIER SYSTEM ============
    getCurrentTier() {
        const total = this.user.powerPoints;
        if (total >= 15000) return 'goggins';
        if (total >= 7500) return 'diamond';
        if (total >= 5000) return 'platinum';
        if (total >= 2500) return 'gold';
        if (total >= 1000) return 'silver';
        return 'bronze';
    }

    getTierLevel(tierName) {
        const levels = { bronze: 0, silver: 1, gold: 2, platinum: 3, diamond: 4, goggins: 5 };
        return levels[tierName] || 0;
    }

    getTierMultiplier(tierName) {
        switch(tierName) {
            case 'bronze': return 0;
            case 'silver': return 0.5;
            case 'gold': return 1;
            case 'platinum': return 2;
            case 'diamond': return 3;
            case 'goggins': return 4;
            default: return 0;
        }
    }

    calculatePowerBalance() {
        const totalPower = this.user.powerPoints + this.doppelganger.powerPoints;

        if (totalPower === 0) {
            return {
                userPercentage: 50,
                doppelgangerPercentage: 50,
                userPower: 0,
                doppelgangerPower: 0
            };
        }

        return {
            userPercentage: Math.round((this.user.powerPoints / totalPower) * 100),
            doppelgangerPercentage: Math.round((this.doppelganger.powerPoints / totalPower) * 100),
            userPower: this.user.powerPoints,
            doppelgangerPower: this.doppelganger.powerPoints
        };
    }

    // ============ STATS CALCULATION ============
    calculateStats() {
        // Process any completed days first
        this.processCompletedDays();

        // Calculate monthly points (last 30 days including today)
        this.user.monthlyPoints = 0;

        for (let i = 0; i < 30; i++) {
            const date = new Date();
            // Adjust for 4:00 AM cutoff
            if (new Date().getHours() < 4) {
                date.setDate(date.getDate() - 1);
            }
            date.setDate(date.getDate() - i);
            const dateKey = this.formatDate(date);

            const dayData = this.dailyData[dateKey];
            if (dayData && dayData.completed) {
                const dayPoints = dayData.completed.reduce((sum, habitId) => {
                    return sum + this.habits[habitId].points;
                }, 0);
                const perfectBonus = dayData.perfectDayBonus ? 5 : 0;
                this.user.monthlyPoints += (dayPoints + perfectBonus);
            }
        }

        this.user.experience = this.user.powerPoints;
        this.user.totalPoints = this.user.powerPoints;
        this.calculateLevel();

        Object.keys(this.habits).forEach(habitId => {
            this.habits[habitId].streak = this.calculateHabitStreak(habitId);
        });

        this.user.currentStreak = this.calculateOverallStreak();
        this.user.tier = this.getCurrentTier();
        this.updateTierProgression();
        this.checkAchievements();

        this.saveToStorage();
    }

    formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    calculateLevel() {
        const positiveExp = Math.max(0, this.user.experience);
        this.user.level = Math.floor(positiveExp / 100) + 1;
        this.user.currentLevelXP = positiveExp % 100;
        this.user.nextLevelXP = 100;
    }

    calculateHabitStreak(habitId) {
        let streak = 0;
        const today = this.getRealTodayKey();

        // Check today first
        const todayData = this.dailyData[today];
        if (todayData && todayData.completed && todayData.completed.includes(habitId)) {
            streak = 1;
        }

        // Check backwards from yesterday
        for (let i = 1; i <= 365; i++) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateKey = this.formatDate(date);
            const dayData = this.dailyData[dateKey];

            if (dayData && dayData.completed && dayData.completed.includes(habitId)) {
                if (streak > 0 || i === 1) { // Continue streak or start if checking yesterday first
                    streak++;
                } else {
                    break; // Gap found
                }
            } else {
                if (streak === 0 && i === 1) {
                    // Today not completed, continue checking yesterday
                    continue;
                } else if (streak > 0) {
                    // Streak broken
                    break;
                }
            }
        }

        return streak;
    }

    calculateOverallStreak() {
        let streak = 0;
        const today = this.getRealTodayKey();
        const totalHabits = Object.keys(this.habits).length;
        const threshold = Math.ceil(totalHabits * 0.7);

        // Check today first
        const todayData = this.dailyData[today];
        const todayCompleted = todayData && todayData.completed ? todayData.completed.length : 0;

        if (todayCompleted >= threshold) {
            streak = 1;
        }

        // Check backwards from yesterday
        for (let i = 1; i <= 365; i++) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateKey = this.formatDate(date);
            const dayData = this.dailyData[dateKey];
            const completed = dayData && dayData.completed ? dayData.completed.length : 0;

            if (completed >= threshold) {
                if (streak > 0 || i === 1) {
                    streak++;
                } else {
                    break;
                }
            } else {
                if (streak === 0 && i === 1) {
                    continue;
                } else if (streak > 0) {
                    break;
                }
            }
        }

        return streak;
    }

    // ============ EVENT LISTENERS ============
    setupEventListeners() {
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchSection(e.target.dataset.section);
            });
        });

        document.querySelectorAll('.habit-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const habitId = e.target.id.replace('-checkbox', '');
                this.toggleHabit(habitId, e.target.checked);
            });
        });

        document.getElementById('prevDay').addEventListener('click', () => {
            this.changeViewingDate(-1);
        });

        document.getElementById('nextDay').addEventListener('click', () => {
            this.changeViewingDate(1);
        });

        document.getElementById('screentime-penalty-btn').addEventListener('click', () => {
            this.user.powerPoints -= 10;
            this.doppelganger.powerPoints += 10;
            this.updateDailySummary();
            this.updateAvatarSystem();
            this.updateQuickStats();
            this.saveToStorage();
        });
    }

    switchSection(sectionId) {
        document.querySelectorAll('.section').forEach(section => {
            section.classList.remove('active');
        });
        document.getElementById(sectionId).classList.add('active');
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-section="${sectionId}"]`).classList.add('active');
        this.currentSection = sectionId;
        this.updateSectionContent(sectionId);
    }

    updateSectionContent(sectionId) {
        switch(sectionId) {
            case 'dashboard': this.updateDashboard(); break;
            case 'habits': this.updateHabitsSection(); break;
            case 'progress': this.updateProgressSection(); break;
        }
    }

    // ============ HABIT MANAGEMENT ============
    toggleHabit(habitId, completed) {
        if (!this.habits[habitId]) return;

        const dayData = this.getDayData(this.viewingDateKey);
        const habit = this.habits[habitId];
        const wasCompleted = dayData.completed.includes(habitId);
        const isPastDayWithPunishment = dayData.punishmentApplied && !this.isRealToday(this.viewingDateKey);
        const hadPerfectDay = dayData.perfectDayBonus;

        if (completed && !wasCompleted) {
            dayData.completed.push(habitId);
            this.user.powerPoints += habit.points;

            // If editing past day that was already punished, remove from doppelganger
            if (isPastDayWithPunishment) {
                this.doppelganger.powerPoints -= habit.points;
            }

            // Check for perfect day
            const totalHabits = Object.keys(this.habits).length;
            if (dayData.completed.length === totalHabits && !hadPerfectDay) {
                // Perfect day achieved!
                dayData.perfectDayBonus = true;
                this.user.powerPoints += 5;

                // Only show confetti if viewing today
                if (this.isRealToday(this.viewingDateKey)) {
                    this.showConfetti();
                }
            }
        } else if (!completed && wasCompleted) {
            dayData.completed = dayData.completed.filter(id => id !== habitId);
            this.user.powerPoints -= habit.points;

            // If editing past day that was already punished, add back to doppelganger
            if (isPastDayWithPunishment) {
                this.doppelganger.powerPoints += habit.points;
            }

            // Remove perfect day bonus if we had it
            if (hadPerfectDay) {
                dayData.perfectDayBonus = false;
                this.user.powerPoints -= 5;
            }
        }

        this.calculateStats();
        this.updateHabitCard(habitId);
        this.updateDailySummary();
        this.updateAvatarSystem();
        this.updateQuickStats();
        this.saveToStorage();
    }

    updateHabitCard(habitId) {
        const habit = this.habits[habitId];
        const card = document.querySelector(`[data-habit="${habitId}"]`);
        const checkbox = document.getElementById(`${habitId}-checkbox`);
        const streakElement = document.getElementById(`${habitId}-streak`);
        const progressElement = document.getElementById(`${habitId}-progress`);

        if (!card) return;

        const dayData = this.getDayData(this.viewingDateKey);
        const isCompleted = dayData.completed.includes(habitId);

        checkbox.checked = isCompleted;
        streakElement.textContent = habit.streak || 0;

        if (isCompleted) {
            card.classList.add('completed');
        } else {
            card.classList.remove('completed');
        }

        const progressWidth = Math.min(100, ((habit.streak || 0) / 66) * 100);
        progressElement.style.width = `${progressWidth}%`;
    }

    changeViewingDate(direction) {
        const currentDate = new Date(this.viewingDateKey + 'T12:00:00');
        currentDate.setDate(currentDate.getDate() + direction);
        const newDateKey = this.formatDate(currentDate);
        const today = this.getRealTodayKey();

        // Don't allow viewing future dates
        if (newDateKey > today) return;

        this.viewingDateKey = newDateKey;
        this.saveToStorage();
        this.updateCurrentDate();
        this.updateHabitsSection();
        this.updateDashboard();
    }

    updateCurrentDate() {
        const isViewingToday = this.isRealToday(this.viewingDateKey);

        if (isViewingToday) {
            document.getElementById('currentDate').textContent = 'Today';
        } else {
            const date = new Date(this.viewingDateKey + 'T12:00:00');
            const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
            document.getElementById('currentDate').textContent = date.toLocaleDateString('en-US', options);
        }
    }

    // ============ UI UPDATES ============
    updateDisplay() {
        this.updateSectionContent(this.currentSection);
    }

    updateDashboard() {
        this.updateAvatarSystem();
        this.updateDailySummary();
        this.updateQuickStats();
        this.updateHabitQuickList();
    }

    updateHabitQuickList() {
        const quickList = document.getElementById('habitQuickList');
        quickList.innerHTML = '';
        const dayData = this.getDayData(this.viewingDateKey);

        Object.entries(this.habits).forEach(([id, habit]) => {
            const isCompleted = dayData.completed.includes(id);
            const item = document.createElement('div');
            item.className = `habit-quick-item ${isCompleted ? 'completed' : ''}`;
            item.innerHTML = `
                <span class="habit-icon">${habit.icon}</span>
                <span class="habit-name">${habit.name}</span>
                <span class="habit-status">${isCompleted ? '✅' : '⭕'}</span>
            `;
            quickList.appendChild(item);
        });
    }

    updateDailySummary() {
        const dayData = this.getDayData(this.viewingDateKey);
        const completedHabits = dayData.completed.length;
        const totalHabits = Object.keys(this.habits).length;

        const basePoints = dayData.completed.reduce((sum, habitId) => {
            return sum + this.habits[habitId].points;
        }, 0);

        // Add perfect day bonus
        const perfectDayBonus = dayData.perfectDayBonus ? 5 : 0;
        const totalEarnedPoints = basePoints + perfectDayBonus;

        const tier = this.getCurrentTier();
        const multiplier = this.getTierMultiplier(tier);
        const missedPoints = Object.keys(this.habits).filter(habitId =>
            !dayData.completed.includes(habitId)
        ).reduce((sum, habitId) => {
            return sum + this.habits[habitId].points;
        }, 0);

        const punishment = Math.floor(missedPoints * multiplier);
        const netScore = totalEarnedPoints - punishment;

        document.getElementById('completedCount').textContent = `${completedHabits}/${totalHabits}`;

        if (perfectDayBonus > 0) {
            if (punishment > 0) {
                document.getElementById('pointsEarned').innerHTML = `${basePoints} + ${perfectDayBonus} - ${punishment} = ${netScore}`;
            } else {
                document.getElementById('pointsEarned').innerHTML = `${basePoints} + ${perfectDayBonus} = ${totalEarnedPoints}`;
            }
        } else {
            if (punishment > 0) {
                document.getElementById('pointsEarned').innerHTML = `${basePoints} - ${punishment} = ${netScore}`;
            } else {
                document.getElementById('pointsEarned').textContent = basePoints;
            }
        }

        document.getElementById('finalScore').textContent = netScore;

        const completionPercentage = Math.round((completedHabits / totalHabits) * 100);
        document.querySelector('.completion-percentage').textContent = `${completionPercentage}%`;

        const circle = document.getElementById('dailyCompletion');
        circle.style.background = `conic-gradient(var(--accent-green) ${completionPercentage}%, var(--tertiary-bg) ${completionPercentage}%)`;
    }

    updateAvatarSystem() {
        const dayData = this.getDayData(this.viewingDateKey);
        const completedHabits = dayData.completed.length;
        const totalHabits = Object.keys(this.habits).length;
        const completionRatio = completedHabits / totalHabits;

        const avatarGlow = document.getElementById('avatarGlow');
        const avatarAura = document.getElementById('avatarAura');

        if (completionRatio >= 0.8) {
            avatarGlow.style.opacity = '0.8';
            avatarAura.style.opacity = '0.6';
        } else if (completionRatio >= 0.5) {
            avatarGlow.style.opacity = '0.4';
            avatarAura.style.opacity = '0.3';
        } else {
            avatarGlow.style.opacity = '0';
            avatarAura.style.opacity = '0';
        }

        const doppelgangerShadow = document.getElementById('doppelgangerShadow');
        const doppelgangerCorruption = document.getElementById('doppelgangerCorruption');
        const missedHabits = totalHabits - completedHabits;
        const corruptionLevel = missedHabits / totalHabits;

        doppelgangerShadow.style.opacity = Math.min(1, corruptionLevel + 0.3);
        doppelgangerCorruption.style.opacity = corruptionLevel;

        const powerBalance = this.calculatePowerBalance();
        const strengthMeter = document.getElementById('strengthMeter');
        strengthMeter.style.width = `${powerBalance.userPercentage}%`;

        document.getElementById('avatarLevel').textContent = `Level ${this.user.level}`;

        const currentXP = Math.max(0, this.user.currentLevelXP || 0);
        const neededXP = this.user.nextLevelXP || 100;
        document.getElementById('avatarExp').textContent = `${currentXP} / ${neededXP} XP`;

        this.doppelganger.level = Math.max(1, Math.floor(this.doppelganger.powerPoints / 100) + 1);
        document.getElementById('doppelgangerLevel').textContent = `Level ${this.doppelganger.level}`;
        document.getElementById('doppelgangerPower').textContent = `${powerBalance.doppelgangerPercentage}% Influence`;

        const meterLabels = document.querySelector('.meter-labels');
        if (meterLabels) {
            meterLabels.innerHTML = `
                <span>You: ${Math.round(powerBalance.userPower)} (${powerBalance.userPercentage}%)</span>
                <span>Shadow: ${Math.round(powerBalance.doppelgangerPower)} (${powerBalance.doppelgangerPercentage}%)</span>
            `;
        }
    }

    updateTierProgression() {
        const tiers = [
            { name: 'bronze', min: 0, max: 1000 },
            { name: 'silver', min: 1000, max: 2500 },
            { name: 'gold', min: 2500, max: 5000 },
            { name: 'platinum', min: 5000, max: 7500 },
            { name: 'diamond', min: 7500, max: 15000 },
            { name: 'goggins', min: 15000, max: Infinity }
        ];

        const currentTier = this.getCurrentTier();
        this.user.tier = currentTier;

        document.getElementById('currentTier').textContent = currentTier.charAt(0).toUpperCase() + currentTier.slice(1);
        document.getElementById('currentTier').className = `current-tier ${currentTier}`;

        const currentTierData = tiers.find(t => t.name === currentTier);
        const nextTierData = tiers[tiers.findIndex(t => t.name === currentTier) + 1];

        if (nextTierData) {
            const progress = ((this.user.powerPoints - currentTierData.min) / (nextTierData.min - currentTierData.min)) * 100;
            const progressClamped = Math.max(0, Math.min(100, progress));
            document.getElementById('tierProgress').textContent = `${Math.round(progressClamped)}%`;
        } else {
            document.getElementById('tierProgress').textContent = '100%';
        }

        document.querySelectorAll('.tier').forEach(tier => {
            tier.classList.remove('active');
            const tierName = tier.dataset.tier;
            const statusElement = tier.querySelector('.tier-status');

            if (tierName === currentTier) {
                tier.classList.add('active');
                statusElement.textContent = 'Current';
            } else if (this.getTierLevel(tierName) < this.getTierLevel(currentTier)) {
                statusElement.textContent = 'Completed';
            } else {
                const tierData = tiers.find(t => t.name === tierName);
                const pointsNeeded = tierData.min - this.user.powerPoints;
                statusElement.textContent = pointsNeeded > 0 ? `${pointsNeeded} pts needed` : 'Locked';
            }
        });
    }

    updateQuickStats() {
        document.getElementById('currentStreak').textContent = this.user.currentStreak;
        document.getElementById('monthlyPoints').textContent = Math.round(this.user.monthlyPoints);
        document.getElementById('dailyScore').textContent = `${Math.round(this.user.powerPoints)} pts`;

        const perfectDays = Object.values(this.dailyData).filter(day => day.perfectDayBonus).length;
        document.getElementById('perfectDays').textContent = perfectDays;
    }

    updateHabitsSection() {
        Object.keys(this.habits).forEach(habitId => {
            this.updateHabitCard(habitId);
        });
        this.updateDailySummary();
        this.updateCurrentDate();
    }

    // ============ PROGRESS SECTION ============
    updateProgressSection() {
        this.updateTierProgression();
        this.updateCharts();
        this.updateAchievements();
    }

    updateCharts() {
        const pointsChart = document.querySelector('#pointsChart canvas');
        const habitsChart = document.querySelector('#habitsChart canvas');

        if (pointsChart && habitsChart) {
            const ctx1 = pointsChart.getContext('2d');
            const ctx2 = habitsChart.getContext('2d');

            ctx1.clearRect(0, 0, pointsChart.width, pointsChart.height);
            ctx2.clearRect(0, 0, habitsChart.width, habitsChart.height);

            ctx1.strokeStyle = '#00d4ff';
            ctx1.lineWidth = 2;
            ctx1.beginPath();

            const days = 7;

            for (let i = 0; i < days; i++) {
                const date = new Date();
                date.setDate(date.getDate() - (days - 1 - i));
                const dateKey = this.formatDate(date);
                const dayData = this.dailyData[dateKey];

                const basePoints = dayData && dayData.completed ? dayData.completed.reduce((sum, habitId) => {
                    return sum + this.habits[habitId].points;
                }, 0) : 0;

                const x = (i / (days - 1)) * (pointsChart.width - 40) + 20;
                const y = pointsChart.height - 20 - (basePoints / 100) * (pointsChart.height - 40);

                if (i === 0) {
                    ctx1.moveTo(x, y);
                } else {
                    ctx1.lineTo(x, y);
                }
            }
            ctx1.stroke();

            ctx2.fillStyle = '#00ff88';
            for (let i = 0; i < days; i++) {
                const date = new Date();
                date.setDate(date.getDate() - (days - 1 - i));
                const dateKey = this.formatDate(date);
                const dayData = this.dailyData[dateKey];
                const completedCount = dayData && dayData.completed ? dayData.completed.length : 0;
                const totalHabits = Object.keys(this.habits).length;
                const completionRate = completedCount / totalHabits;

                const barWidth = (habitsChart.width - 40) / days;
                const barHeight = completionRate * (habitsChart.height - 40);
                const x = 20 + i * barWidth + barWidth * 0.1;
                const y = habitsChart.height - 20 - barHeight;

                ctx2.fillRect(x, y, barWidth * 0.8, barHeight);
            }
        }
    }

    updateAchievements() {
        document.querySelectorAll('.badge').forEach(badge => {
            const badgeId = badge.dataset.badge;
            if (this.achievements[badgeId]) {
                badge.classList.remove('locked');
            } else {
                badge.classList.add('locked');
            }
        });
    }

    checkAchievements() {
        if (this.user.currentStreak >= 7) {
            this.achievements['first-week'] = true;
        }

        const todayData = this.getDayData(this.getRealTodayKey());
        const totalHabits = Object.keys(this.habits).length;
        const completedToday = todayData.completed.length;

        if (completedToday === totalHabits) {
            this.achievements['perfect-day'] = true;
        }

        if (this.user.currentStreak >= 66) {
            this.achievements['streak-master'] = true;
        }

        if (this.user.monthlyPoints > 5000) {
            this.achievements['top-performer'] = true;
        }
    }

    // ============ DAY CHANGE DETECTION ============
    startDayChangeDetection() {
        // Simple timer - check every 30 seconds if day changed (4:00 AM cutoff)
        setInterval(() => {
            const realToday = this.getRealTodayKey();

            // If viewing today and real today changed, update viewing date
            if (this.isRealToday(this.viewingDateKey) && this.viewingDateKey !== realToday) {
                this.viewingDateKey = realToday;
                this.processCompletedDays();
                this.calculateStats();
                this.updateDisplay();
            }
        }, 30000);
    }

    // ============ CONFETTI CELEBRATION ============
    showConfetti() {
        // Create confetti container
        const confettiContainer = document.createElement('div');
        confettiContainer.id = 'confettiContainer';
        document.body.appendChild(confettiContainer);

        // Show congratulations message
        const congrats = document.createElement('div');
        congrats.className = 'perfect-day-congrats';
        congrats.innerHTML = `
            <div class="perfect-day-emoji">🎉</div>
            <div class="perfect-day-title">PERFECT DAY!</div>
            <div class="perfect-day-bonus">+5 Bonus Points</div>
        `;
        document.body.appendChild(congrats);

        // Generate confetti
        const colors = ['#00d4ff', '#00ff88', '#9945ff', '#ffd700', '#ff4444'];
        const confettiCount = 100;

        for (let i = 0; i < confettiCount; i++) {
            const confetti = document.createElement('div');
            confetti.className = Math.random() > 0.5 ? 'confetti-piece confetti-round' : 'confetti-piece confetti-square';

            const color = colors[Math.floor(Math.random() * colors.length)];
            const left = Math.random() * 100;
            const animationDuration = 2 + Math.random() * 2;
            const animationDelay = Math.random() * 0.5;
            const size = Math.random() * 10 + 5;
            const rotation = Math.random() * 360;
            const drift = Math.random() * 200 - 100;

            confetti.style.cssText = `
                left: ${left}%;
                top: -10%;
                width: ${size}px;
                height: ${size}px;
                background: ${color};
                animation: confettiFall ${animationDuration}s linear ${animationDelay}s forwards;
                transform: rotate(${rotation}deg);
            `;

            // Add random horizontal drift during fall
            confetti.style.setProperty('--drift', `${drift}px`);

            confettiContainer.appendChild(confetti);
        }

        // Remove after animation
        setTimeout(() => {
            confettiContainer.remove();
            congrats.remove();
        }, 4000);
    }
}

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    window.doppelgangerApp = new DoppelgangerApp();
    window.app = window.doppelgangerApp;
});
