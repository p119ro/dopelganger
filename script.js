// Doppelganger App - Main JavaScript

class DoppelgangerApp {
    constructor() {
        this.habits = {
            reading: { name: 'Read 30 minutes', points: 10, icon: '📚', streak: 0, completed: false },
            screentime: { name: 'Screen time <2 hours', points: 10, icon: '📵', streak: 0, completed: false },
            gym: { name: 'Gym session', points: 15, icon: '💪', streak: 0, completed: false },
            sleep: { name: 'Sleep 7-9 hours', points: 10, icon: '😴', streak: 0, completed: false },
            deepwork: { name: '90 min deep work', points: 15, icon: '🎯', streak: 0, completed: false },
            cardio: { name: '20 min cardio', points: 10, icon: '🏃‍♂️', streak: 0, completed: false },
            meditation: { name: 'Meditate 10 min', points: 5, icon: '🧘', streak: 0, completed: false },
            coldshower: { name: 'Cold shower', points: 5, icon: '❄️', streak: 0, completed: false },
            nutrition: { name: 'No sugar/processed food', points: 15, icon: '🍽️', streak: 0, completed: false }
        };

        this.user = {
            name: 'Player',
            level: 1,
            experience: 0,
            totalPoints: 0,
            monthlyPoints: 0,
            currentStreak: 0,
            tier: 'bronze',
            avatar: {
                strength: 100,
                glow: 0,
                aura: 0
            }
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
            multiplier: 0.90
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
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.updateDisplay();
        this.startTimers();
        this.loadInitialData();
    }

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

    toggleHabit(habitId, completed) {
        if (!this.habits[habitId]) return;

        const habit = this.habits[habitId];
        const wasCompleted = habit.completed;
        habit.completed = completed;

        if (completed && !wasCompleted) {
            // Habit completed
            habit.streak += 1;
            this.user.experience += habit.points;
            this.user.totalPoints += habit.points;
            this.user.monthlyPoints += habit.points;
            
            // Update avatar strength
            this.user.avatar.strength += 2;
            
            // Reduce doppelganger influence
            this.doppelganger.influence = Math.max(0, this.doppelganger.influence - 3);
            
        } else if (!completed && wasCompleted) {
            // Habit uncompleted
            this.user.experience = Math.max(0, this.user.experience - habit.points);
            this.user.totalPoints = Math.max(0, this.user.totalPoints - habit.points);
            this.user.monthlyPoints = Math.max(0, this.user.monthlyPoints - habit.points);
            
            // Reduce avatar strength
            this.user.avatar.strength = Math.max(50, this.user.avatar.strength - 2);
            
            // Increase doppelganger influence
            this.doppelganger.influence = Math.min(100, this.doppelganger.influence + 5);
        }

        this.updateHabitCard(habitId);
        this.updateDailySummary();
        this.updateAvatarSystem();
        this.updateTierProgression();
        this.checkAchievements();
        this.updateQuickStats();
    }

    updateHabitCard(habitId) {
        const habit = this.habits[habitId];
        const card = document.querySelector(`[data-habit="${habitId}"]`);
        const checkbox = document.getElementById(`${habitId}-checkbox`);
        const streakElement = document.getElementById(`${habitId}-streak`);
        const progressElement = document.getElementById(`${habitId}-progress`);

        if (!card) return;

        checkbox.checked = habit.completed;
        streakElement.textContent = habit.streak;

        // Update card appearance
        if (habit.completed) {
            card.classList.add('completed');
        } else {
            card.classList.remove('completed');
        }

        // Update progress bar (based on streak)
        const progressWidth = Math.min(100, (habit.streak / 30) * 100);
        progressElement.style.width = `${progressWidth}%`;
    }

    updateDailySummary() {
        const completedHabits = Object.values(this.habits).filter(h => h.completed).length;
        const totalHabits = Object.keys(this.habits).length;
        const basePoints = Object.values(this.habits)
            .filter(h => h.completed)
            .reduce((sum, h) => sum + h.points, 0);
        
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
        const completedHabits = Object.values(this.habits).filter(h => h.completed).length;
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

        // Update avatar info
        document.getElementById('avatarLevel').textContent = `Level ${this.user.level}`;
        document.getElementById('avatarExp').textContent = `${this.user.experience % 100} / 100 XP`;
        document.getElementById('doppelgangerLevel').textContent = `Level ${this.doppelganger.level}`;
        document.getElementById('doppelgangerPower').textContent = `${Math.round(this.doppelganger.influence)}% Influence`;

        // Level up check
        if (this.user.experience >= this.user.level * 100) {
            this.levelUp();
        }
    }

    levelUp() {
        this.user.level += 1;
        this.user.experience = this.user.experience % 100;
        
        // Show level up animation (you could add a modal or notification here)
        console.log(`Level up! You are now level ${this.user.level}`);
        
        // Increase avatar base strength
        this.user.avatar.strength += 10;
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
        // Calculate current streak
        const allCompleted = Object.values(this.habits).every(h => h.completed);
        if (allCompleted) {
            this.user.currentStreak += 1;
        }

        document.getElementById('currentStreak').textContent = this.user.currentStreak;
        document.getElementById('monthlyPoints').textContent = this.user.monthlyPoints;
        document.getElementById('dailyScore').textContent = `${this.calculateDailyScore()} pts`;
    }

    calculateDailyScore() {
        const basePoints = Object.values(this.habits)
            .filter(h => h.completed)
            .reduce((sum, h) => sum + h.points, 0);
        return Math.round(basePoints * this.team.multiplier);
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

        Object.entries(this.habits).forEach(([id, habit]) => {
            const item = document.createElement('div');
            item.className = `habit-quick-item ${habit.completed ? 'completed' : ''}`;
            item.innerHTML = `
                <span class="habit-icon">${habit.icon}</span>
                <span class="habit-name">${habit.name}</span>
                <span class="habit-status">${habit.completed ? '✅' : '⭕'}</span>
            `;
            quickList.appendChild(item);
        });
    }

    updateHabitsSection() {
        Object.keys(this.habits).forEach(habitId => {
            this.updateHabitCard(habitId);
        });
        this.updateDailySummary();
        this.updateCurrentDate();
    }

    updateCurrentDate() {
        const options = { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        };
        const today = new Date();
        const isToday = this.currentDate.toDateString() === today.toDateString();
        
        document.getElementById('currentDate').textContent = isToday ? 
            'Today' : 
            this.currentDate.toLocaleDateString('en-US', options);
    }

    changeDate(direction) {
        const newDate = new Date(this.currentDate);
        newDate.setDate(newDate.getDate() + direction);
        
        // Don't allow future dates
        if (newDate > new Date()) return;
        
        this.currentDate = newDate;
        this.updateCurrentDate();
        // In a real app, you'd load data for this date
    }

    updateTeamSection() {
        this.updateTeamStats();
        this.updateTeamMembers();
        this.updateTeamLeaderboard();
    }

    updateTeamStats() {
        // Simulate team score calculation
        this.team.dailyScore = Math.min(this.team.maxScore, 
            this.calculateDailyScore() + Math.floor(Math.random() * 400));

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
            this.team.multiplier = 0.90;
        }

        document.getElementById('teamGrade').textContent = this.team.grade;
        document.getElementById('teamMultiplier').textContent = `×${this.team.multiplier.toFixed(2)}`;
    }

