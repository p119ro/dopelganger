// Doppelganger App - Fully Functional Version

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
            nutrition: { name: 'No sugar/processed food', points: 15, icon: '🍽️' }
        };

        this.user = {
            name: '',
            level: 1,
            experience: 0,
            totalPoints: 0,
            monthlyPoints: 0,
            tier: 'bronze',
            avatar: {
                strength: 100,
                glow: 0,
                aura: 0
            },
            isFirstTime: true
        };

        this.doppelganger = {
            level: 1,
            strength: 80,
            influence: 0,
            corruption: 0
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

        this.currentDate = new Date();
        this.currentSection = 'dashboard';
        
        // Data structure: { 'YYYY-MM-DD': { habits: {}, completed: [], points: 0 } }
        this.dailyData = {};
        
        this.init();
    }

    init() {
        this.loadFromStorage();
        
        // Check if first time user
        if (this.user.isFirstTime) {
            this.showNameModal();
        }
        
        this.setupEventListeners();
        this.updateDisplay();
        this.startTimers();
        this.calculateStreaksAndStats();
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

        // Focus on input
        setTimeout(() => {
            document.getElementById('userName').focus();
        }, 100);

        // Enter key support
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
            battle: this.battle
        };
        
        try {
            const compressed = JSON.stringify(data);
            localStorage.setItem('doppelganger_data', compressed);
            this.saveCurrentDate();
        } catch (error) {
            console.error('Failed to save data:', error);
        }
    }

    saveCurrentDate() {
        localStorage.setItem('doppelganger_currentDate', this.currentDate.toISOString());
    }

    handleRealDayTransition() {
        const now = new Date();
        const lastCheck = this.user.lastCheck ? new Date(this.user.lastCheck) : this.currentDate;
        
        // Calculate how many real days have passed
        const timeDiff = now.getTime() - lastCheck.getTime();
        const daysPassed = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
        
        if (daysPassed >= 1) {
            // Advance currentDate by the number of days that passed
            this.currentDate.setDate(this.currentDate.getDate() + daysPassed);
            this.user.lastCheck = now.toISOString();
            
            console.log(`Advanced ${daysPassed} day(s). New current date: ${this.formatDate(this.currentDate)}`);
            
            // Recalculate everything with new date
            this.calculateStreaksAndStats();
            this.saveToStorage();
        }
    }

    loadFromStorage() {
        try {
            const saved = localStorage.getItem('doppelganger_data');
            if (saved) {
                const data = JSON.parse(saved);
                
                // Merge saved data with defaults
                this.user = { ...this.user, ...data.user };
                this.doppelganger = { ...this.doppelganger, ...data.doppelganger };
                this.team = { ...this.team, ...data.team };
                this.achievements = { ...this.achievements, ...data.achievements };
                this.dailyData = data.dailyData || {};
                this.battle = { ...this.battle, ...data.battle };
            }

            // Restore currentDate as the authoritative "today"
            const savedDate = localStorage.getItem('doppelganger_currentDate');
            if (savedDate) {
                this.currentDate = new Date(savedDate);
            } else {
                this.currentDate = new Date();
                this.saveCurrentDate();
            }
            
            // Check if real days have passed and advance currentDate accordingly
            this.handleRealDayTransition();
            
        } catch (error) {
            console.error('Failed to load data:', error);
            // Start fresh if data is corrupted
            this.resetData();
        }
    }

    resetData() {
        localStorage.removeItem('doppelganger_data');
        localStorage.removeItem('doppelganger_currentDate');
        this.dailyData = {};
        this.currentDate = new Date();
        this.user.isFirstTime = true;
        this.saveToStorage();
    }

    // ============ DATE MANAGEMENT ============
    formatDate(date) {
        return date.toISOString().split('T')[0]; // YYYY-MM-DD format
    }

    getCurrentDateKey() {
        return this.formatDate(this.currentDate);
    }

    getTodayKey() {
        // Use currentDate as the authoritative "today"
        return this.formatDate(this.currentDate);
    }

    getDailyData(dateKey) {
        if (!this.dailyData[dateKey]) {
            this.dailyData[dateKey] = {
                habits: {},
                completed: [],
                points: 0,
                timestamp: Date.now()
            };
        }
        return this.dailyData[dateKey];
    }

    // ============ STREAK CALCULATION ============
    calculateStreaksAndStats() {
        // Use currentDate as authoritative "today"
        const today = new Date(this.currentDate);
        const todayKey = this.formatDate(today);
        
        // Calculate total experience and points from all completed habits
        let totalExperience = 0;
        this.user.totalPoints = 0;
        this.user.monthlyPoints = 0;
        
        // Get all dates and sort them
        const allDates = Object.keys(this.dailyData).sort();
        
        // Calculate total points and experience
        for (const dateKey of allDates) {
            const data = this.dailyData[dateKey];
            const dayDate = new Date(dateKey);
            const daysSinceToday = Math.floor((today - dayDate) / (1000 * 60 * 60 * 24));
            
            if (data && data.completed) {
                const dayPoints = data.completed.reduce((sum, habitId) => {
                    const habit = this.habits[habitId];
                    return sum + (habit ? habit.points : 0);
                }, 0);
                
                totalExperience += dayPoints;
                this.user.totalPoints += dayPoints;
                
                // Monthly points (last 30 days from currentDate)
                if (daysSinceToday <= 30 && daysSinceToday >= 0) {
                    this.user.monthlyPoints += dayPoints;
                }
            }
        }

        // Update experience and calculate level
        this.user.experience = totalExperience;
        this.calculateLevel();

        // Calculate streaks for each habit using currentDate
        Object.keys(this.habits).forEach(habitId => {
            this.habits[habitId].streak = this.calculateHabitStreak(habitId);
        });

        // Calculate current overall streak using currentDate
        this.user.currentStreak = this.calculateOverallStreak();
        
        // Update tier based on monthly points
        this.updateTierProgression();
        
        // Check achievements
        this.checkAchievements();
        
        this.saveToStorage();
    }

    calculateLevel() {
        // Simple leveling: Level 1 = 0-99 XP, Level 2 = 100-199 XP, etc.
        this.user.level = Math.floor(this.user.experience / 100) + 1;
        
        // Calculate current level progress
        this.user.currentLevelXP = this.user.experience % 100;
        this.user.nextLevelXP = 100;
    }

    calculateHabitStreak(habitId) {
        // Use currentDate as authoritative "today"
        const today = new Date(this.currentDate);
        let streak = 0;
        
        // Start from currentDate and go backwards
        for (let i = 0; i >= -365; i--) { // Check up to a year back
            const checkDate = new Date(today);
            checkDate.setDate(today.getDate() + i);
            const dateKey = this.formatDate(checkDate);
            const dayData = this.dailyData[dateKey];
            
            if (dayData && dayData.completed && dayData.completed.includes(habitId)) {
                if (i === 0) {
                    // Today counts towards streak
                    streak++;
                } else if (streak > 0) {
                    // Consecutive day
                    streak++;
                } else {
                    // Gap found, stop counting
                    break;
                }
            } else if (i === 0) {
                // Today not completed, no current streak
                break;
            } else if (streak > 0) {
                // Gap found in consecutive days
                break;
            }
        }
        
        return streak;
    }

    calculateOverallStreak() {
        // Use currentDate as authoritative "today"
        const today = new Date(this.currentDate);
        let streak = 0;
        
        // Start from currentDate and go backwards
        for (let i = 0; i >= -365; i--) {
            const checkDate = new Date(today);
            checkDate.setDate(today.getDate() + i);
            const dateKey = this.formatDate(checkDate);
            const dayData = this.dailyData[dateKey];
            
            if (dayData && dayData.completed) {
                const totalHabits = Object.keys(this.habits).length;
                const completedHabits = dayData.completed.length;
                
                // Consider it a streak day if at least 70% of habits completed
                if (completedHabits >= Math.ceil(totalHabits * 0.7)) {
                    if (i === 0) {
                        // Today counts
                        streak++;
                    } else if (streak > 0) {
                        // Consecutive day
                        streak++;
                    } else {
                        // Gap found
                        break;
                    }
                } else if (i === 0) {
                    // Today doesn't meet criteria
                    break;
                } else if (streak > 0) {
                    // Gap found
                    break;
                }
            } else if (i === 0) {
                // No data for today
                break;
            } else if (streak > 0) {
                // Gap found
                break;
            }
        }
        
        return streak;
    }

    // ============ EVENT LISTENERS ============
    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchSection(e.target.dataset.section);
            });
        });

        // Habit toggles
        document.querySelectorAll('.habit-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const habitId = e.target.id.replace('-checkbox', '');
                this.toggleHabit(habitId, e.target.checked);
            });
        });

        // Date navigation
        document.getElementById('prevDay').addEventListener('click', () => {
            this.changeDate(-1);
        });
        
        document.getElementById('nextDay').addEventListener('click', () => {
            this.changeDate(1);
        });

        // Team modals
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

        // Team actions
        document.getElementById('createTeamAction').addEventListener('click', () => {
            this.createTeam();
        });

        document.getElementById('joinTeamAction').addEventListener('click', () => {
            this.joinTeam();
        });

        // Modal tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchModalTab(e.target.dataset.tab);
            });
        });

        // Progress filters
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchProgressFilter(e.target.dataset.period);
            });
        });
    }

    switchSection(sectionId) {
        // Hide all sections
        document.querySelectorAll('.section').forEach(section => {
            section.classList.remove('active');
        });

        // Show target section
        document.getElementById(sectionId).classList.add('active');

        // Update navigation
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

        if (completed && !wasCompleted) {
            // Habit completed
            dayData.completed.push(habitId);
            
            // Update avatar strength
            this.user.avatar.strength += 2;
            
            // Reduce doppelganger influence
            this.doppelganger.influence = Math.max(0, this.doppelganger.influence - 3);
            
        } else if (!completed && wasCompleted) {
            // Habit uncompleted
            dayData.completed = dayData.completed.filter(id => id !== habitId);
            
            // Reduce avatar strength
            this.user.avatar.strength = Math.max(50, this.user.avatar.strength - 2);
            
            // Increase doppelganger influence
            this.doppelganger.influence = Math.min(100, this.doppelganger.influence + 5);
        }

        // Recalculate everything based on actual data
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

        // Update card appearance
        if (isCompleted) {
            card.classList.add('completed');
        } else {
            card.classList.remove('completed');
        }

        // Update progress bar (based on streak)
        const progressWidth = Math.min(100, ((habit.streak || 0) / 30) * 100);
        progressElement.style.width = `${progressWidth}%`;
    }

    changeDate(direction) {
        const newDate = new Date(this.currentDate);
        newDate.setDate(newDate.getDate() + direction);
        
        // Don't allow future dates beyond the real today
        const realToday = new Date();
        realToday.setHours(23, 59, 59, 999); // End of real today
        
        if (newDate > realToday) return;
        
        this.currentDate = newDate;
        this.saveCurrentDate(); // Persist the new current date
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
        const realToday = new Date();
        
        // Check if currentDate matches real today (same day, month, year)
        const isToday = this.currentDate.getDate() === realToday.getDate() &&
                       this.currentDate.getMonth() === realToday.getMonth() &&
                       this.currentDate.getFullYear() === realToday.getFullYear();
        
        document.getElementById('currentDate').textContent = isToday ? 
            'Today' : 
            this.currentDate.toLocaleDateString('en-US', options);
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
        
        // Calculate points for this specific day
        const basePoints = dayData.completed ? dayData.completed.reduce((sum, habitId) => {
            const habit = this.habits[habitId];
            return sum + (habit ? habit.points : 0);
        }, 0) : 0;
        
        const teamBonus = this.team.multiplier;
        const finalScore = Math.round(basePoints * teamBonus);

        document.getElementById('completedCount').textContent = `${completedHabits}/${totalHabits}`;
        document.getElementById('pointsEarned').textContent = basePoints;
        document.getElementById('teamBonus').textContent = `+${Math.round((teamBonus - 1) * 100)}%`;
        document.getElementById('finalScore').textContent = finalScore;

        // Update daily completion circle
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

        // Update avatar glow and aura
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

        // Update doppelganger corruption
        const doppelgangerShadow = document.getElementById('doppelgangerShadow');
        const doppelgangerCorruption = document.getElementById('doppelgangerCorruption');
        
        const missedHabits = totalHabits - completedHabits;
        const corruptionLevel = missedHabits / totalHabits;
        
        doppelgangerShadow.style.opacity = Math.min(1, corruptionLevel + 0.3);
        doppelgangerCorruption.style.opacity = corruptionLevel;

        // Update strength meter
        const strengthMeter = document.getElementById('strengthMeter');
        const avatarStrength = this.user.avatar.strength;
        const doppelgangerStrength = this.doppelganger.strength + this.doppelganger.influence;
        const totalStrength = avatarStrength + doppelgangerStrength;
        const meterPosition = (avatarStrength / totalStrength) * 100;
        
        strengthMeter.style.width = `${meterPosition}%`;

        // Update avatar info with proper XP display
        const userName = this.user.name || 'Your Avatar';
        document.querySelector('.avatar-info h3').textContent = userName;
        document.getElementById('avatarLevel').textContent = `Level ${this.user.level}`;
        
        // Show current level progress - make sure we have the calculated values
        const currentXP = this.user.currentLevelXP !== undefined ? this.user.currentLevelXP : (this.user.experience % 100);
        const neededXP = this.user.nextLevelXP || 100;
        document.getElementById('avatarExp').textContent = `${currentXP} / ${neededXP} XP`;
        
        document.getElementById('doppelgangerLevel').textContent = `Level ${this.doppelganger.level}`;
        document.getElementById('doppelgangerPower').textContent = `${Math.round(this.doppelganger.influence)}% Influence`;
    }

    updateTierProgression() {
        const tiers = [
            { name: 'bronze', min: 0, max: 1000 },
            { name: 'silver', min: 1000, max: 2500 },
            { name: 'gold', min: 2500, max: 5000 },
            { name: 'platinum', min: 5000, max: 7500 },
            { name: 'diamond', min: 7500, max: Infinity }
        ];

        let currentTier = 'bronze';
        tiers.forEach(tier => {
            if (this.user.monthlyPoints >= tier.min) {
                currentTier = tier.name;
            }
        });

        this.user.tier = currentTier;

        // Update tier display
        document.getElementById('currentTier').textContent = currentTier.charAt(0).toUpperCase() + currentTier.slice(1);
        document.getElementById('currentTier').className = `current-tier ${currentTier}`;

        // Update tier progress
        const currentTierData = tiers.find(t => t.name === currentTier);
        const nextTierData = tiers[tiers.findIndex(t => t.name === currentTier) + 1];
        
        if (nextTierData) {
            const progress = ((this.user.monthlyPoints - currentTierData.min) / (nextTierData.min - currentTierData.min)) * 100;
            document.getElementById('tierProgress').textContent = `${Math.round(progress)}%`;
        } else {
            document.getElementById('tierProgress').textContent = '100%';
        }

        // Update tier ladder
        document.querySelectorAll('.tier').forEach(tier => {
            tier.classList.remove('active');
            const tierName = tier.dataset.tier;
            const statusElement = tier.querySelector('.tier-status');
            
            if (tierName === currentTier) {
                tier.classList.add('active');
                statusElement.textContent = 'Current';
            } else if (tiers.findIndex(t => t.name === tierName) < tiers.findIndex(t => t.name === currentTier)) {
                statusElement.textContent = 'Completed';
            } else {
                statusElement.textContent = 'Locked';
            }
        });
    }

    updateQuickStats() {
        const todayKey = this.getTodayKey();
        const todayData = this.getDailyData(todayKey);
        const todayPoints = todayData.completed ? todayData.completed.reduce((sum, habitId) => {
            const habit = this.habits[habitId];
            return sum + (habit ? habit.points : 0);
        }, 0) : 0;
        
        document.getElementById('currentStreak').textContent = this.user.currentStreak;
        document.getElementById('monthlyPoints').textContent = this.user.monthlyPoints;
        document.getElementById('dailyScore').textContent = `${todayPoints} pts`;
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

        // Simulate basic team scoring if in a team
        const todayKey = this.getTodayKey();
        const todayData = this.getDailyData(todayKey);
        const userScore = todayData.completed ? todayData.completed.reduce((sum, habitId) => {
            const habit = this.habits[habitId];
            return sum + (habit ? habit.points : 0);
        }, 0) : 0;
        
        // Simulate other member scores (in real app, this would come from server)
        const teamScore = userScore + 150; // Simulated team contribution
        this.team.dailyScore = Math.min(this.team.maxScore, teamScore);

        const scorePercentage = (this.team.dailyScore / this.team.maxScore) * 100;
        document.getElementById('collectiveFill').style.width = `${scorePercentage}%`;
        document.getElementById('teamScore').textContent = this.team.dailyScore;

        // Update team grade and multiplier
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

        // Show user and simulate other members
        const todayKey = this.getTodayKey();
        const todayData = this.getDailyData(todayKey);
        const userScore = todayData.completed ? todayData.completed.reduce((sum, habitId) => {
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

        // Basic leaderboard simulation
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

        // Create team
        this.team.id = 'team_' + Date.now();
        this.team.name = teamName;
        this.team.members = [{ name: this.user.name || 'You', score: 0 }];

        // Mark team player achievement
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

        // Join team (in real app, would validate with server)
        this.team.id = teamCode;
        this.team.name = 'Team ' + teamCode.substring(5, 10);
        this.team.members = [
            { name: this.user.name || 'You', score: 0 },
            { name: 'TeamMate_1', score: 45 },
            { name: 'TeamMate_2', score: 38 }
        ];

        // Mark team player achievement
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
        // Basic chart data visualization using currentDate as reference
        const pointsChart = document.querySelector('#pointsChart canvas');
        const habitsChart = document.querySelector('#habitsChart canvas');
        
        if (pointsChart && habitsChart) {
            const ctx1 = pointsChart.getContext('2d');
            const ctx2 = habitsChart.getContext('2d');
            
            // Clear canvases
            ctx1.clearRect(0, 0, pointsChart.width, pointsChart.height);
            ctx2.clearRect(0, 0, habitsChart.width, habitsChart.height);
            
            // Draw simple line for points over time (last 7 days from currentDate)
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
                const points = dayData && dayData.completed ? dayData.completed.reduce((sum, habitId) => {
                    const habit = this.habits[habitId];
                    return sum + (habit ? habit.points : 0);
                }, 0) : 0;
                
                const x = (i / (days - 1)) * (pointsChart.width - 40) + 20;
                const y = pointsChart.height - 20 - (points / 100) * (pointsChart.height - 40);
                
                if (i === 0) {
                    ctx1.moveTo(x, y);
                } else {
                    ctx1.lineTo(x, y);
                }
            }
            ctx1.stroke();
            
            // Draw completion rate
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
        // First Week
        if (this.user.currentStreak >= 7) {
            this.achievements['first-week'] = true;
        }

        // Perfect Day
        const todayKey = this.getTodayKey();
        const todayData = this.getDailyData(todayKey);
        const totalHabits = Object.keys(this.habits).length;
        const completedToday = todayData.completed ? todayData.completed.length : 0;
        
        if (completedToday === totalHabits) {
            this.achievements['perfect-day'] = true;
        }

        // Streak Master
        if (this.user.currentStreak >= 30) {
            this.achievements['streak-master'] = true;
        }

        // Top Performer
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
        
        // Calculate next Monday at midnight
        const nextMonday = new Date(now);
        const daysUntilMonday = (1 + 7 - now.getDay()) % 7 || 7; // 0 if today is Monday, 7 if today is Tuesday-Sunday
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
        const avatarPower = this.user.avatar.strength + (this.user.level * 10);
        const shadowPower = this.doppelganger.strength + this.doppelganger.influence;

        document.getElementById('avatarPower').textContent = `Power: ${Math.round(avatarPower)}`;
        document.getElementById('shadowPower').textContent = `Power: ${Math.round(shadowPower)}`;

        // Update battle status based on weekly performance from currentDate
        const today = new Date(this.currentDate);
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay() + 1); // Monday
        
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
        
        if (avgCompletion >= 0.8) {
            document.getElementById('battleStatus').textContent = 'Victory Imminent';
            this.battle.playerHealth = 100;
            this.battle.doppelgangerHealth = Math.max(20, 100 - (avgCompletion * 80));
        } else if (avgCompletion >= 0.5) {
            document.getElementById('battleStatus').textContent = 'Fierce Battle';
            this.battle.playerHealth = 60 + (avgCompletion * 40);
            this.battle.doppelgangerHealth = 40 + ((1 - avgCompletion) * 60);
        } else {
            document.getElementById('battleStatus').textContent = 'Shadow Winning';
            this.battle.playerHealth = Math.max(20, avgCompletion * 100);
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
        // Update battle timer every second
        setInterval(() => {
            if (this.currentSection === 'battle') {
                this.updateBattleTimer();
            }
        }, 1000);

        // Check for real day transitions every 30 minutes
        setInterval(() => {
            this.handleRealDayTransition();
        }, 30 * 60 * 1000); // 30 minutes
    }

    checkWeeklyBattle() {
        const now = new Date();
        
        // Check if it's Monday and we haven't processed this week's battle
        if (now.getDay() === 1 && !this.battle.lastBattleWeek) {
            this.processBattleResult();
        }
    }

    processBattleResult() {
        const now = new Date();
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - 7);
        
        let weeklyScore = 0;
        let daysCount = 0;
        
        // Calculate last week's performance
        for (let i = 0; i < 7; i++) {
            const checkDate = new Date(weekStart);
            checkDate.setDate(weekStart.getDate() + i);
            const dateKey = this.formatDate(checkDate);
            const dayData = this.dailyData[dateKey];
            
            if (dayData && dayData.completed) {
                const dayPoints = dayData.completed.reduce((sum, habitId) => {
                    const habit = this.habits[habitId];
                    return sum + (habit ? habit.points : 0);
                }, 0);
                weeklyScore += dayPoints;
                daysCount++;
            }
        }
        
        const avgScore = daysCount > 0 ? weeklyScore / daysCount : 0;
        const shadowScore = Math.max(30, 70 - avgScore); // Shadow gets stronger when you're weaker
        
        const result = avgScore > shadowScore ? 'Victory' : 'Defeat';
        
        this.battle.history.unshift({
            date: weekStart.toLocaleDateString(),
            result: result,
            playerScore: Math.round(avgScore),
            doppelgangerScore: Math.round(shadowScore)
        });
        
        // Keep only last 10 battles
        if (this.battle.history.length > 10) {
            this.battle.history = this.battle.history.slice(0, 10);
        }
        
        this.battle.lastBattleWeek = this.formatDate(weekStart);
        this.saveToStorage();
    }

    // ============ DEBUG METHODS (Console Commands) ============
    
    // Add these methods for console testing
    debugSkipDays(days) {
        console.log(`🕐 Skipping ${days} day(s)...`);
        console.log(`📅 Before: ${this.formatDate(this.currentDate)}`);
        
        this.currentDate.setDate(this.currentDate.getDate() + days);
        this.user.lastCheck = new Date().toISOString(); // Update last check to prevent auto-advance
        
        console.log(`📅 After: ${this.formatDate(this.currentDate)}`);
        
        // Recalculate everything
        this.calculateStreaksAndStats();
        this.saveToStorage();
        this.updateDisplay();
        
        console.log(`✅ Time advanced! Streaks and stats recalculated.`);
        this.debugShowStatus();
    }
    
    debugGoToDate(dateString) {
        try {
            const newDate = new Date(dateString);
            if (isNaN(newDate.getTime())) {
                console.error('❌ Invalid date format. Use: YYYY-MM-DD (e.g., "2024-01-15")');
                return;
            }
            
            console.log(`📅 Jumping to: ${this.formatDate(newDate)}`);
            this.currentDate = newDate;
            this.user.lastCheck = new Date().toISOString();
            
            this.calculateStreaksAndStats();
            this.saveToStorage();
            this.updateDisplay();
            
            console.log(`✅ Jumped to ${this.formatDate(newDate)}!`);
            this.debugShowStatus();
        } catch (error) {
            console.error('❌ Error jumping to date:', error.message);
        }
    }
    
    debugGoToToday() {
        console.log(`📅 Returning to real today...`);
        this.currentDate = new Date();
        this.user.lastCheck = new Date().toISOString();
        
        this.calculateStreaksAndStats();
        this.saveToStorage();
        this.updateDisplay();
        
        console.log(`✅ Back to today: ${this.formatDate(this.currentDate)}`);
        this.debugShowStatus();
    }
    
    debugShowStatus() {
        console.log('\n📊 CURRENT STATUS:');
        console.log(`📅 Current Date: ${this.formatDate(this.currentDate)}`);
        console.log(`📅 Real Today: ${this.formatDate(new Date())}`);
        console.log(`🔥 Current Streak: ${this.user.currentStreak} days`);
        console.log(`⭐ Total XP: ${this.user.experience}`);
        console.log(`🏆 Level: ${this.user.level}`);
        console.log(`📈 Monthly Points: ${this.user.monthlyPoints}`);
        
        const todayData = this.getDailyData(this.getCurrentDateKey());
        const completed = todayData.completed ? todayData.completed.length : 0;
        console.log(`✅ Today's Habits: ${completed}/${Object.keys(this.habits).length}`);
        
        // Show habit streaks
        console.log('\n🎯 HABIT STREAKS:');
        Object.entries(this.habits).forEach(([id, habit]) => {
            console.log(`${habit.icon} ${habit.name}: ${habit.streak} days`);
        });
    }
    
    debugSimulateWeek() {
        console.log('🚀 Simulating a week of varied habit completion...');
        
        // Go back 7 days
        const startDate = new Date(this.currentDate);
        startDate.setDate(startDate.getDate() - 6);
        
        const habitIds = Object.keys(this.habits);
        
        for (let i = 0; i < 7; i++) {
            const testDate = new Date(startDate);
            testDate.setDate(startDate.getDate() + i);
            const dateKey = this.formatDate(testDate);
            
            // Simulate different completion rates
            const completionRate = 0.4 + Math.random() * 0.6; // 40-100% completion
            const habitsToComplete = Math.floor(habitIds.length * completionRate);
            
            const dayData = this.getDailyData(dateKey);
            dayData.completed = habitIds.slice(0, habitsToComplete);
            
            console.log(`📅 ${dateKey}: Completed ${habitsToComplete}/${habitIds.length} habits`);
        }
        
        this.calculateStreaksAndStats();
        this.saveToStorage();
        this.updateDisplay();
        
        console.log('✅ Week simulation complete!');
        this.debugShowStatus();
    }
    
    debugResetData() {
        if (confirm('⚠️ This will reset ALL data. Are you sure?')) {
            console.log('🗑️ Resetting all data...');
            this.resetData();
            location.reload();
        }
    }
    
    updateDisplay() {
        this.updateSectionContent(this.currentSection);
    }

    // ============ SIMPLE DAY SKIP FOR TESTING ============
    skipDay() {
        // Simulate a real day passing by advancing currentDate
        this.currentDate.setDate(this.currentDate.getDate() + 1);
        
        // Update lastCheck to the new "current" time to prevent auto-advance
        this.user.lastCheck = new Date(this.currentDate).toISOString();
        
        // Recalculate everything as if a real day passed
        this.calculateStreaksAndStats();
        this.saveToStorage();
        this.updateDisplay();
        
        // Force update the date display to show "Today" if we're now on real today
        this.updateCurrentDate();
    }
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.doppelgangerApp = new DoppelgangerApp();
    window.app = window.doppelgangerApp;
});

