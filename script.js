// Doppelganger App - Fixed Date Management and Daily Reset System

class DoppelgangerApp {
    constructor() {
        this.habits = {
            reading: { name: 'Read 30 minutes', points: 10, icon: '📚' },
            screentime: { name: 'Screen time <2 hours', points: 10, icon: '📵' },
            gym: { name: 'Gym session', points: 15, icon: '💪' },
            sleep: { name: 'Sleep 7-9 hours', points: 10, icon: '😴' },
            deepwork: { name: '90 min deep work', points: 15, icon: '🎯' },
            cardio: { name: '20 min cardio', points: 10, icon: '🏃‍♂️' },
            meditation: { name: 'Meditate 10 min', points: 5, icon: '🧘' },
            coldshower: { name: 'Cold shower', points: 5, icon: '❄️' },
            nutrition: { name: 'No sugar/processed food', points: 10, icon: '🍽️' }
        };

        this.user = {
            name: '',
            level: 1,
            experience: 0,
            totalPoints: 0,
            monthlyPoints: 0,
            tier: 'bronze',
            powerPoints: 0, // Cumulative power from completed habits
            avatar: {
                strength: 100,
                glow: 0,
                aura: 0
            },
            isFirstTime: true,
            currentStreak: 0
        };

        this.doppelganger = {
            level: 1,
            strength: 80,
            influence: 0,
            corruption: 0,
            powerPoints: 0 // Cumulative power from missed habits
        };

        this.team = {
            id: null,
            name: null,
            members: [],
            dailyScore: 0,
            maxScore: 500,
            grade: 'Poor',
            multiplier: 1.00
        };

        this.battle = {
            active: false,
            round: 1,
            maxRounds: 7,
            playerHealth: 100,
            doppelgangerHealth: 100,
            history: [],
            nextBattleTime: null
        };

        this.achievements = {
            'first-week': false,
            'perfect-day': false,
            'streak-master': false,
            'team-player': false,
            'top-performer': false
        };

        // Always use the real current date
        this.currentDate = new Date();
        this.viewingDate = new Date();
        this.currentSection = 'dashboard';
        
        // Cache the current date key for performance
        this._cachedDateKey = null;
        this._lastSyncCheck = null;
        
        // Data structure: { 'YYYY-MM-DD': { habits: {}, completed: [], points: 0, processed: false, punishmentProcessed: false } }
        this.dailyData = {};
        
        this.init();
    }

    init() {
        this.loadFromStorage();
        
        // Initialize cache
        this._cachedDateKey = this.formatDate(this.currentDate);
        this._lastSyncCheck = Date.now();
        this._lastMissedDaysCheck = 0; // Force initial check
        
        // Always sync with real current date and process any missed days
        this.syncWithRealDate();
        
        if (this.user.isFirstTime) {
            this.showNameModal();
        }
        
        this.setupEventListeners();
        this.calculateStreaksAndStats(); // This will now call processAllMissedDays internally
        this.updateDisplay();
        this.startTimers();
    }

    // ============ DATE SYNCHRONIZATION ============
    syncWithRealDate() {
        const realCurrentDate = new Date();
        const realDateKey = this.formatDate(realCurrentDate);
        
        // Use cached date key for performance
        if (!this._cachedDateKey) {
            this._cachedDateKey = this.formatDate(this.currentDate);
        }
        
        // Only sync if we're on a different DATE (not just different time)
        if (realDateKey !== this._cachedDateKey) {
            // Get the last stored date (only if we actually need it)
            const storedDates = Object.keys(this.dailyData);
            if (storedDates.length > 0) {
                const lastStoredDateKey = storedDates.sort().pop();
                
                // Only process gap if there are actually missing days between stored dates and today
                if (lastStoredDateKey && lastStoredDateKey < realDateKey) {
                    const lastStoredDate = new Date(lastStoredDateKey);
                    const daysDifference = Math.floor((realCurrentDate - lastStoredDate) / (1000 * 60 * 60 * 24));
                    
                    // Only process if there's actually a gap of more than 1 day
                    if (daysDifference > 1) {
                        this.processDateGap(lastStoredDate, realCurrentDate);
                    }
                }
            }
            
            // Update current date and cache
            this.currentDate = new Date(realCurrentDate);
            this.viewingDate = new Date(realCurrentDate);
            this._cachedDateKey = realDateKey;
            
            // Ensure today's data exists
            this.getDailyData(realDateKey);
            this.saveToStorage();
        }
    }

    processDateGap(fromDate, toDate) {
        const currentDate = new Date(fromDate);
        currentDate.setDate(currentDate.getDate() + 1); // Start from the day after the last stored date
        
        // Only process days that are actually in the past, not today
        const today = new Date(toDate);
        const todayDateKey = this.formatDate(today);
        
        while (currentDate < today) {
            const dateKey = this.formatDate(currentDate);
            
            // Skip if this is today - we don't want to process today as a "missed" day
            if (dateKey === todayDateKey) {
                break;
            }
            
            // Create empty day data for missed days
            if (!this.dailyData[dateKey]) {
                this.dailyData[dateKey] = {
                    habits: {},
                    completed: [],
                    points: 0,
                    timestamp: currentDate.getTime(),
                    punishmentApplied: false
                };
            }
            
            // Apply punishment for missed days (only for actual past days)
            this.applyDayEndPunishment(dateKey);
            
            currentDate.setDate(currentDate.getDate() + 1);
        }
    }