    updateTeamMembers() {
        const memberSlots = document.querySelectorAll('.member-slot');
        
        // If no team, show empty slots
        if (!this.team.id) {
            memberSlots.forEach((slot, index) => {
                slot.classList.add('empty');
                slot.querySelector('.member-name').textContent = 'Empty Slot';
                slot.querySelector('.member-score').textContent = '--';
            });
            return;
        }

        // Show team members (simulated for demo)
        const demoMembers = [
            { name: 'You', score: this.calculateDailyScore() },
            { name: 'Alex_Warrior', score: 85 },
            { name: 'ZenMaster_42', score: 78 },
            { name: 'IronWill_23', score: 92 }
        ];

        memberSlots.forEach((slot, index) => {
            if (index < demoMembers.length) {
                slot.classList.remove('empty');
                slot.querySelector('.member-name').textContent = demoMembers[index].name;
                slot.querySelector('.member-score').textContent = `${demoMembers[index].score} pts`;
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

        // Simulated leaderboard data
        const teams = [
            { name: 'Elite Squad', score: 2340, rank: 1 },
            { name: 'Habit Hackers', score: 2180, rank: 2 },
            { name: 'Your Team', score: this.team.dailyScore * 7, rank: 3 },
            { name: 'Morning Warriors', score: 1950, rank: 4 },
            { name: 'Discipline Devils', score: 1890, rank: 5 }
        ];

        leaderboard.innerHTML = teams.map(team => `
            <div class="leaderboard-item ${team.name === 'Your Team' ? 'current-team' : ''}">
                <div class="team-rank">#${team.rank}</div>
                <div class="team-name">${team.name}</div>
                <div class="team-score">${team.score} pts</div>
            </div>
        `).join('');
    }

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

        // Simulate team creation
        this.team.id = 'team_' + Date.now();
        this.team.name = teamName;
        this.team.members = [{ name: 'You', score: 0 }];

        // Mark team player achievement
        this.achievements['team-player'] = true;

        this.hideTeamModal();
        this.updateTeamSection();
        alert(`Team "${teamName}" created successfully!`);
    }

    joinTeam() {
        const teamCode = document.getElementById('teamCode').value.trim();

        if (!teamCode) {
            alert('Please enter a team code');
            return;
        }

        // Simulate joining team
        this.team.id = teamCode;
        this.team.name = 'Joined Team';
        this.team.members = [{ name: 'You', score: 0 }];

        // Mark team player achievement
        this.achievements['team-player'] = true;

        this.hideTeamModal();
        this.updateTeamSection();
        alert('Successfully joined team!');
    }

    updateProgressSection() {
        this.updateTierProgression();
        this.updateCharts();
        this.updateAchievements();
    }

    updateCharts() {
        // Placeholder for chart updates
        // In a real implementation, you'd use a charting library like Chart.js
        const pointsChart = document.querySelector('#pointsChart canvas');
        const habitsChart = document.querySelector('#habitsChart canvas');
        
        if (pointsChart && habitsChart) {
            const ctx1 = pointsChart.getContext('2d');
            const ctx2 = habitsChart.getContext('2d');
            
            // Simple placeholder visualization
            ctx1.clearRect(0, 0, pointsChart.width, pointsChart.height);
            ctx1.fillStyle = '#00d4ff';
            ctx1.fillText('Points Chart - Coming Soon', 150, 100);
            
            ctx2.clearRect(0, 0, habitsChart.width, habitsChart.height);
            ctx2.fillStyle = '#00ff88';
            ctx2.fillText('Habits Chart - Coming Soon', 150, 100);
        }
    }

    switchProgressFilter(period) {
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-period="${period}"]`).classList.add('active');
        
        // Update charts based on period
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
        const allCompleted = Object.values(this.habits).every(h => h.completed);
        if (allCompleted) {
            this.achievements['perfect-day'] = true;
        }

        // Streak Master
        if (this.user.currentStreak >= 30) {
            this.achievements['streak-master'] = true;
        }

        // Top Performer (simulated)
        if (this.user.monthlyPoints > 5000) {
            this.achievements['top-performer'] = true;
        }
    }

    updateBattleSection() {
        this.updateBattleTimer();
        this.updateBattleArena();
        this.updateBattleHistory();
    }

    updateBattleTimer() {
        // Calculate time until next Monday
        const now = new Date();
        const nextMonday = new Date();
        nextMonday.setDate(now.getDate() + (1 + 7 - now.getDay()) % 7);
        nextMonday.setHours(0, 0, 0, 0);

        const timeUntil = nextMonday.getTime() - now.getTime();
        const days = Math.floor(timeUntil / (1000 * 60 * 60 * 24));
        const hours = Math.floor((timeUntil % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((timeUntil % (1000 * 60 * 60)) / (1000 * 60));

        document.getElementById('battleTimer').textContent = 
            `${days}d ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`;
    }

    updateBattleArena() {
        const avatarPower = this.user.avatar.strength + (this.user.level * 10);
        const shadowPower = this.doppelganger.strength + this.doppelganger.influence;

        document.getElementById('avatarPower').textContent = `Power: ${Math.round(avatarPower)}`;
        document.getElementById('shadowPower').textContent = `Power: ${Math.round(shadowPower)}`;

        // Update battle status
        if (this.battle.active) {
            document.getElementById('battleStatus').textContent = 'Battle In Progress';
            document.getElementById('battleRound').textContent = `Round ${this.battle.round}/${this.battle.maxRounds}`;
        } else {
            document.getElementById('battleStatus').textContent = 'Preparing for Battle';
            document.getElementById('battleRound').textContent = 'Waiting...';
        }

        // Update health bars
        document.getElementById('avatarHealth').textContent = `${this.battle.playerHealth}%`;
        document.getElementById('doppelgangerHealth').textContent = `${this.battle.doppelgangerHealth}%`;
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

    startTimers() {
        // Update battle timer every minute
        setInterval(() => {
            if (this.currentSection === 'battle') {
                this.updateBattleTimer();
            }
        }, 60000);

        // Daily reset check
        setInterval(() => {
            this.checkDailyReset();
        }, 60000 * 60); // Check every hour
    }

    checkDailyReset() {
        const now = new Date();
        const lastReset = new Date(this.currentDate);
        
        if (now.getDate() !== lastReset.getDate()) {
            this.performDailyReset();
        }
    }

    performDailyReset() {
        // Reset daily habits
        Object.keys(this.habits).forEach(habitId => {
            if (!this.habits[habitId].completed) {
                // Missed habit - break streak and strengthen doppelganger
                this.habits[habitId].streak = 0;
                this.doppelganger.influence += 5;
                this.doppelganger.strength += 2;
            }
            this.habits[habitId].completed = false;
        });

        // Update current date
        this.currentDate = new Date();
        
        // Update display
        this.updateDisplay();
    }

    updateDisplay() {
        this.updateSectionContent(this.currentSection);
    }

    loadInitialData() {
        // In a real app, this would load from a backend
        // For demo, we'll simulate some initial data
        
        // Simulate some streak data
        this.habits.reading.streak = 3;
        this.habits.gym.streak = 5;
        this.habits.meditation.streak = 2;
        
        // Set some initial points
        this.user.monthlyPoints = 450;
        this.user.currentStreak = 3;
        
        // Initial display update
        this.updateDisplay();
    }

    // Utility method to simulate team data
    simulateTeamData() {
        if (this.team.id) {
            // Simulate other team members' daily scores
            const memberScores = [
                Math.floor(Math.random() * 95) + 50,
                Math.floor(Math.random() * 95) + 50,
                Math.floor(Math.random() * 95) + 50,
                Math.floor(Math.random() * 95) + 50
            ];
            
            this.team.dailyScore = this.calculateDailyScore() + 
                memberScores.reduce((sum, score) => sum + score, 0);
        }
    }
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.doppelgangerApp = new DoppelgangerApp();
});

// Add some CSS for dynamic elements
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