// Add CSS for dynamic elements
const style = document.createElement('style');
style.textContent = `
    .habit-quick-item {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem;
        margin-bottom: 0.25rem;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 8px;
        font-size: 0.9rem;
        transition: all 0.3s ease;
    }
    
    .habit-quick-item.completed {
        background: rgba(0, 255, 136, 0.1);
        border-left: 3px solid var(--accent-green);
    }
    
    .habit-quick-item .habit-icon {
        font-size: 1.2rem;
        min-width: 1.5rem;
    }
    
    .habit-quick-item .habit-name {
        flex: 1;
        font-size: 0.8rem;
    }
    
    .habit-quick-item .habit-status {
        font-size: 1rem;
    }
    
    .leaderboard-item {
        display: flex;
        align-items: center;
        gap: 1rem;
        padding: 1rem;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 10px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        margin-bottom: 0.5rem;
        transition: all 0.3s ease;
    }
    
    .leaderboard-item.current-team {
        border-color: var(--accent-blue);
        box-shadow: var(--glow-blue);
    }
    
    .leaderboard-item:hover {
        transform: translateY(-2px);
    }
    
    .team-rank {
        font-weight: 700;
        font-size: 1.2rem;
        color: var(--accent-gold);
        min-width: 3rem;
    }
    
    .team-name {
        flex: 1;
        font-weight: 600;
    }
    
    .team-score {
        color: var(--accent-blue);
        font-weight: 700;
    }
    
    .no-team {
        text-align: center;
        color: var(--text-secondary);
        font-style: italic;
        padding: 2rem;
    }
    
    .history-item .history-result.Victory {
        color: var(--accent-green);
        font-weight: 700;
    }
    
    .history-item .history-result.Defeat {
        color: var(--accent-red);
        font-weight: 700;
    }
    
    .current-tier.bronze { color: var(--bronze); }
    .current-tier.silver { color: var(--silver); }
    .current-tier.gold { color: var(--gold); }
    .current-tier.platinum { color: var(--platinum); }
    .current-tier.diamond { color: var(--diamond); }
`;
document.head.appendChild(style);