    // ============ USER SETUP ============
    showNameModal() {
        const modalHTML = `
            <div class="modal-overlay active" id="nameModalOverlay" style="z-index: 3000;">
                <div class="modal" style="max-width: 400px;">
                    <div class="modal-header">
                        <h3>Welcome to Doppelganger</h3>
                    </div>
                    <div class="modal-content">
                        <p style="margin-bottom: 1rem; color: var(--text-secondary);">What should we call you, warrior?</p>
                        <input type="text" placeholder="Enter your name" id="userName" style="width: 100%; margin-bottom: 1rem;">
                        <button class="action-btn" id="confirmName">Begin Your Journey</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        document.getElementById('confirmName').addEventListener('click', () => {
            const name = document.getElementById('userName').value.trim();
            if (name) {
                this.user.name = name;
                this.user.isFirstTime = false;
                this.saveToStorage();
                document.getElementById('nameModalOverlay').remove();
                this.updateDisplay();
            } else {
                alert('Please enter your name to continue');
            }
        });

        setTimeout(() => {
            document.getElementById('userName').focus();
        }, 100);

        document.getElementById('userName').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                document.getElementById('confirmName').click();
            }
        });
    }

    // ============ STORAGE METHODS ============
    saveToStorage() {
        const data = {
            user: this.user,
            doppelganger: this.doppelganger,
            team: this.team,
            achievements: this.achievements,
            dailyData: this.dailyData,
            battle: this.battle,
            lastSavedDate: this.formatDate(new Date()) // Store when we last saved
        };
        
        try {
            const compressed = JSON.stringify(data);
            localStorage.setItem('doppelganger_data', compressed);
        } catch (error) {
            // Silent fail
        }
    }

    loadFromStorage() {
        try {
            const saved = localStorage.getItem('doppelganger_data');
            if (saved) {
                const data = JSON.parse(saved);
                
                this.user = { ...this.user, ...data.user };
                this.doppelganger = { ...this.doppelganger, ...data.doppelganger };
                this.team = { ...this.team, ...data.team };
                this.achievements = { ...this.achievements, ...data.achievements };
                this.dailyData = data.dailyData || {};
                this.battle = { ...this.battle, ...data.battle };
                
                if (this.user.powerPoints === undefined) {
                    this.user.powerPoints = 0;
                }
                if (this.doppelganger.powerPoints === undefined) {
                    this.doppelganger.powerPoints = 0;
                }
                
            }
            
        } catch (error) {
            this.resetData();
        }
    }

    resetData() {
        localStorage.removeItem('doppelganger_data');
        this.dailyData = {};
        this.currentDate = new Date();
        this.viewingDate = new Date();
        this.user.isFirstTime = true;
        this.user.powerPoints = 0;
        this.doppelganger.powerPoints = 0;
        this.saveToStorage();
    }

    // ============ DATE MANAGEMENT ============
    formatDate(date) {
        return date.toISOString().split('T')[0];
    }

    getCurrentDateKey() {
        return this.formatDate(this.viewingDate);
    }

    getDailyData(dateKey) {
        if (!this.dailyData[dateKey]) {
            this.dailyData[dateKey] = {
                habits: {},
                completed: [],
                points: 0,
                timestamp: new Date(dateKey).getTime(),
                punishmentApplied: false
            };
        }
        return this.dailyData[dateKey];
    }

    isToday(dateKey) {
        const today = this.formatDate(this.currentDate);
        return dateKey === today;
    }

    // ============ TIER SYSTEM ============
    getCurrentTier() {
        const total = this.user.powerPoints;
        
        if (total >= 15000) return 'goggins';
        if (total >= 7500) return 'diamond';
        if (total >= 5000) return 'platinum';
        if (total >= 2500) return 'gold';
        if (total >= 1000) return 'silver';
        return 'bronze'; // Even if powerPoints is negative, stay at bronze
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

    // ============ POWER SYSTEM ============
    applyDayEndPunishment(dateKey) {
        const dayData = this.getDailyData(dateKey);
        
        if (dayData.punishmentApplied) {
            return; // Already applied punishment for this day
        }
        
        // Calculate missed points and punishment
        const totalHabits = Object.keys(this.habits);
        const missedHabits = totalHabits.filter(habitId => 
            !dayData.completed || !dayData.completed.includes(habitId)
        );
        
        const missedPoints = missedHabits.reduce((sum, habitId) => {
            const habit = this.habits[habitId];
            return sum + (habit ? habit.points : 0);
        }, 0);
        
        const currentTier = this.getCurrentTier();
        const multiplier = this.getTierMultiplier(currentTier);
        const punishment = Math.floor(missedPoints * multiplier);
        
        // Apply punishment (can go negative)
        this.user.powerPoints -= punishment;
        
        // Award doppelganger power for missed habits
        this.doppelganger.powerPoints += missedPoints;
        
        dayData.punishmentApplied = true;
    }

    processAllMissedDays() {
        const today = new Date(this.currentDate);
        const todayDateKey = this.formatDate(today);
        const allDates = Object.keys(this.dailyData);
        
        // Early exit if no data
        if (allDates.length === 0) return;
        
        let hasChanges = false;
        const sortedDates = allDates.sort();
        
        for (const dateKey of sortedDates) {
            // Skip today - we don't want to process today as "missed" until tomorrow
            if (dateKey === todayDateKey) {
                continue;
            }
            
            const dayData = this.dailyData[dateKey];
            
            // Early exit if already processed
            if (dayData.punishmentApplied) {
                continue;
            }
            
            // More robust date comparison - only process if date is clearly in the past
            const dayDate = new Date(dateKey + 'T23:59:59'); // End of that day
            const todayStart = new Date(todayDateKey + 'T00:00:00'); // Start of today
            
            // Only process if the day has completely ended (not just a time difference)
            if (dayDate < todayStart) {
                this.applyDayEndPunishment(dateKey);
                hasChanges = true;
            }
        }
        
        // Only save if we made changes
        if (hasChanges) {
            this.saveToStorage();
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
        
        const userPercentage = (this.user.powerPoints / totalPower) * 100;
        const doppelgangerPercentage = (this.doppelganger.powerPoints / totalPower) * 100;
        
        return {
            userPercentage: Math.round(userPercentage),
            doppelgangerPercentage: Math.round(doppelgangerPercentage),
            userPower: this.user.powerPoints,
            doppelgangerPower: this.doppelganger.powerPoints
        };
    }

    // ============ STREAK CALCULATION ============
    calculateStreaksAndStats() {
        // Only process missed days if we haven't recently
        const now = Date.now();
        if (!this._lastMissedDaysCheck || (now - this._lastMissedDaysCheck) >= 300000) { // 5 minutes
            this.processAllMissedDays();
            this._lastMissedDaysCheck = now;
        }
        
        // Calculate monthly points from completed habits (last 30 days)
        this.user.monthlyPoints = 0;
        
        const today = new Date(this.currentDate);
        const allDates = Object.keys(this.dailyData);
        
        // Calculate monthly points from completed habits only
        for (const dateKey of allDates) {
            const data = this.dailyData[dateKey];
            if (!data || !data.completed) continue;
            
            const dayDate = new Date(dateKey);
            const daysDifference = Math.floor((today - dayDate) / (1000 * 60 * 60 * 24));
            
            if (daysDifference <= 30 && daysDifference >= 0) {
                const dayPoints = data.completed.reduce((sum, habitId) => {
                    const habit = this.habits[habitId];
                    return habit ? sum + habit.points : sum;
                }, 0);
                this.user.monthlyPoints += dayPoints;
            }
        }

        // Calculate experience and level based on powerPoints
        this.user.experience = this.user.powerPoints; // Allow negative experience
        this.user.totalPoints = this.user.powerPoints; // Keep totalPoints in sync
        this.calculateLevel();

        // Calculate habit streaks (cache for performance)
        Object.keys(this.habits).forEach(habitId => {
            this.habits[habitId].streak = this.calculateHabitStreak(habitId);
        });

        this.user.currentStreak = this.calculateOverallStreak();
        
        this.user.tier = this.getCurrentTier();
        this.updateTierProgression();
        
        this.checkAchievements();
        
        this.saveToStorage();
    }

    calculateLevel() {
        // Level can't go below 1, but experience can be negative
        const positiveExp = Math.max(0, this.user.experience);
        this.user.level = Math.floor(positiveExp / 100) + 1;
        this.user.currentLevelXP = positiveExp % 100;
        this.user.nextLevelXP = 100;
    }

    calculateHabitStreak(habitId) {
        const today = new Date(this.currentDate);
        let streak = 0;
        
        const todayKey = this.formatDate(today);
        const todayData = this.dailyData[todayKey];
        const todayCompleted = todayData && todayData.completed && todayData.completed.includes(habitId);
        
        if (todayCompleted) {
            streak = 1;
            
            for (let i = -1; i >= -365; i--) {
                const checkDate = new Date(today);
                checkDate.setDate(today.getDate() + i);
                const dateKey = this.formatDate(checkDate);
                const dayData = this.dailyData[dateKey];
                
                if (dayData && dayData.completed && dayData.completed.includes(habitId)) {
                    streak++;
                } else {
                    break;
                }
            }
        } else {
            for (let i = -1; i >= -365; i--) {
                const checkDate = new Date(today);
                checkDate.setDate(today.getDate() + i);
                const dateKey = this.formatDate(checkDate);
                const dayData = this.dailyData[dateKey];
                
                if (dayData && dayData.completed && dayData.completed.includes(habitId)) {
                    streak++;
                } else {
                    break;
                }
            }
        }
        
        return streak;
    }

    calculateOverallStreak() {
        const today = new Date(this.currentDate);
        let streak = 0;
        
        const todayKey = this.formatDate(today);
        const todayData = this.dailyData[todayKey];
        const totalHabits = Object.keys(this.habits).length;
        const todayCompleted = todayData && todayData.completed ? todayData.completed.length : 0;
        const todayMeetsCriteria = todayCompleted >= Math.ceil(totalHabits * 0.7);
        
        if (todayMeetsCriteria) {
            streak = 1;
            
            for (let i = -1; i >= -365; i--) {
                const checkDate = new Date(today);
                checkDate.setDate(today.getDate() + i);
                const dateKey = this.formatDate(checkDate);
                const dayData = this.dailyData[dateKey];
                
                if (dayData && dayData.completed) {
                    const completedHabits = dayData.completed.length;
                    if (completedHabits >= Math.ceil(totalHabits * 0.7)) {
                        streak++;
                    } else {
                        break;
                    }
                } else {
                    break;
                }
            }
        } else {
            for (let i = -1; i >= -365; i--) {
                const checkDate = new Date(today);
                checkDate.setDate(today.getDate() + i);
                const dateKey = this.formatDate(checkDate);
                const dayData = this.dailyData[dateKey];
                
                if (dayData && dayData.completed) {
                    const completedHabits = dayData.completed.length;
                    if (completedHabits >= Math.ceil(totalHabits * 0.7)) {
                        streak++;
                    } else {
                        break;
                    }
                } else {
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
            this.changeDate(-1);
        });
        
        document.getElementById('nextDay').addEventListener('click', () => {
            this.changeDate(1);
        });

        document.getElementById('createTeamBtn').addEventListener('click', () => {
            this.showTeamModal('create');
        });
        
        document.getElementById('joinTeamBtn').addEventListener('click', () => {
            this.showTeamModal('join');
        });

        document.getElementById('modalClose').addEventListener('click', () => {
            this.hideTeamModal();
        });

        document.getElementById('modalOverlay').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) {
                this.hideTeamModal();
            }
        });

        document.getElementById('createTeamAction').addEventListener('click', () => {
            this.createTeam();
        });

        document.getElementById('joinTeamAction').addEventListener('click', () => {
            this.joinTeam();
        });

        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchModalTab(e.target.dataset.tab);
            });
        });

        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchProgressFilter(e.target.dataset.period);
            });
        });

        document.getElementById('screentime-penalty-btn').addEventListener('click', () => {
            // Deduct from user and give to doppelganger (feeding the shadow)
            this.user.powerPoints -= 10;
            this.doppelganger.powerPoints += 10;
            
            // Update all displays
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
            case 'dashboard':
                this.updateDashboard();
                break;
            case 'habits':
                this.updateHabitsSection();
                break;
            case 'team':
                this.updateTeamSection();
                break;
            case 'progress':
                this.updateProgressSection();
                break;
            case 'battle':
                this.updateBattleSection();
                break;
        }
    }

    // ============ HABIT MANAGEMENT ============
    toggleHabit(habitId, completed) {
        if (!this.habits[habitId]) return;

        const dateKey = this.getCurrentDateKey();
        const dayData = this.getDailyData(dateKey);
        
        if (!dayData.completed) {
            dayData.completed = [];
        }

        const habit = this.habits[habitId];
        const wasCompleted = dayData.completed.includes(habitId);
        const isPastDayWithPunishment = dayData.punishmentApplied && !this.isToday(dateKey);

        if (completed && !wasCompleted) {
            // Habit completed - add points immediately
            dayData.completed.push(habitId);
            this.user.powerPoints += habit.points;
            
            // If this is a past day that already had punishment applied,
            // subtract points from doppelganger since this habit is no longer "missed"
            if (isPastDayWithPunishment) {
                this.doppelganger.powerPoints -= habit.points;
            }
        } else if (!completed && wasCompleted) {
            // Habit uncompleted - remove points immediately
            dayData.completed = dayData.completed.filter(id => id !== habitId);
            this.user.powerPoints -= habit.points;
            
            // If this is a past day that already had punishment applied,
            // add points back to doppelganger since this habit is now "missed" again
            if (isPastDayWithPunishment) {
                this.doppelganger.powerPoints += habit.points;
            }
        }

        this.calculateStreaksAndStats();
        
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

        const dateKey = this.getCurrentDateKey();
        const dayData = this.getDailyData(dateKey);
        const isCompleted = dayData.completed && dayData.completed.includes(habitId);

        checkbox.checked = isCompleted;
        streakElement.textContent = habit.streak || 0;

        if (isCompleted) {
            card.classList.add('completed');
        } else {
            card.classList.remove('completed');
        }

        const progressWidth = Math.min(100, ((habit.streak || 0) / 30) * 100);
        progressElement.style.width = `${progressWidth}%`;
    }

    changeDate(direction) {
        const newDate = new Date(this.viewingDate);
        newDate.setDate(newDate.getDate() + direction);
        
        // Don't allow viewing future dates beyond today
        if (newDate > this.currentDate) return;
        
        this.viewingDate = newDate;
        this.saveToStorage();
        this.updateCurrentDate();
        this.updateHabitsSection();
        this.updateDashboard();
    }

    updateCurrentDate() {
        const options = { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        };
        
        const isViewingToday = this.viewingDate.getDate() === this.currentDate.getDate() &&
                              this.viewingDate.getMonth() === this.currentDate.getMonth() &&
                              this.viewingDate.getFullYear() === this.currentDate.getFullYear();
        
        document.getElementById('currentDate').textContent = isViewingToday ? 
            'Today' : 
            this.viewingDate.toLocaleDateString('en-US', options);
    }

    // ============ UI UPDATES ============
    updateDashboard() {
        this.updateAvatarSystem();
        this.updateDailySummary();
        this.updateQuickStats();
        this.updateHabitQuickList();
    }

    updateHabitQuickList() {
        const quickList = document.getElementById('habitQuickList');
        quickList.innerHTML = '';

        const dateKey = this.getCurrentDateKey();
        const dayData = this.getDailyData(dateKey);

        Object.entries(this.habits).forEach(([id, habit]) => {
            const isCompleted = dayData.completed && dayData.completed.includes(id);
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
        const dateKey = this.getCurrentDateKey();
        const dayData = this.getDailyData(dateKey);
        const completedHabits = dayData.completed ? dayData.completed.length : 0;
        const totalHabits = Object.keys(this.habits).length;
        
        const basePoints = dayData.completed ? dayData.completed.reduce((sum, habitId) => {
            const habit = this.habits[habitId];
            return sum + (habit ? habit.points : 0);
        }, 0) : 0;
        
        // Calculate potential end-of-day punishment
        const missedHabits = totalHabits - completedHabits;
        const tier = this.getCurrentTier();
        const multiplier = this.getTierMultiplier(tier);
        
        const missedPoints = Object.keys(this.habits).filter(habitId => 
            !dayData.completed || !dayData.completed.includes(habitId)
        ).reduce((sum, habitId) => {
            const habit = this.habits[habitId];
            return sum + (habit ? habit.points : 0);
        }, 0);
        
        const punishment = Math.floor(missedPoints * multiplier);
        const netScore = basePoints - punishment; // Allow negative scores
        
        const teamBonus = this.team.multiplier;
        const finalScore = Math.round(netScore * teamBonus);

        document.getElementById('completedCount').textContent = `${completedHabits}/${totalHabits}`;
        
        // Show the calculation: base points - punishment = net points (can be negative)
        if (punishment > 0) {
            document.getElementById('pointsEarned').innerHTML = `${basePoints} - ${punishment} = ${netScore}`;
        } else {
            document.getElementById('pointsEarned').textContent = basePoints;
        }
        
        document.getElementById('teamBonus').textContent = `+${Math.round((teamBonus - 1) * 100)}%`;
        document.getElementById('finalScore').textContent = finalScore;

        const completionPercentage = Math.round((completedHabits / totalHabits) * 100);
        document.querySelector('.completion-percentage').textContent = `${completionPercentage}%`;
        
        const circle = document.getElementById('dailyCompletion');
        circle.style.background = `conic-gradient(var(--accent-green) ${completionPercentage}%, var(--tertiary-bg) ${completionPercentage}%)`;
    }

    updateAvatarSystem() {
        const dateKey = this.getCurrentDateKey();
        const dayData = this.getDailyData(dateKey);
        const completedHabits = dayData.completed ? dayData.completed.length : 0;
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

        // Update power balance meter using CUMULATIVE POWER
        const powerBalance = this.calculatePowerBalance();
        const strengthMeter = document.getElementById('strengthMeter');
        
        strengthMeter.style.width = `${powerBalance.userPercentage}%`;
        strengthMeter.style.background = 'var(--avatar-gradient)';
        strengthMeter.style.display = 'block';

        const userName = this.user.name || 'Your Avatar';
        document.querySelector('.avatar-info h3').textContent = userName;
        document.getElementById('avatarLevel').textContent = `Level ${this.user.level}`;
        
        const currentXP = this.user.currentLevelXP !== undefined ? this.user.currentLevelXP : (this.user.experience % 100);
        const neededXP = this.user.nextLevelXP || 100;
        document.getElementById('avatarExp').textContent = `${Math.max(0, currentXP)} / ${neededXP} XP`;
        
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
            { name: 'bronze', min: 0, max: 1000, label: 'Bronze', range: '0 - 1K pts' },
            { name: 'silver', min: 1000, max: 2500, label: 'Silver', range: '1K - 2.5K pts' },
            { name: 'gold', min: 2500, max: 5000, label: 'Gold', range: '2.5K - 5K pts' },
            { name: 'platinum', min: 5000, max: 7500, label: 'Platinum', range: '5K - 7.5K pts' },
            { name: 'diamond', min: 7500, max: 15000, label: 'Diamond', range: '7.5K - 15K pts' },
            { name: 'goggins', min: 15000, max: Infinity, label: 'Goggins', range: '15K+ pts' }
        ];

        const currentTier = this.getCurrentTier();
        this.user.tier = currentTier;
        
        document.getElementById('currentTier').textContent = currentTier.charAt(0).toUpperCase() + currentTier.slice(1);
        document.getElementById('currentTier').className = `current-tier ${currentTier}`;

        const currentTierData = tiers.find(t => t.name === currentTier);
        const nextTierData = tiers[tiers.findIndex(t => t.name === currentTier) + 1];
        
        if (nextTierData) {
            const progress = ((this.user.powerPoints - currentTierData.min) / (nextTierData.min - currentTierData.min)) * 100; // Use powerPoints
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
                const pointsNeeded = tierData.min - this.user.powerPoints; // Use powerPoints
                statusElement.textContent = pointsNeeded > 0 ? `${pointsNeeded} pts needed` : 'Locked';
            }
        });
    }

    updateQuickStats() {
        document.getElementById('currentStreak').textContent = this.user.currentStreak;
        document.getElementById('monthlyPoints').textContent = Math.round(this.user.monthlyPoints);
        document.getElementById('dailyScore').textContent = `${Math.round(this.user.powerPoints)} pts`; // Use powerPoints
        document.getElementById('teamRank').textContent = this.team.id ? '#3' : '#--';
    }

    updateHabitsSection() {
        Object.keys(this.habits).forEach(habitId => {
            this.updateHabitCard(habitId);
        });
        this.updateDailySummary();
        this.updateCurrentDate();
    }

    // ============ TEAM SYSTEM ============
    updateTeamSection() {
        this.updateTeamStats();
        this.updateTeamMembers();
        this.updateTeamLeaderboard();
    }

    updateTeamStats() {
        if (!this.team.id) {
            document.getElementById('collectiveFill').style.width = '0%';
            document.getElementById('teamScore').textContent = '0';
            document.getElementById('teamGrade').textContent = '🔴 No Team';
            document.getElementById('teamMultiplier').textContent = '×1.00';
            return;
        }

        const dateKey = this.getCurrentDateKey();
        const dayData = this.getDailyData(dateKey);
        const userScore = dayData.completed ? dayData.completed.reduce((sum, habitId) => {
            const habit = this.habits[habitId];
            return sum + (habit ? habit.points : 0);
        }, 0) : 0;
        
        const teamScore = userScore + 150;
        this.team.dailyScore = Math.min(this.team.maxScore, teamScore);

        const scorePercentage = (this.team.dailyScore / this.team.maxScore) * 100;
        document.getElementById('collectiveFill').style.width = `${scorePercentage}%`;
        document.getElementById('teamScore').textContent = this.team.dailyScore;

        if (this.team.dailyScore >= 450) {
            this.team.grade = '🟢 Excellent';
            this.team.multiplier = 1.10;
        } else if (this.team.dailyScore >= 400) {
            this.team.grade = '🟡 Good';
            this.team.multiplier = 1.05;
        } else if (this.team.dailyScore >= 300) {
            this.team.grade = '🟠 Average';
            this.team.multiplier = 1.00;
        } else {
            this.team.grade = '🔴 Poor';
            this.team.multiplier = 0.95;
        }

        document.getElementById('teamGrade').textContent = this.team.grade;
        document.getElementById('teamMultiplier').textContent = `×${this.team.multiplier.toFixed(2)}`;
    }

    updateTeamMembers() {
        const memberSlots = document.querySelectorAll('.member-slot');
        
        if (!this.team.id) {
            memberSlots.forEach((slot, index) => {
                slot.classList.add('empty');
                slot.querySelector('.member-name').textContent = 'Empty Slot';
                slot.querySelector('.member-score').textContent = '--';
            });
            return;
        }

        const dateKey = this.getCurrentDateKey();
        const dayData = this.getDailyData(dateKey);
        const userScore = dayData.completed ? dayData.completed.reduce((sum, habitId) => {
            const habit = this.habits[habitId];
            return sum + (habit ? habit.points : 0);
        }, 0) : 0;
        
        const members = [
            { name: this.user.name || 'You', score: userScore },
            ...this.team.members.slice(1)
        ];

        memberSlots.forEach((slot, index) => {
            if (index < members.length) {
                slot.classList.remove('empty');
                slot.querySelector('.member-name').textContent = members[index].name;
                slot.querySelector('.member-score').textContent = `${members[index].score} pts`;
                slot.querySelector('.member-avatar').classList.remove('placeholder');
            } else {
                slot.classList.add('empty');
                slot.querySelector('.member-name').textContent = 'Empty Slot';
                slot.querySelector('.member-score').textContent = '--';
                slot.querySelector('.member-avatar').classList.add('placeholder');
            }
        });
    }

    updateTeamLeaderboard() {
        const leaderboard = document.getElementById('teamLeaderboard');
        
        if (!this.team.id) {
            leaderboard.innerHTML = '<div class="no-team">Join a team to see leaderboard</div>';
            return;
        }

        const teams = [
            { name: 'Elite Squad', score: 2340, rank: 1 },
            { name: 'Habit Hackers', score: 2180, rank: 2 },
            { name: this.team.name, score: this.team.dailyScore * 7, rank: 3 },
            { name: 'Morning Warriors', score: 1950, rank: 4 },
            { name: 'Discipline Devils', score: 1890, rank: 5 }
        ];

        leaderboard.innerHTML = teams.map(team => `
            <div class="leaderboard-item ${team.name === this.team.name ? 'current-team' : ''}">
                <div class="team-rank">#${team.rank}</div>
                <div class="team-name">${team.name}</div>
                <div class="team-score">${team.score} pts</div>
            </div>
        `).join('');
    }

    // ============ TEAM MODALS ============
    showTeamModal(tab = 'create') {
        document.getElementById('modalOverlay').classList.add('active');
        this.switchModalTab(tab);
    }

    hideTeamModal() {
        document.getElementById('modalOverlay').classList.remove('active');
    }

    switchModalTab(tabName) {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });

        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        document.getElementById(`${tabName}Tab`).classList.add('active');
    }

    createTeam() {
        const teamName = document.getElementById('teamName').value.trim();
        const teamDescription = document.getElementById('teamDescription').value.trim();

        if (!teamName) {
            alert('Please enter a team name');
            return;
        }

        this.team.id = 'team_' + Date.now();
        this.team.name = teamName;
        this.team.members = [{ name: this.user.name || 'You', score: 0 }];
        this.achievements['team-player'] = true;

        this.hideTeamModal();
        this.updateTeamSection();
        this.saveToStorage();
        alert(`Team "${teamName}" created successfully! Share code: ${this.team.id}`);
    }

    joinTeam() {
        const teamCode = document.getElementById('teamCode').value.trim();

        if (!teamCode) {
            alert('Please enter a team code');
            return;
        }

        this.team.id = teamCode;
        this.team.name = 'Team ' + teamCode.substring(5, 10);
        this.team.members = [
            { name: this.user.name || 'You', score: 0 },
            { name: 'TeamMate_1', score: 45 },
            { name: 'TeamMate_2', score: 38 }
        ];

        this.achievements['team-player'] = true;

        this.hideTeamModal();
        this.updateTeamSection();
        this.saveToStorage();
        alert('Successfully joined team!');
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
            const today = new Date(this.currentDate);
            
            for (let i = 0; i < days; i++) {
                const date = new Date(today);
                date.setDate(today.getDate() - (days - 1 - i));
                const dateKey = this.formatDate(date);
                const dayData = this.dailyData[dateKey];
                
                const basePoints = dayData && dayData.completed ? dayData.completed.reduce((sum, habitId) => {
                    const habit = this.habits[habitId];
                    return sum + (habit ? habit.points : 0);
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
                const date = new Date(today);
                date.setDate(today.getDate() - (days - 1 - i));
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

    switchProgressFilter(period) {
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-period="${period}"]`).classList.add('active');
        
