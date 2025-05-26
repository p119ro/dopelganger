// Doppelganger App - Complete Enhanced Power System with Tier-based Punishment

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
            powerPoints: 0, // Accumulated power from completed habits
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
            powerPoints: 0 // Accumulated power from missed habits
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
        this.viewingDate = new Date(); // Track what date we're currently viewing
        this.currentSection = 'dashboard';
        
        // Data structure: { 'YYYY-MM-DD': { habits: {}, completed: [], points: 0, processed: false } }
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
        this.calculateStreaksAndStats();
        this.updateDisplay();
        this.startTimers();
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
            currentDate: this.currentDate.toISOString(),
            viewingDate: this.viewingDate.toISOString()
        };
        
        try {
            const compressed = JSON.stringify(data);
            localStorage.setItem('doppelganger_data', compressed);
        } catch (error) {
            console.error('Failed to save data:', error);
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
                
                // Restore currentDate and viewingDate
                if (data.currentDate) {
                    this.currentDate = new Date(data.currentDate);
                    this.viewingDate = new Date(data.currentDate); // Start viewing current app date
                } else {
                    this.currentDate = new Date();
                    this.viewingDate = new Date();
                }
                
                // Ensure backward compatibility
                if (this.user.powerPoints === undefined) {
                    this.user.powerPoints = 0;
                }
                if (this.doppelganger.powerPoints === undefined) {
                    this.doppelganger.powerPoints = 0;
                }
                
            } else {
                this.currentDate = new Date();
            }
            
        } catch (error) {
            console.error('Failed to load data:', error);
            this.resetData();
        }
    }

    resetData() {
        localStorage.removeItem('doppelganger_data');
        this.dailyData = {};
        this.currentDate = new Date();
        this.user.isFirstTime = true;
        this.user.powerPoints = 0;
        this.doppelganger.powerPoints = 0;
        this.saveToStorage();
    }

    // ============ DATE MANAGEMENT ============
    formatDate(date) {
        return date.toISOString().split('T')[0]; // YYYY-MM-DD format
    }

    getCurrentDateKey() {
        return this.formatDate(this.viewingDate); // Use viewingDate for UI
    }

    getDailyData(dateKey) {
        if (!this.dailyData[dateKey]) {
            this.dailyData[dateKey] = {
                habits: {},
                completed: [],
                points: 0,
                timestamp: Date.now(),
                processed: false, // Track if missed habits have been processed for doppelganger
                punishmentProcessed: false // Track if punishment for missed habits has been applied
            };
        }
        return this.dailyData[dateKey];
    }

    // ============ TIER SYSTEM ============
    getCurrentTier() {
        // Tier based on current total points (can go up or down)
        const total = this.user.totalPoints;
        
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
        // Punishment multipliers for missed habits
        switch(tierName) {
            case 'bronze': return 0;    // No punishment
            case 'silver': return 0.5;  // 0.5x missed points
            case 'gold': return 1;      // 1x missed points  
            case 'platinum': return 2;  // 2x missed points
            case 'diamond': return 3;   // 3x missed points
            case 'goggins': return 4;   // 4x missed points
            default: return 0;
        }
    }

    applyPreviousDayPunishment() {
        // Apply punishment for ALL previous unprocessed days
        const today = new Date(this.currentDate);
        const allDates = Object.keys(this.dailyData).sort();
        
        for (const dateKey of allDates) {
            const dayData = this.dailyData[dateKey];
            const dayDate = new Date(dateKey);
            const daysDifference = Math.floor((today - dayDate) / (1000 * 60 * 60 * 24));
            
            // Only process past days that haven't been processed yet
            if (daysDifference > 0 && !dayData.punishmentProcessed) {
                const completedHabits = dayData.completed || [];
                const totalHabits = Object.keys(this.habits);
                const missedHabits = totalHabits.filter(habitId => !completedHabits.includes(habitId));
                
                if (missedHabits.length > 0) {
                    // Calculate missed points
                    const missedPoints = missedHabits.reduce((sum, habitId) => {
                        const habit = this.habits[habitId];
                        return sum + (habit ? habit.points : 0);
                    }, 0);
                    
                    // Get tier when the missed day occurred (for punishment calculation)
                    const tierAtTime = this.getCurrentTier(); // Use current tier for simplicity
                    const multiplier = this.getTierMultiplier(tierAtTime);
                    const punishmentPoints = missedPoints * multiplier;
                    
                    if (punishmentPoints > 0) {
                        this.user.totalPoints -= punishmentPoints;
                        console.log(`💀 PUNISHMENT: Lost ${punishmentPoints} points for missing ${missedHabits.length} habits on ${dateKey} (${tierAtTime} tier, ${multiplier}x multiplier)`);
                    }
                }
                
                // Mark as processed
                dayData.punishmentProcessed = true;
            }
        }
    }

    // ============ POWER SYSTEM ============
    processMissedHabits(dateKey) {
        const dayData = this.getDailyData(dateKey);
        
        // Skip if already processed or if it's today (since day isn't over)
        if (dayData.processed || dateKey === this.formatDate(this.currentDate)) {
            return;
        }
        
        const completedHabits = dayData.completed || [];
        const totalHabits = Object.keys(this.habits);
        
        // Find missed habits
        const missedHabits = totalHabits.filter(habitId => !completedHabits.includes(habitId));
        
        // Award doppelganger power for each missed habit
        missedHabits.forEach(habitId => {
            const habit = this.habits[habitId];
            if (habit) {
                this.doppelganger.powerPoints += habit.points;
                console.log(`🌑 Doppelganger gained ${habit.points} power from missed habit: ${habit.name} on ${dateKey}`);
            }
        });
        
        // Mark as processed
        dayData.processed = true;
        
        if (missedHabits.length > 0) {
            console.log(`💀 Doppelganger gained ${missedHabits.reduce((sum, id) => sum + this.habits[id].points, 0)} total power from ${missedHabits.length} missed habits on ${dateKey}`);
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
        const today = new Date(this.currentDate);
        const todayKey = this.formatDate(today);
        
        // Reset totals
        this.user.totalPoints = 0;
        this.user.monthlyPoints = 0;
        this.user.powerPoints = 0; // Reset and recalculate
        this.doppelganger.powerPoints = 0; // Reset and recalculate
        
        // Get all dates and sort them
        const allDates = Object.keys(this.dailyData).sort();
        
        // First pass: Calculate all completed points normally (no punishment yet)
        for (const dateKey of allDates) {
            const data = this.dailyData[dateKey];
            const dayDate = new Date(dateKey);
            const daysDifference = Math.floor((today - dayDate) / (1000 * 60 * 60 * 24));
            
            if (data && data.completed) {
                // Calculate completed habit points (earned normally)
                const dayPoints = data.completed.reduce((sum, habitId) => {
                    const habit = this.habits[habitId];
                    return habit ? sum + habit.points : sum;
                }, 0);
                
                // Add points to user power and totals
                this.user.powerPoints += dayPoints;
                this.user.totalPoints += dayPoints;
                
                // Monthly points (last 30 days from currentDate)
                if (daysDifference <= 30 && daysDifference >= 0) {
                    this.user.monthlyPoints += dayPoints;
                }
            }
            
            // Process missed habits for doppelganger power (days in the past)
            if (daysDifference > 0) {
                this.processMissedHabits(dateKey);
            }
        }
        
        // Second pass: Apply punishment for previous missed days
        this.applyPreviousDayPunishment();

        // Calculate experience and level
        this.user.experience = Math.max(0, this.user.totalPoints);
        this.calculateLevel();

        // Calculate streaks for each habit
        Object.keys(this.habits).forEach(habitId => {
            this.habits[habitId].streak = this.calculateHabitStreak(habitId);
        });

        // Calculate current overall streak
        this.user.currentStreak = this.calculateOverallStreak();
        
        // Update tier based on current total points
        this.user.tier = this.getCurrentTier();
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
        const today = new Date(this.currentDate);
        let streak = 0;
        
        // Check if today's habit is completed
        const todayKey = this.formatDate(today);
        const todayData = this.dailyData[todayKey];
        const todayCompleted = todayData && todayData.completed && todayData.completed.includes(habitId);
        
        // If today is completed, start counting from today
        if (todayCompleted) {
            streak = 1;
            
            // Count backwards from yesterday
            for (let i = -1; i >= -365; i--) {
                const checkDate = new Date(today);
                checkDate.setDate(today.getDate() + i);
                const dateKey = this.formatDate(checkDate);
                const dayData = this.dailyData[dateKey];
                
                if (dayData && dayData.completed && dayData.completed.includes(habitId)) {
                    streak++;
                } else {
                    // Gap found, stop counting
                    break;
                }
            }
        } else {
            // Today not completed, check if there's a streak ending yesterday
            for (let i = -1; i >= -365; i--) {
                const checkDate = new Date(today);
                checkDate.setDate(today.getDate() + i);
                const dateKey = this.formatDate(checkDate);
                const dayData = this.dailyData[dateKey];
                
                if (dayData && dayData.completed && dayData.completed.includes(habitId)) {
                    streak++;
                } else {
                    // Gap found or no more days, stop counting
                    break;
                }
            }
        }
        
        return streak;
    }

    calculateOverallStreak() {
        const today = new Date(this.currentDate);
        let streak = 0;
        
        // Check if today meets the criteria (70% completion)
        const todayKey = this.formatDate(today);
        const todayData = this.dailyData[todayKey];
        const totalHabits = Object.keys(this.habits).length;
        const todayCompleted = todayData && todayData.completed ? todayData.completed.length : 0;
        const todayMeetsCriteria = todayCompleted >= Math.ceil(totalHabits * 0.7);
        
        // If today meets criteria, start counting from today
        if (todayMeetsCriteria) {
            streak = 1;
            
            // Count backwards from yesterday
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
                        // Gap found, stop counting
                        break;
                    }
                } else {
                    // No data or gap found, stop counting
                    break;
                }
            }
        } else {
            // Today doesn't meet criteria, check if there's a streak ending yesterday
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
                        // Gap found, stop counting
                        break;
                    }
                } else {
                    // No data or gap found, stop counting
                    break;
                }
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
            // Habit completed - recalculate everything to apply tier punishment
            dayData.completed.push(habitId);
            
            console.log(`✅ Completed: ${habit.name}`);
            
        } else if (!completed && wasCompleted) {
            // Habit uncompleted - recalculate everything
            dayData.completed = dayData.completed.filter(id => id !== habitId);
            
            console.log(`❌ Uncompleted: ${habit.name}`);
        }

        // Recalculate everything
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
        const newDate = new Date(this.viewingDate);
        newDate.setDate(newDate.getDate() + direction);
        
        // Don't allow future dates beyond the current app date
        if (newDate > this.currentDate) return;
        
        this.viewingDate = newDate;
        this.saveToStorage(); // Save the new viewing date
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
        
        // Show "Today" when viewing the current app date
        const isAppToday = this.viewingDate.getDate() === this.currentDate.getDate() &&
                          this.viewingDate.getMonth() === this.currentDate.getMonth() &&
                          this.viewingDate.getFullYear() === this.currentDate.getFullYear();
        
        document.getElementById('currentDate').textContent = isAppToday ? 
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
        
        // Calculate points for this specific day (earned normally, no punishment applied today)
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

        // Show warning about tomorrow's punishment if in higher tier
        const tier = this.getCurrentTier();
        const missedHabits = totalHabits - completedHabits;
        if (tier !== 'bronze' && missedHabits > 0) {
            const missedPoints = Object.keys(this.habits).filter(habitId => 
                !dayData.completed || !dayData.completed.includes(habitId)
            ).reduce((sum, habitId) => {
                const habit = this.habits[habitId];
                return sum + (habit ? habit.points : 0);
            }, 0);
            
            const multiplier = this.getTierMultiplier(tier);
            const tomorrowPunishment = missedPoints * multiplier;
            
            if (tomorrowPunishment > 0) {
                const warningElement = document.getElementById('pointsEarned');
                warningElement.innerHTML = `${basePoints} <span style="color: var(--accent-red); font-size: 0.8rem;">(-${tomorrowPunishment} tomorrow)</span>`;
            }
        }

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

        // Update avatar glow and aura based on today's completion
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

        // Update doppelganger corruption based on today's missed habits
        const doppelgangerShadow = document.getElementById('doppelgangerShadow');
        const doppelgangerCorruption = document.getElementById('doppelgangerCorruption');
        
        const missedHabits = totalHabits - completedHabits;
        const corruptionLevel = missedHabits / totalHabits;
        
        doppelgangerShadow.style.opacity = Math.min(1, corruptionLevel + 0.3);
        doppelgangerCorruption.style.opacity = corruptionLevel;

        // Update power balance meter using TOTAL ACCUMULATED POWER
        const powerBalance = this.calculatePowerBalance();
        const strengthMeter = document.getElementById('strengthMeter');
        const meterBar = strengthMeter.parentElement;
        
        // Avatar is on LEFT, Doppelganger is on RIGHT
        // So meter fill should represent USER power from left
        strengthMeter.style.width = `${powerBalance.userPercentage}%`;
        strengthMeter.style.background = 'var(--avatar-gradient)';
        strengthMeter.style.display = 'block';
        
        // Set the background of the meter bar to show doppelganger color
        meterBar.style.background = 'var(--doppelganger-gradient)';

        // Update avatar info
        const userName = this.user.name || 'Your Avatar';
        document.querySelector('.avatar-info h3').textContent = userName;
        document.getElementById('avatarLevel').textContent = `Level ${this.user.level}`;
        
        const currentXP = this.user.currentLevelXP !== undefined ? this.user.currentLevelXP : (this.user.experience % 100);
        const neededXP = this.user.nextLevelXP || 100;
        document.getElementById('avatarExp').textContent = `${currentXP} / ${neededXP} XP`;
        
        // Update doppelganger info
        this.doppelganger.level = Math.max(1, Math.floor(this.doppelganger.powerPoints / 100) + 1);
        document.getElementById('doppelgangerLevel').textContent = `Level ${this.doppelganger.level}`;
        document.getElementById('doppelgangerPower').textContent = `${powerBalance.doppelgangerPercentage}% Influence`;
        
        // Update meter labels to match visual layout
        // Avatar is on LEFT, Doppelganger is on RIGHT
        const meterLabels = document.querySelector('.meter-labels');
        if (meterLabels) {
            meterLabels.innerHTML = `
                <span>You: ${Math.round(powerBalance.userPower)} (${powerBalance.userPercentage}%)</span>
                <span>Shadow: ${Math.round(powerBalance.doppelgangerPower)} (${powerBalance.doppelgangerPercentage}%)</span>
            `;
        }
        
        console.log(`⚡ Power Balance - You: ${Math.round(powerBalance.userPower)} (${powerBalance.userPercentage}%) | Shadow: ${Math.round(powerBalance.doppelgangerPower)} (${powerBalance.doppelgangerPercentage}%)`);
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
        
        // Update tier display in header
        document.getElementById('currentTier').textContent = currentTier.charAt(0).toUpperCase() + currentTier.slice(1);
        document.getElementById('currentTier').className = `current-tier ${currentTier}`;

        // Calculate progress toward next tier
        const currentTierData = tiers.find(t => t.name === currentTier);
        const nextTierData = tiers[tiers.findIndex(t => t.name === currentTier) + 1];
        
        if (nextTierData) {
            const progress = ((this.user.totalPoints - currentTierData.min) / (nextTierData.min - currentTierData.min)) * 100;
            const progressClamped = Math.max(0, Math.min(100, progress));
            document.getElementById('tierProgress').textContent = `${Math.round(progressClamped)}%`;
        } else {
            document.getElementById('tierProgress').textContent = '100%';
        }

        // Update tier ladder in progress section
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
                // Show points needed for locked tiers
                const tierData = tiers.find(t => t.name === tierName);
                const pointsNeeded = tierData.min - this.user.totalPoints;
                statusElement.textContent = pointsNeeded > 0 ? `${pointsNeeded} pts needed` : 'Locked';
            }
        });
    }

    updateQuickStats() {
        const dateKey = this.getCurrentDateKey();
        const dayData = this.getDailyData(dateKey);
        
        document.getElementById('currentStreak').textContent = this.user.currentStreak;
        document.getElementById('monthlyPoints').textContent = Math.round(this.user.monthlyPoints);
        // Show total accumulated points instead of just today's points
        document.getElementById('dailyScore').textContent = `${Math.round(this.user.totalPoints)} pts`;
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
                
                // Calculate points normally for charts (no tier punishment)
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
        
        // Battle status based on power balance
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
        setInterval(() => {
            if (this.currentSection === 'battle') {
                this.updateBattleTimer();
            }
        }, 1000);
    }

    // ============ SKIP DAY (DEBUG) ============
    skipDay() {
        console.log(`🕐 Skipping day...`);
        console.log(`📅 Before: ${this.formatDate(this.currentDate)}`);
        
        // Process missed habits for the current day before advancing
        const currentDateKey = this.formatDate(this.currentDate);
        this.processMissedHabits(currentDateKey);
        
        // Advance the current date by one day
        this.currentDate.setDate(this.currentDate.getDate() + 1);
        // Also update viewing date to the new current date
        this.viewingDate = new Date(this.currentDate);
        
        console.log(`📅 After: ${this.formatDate(this.currentDate)}`);
        
        // Recalculate everything with the new date
        this.calculateStreaksAndStats();
        this.saveToStorage();
        this.updateDisplay();
        
        const powerBalance = this.calculatePowerBalance();
        console.log(`✅ Day skipped! New stats calculated.`);
        console.log(`🔥 Current Streak: ${this.user.currentStreak}`);
        console.log(`⭐ Total XP: ${this.user.experience}`);
        console.log(`📈 Monthly Points: ${Math.round(this.user.monthlyPoints)}`);
        console.log(`💰 Total Points: ${Math.round(this.user.totalPoints)}`);
        console.log(`🏆 Current Tier: ${this.getCurrentTier().toUpperCase()}`);
        console.log(`⚔️ Tier Multiplier: ${this.getTierMultiplier(this.getCurrentTier())}x`);
        console.log(`⚡ Your Power: ${Math.round(powerBalance.userPower)} (${powerBalance.userPercentage}%)`);
        console.log(`🌑 Shadow Power: ${Math.round(powerBalance.doppelgangerPower)} (${powerBalance.doppelgangerPercentage}%)`);
        
        // Show current day's habit completion
        const todayKey = this.formatDate(this.currentDate);
        const todayData = this.getDailyData(todayKey);
        const completed = todayData.completed ? todayData.completed.length : 0;
        console.log(`📝 Today's Habits Completed: ${completed}/${Object.keys(this.habits).length}`);
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