        this.updateCharts();
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

        const todayKey = this.getCurrentDateKey();
        const todayData = this.getDailyData(todayKey);
        const totalHabits = Object.keys(this.habits).length;
        const completedToday = todayData.completed ? todayData.completed.length : 0;
        
        if (completedToday === totalHabits) {
            this.achievements['perfect-day'] = true;
        }

        if (this.user.currentStreak >= 30) {
            this.achievements['streak-master'] = true;
        }

        if (this.user.monthlyPoints > 5000) {
            this.achievements['top-performer'] = true;
        }
    }

    // ============ BATTLE SYSTEM ============
    updateBattleSection() {
        this.updateBattleTimer();
        this.updateBattleArena();
        this.updateBattleHistory();
    }

    updateBattleTimer() {
        const now = new Date();
        const nextMonday = new Date(now);
        const daysUntilMonday = (1 + 7 - now.getDay()) % 7 || 7;
        nextMonday.setDate(now.getDate() + daysUntilMonday);
        nextMonday.setHours(0, 0, 0, 0);
        
        const timeUntil = nextMonday.getTime() - now.getTime();
        
        const days = Math.floor(timeUntil / (1000 * 60 * 60 * 24));
        const hours = Math.floor((timeUntil % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((timeUntil % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeUntil % (1000 * 60)) / 1000);

        document.getElementById('battleTimer').textContent = 
            `${days}d ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    updateBattleArena() {
        const powerBalance = this.calculatePowerBalance();
        
        document.getElementById('avatarPower').textContent = `Power: ${Math.round(powerBalance.userPower)}`;
        document.getElementById('shadowPower').textContent = `Power: ${Math.round(powerBalance.doppelgangerPower)}`;

        const today = new Date(this.currentDate);
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay() + 1);
        
        let weeklyCompletion = 0;
        let daysChecked = 0;
        
        for (let i = 0; i < 7; i++) {
            const checkDate = new Date(startOfWeek);
            checkDate.setDate(startOfWeek.getDate() + i);
            
            if (checkDate <= today) {
                const dateKey = this.formatDate(checkDate);
                const dayData = this.dailyData[dateKey];
                const completed = dayData && dayData.completed ? dayData.completed.length : 0;
                const total = Object.keys(this.habits).length;
                weeklyCompletion += completed / total;
                daysChecked++;
            }
        }
        
        const avgCompletion = daysChecked > 0 ? weeklyCompletion / daysChecked : 0;
        
        if (powerBalance.userPercentage >= 70) {
            document.getElementById('battleStatus').textContent = 'Victory Imminent';
            this.battle.playerHealth = 100;
            this.battle.doppelgangerHealth = Math.max(10, 100 - powerBalance.userPercentage);
        } else if (powerBalance.userPercentage >= 50) {
            document.getElementById('battleStatus').textContent = 'Fierce Battle';
            this.battle.playerHealth = 50 + (powerBalance.userPercentage - 50) * 2;
            this.battle.doppelgangerHealth = 50 + (powerBalance.doppelgangerPercentage - 50) * 2;
        } else {
            document.getElementById('battleStatus').textContent = 'Shadow Winning';
            this.battle.playerHealth = Math.max(10, powerBalance.userPercentage * 2);
            this.battle.doppelgangerHealth = 100;
        }

        document.getElementById('battleRound').textContent = `Day ${Math.min(7, daysChecked)}/7`;
        document.getElementById('avatarHealth').textContent = `${Math.round(this.battle.playerHealth)}%`;
        document.getElementById('doppelgangerHealth').textContent = `${Math.round(this.battle.doppelgangerHealth)}%`;
    }

    updateBattleHistory() {
        const historyContainer = document.getElementById('battleHistory');
        
        if (this.battle.history.length === 0) {
            historyContainer.innerHTML = `
                <div class="history-item">
                    <div class="history-date">No battles yet</div>
                    <div class="history-result">--</div>
                    <div class="history-score">-- vs --</div>
                </div>
            `;
            return;
        }

        historyContainer.innerHTML = this.battle.history.map(battle => `
            <div class="history-item">
                <div class="history-date">${battle.date}</div>
                <div class="history-result ${battle.result}">${battle.result}</div>
                <div class="history-score">${battle.playerScore} vs ${battle.doppelgangerScore}</div>
            </div>
        `).join('');
    }

    // ============ TIMERS ============
    startTimers() {
        // Check for date changes every minute, but be efficient about it
        setInterval(() => {
            const now = Date.now();
            
            // Only check sync every minute, not more frequently
            if (!this._lastSyncCheck || (now - this._lastSyncCheck) >= 60000) {
                const realDateKey = this.formatDate(new Date());
                
                // Only do expensive sync if date actually changed
                if (realDateKey !== this._cachedDateKey) {
                    this.syncWithRealDate();
                    this.updateDisplay();
                }
                
                this._lastSyncCheck = now;
            }
        }, 60000); // Check every minute

        setInterval(() => {
            if (this.currentSection === 'battle') {
                this.updateBattleTimer();
            }
        }, 1000);
    }

    // ============ DEBUG FUNCTIONS ============
    skipDay() {
        // Apply punishment for the current day before advancing
        const currentDateKey = this.formatDate(this.currentDate);
        this.applyDayEndPunishment(currentDateKey);
        
        // Advance the current date by one day
        this.currentDate.setDate(this.currentDate.getDate() + 1);
        this.viewingDate = new Date(this.currentDate);
        
        // Recalculate everything with the new date
        this.calculateStreaksAndStats();
        this.saveToStorage();
        this.updateDisplay();
    }

    // Recovery function for shifted data
    shiftDataForward() {
        const newDailyData = {};
        const sortedDates = Object.keys(this.dailyData).sort();
        
        for (let i = 0; i < sortedDates.length; i++) {
            const oldDateKey = sortedDates[i];
            const oldDate = new Date(oldDateKey);
            const newDate = new Date(oldDate);
            newDate.setDate(newDate.getDate() + 1); // Shift forward by 1 day
            const newDateKey = this.formatDate(newDate);
            
            newDailyData[newDateKey] = { ...this.dailyData[oldDateKey] };
            newDailyData[newDateKey].timestamp = newDate.getTime();
        }
        
        this.dailyData = newDailyData;
        this.saveToStorage();
        this.updateDisplay();
        console.log('Data shifted forward by 1 day');
    }

    updateDisplay() {
        this.updateSectionContent(this.currentSection);
    }
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.doppelgangerApp = new DoppelgangerApp();
    window.app = window.doppelgangerApp;
});