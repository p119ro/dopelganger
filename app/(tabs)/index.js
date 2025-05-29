import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Modal,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

const { width, height } = Dimensions.get('window');

// Complete Doppelganger App with ALL features from web version
const DoppelgangerApp = () => {
  // ============ STATE MANAGEMENT ============
  const [currentSection, setCurrentSection] = useState('dashboard');
  const [viewingDate, setViewingDate] = useState(new Date());
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const [user, setUser] = useState({
    name: '',
    level: 1,
    experience: 0,
    totalPoints: 0,
    monthlyPoints: 0,
    tier: 'bronze',
    powerPoints: 0, // Cumulative power from completed habits
    currentStreak: 0,
    isFirstTime: true,
    currentLevelXP: 0,
    nextLevelXP: 100,
    avatar: {
      strength: 100,
      glow: 0,
      aura: 0
    }
  });

  const [doppelganger, setDoppelganger] = useState({
    level: 1,
    strength: 80,
    influence: 0,
    corruption: 0,
    powerPoints: 0 // Cumulative power from missed habits
  });

  const [team, setTeam] = useState({
    id: null,
    name: null,
    members: [],
    dailyScore: 0,
    maxScore: 500,
    grade: 'Poor',
    multiplier: 1.00
  });

  const [battle, setBattle] = useState({
    active: false,
    round: 1,
    maxRounds: 7,
    playerHealth: 100,
    doppelgangerHealth: 100,
    history: [],
    nextBattleTime: null,
    status: 'Preparing for Battle'
  });

  const [achievements, setAchievements] = useState({
    'first-week': false,
    'perfect-day': false,
    'streak-master': false,
    'team-player': false,
    'top-performer': false
  });

  const [dailyData, setDailyData] = useState({});
  const [showNameModal, setShowNameModal] = useState(false);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [teamModalTab, setTeamModalTab] = useState('create');
  const [tempName, setTempName] = useState('');
  const [tempTeamName, setTempTeamName] = useState('');
  const [tempTeamCode, setTempTeamCode] = useState('');
  const [battleTimer, setBattleTimer] = useState('--:--:--');
  const [progressFilter, setProgressFilter] = useState('daily');

  // Animation refs
  const avatarGlow = useRef(new Animated.Value(0)).current;
  const shadowGlow = useRef(new Animated.Value(0)).current;

  // ============ HABIT DEFINITIONS ============
  const habits = {
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

  // ============ STORAGE FUNCTIONS ============
  const saveToStorage = async () => {
    try {
      const data = {
        user,
        doppelganger,
        team,
        battle,
        achievements,
        dailyData,
        currentDate: currentDate.toISOString(),
        viewingDate: viewingDate.toISOString()
      };
      
      const compressed = JSON.stringify(data);
      await AsyncStorage.setItem('doppelganger_data', compressed);
    } catch (error) {
      console.error('Error saving data:', error);
    }
  };

  const loadFromStorage = async () => {
    try {
      const saved = await AsyncStorage.getItem('doppelganger_data');
      if (saved) {
        const data = JSON.parse(saved);
        
        // Update all state with loaded data
        if (data.user) {
          setUser(prevUser => ({ ...prevUser, ...data.user }));
        }
        if (data.doppelganger) {
          setDoppelganger(prevDoppelganger => ({ ...prevDoppelganger, ...data.doppelganger }));
        }
        if (data.team) {
          setTeam(prevTeam => ({ ...prevTeam, ...data.team }));
        }
        if (data.battle) {
          setBattle(prevBattle => ({ ...prevBattle, ...data.battle }));
        }
        if (data.achievements) {
          setAchievements(prevAchievements => ({ ...prevAchievements, ...data.achievements }));
        }
        if (data.dailyData) {
          setDailyData(data.dailyData);
        }
        
        if (data.currentDate) {
          setCurrentDate(new Date(data.currentDate));
        }
        if (data.viewingDate) {
          setViewingDate(new Date(data.viewingDate));
        } else if (data.currentDate) {
          setViewingDate(new Date(data.currentDate)); // Fallback to current date
        }
        
        // Return the loaded user data to check if it's first time
        return data.user || null;
      } else {
        return null; // No saved data
      }
    } catch (error) {
      console.error('Error loading data:', error);
      return null;
    }
  };

  const resetData = async () => {
    try {
      await AsyncStorage.removeItem('doppelganger_data');
      // Reset all state to initial values
      setUser({
        name: '',
        level: 1,
        experience: 0,
        totalPoints: 0,
        monthlyPoints: 0,
        tier: 'bronze',
        powerPoints: 0,
        currentStreak: 0,
        isFirstTime: true,
        currentLevelXP: 0,
        nextLevelXP: 100,
        avatar: {
          strength: 100,
          glow: 0,
          aura: 0
        }
      });
      setDoppelganger({
        level: 1,
        strength: 80,
        influence: 0,
        corruption: 0,
        powerPoints: 0
      });
      setTeam({
        id: null,
        name: null,
        members: [],
        dailyScore: 0,
        maxScore: 500,
        grade: 'Poor',
        multiplier: 1.00
      });
      setBattle({
        active: false,
        round: 1,
        maxRounds: 7,
        playerHealth: 100,
        doppelgangerHealth: 100,
        history: [],
        nextBattleTime: null,
        status: 'Preparing for Battle'
      });
      setAchievements({
        'first-week': false,
        'perfect-day': false,
        'streak-master': false,
        'team-player': false,
        'top-performer': false
      });
      setDailyData({});
      setCurrentDate(new Date());
      setViewingDate(new Date());
    } catch (error) {
      console.error('Error resetting data:', error);
    }
  };

  // ============ DEBUG FUNCTIONS ============
  const skipDay = () => {
    // Apply punishment for the current day before advancing
    const currentDateKey = formatDate(currentDate);
    applyDayEndPunishment(currentDateKey);
    
    // Advance the current date by one day
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + 1);
    setCurrentDate(newDate);
    setViewingDate(new Date(newDate)); // Also update viewing date to new day
    
    // Recalculate everything with the new date
    setTimeout(() => {
      calculateStreaksAndStats();
      saveToStorage();
    }, 100);
  };

  // Expose debug functions globally for testing
  if (__DEV__) {
    global.skipDay = skipDay;
    global.resetData = resetData;
    global.logData = () => console.log({ user, doppelganger, team, dailyData });
    global.checkPowerBalance = () => console.log(calculatePowerBalance());
    global.viewYesterday = () => changeDate(-1);
    global.viewToday = () => setViewingDate(new Date(currentDate));
  }

  // ============ UTILITY FUNCTIONS ============
  const formatDate = (date) => {
    return date.toISOString().split('T')[0];
  };

  const getCurrentDateKey = () => {
    return formatDate(viewingDate); // Use viewingDate, not currentDate
  };

  // ============ DATE NAVIGATION ============
  const changeDate = (direction) => {
    const newDate = new Date(viewingDate);
    newDate.setDate(newDate.getDate() + direction);
    
    if (newDate > currentDate) return; // Can't go to future
    
    setViewingDate(newDate);
    saveToStorage();
  };

  const updateCurrentDateDisplay = () => {
    const options = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    
    const isAppToday = viewingDate.getDate() === currentDate.getDate() &&
                      viewingDate.getMonth() === currentDate.getMonth() &&
                      viewingDate.getFullYear() === currentDate.getFullYear();
    
    return isAppToday ? 'Today' : viewingDate.toLocaleDateString('en-US', options);
  };

  const getDailyData = (dateKey) => {
    if (!dailyData[dateKey]) {
      const newData = {
        ...dailyData,
        [dateKey]: {
          habits: {},
          completed: [],
          points: 0,
          timestamp: Date.now(),
          punishmentApplied: false
        }
      };
      setDailyData(newData);
      return newData[dateKey];
    }
    return dailyData[dateKey];
  };

  // ============ TIER SYSTEM ============
  const getCurrentTier = () => {
    const total = user.powerPoints;
    if (total >= 15000) return 'goggins';
    if (total >= 7500) return 'diamond';
    if (total >= 5000) return 'platinum';
    if (total >= 2500) return 'gold';
    if (total >= 1000) return 'silver';
    return 'bronze';
  };

  const getTierLevel = (tierName) => {
    const levels = { bronze: 0, silver: 1, gold: 2, platinum: 3, diamond: 4, goggins: 5 };
    return levels[tierName] || 0;
  };

  const getTierMultiplier = (tierName) => {
    switch(tierName) {
      case 'bronze': return 0;
      case 'silver': return 0.5;
      case 'gold': return 1;
      case 'platinum': return 2;
      case 'diamond': return 3;
      case 'goggins': return 4;
      default: return 0;
    }
  };

  // ============ POWER SYSTEM WITH PUNISHMENT ============
  const applyDayEndPunishment = (dateKey) => {
    const dayData = getDailyData(dateKey);
    
    if (dayData.punishmentApplied) {
      return;
    }
    
    const totalHabits = Object.keys(habits);
    const missedHabits = totalHabits.filter(habitId => 
      !dayData.completed || !dayData.completed.includes(habitId)
    );
    
    const missedPoints = missedHabits.reduce((sum, habitId) => {
      const habit = habits[habitId];
      return sum + (habit ? habit.points : 0);
    }, 0);
    
    const currentTier = getCurrentTier();
    const multiplier = getTierMultiplier(currentTier);
    const punishment = Math.floor(missedPoints * multiplier);
    
    // Apply punishment (can go negative)
    setUser(prev => ({ ...prev, powerPoints: prev.powerPoints - punishment }));
    
    // Award doppelganger power for missed habits
    setDoppelganger(prev => ({ ...prev, powerPoints: prev.powerPoints + missedPoints }));
    
    const newData = { ...dailyData };
    newData[dateKey] = { ...dayData, punishmentApplied: true };
    setDailyData(newData);
    
    saveToStorage(); // Save after punishment applied
  };

  const processAllMissedDays = () => {
    const today = new Date(currentDate);
    const allDates = Object.keys(dailyData).sort();
    
    for (const dateKey of allDates) {
      const dayData = dailyData[dateKey];
      const dayDate = new Date(dateKey);
      const daysDifference = Math.floor((today - dayDate) / (1000 * 60 * 60 * 24));
      
      if (daysDifference > 0 && !dayData.punishmentApplied) {
        applyDayEndPunishment(dateKey);
      }
    }
  };

  const calculatePowerBalance = () => {
    const totalPower = user.powerPoints + doppelganger.powerPoints;
    
    if (totalPower === 0) {
      return {
        userPercentage: 50,
        doppelgangerPercentage: 50,
        userPower: 0,
        doppelgangerPower: 0
      };
    }
    
    const userPercentage = (user.powerPoints / totalPower) * 100;
    const doppelgangerPercentage = (doppelganger.powerPoints / totalPower) * 100;
    
    return {
      userPercentage: Math.round(userPercentage),
      doppelgangerPercentage: Math.round(doppelgangerPercentage),
      userPower: user.powerPoints,
      doppelgangerPower: doppelganger.powerPoints
    };
  };

  // ============ STREAK CALCULATIONS ============
  const calculateHabitStreak = (habitId) => {
    const today = new Date(currentDate);
    let streak = 0;
    
    const todayKey = formatDate(today);
    const todayData = dailyData[todayKey];
    const todayCompleted = todayData && todayData.completed && todayData.completed.includes(habitId);
    
    if (todayCompleted) {
      streak = 1;
      
      for (let i = -1; i >= -365; i--) {
        const checkDate = new Date(today);
        checkDate.setDate(today.getDate() + i);
        const dateKey = formatDate(checkDate);
        const dayData = dailyData[dateKey];
        
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
        const dateKey = formatDate(checkDate);
        const dayData = dailyData[dateKey];
        
        if (dayData && dayData.completed && dayData.completed.includes(habitId)) {
          streak++;
        } else {
          break;
        }
      }
    }
    
    return streak;
  };

  const calculateOverallStreak = () => {
    const today = new Date(currentDate);
    let streak = 0;
    
    const todayKey = formatDate(today);
    const todayData = dailyData[todayKey];
    const totalHabits = Object.keys(habits).length;
    const todayCompleted = todayData && todayData.completed ? todayData.completed.length : 0;
    const todayMeetsCriteria = todayCompleted >= Math.ceil(totalHabits * 0.7);
    
    if (todayMeetsCriteria) {
      streak = 1;
      
      for (let i = -1; i >= -365; i--) {
        const checkDate = new Date(today);
        checkDate.setDate(today.getDate() + i);
        const dateKey = formatDate(checkDate);
        const dayData = dailyData[dateKey];
        
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
        const dateKey = formatDate(checkDate);
        const dayData = dailyData[dateKey];
        
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
  };

  const calculateStreaksAndStats = () => {
    // Process any unprocessed past days
    processAllMissedDays();
    
    // Calculate monthly points from completed habits only
    let monthlyPoints = 0;
    const today = new Date(currentDate);
    const allDates = Object.keys(dailyData).sort();
    
    for (const dateKey of allDates) {
      const data = dailyData[dateKey];
      const dayDate = new Date(dateKey);
      const daysDifference = Math.floor((today - dayDate) / (1000 * 60 * 60 * 24));
      
      if (data && data.completed && daysDifference <= 30 && daysDifference >= 0) {
        const dayPoints = data.completed.reduce((sum, habitId) => {
          const habit = habits[habitId];
          return habit ? sum + habit.points : sum;
        }, 0);
        monthlyPoints += dayPoints;
      }
    }

    // Calculate experience and level based on powerPoints
    const experience = user.powerPoints;
    const positiveExp = Math.max(0, experience);
    const level = Math.floor(positiveExp / 100) + 1;
    const currentLevelXP = positiveExp % 100;

    const currentStreak = calculateOverallStreak();
    const tier = getCurrentTier();

    setUser(prev => ({
      ...prev,
      monthlyPoints,
      experience,
      level,
      currentLevelXP,
      nextLevelXP: 100,
      currentStreak,
      tier,
      totalPoints: user.powerPoints
    }));

    checkAchievements();
    updateBattleSystem();
    saveToStorage(); // Save after calculations
  };

  // ============ ACHIEVEMENTS SYSTEM ============
  const checkAchievements = () => {
    const newAchievements = { ...achievements };
    
    if (user.currentStreak >= 7) {
      newAchievements['first-week'] = true;
    }

    const todayKey = getCurrentDateKey();
    const todayData = getDailyData(todayKey);
    const totalHabits = Object.keys(habits).length;
    const completedToday = todayData.completed ? todayData.completed.length : 0;
    
    if (completedToday === totalHabits) {
      newAchievements['perfect-day'] = true;
    }

    if (user.currentStreak >= 30) {
      newAchievements['streak-master'] = true;
    }

    if (user.monthlyPoints > 5000) {
      newAchievements['top-performer'] = true;
    }

    if (team.id) {
      newAchievements['team-player'] = true;
    }

    setAchievements(newAchievements);
  };

  // ============ BATTLE SYSTEM ============
  const updateBattleSystem = () => {
    const powerBalance = calculatePowerBalance();
    const today = new Date(currentDate);
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay() + 1);
    
    let weeklyCompletion = 0;
    let daysChecked = 0;
    
    for (let i = 0; i < 7; i++) {
      const checkDate = new Date(startOfWeek);
      checkDate.setDate(startOfWeek.getDate() + i);
      
      if (checkDate <= today) {
        const dateKey = formatDate(checkDate);
        const dayData = dailyData[dateKey];
        const completed = dayData && dayData.completed ? dayData.completed.length : 0;
        const total = Object.keys(habits).length;
        weeklyCompletion += completed / total;
        daysChecked++;
      }
    }

    let status = 'Preparing for Battle';
    let playerHealth = 100;
    let doppelgangerHealth = 100;

    if (powerBalance.userPercentage >= 70) {
      status = 'Victory Imminent';
      playerHealth = 100;
      doppelgangerHealth = Math.max(10, 100 - powerBalance.userPercentage);
    } else if (powerBalance.userPercentage >= 50) {
      status = 'Fierce Battle';
      playerHealth = 50 + (powerBalance.userPercentage - 50) * 2;
      doppelgangerHealth = 50 + (powerBalance.doppelgangerPercentage - 50) * 2;
    } else {
      status = 'Shadow Winning';
      playerHealth = Math.max(10, powerBalance.userPercentage * 2);
      doppelgangerHealth = 100;
    }

    setBattle(prev => ({
      ...prev,
      status,
      playerHealth,
      doppelgangerHealth,
      round: Math.min(7, daysChecked)
    }));
  };

  const updateBattleTimer = () => {
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

    setBattleTimer(`${days}d ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
  };

  // ============ TEAM SYSTEM ============
  const updateTeamStats = () => {
    if (!team.id) {
      return;
    }

    const dateKey = getCurrentDateKey();
    const dayData = getDailyData(dateKey);
    const userScore = dayData.completed ? dayData.completed.reduce((sum, habitId) => {
      const habit = habits[habitId];
      return sum + (habit ? habit.points : 0);
    }, 0) : 0;
    
    const teamScore = userScore + 150; // Simulate other team members
    const newDailyScore = Math.min(team.maxScore, teamScore);

    let grade = '🔴 Poor';
    let multiplier = 0.95;

    if (newDailyScore >= 450) {
      grade = '🟢 Excellent';
      multiplier = 1.10;
    } else if (newDailyScore >= 400) {
      grade = '🟡 Good';
      multiplier = 1.05;
    } else if (newDailyScore >= 300) {
      grade = '🟠 Average';
      multiplier = 1.00;
    }

    setTeam(prev => ({
      ...prev,
      dailyScore: newDailyScore,
      grade,
      multiplier
    }));
  };

  // ============ HABIT MANAGEMENT ============
  const toggleHabit = (habitId, completed) => {
    if (!habits[habitId]) return;

    // Only allow editing current day
    const isCurrentDay = formatDate(viewingDate) === formatDate(currentDate);
    if (!isCurrentDay) {
      Alert.alert('Cannot Edit Past Days', 'You can only modify habits for today.');
      return;
    }

    const dateKey = getCurrentDateKey();
    const dayData = getDailyData(dateKey);
    
    const newDailyData = { ...dailyData };
    if (!newDailyData[dateKey].completed) {
      newDailyData[dateKey].completed = [];
    }

    const habit = habits[habitId];
    const wasCompleted = newDailyData[dateKey].completed.includes(habitId);

    if (completed && !wasCompleted) {
      newDailyData[dateKey].completed.push(habitId);
      setUser(prev => ({ ...prev, powerPoints: prev.powerPoints + habit.points }));
    } else if (!completed && wasCompleted) {
      newDailyData[dateKey].completed = newDailyData[dateKey].completed.filter(id => id !== habitId);
      setUser(prev => ({ ...prev, powerPoints: prev.powerPoints - habit.points }));
    }

    setDailyData(newDailyData);
    setTimeout(() => {
      calculateStreaksAndStats();
      updateTeamStats();
      saveToStorage(); // Save after habit toggle
    }, 100);
  };

  // ============ MODALS ============
  const handleNameSubmit = () => {
    if (tempName.trim()) {
      setUser(prev => ({
        ...prev,
        name: tempName.trim(),
        isFirstTime: false
      }));
      setShowNameModal(false);
      setTempName('');
      saveToStorage(); // Save after name submission
    } else {
      Alert.alert('Error', 'Please enter your name to continue');
    }
  };

  const createTeam = () => {
    if (!tempTeamName.trim()) {
      Alert.alert('Error', 'Please enter a team name');
      return;
    }

    const teamId = 'team_' + Date.now();
    setTeam({
      id: teamId,
      name: tempTeamName.trim(),
      members: [{ name: user.name || 'You', score: 0 }],
      dailyScore: 0,
      maxScore: 500,
      grade: '🔴 Poor',
      multiplier: 1.00
    });

    setAchievements(prev => ({ ...prev, 'team-player': true })); // Unlock achievement

    setShowTeamModal(false);
    setTempTeamName('');
    saveToStorage(); // Save after team creation
    Alert.alert('Success', `Team "${tempTeamName}" created successfully! Share code: ${teamId}`);
  };

  const joinTeam = () => {
    if (!tempTeamCode.trim()) {
      Alert.alert('Error', 'Please enter a team code');
      return;
    }

    setTeam({
      id: tempTeamCode,
      name: 'Team ' + tempTeamCode.substring(5, 10),
      members: [
        { name: user.name || 'You', score: 0 },
        { name: 'TeamMate_1', score: 45 },
        { name: 'TeamMate_2', score: 38 }
      ],
      dailyScore: 0,
      maxScore: 500,
      grade: '🔴 Poor',
      multiplier: 1.00
    });

    setAchievements(prev => ({ ...prev, 'team-player': true })); // Unlock achievement

    setShowTeamModal(false);
    setTempTeamCode('');
    saveToStorage(); // Save after joining team
    Alert.alert('Success', 'Successfully joined team!');
  };

  // ============ ANIMATIONS ============
  useEffect(() => {
    const glowAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(avatarGlow, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(avatarGlow, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    );

    const shadowAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(shadowGlow, {
          toValue: 1,
          duration: 3000,
          useNativeDriver: true,
        }),
        Animated.timing(shadowGlow, {
          toValue: 0,
          duration: 3000,
          useNativeDriver: true,
        }),
      ])
    );

    glowAnimation.start();
    shadowAnimation.start();

    return () => {
      glowAnimation.stop();
      shadowAnimation.stop();
    };
  }, []);

  // ============ INITIALIZATION ============
  useEffect(() => {
    const initializeApp = async () => {
      const loadedUser = await loadFromStorage();
      
      // Check if we need to show the name modal
      if (!loadedUser || loadedUser.isFirstTime) {
        setShowNameModal(true);
      }
      
      // Give state time to update, then calculate stats
      setTimeout(() => {
        calculateStreaksAndStats();
        updateTeamStats();
      }, 200);
    };
    
    initializeApp();
    
    const timer = setInterval(updateBattleTimer, 1000);
    return () => clearInterval(timer);
  }, []);

  // Additional effect to trigger calculations when user state loads
  useEffect(() => {
    if (!user.isFirstTime && user.name && Object.keys(dailyData).length > 0) {
      calculateStreaksAndStats();
      updateTeamStats();
    }
  }, [user.name, dailyData]);

  // Effect to handle viewing date changes
  useEffect(() => {
    // Force re-render when viewing date changes
    if (viewingDate) {
      saveToStorage();
    }
  }, [viewingDate]);

  // ============ CUSTOM COMPONENTS ============
  const NavButton = ({ title, active, onPress }) => (
    <TouchableOpacity
      style={[styles.navBtn, active && styles.navBtnActive]}
      onPress={onPress}
    >
      <Text style={[styles.navBtnText, active && styles.navBtnTextActive]}>
        {title}
      </Text>
    </TouchableOpacity>
  );

  const StatCard = ({ icon, value, label, onPress }) => (
    <TouchableOpacity style={styles.statCard} onPress={onPress}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </TouchableOpacity>
  );

  const HabitCard = ({ habit, habitId, completed, onToggle, streak, disabled }) => (
    <View style={[styles.habitCard, completed && styles.habitCardCompleted]}>
      <View style={styles.habitHeader}>
        <Text style={styles.habitIcon}>{habit.icon}</Text>
        <View style={styles.habitInfo}>
          <Text style={styles.habitName}>{habit.name}</Text>
          <Text style={styles.habitPoints}>+{habit.points} points</Text>
        </View>
        <Switch
          value={completed}
          onValueChange={onToggle}
          trackColor={{ false: '#2a2a2a', true: '#00ff88' }}
          thumbColor={completed ? '#ffffff' : '#666666'}
          style={[styles.habitSwitch, disabled && styles.habitSwitchDisabled]}
          disabled={disabled}
        />
      </View>
      <View style={styles.habitDetails}>
        <Text style={styles.habitStreak}>Streak: {streak} days</Text>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${Math.min(100, (streak / 30) * 100)}%` }]} />
        </View>
      </View>
    </View>
  );

  const Avatar = ({ user, doppelganger, powerBalance }) => (
    <View style={styles.battleArena}>
      <Text style={styles.arenaTitle}>Your Inner Battle</Text>
      
      <View style={styles.strengthMeter}>
        <Text style={styles.meterLabel}>Balance of Power</Text>
        <View style={styles.meterBar}>
          <View style={[styles.meterFill, { width: `${powerBalance.userPercentage}%` }]} />
        </View>
        <View style={styles.meterLabels}>
          <Text style={styles.meterLabelText}>You: {powerBalance.userPower} ({powerBalance.userPercentage}%)</Text>
          <Text style={styles.meterLabelText}>Shadow: {powerBalance.doppelgangerPower} ({powerBalance.doppelgangerPercentage}%)</Text>
        </View>
      </View>

      <View style={styles.combatants}>
        <View style={styles.avatarContainer}>
          <View style={styles.avatarWrapper}>
            <Animated.View 
              style={[
                styles.avatarGlow, 
                { opacity: avatarGlow.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.8] }) }
              ]} 
            />
            <View style={styles.avatar} />
          </View>
          <Text style={styles.avatarName}>{user.name || 'Your Avatar'}</Text>
          <Text style={styles.avatarLevel}>Level {user.level}</Text>
          <Text style={styles.avatarExp}>{user.currentLevelXP || 0} / {user.nextLevelXP || 100} XP</Text>
        </View>

        <Text style={styles.vsIndicator}>VS</Text>

        <View style={styles.doppelgangerContainer}>
          <View style={styles.doppelgangerWrapper}>
            <Animated.View 
              style={[
                styles.doppelgangerGlow, 
                { opacity: shadowGlow.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.6] }) }
              ]} 
            />
            <View style={styles.doppelganger} />
          </View>
          <Text style={styles.doppelgangerName}>Your Shadow</Text>
          <Text style={styles.doppelgangerLevel}>Level {doppelganger.level}</Text>
          <Text style={styles.doppelgangerPower}>{powerBalance.doppelgangerPercentage}% Influence</Text>
        </View>
      </View>
    </View>
  );

  // ============ RENDER SECTIONS ============
  const renderDashboard = () => {
    const powerBalance = calculatePowerBalance();
    const dateKey = getCurrentDateKey();
    const dayData = getDailyData(dateKey);
    const completedHabits = dayData.completed ? dayData.completed.length : 0;
    const totalHabits = Object.keys(habits).length;
    const completionPercentage = Math.round((completedHabits / totalHabits) * 100);

    return (
      <ScrollView style={styles.section} showsVerticalScrollIndicator={false}>
        <Avatar user={user} doppelganger={doppelganger} powerBalance={powerBalance} />
        
        <View style={styles.quickStats}>
          <StatCard icon="🔥" value={user.currentStreak} label="Current Streak" />
          <StatCard icon="📈" value={Math.round(user.monthlyPoints)} label="Monthly Points" />
          <StatCard icon="👥" value={team.id ? "#3" : "#--"} label="Team Rank" />
          <StatCard icon="💎" value={`${Math.round(user.powerPoints)} pts`} label="Power Points" />
        </View>

        <View style={styles.todayHabits}>
          <Text style={styles.sectionTitle}>Today's Mission</Text>
          <View style={styles.habitQuickList}>
            {Object.entries(habits).map(([id, habit]) => {
              const isCompleted = dayData.completed && dayData.completed.includes(id);
              return (
                <View key={id} style={[styles.habitQuickItem, isCompleted && styles.habitQuickItemCompleted]}>
                  <Text style={styles.habitIcon}>{habit.icon}</Text>
                  <Text style={styles.habitQuickName}>{habit.name}</Text>
                  <Text style={styles.habitStatus}>{isCompleted ? '✅' : '⭕'}</Text>
                </View>
              );
            })}
          </View>
          <View style={styles.completionCircle}>
            <Text style={styles.completionPercentage}>{completionPercentage}%</Text>
          </View>
        </View>
      </ScrollView>
    );
  };

  const renderHabits = () => {
    const dateKey = getCurrentDateKey();
    const dayData = getDailyData(dateKey);

    return (
      <ScrollView style={styles.section} showsVerticalScrollIndicator={false}>
        <View style={styles.habitsHeader}>
          <Text style={styles.sectionTitle}>Daily Habits</Text>
          <View style={styles.dateSelector}>
            <TouchableOpacity 
              style={styles.dateBtn} 
              onPress={() => changeDate(-1)}
            >
              <Text style={styles.dateBtnText}>◀</Text>
            </TouchableOpacity>
            <Text style={styles.currentDate}>{updateCurrentDateDisplay()}</Text>
            <TouchableOpacity 
              style={styles.dateBtn} 
              onPress={() => changeDate(1)}
              disabled={viewingDate >= currentDate}
            >
              <Text style={[styles.dateBtnText, viewingDate >= currentDate && styles.dateBtnDisabled]}>▶</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.habitsGrid}>
          {Object.entries(habits).map(([id, habit]) => {
            const isCompleted = dayData.completed && dayData.completed.includes(id);
            const streak = calculateHabitStreak(id);
            const isCurrentDay = formatDate(viewingDate) === formatDate(currentDate);
            
            return (
              <HabitCard
                key={id}
                habit={habit}
                habitId={id}
                completed={isCompleted}
                onToggle={(completed) => toggleHabit(id, completed)}
                streak={streak}
                disabled={!isCurrentDay}
              />
            );
          })}
        </View>

        <View style={styles.dailySummary}>
          <View style={styles.summaryHeader}>
            <Text style={styles.summaryTitle}>Daily Summary</Text>
            {formatDate(viewingDate) !== formatDate(currentDate) && (
              <Text style={styles.viewingPastDay}>Viewing Past Day</Text>
            )}
          </View>
          <View style={styles.summaryStats}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Completed:</Text>
              <Text style={styles.summaryValue}>{dayData.completed ? dayData.completed.length : 0}/{Object.keys(habits).length}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Base Points:</Text>
              <Text style={styles.summaryValue}>
                {dayData.completed ? dayData.completed.reduce((sum, habitId) => {
                  const habit = habits[habitId];
                  return sum + (habit ? habit.points : 0);
                }, 0) : 0}
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Team Bonus:</Text>
              <Text style={styles.summaryValue}>+{Math.round((team.multiplier - 1) * 100)}%</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Potential Punishment:</Text>
              <Text style={styles.summaryValue}>
                -{Math.floor((Object.keys(habits).length - (dayData.completed ? dayData.completed.length : 0)) * getTierMultiplier(user.tier))}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    );
  };

  const renderTeam = () => (
    <ScrollView style={styles.section} showsVerticalScrollIndicator={false}>
      <View style={styles.teamHeader}>
        <Text style={styles.sectionTitle}>Your Squad</Text>
        <View style={styles.teamButtons}>
          <TouchableOpacity 
            style={styles.teamBtn} 
            onPress={() => { setTeamModalTab('create'); setShowTeamModal(true); }}
          >
            <Text style={styles.teamBtnText}>Create Team</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.teamBtn} 
            onPress={() => { setTeamModalTab('join'); setShowTeamModal(true); }}
          >
            <Text style={styles.teamBtnText}>Join Team</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.teamContent}>
        <View style={styles.teamStats}>
          <Text style={styles.teamStatsTitle}>Collective Strength</Text>
          <View style={styles.collectiveBar}>
            <View style={[styles.collectiveFill, { width: `${(team.dailyScore / team.maxScore) * 100}%` }]} />
          </View>
          <Text style={styles.teamScore}>{team.dailyScore} / {team.maxScore} points</Text>
          <Text style={styles.teamGrade}>{team.grade}</Text>
          <Text style={styles.teamMultiplier}>Bonus: ×{team.multiplier.toFixed(2)}</Text>
        </View>

        <View style={styles.teamMembers}>
          <Text style={styles.teamMembersTitle}>Squad Members</Text>
          {[0, 1, 2, 3, 4].map((index) => (
            <View key={index} style={styles.memberSlot}>
              <View style={[styles.memberAvatar, !team.members[index] && styles.memberAvatarEmpty]} />
              <View style={styles.memberInfo}>
                <Text style={styles.memberName}>
                  {team.members[index] ? team.members[index].name : 'Empty Slot'}
                </Text>
                <Text style={styles.memberScore}>
                  {team.members[index] ? `${team.members[index].score} pts` : '--'}
                </Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.teamLeaderboard}>
          <Text style={styles.leaderboardTitle}>Team Leaderboard</Text>
          {[
            { name: 'Elite Squad', score: 2340, rank: 1 },
            { name: 'Habit Hackers', score: 2180, rank: 2 },
            { name: team.name || 'Your Team', score: team.dailyScore * 7, rank: 3 },
            { name: 'Morning Warriors', score: 1950, rank: 4 },
            { name: 'Discipline Devils', score: 1890, rank: 5 }
          ].map((teamData, index) => (
            <View key={index} style={[styles.leaderboardItem, teamData.name === team.name && styles.currentTeam]}>
              <Text style={styles.teamRank}>#{teamData.rank}</Text>
              <Text style={styles.teamNameText}>{teamData.name}</Text>
              <Text style={styles.teamScoreText}>{teamData.score} pts</Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );

  const renderProgress = () => {
    const tiers = [
      { name: 'goggins', min: 15000, max: Infinity, label: 'Goggins', range: '15K+ pts', icon: '🔥' },
      { name: 'diamond', min: 7500, max: 15000, label: 'Diamond', range: '7.5K - 15K pts', icon: '💎' },
      { name: 'platinum', min: 5000, max: 7500, label: 'Platinum', range: '5K - 7.5K pts', icon: '🏆' },
      { name: 'gold', min: 2500, max: 5000, label: 'Gold', range: '2.5K - 5K pts', icon: '🥇' },
      { name: 'silver', min: 1000, max: 2500, label: 'Silver', range: '1K - 2.5K pts', icon: '🥈' },
      { name: 'bronze', min: 0, max: 1000, label: 'Bronze', range: '0 - 1K pts', icon: '🥉' }
    ];

    return (
      <ScrollView style={styles.section} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>Progress Tracking</Text>
        
        <View style={styles.filterButtons}>
          {['daily', 'weekly', 'monthly', 'yearly'].map(period => (
            <TouchableOpacity
              key={period}
              style={[styles.filterBtn, progressFilter === period && styles.filterBtnActive]}
              onPress={() => setProgressFilter(period)}
            >
              <Text style={[styles.filterBtnText, progressFilter === period && styles.filterBtnTextActive]}>
                {period.charAt(0).toUpperCase() + period.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.tierProgression}>
          <Text style={styles.tierTitle}>Tier Progression</Text>
          {tiers.map((tier) => {
            const isActive = user.tier === tier.name;
            const isCompleted = getTierLevel(tier.name) < getTierLevel(user.tier);
            let status = 'Locked';
            if (isActive) status = 'Current';
            else if (isCompleted) status = 'Completed';
            else {
              const pointsNeeded = tier.min - user.powerPoints;
              if (pointsNeeded > 0) status = `${pointsNeeded} pts needed`;
            }

            return (
              <View key={tier.name} style={[styles.tier, isActive && styles.tierActive]}>
                <Text style={styles.tierIcon}>{tier.icon}</Text>
                <View style={styles.tierInfo}>
                  <Text style={styles.tierName}>{tier.label}</Text>
                  <Text style={styles.tierRange}>{tier.range}</Text>
                </View>
                <Text style={styles.tierStatus}>{status}</Text>
              </View>
            );
          })}
        </View>

        <View style={styles.charts}>
          <Text style={styles.chartsTitle}>Performance Charts</Text>
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Points Over Time</Text>
            <View style={styles.chartPlaceholder}>
              <Text style={styles.chartText}>Chart coming soon</Text>
            </View>
          </View>
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Habit Completion Rate</Text>
            <View style={styles.chartPlaceholder}>
              <Text style={styles.chartText}>Chart coming soon</Text>
            </View>
          </View>
        </View>

        <View style={styles.achievements}>
          <Text style={styles.achievementsTitle}>Achievements & Badges</Text>
          {Object.entries(achievements).map(([key, unlocked]) => (
            <View key={key} style={[styles.badge, !unlocked && styles.badgeLocked]}>
              <Text style={styles.badgeIcon}>
                {key === 'first-week' ? '🎯' : key === 'perfect-day' ? '⭐' : 
                 key === 'streak-master' ? '🔥' : key === 'team-player' ? '👥' : '🏅'}
              </Text>
              <View style={styles.badgeInfo}>
                <Text style={styles.badgeName}>
                  {key === 'first-week' ? 'First Week' : key === 'perfect-day' ? 'Perfect Day' : 
                   key === 'streak-master' ? 'Streak Master' : key === 'team-player' ? 'Team Player' : 'Top 10%'}
                </Text>
                <Text style={styles.badgeDesc}>
                  {key === 'first-week' ? 'Complete 7 days in a row' :
                   key === 'perfect-day' ? 'Complete all 9 habits in one day' :
                   key === 'streak-master' ? 'Maintain a 30-day streak' :
                   key === 'team-player' ? 'Join your first team' :
                   'Rank in top 10% for a month'}
                </Text>
              </View>
              <Text style={styles.badgeStatus}>{unlocked ? '✅' : '🔒'}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    );
  };

  const renderBattle = () => (
    <ScrollView style={styles.section} showsVerticalScrollIndicator={false}>
      <View style={styles.battleHeader}>
        <Text style={styles.sectionTitle}>Battle Arena</Text>
        <View style={styles.battleTimerContainer}>
          <Text style={styles.battleTimerLabel}>Next Battle Event:</Text>
          <Text style={styles.battleTimerText}>{battleTimer}</Text>
        </View>
      </View>
      
      <View style={styles.battleContent}>
        <Text style={styles.battleTitle}>Weekly Doppelganger Duel</Text>
        <Text style={styles.battleDescription}>
          Every day you complete habits, you grow stronger. Every day you miss them, your shadow gains power.
          The battle rages within - who will emerge victorious?
        </Text>
        
        <View style={styles.battleArenaMain}>
          <View style={styles.battleParticipant}>
            <View style={styles.participantAvatar}>
              <Text style={styles.battleHealth}>{Math.round(battle.playerHealth)}%</Text>
            </View>
            <Text style={styles.participantName}>You</Text>
            <Text style={styles.participantPower}>Power: {Math.round(user.powerPoints)}</Text>
          </View>
          
          <View style={styles.battleVs}>
            <Text style={styles.battleStatus}>{battle.status}</Text>
            <Text style={styles.battleRound}>Day {battle.round}/7</Text>
          </View>
          
          <View style={styles.battleParticipant}>
            <View style={[styles.participantAvatar, styles.doppelgangerAvatar]}>
              <Text style={styles.battleHealth}>{Math.round(battle.doppelgangerHealth)}%</Text>
            </View>
            <Text style={styles.participantName}>Your Shadow</Text>
            <Text style={styles.participantPower}>Power: {Math.round(doppelganger.powerPoints)}</Text>
          </View>
        </View>

        <View style={styles.battleStats}>
          <View style={styles.battleStat}>
            <Text style={styles.battleStatLabel}>Your Power</Text>
            <Text style={styles.battleStatValue}>{Math.round(user.powerPoints)}</Text>
          </View>
          <View style={styles.battleStat}>
            <Text style={styles.battleStatLabel}>Shadow Power</Text>
            <Text style={styles.battleStatValue}>{Math.round(doppelganger.powerPoints)}</Text>
          </View>
        </View>

        <View style={styles.battleResult}>
          <Text style={styles.battleResultText}>
            {user.powerPoints > doppelganger.powerPoints ? 
              '🎉 You are winning the battle!' : 
              '⚔️ Your shadow is gaining strength...'}
          </Text>
        </View>

        <View style={styles.battleHistory}>
          <Text style={styles.battleHistoryTitle}>Battle History</Text>
          {battle.history.length === 0 ? (
            <View style={styles.historyItem}>
              <Text style={styles.historyDate}>No battles yet</Text>
              <Text style={styles.historyResult}>--</Text>
              <Text style={styles.historyScore}>-- vs --</Text>
            </View>
          ) : (
            battle.history.map((battleRecord, index) => (
              <View key={index} style={styles.historyItem}>
                <Text style={styles.historyDate}>{battleRecord.date}</Text>
                <Text style={[styles.historyResult, styles[battleRecord.result.toLowerCase()]]}>
                  {battleRecord.result}
                </Text>
                <Text style={styles.historyScore}>
                  {battleRecord.playerScore} vs {battleRecord.doppelgangerScore}
                </Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.upcomingEvents}>
          <Text style={styles.eventsTitle}>Upcoming Events</Text>
          {[
            { icon: '⚔️', name: 'Doppelganger Duel', time: 'Every Monday' },
            { icon: '🐉', name: 'Boss Raid', time: 'Monthly Challenge' },
            { icon: '🏆', name: 'Team Championship', time: 'Quarterly' }
          ].map((event, index) => (
            <View key={index} style={styles.eventItem}>
              <Text style={styles.eventIcon}>{event.icon}</Text>
              <View style={styles.eventInfo}>
                <Text style={styles.eventName}>{event.name}</Text>
                <Text style={styles.eventTime}>{event.time}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );

  const getCurrentSectionComponent = () => {
    switch (currentSection) {
      case 'dashboard': return renderDashboard();
      case 'habits': return renderHabits();
      case 'team': return renderTeam();
      case 'progress': return renderProgress();
      case 'battle': return renderBattle();
      default: return renderDashboard();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0a" />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logo}>
          <Text style={styles.logoText}>DOPPELGANGER</Text>
          <Text style={styles.tagline}>Become the One Who Wins</Text>
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.currentTier}>{user.tier.charAt(0).toUpperCase() + user.tier.slice(1)}</Text>
          <Text style={styles.dailyScore}>{Math.round(user.powerPoints)} pts</Text>
        </View>
      </View>

      {/* Navigation */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.nav} contentContainerStyle={styles.navContent}>
        <NavButton 
          title="Dashboard" 
          active={currentSection === 'dashboard'} 
          onPress={() => setCurrentSection('dashboard')} 
        />
        <NavButton 
          title="Habits" 
          active={currentSection === 'habits'} 
          onPress={() => setCurrentSection('habits')} 
        />
        <NavButton 
          title="Team" 
          active={currentSection === 'team'} 
          onPress={() => setCurrentSection('team')} 
        />
        <NavButton 
          title="Progress" 
          active={currentSection === 'progress'} 
          onPress={() => setCurrentSection('progress')} 
        />
        <NavButton 
          title="Battle" 
          active={currentSection === 'battle'} 
          onPress={() => setCurrentSection('battle')} 
        />
      </ScrollView>

      {/* Main Content */}
      <View style={styles.mainContainer}>
        {getCurrentSectionComponent()}
      </View>

      {/* Name Modal */}
      <Modal visible={showNameModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Welcome to Doppelganger</Text>
            <Text style={styles.modalSubtitle}>What should we call you, warrior?</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Enter your name"
              placeholderTextColor="#666666"
              value={tempName}
              onChangeText={setTempName}
              autoFocus
            />
            <TouchableOpacity style={styles.modalButton} onPress={handleNameSubmit}>
              <Text style={styles.modalButtonText}>Begin Your Journey</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Team Modal */}
      <Modal visible={showTeamModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {teamModalTab === 'create' ? 'Create Team' : 'Join Team'}
              </Text>
              <TouchableOpacity onPress={() => setShowTeamModal(false)}>
                <Text style={styles.modalClose}>×</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalTabs}>
              <TouchableOpacity 
                style={[styles.modalTab, teamModalTab === 'create' && styles.modalTabActive]}
                onPress={() => setTeamModalTab('create')}
              >
                <Text style={[styles.modalTabText, teamModalTab === 'create' && styles.modalTabTextActive]}>
                  Create
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalTab, teamModalTab === 'join' && styles.modalTabActive]}
                onPress={() => setTeamModalTab('join')}
              >
                <Text style={[styles.modalTabText, teamModalTab === 'join' && styles.modalTabTextActive]}>
                  Join
                </Text>
              </TouchableOpacity>
            </View>

            {teamModalTab === 'create' ? (
              <>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Team Name"
                  placeholderTextColor="#666666"
                  value={tempTeamName}
                  onChangeText={setTempTeamName}
                />
                <TouchableOpacity style={styles.modalButton} onPress={createTeam}>
                  <Text style={styles.modalButtonText}>Create Team</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Team Code"
                  placeholderTextColor="#666666"
                  value={tempTeamCode}
                  onChangeText={setTempTeamCode}
                />
                <TouchableOpacity style={styles.modalButton} onPress={joinTeam}>
                  <Text style={styles.modalButtonText}>Join Team</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: 'rgba(26, 26, 26, 0.95)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  logo: {
    flex: 1,
  },
  logoText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#00d4ff',
  },
  tagline: {
    fontSize: 10,
    color: '#b0b0b0',
    fontWeight: '300',
  },
  userInfo: {
    alignItems: 'flex-end',
  },
  currentTier: {
    fontSize: 12,
    fontWeight: '700',
    color: '#cd7f32',
    textTransform: 'uppercase',
  },
  dailyScore: {
    fontSize: 10,
    color: '#b0b0b0',
  },
  nav: {
    backgroundColor: '#1a1a1a',
    paddingVertical: 6,
    maxHeight: 50,
  },
  navContent: {
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  navBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 15,
    marginRight: 6,
    minWidth: 60,
  },
  navBtnActive: {
    backgroundColor: '#00d4ff',
    borderColor: 'transparent',
  },
  navBtnText: {
    color: '#b0b0b0',
    fontWeight: '500',
    fontSize: 10,
    textAlign: 'center',
  },
  navBtnTextActive: {
    color: '#0a0a0a',
  },
  mainContainer: {
    flex: 1,
    paddingHorizontal: 12,
  },
  section: {
    flex: 1,
    paddingTop: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#00d4ff',
    marginBottom: 10,
    textAlign: 'center',
  },
  
  // Battle Arena
  battleArena: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
  },
  arenaTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#00d4ff',
    textAlign: 'center',
    marginBottom: 10,
  },
  strengthMeter: {
    marginBottom: 10,
  },
  meterLabel: {
    textAlign: 'center',
    marginBottom: 6,
    color: '#b0b0b0',
    fontSize: 10,
  },
  meterBar: {
    height: 12,
    backgroundColor: 'rgba(255, 68, 68, 0.3)',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 6,
  },
  meterFill: {
    height: '100%',
    backgroundColor: '#00d4ff',
    borderRadius: 6,
  },
  meterLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  meterLabelText: {
    fontSize: 8,
    color: '#b0b0b0',
    fontWeight: '600',
  },
  combatants: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  avatarContainer: {
    alignItems: 'center',
    flex: 1,
  },
  avatarWrapper: {
    width: 60,
    height: 60,
    marginBottom: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: {
    width: 45,
    height: 45,
    backgroundColor: '#00d4ff',
    borderRadius: 22.5,
    position: 'absolute',
  },
  avatarGlow: {
    width: 60,
    height: 60,
    backgroundColor: '#00d4ff',
    borderRadius: 30,
    position: 'absolute',
    opacity: 0.3,
  },
  avatarName: {
    fontSize: 10,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 2,
    textAlign: 'center',
  },
  avatarLevel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#00d4ff',
    marginBottom: 2,
  },
  avatarExp: {
    fontSize: 8,
    color: '#b0b0b0',
    textAlign: 'center',
  },
  vsIndicator: {
    fontSize: 18,
    fontWeight: '900',
    color: '#9945ff',
    marginHorizontal: 10,
  },
  doppelgangerContainer: {
    alignItems: 'center',
    flex: 1,
  },
  doppelgangerWrapper: {
    width: 60,
    height: 60,
    marginBottom: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  doppelganger: {
    width: 45,
    height: 45,
    backgroundColor: '#ff4444',
    borderRadius: 22.5,
    position: 'absolute',
  },
  doppelgangerGlow: {
    width: 60,
    height: 60,
    backgroundColor: '#ff4444',
    borderRadius: 30,
    position: 'absolute',
    opacity: 0.3,
  },
  doppelgangerName: {
    fontSize: 10,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 2,
    textAlign: 'center',
  },
  doppelgangerLevel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#ff4444',
    marginBottom: 2,
  },
  doppelgangerPower: {
    fontSize: 8,
    color: '#b0b0b0',
    textAlign: 'center',
  },
  
  // Quick Stats
  quickStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  statCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    padding: 8,
    alignItems: 'center',
    width: '48%',
    marginBottom: 6,
  },
  statIcon: {
    fontSize: 18,
    marginBottom: 3,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#00d4ff',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 8,
    color: '#b0b0b0',
    textAlign: 'center',
  },
  
  // Today's Habits
  todayHabits: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 10,
  },
  habitQuickList: {
    marginBottom: 8,
  },
  habitQuickItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 5,
    marginBottom: 3,
  },
  habitQuickItemCompleted: {
    backgroundColor: 'rgba(0, 255, 136, 0.1)',
    borderLeftWidth: 2,
    borderLeftColor: '#00ff88',
  },
  habitIcon: {
    fontSize: 12,
    marginRight: 6,
    width: 16,
    textAlign: 'center',
  },
  habitQuickName: {
    flex: 1,
    fontSize: 9,
    color: '#ffffff',
  },
  habitStatus: {
    fontSize: 10,
  },
  completionCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    borderWidth: 2,
    borderColor: '#00ff88',
  },
  completionPercentage: {
    fontSize: 12,
    fontWeight: '700',
    color: '#00ff88',
  },
  
  // Habits Section
  habitsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    borderRadius: 20,
    padding: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  dateBtn: {
    backgroundColor: 'transparent',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 15,
  },
  dateBtnText: {
    color: '#00d4ff',
    fontSize: 12,
    fontWeight: '600',
  },
  dateBtnDisabled: {
    color: '#666666',
  },
  currentDate: {
    fontSize: 10,
    fontWeight: '600',
    color: '#ffffff',
    minWidth: 60,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  habitsGrid: {
    marginBottom: 10,
  },
  habitCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  habitCardCompleted: {
    borderColor: '#00ff88',
    borderTopWidth: 2,
  },
  habitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  habitInfo: {
    flex: 1,
    marginLeft: 8,
  },
  habitName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 2,
  },
  habitPoints: {
    fontSize: 10,
    color: '#00d4ff',
    fontWeight: '600',
  },
  habitSwitch: {
    transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }],
  },
  habitSwitchDisabled: {
    opacity: 0.5,
  },
  habitDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  habitStreak: {
    fontSize: 10,
    color: '#b0b0b0',
  },
  progressBar: {
    width: 60,
    height: 4,
    backgroundColor: '#2a2a2a',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#00d4ff',
  },
  
  // Daily Summary
  dailySummary: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    padding: 10,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9945ff',
  },
  viewingPastDay: {
    fontSize: 10,
    color: '#ff4444',
    fontStyle: 'italic',
  },
  summaryStats: {
    gap: 6,
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  summaryLabel: {
    color: '#b0b0b0',
    fontSize: 10,
  },
  summaryValue: {
    color: '#00d4ff',
    fontWeight: '700',
    fontSize: 10,
  },
  
  // Team Section
  teamHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    flexWrap: 'wrap',
  },
  teamButtons: {
    flexDirection: 'row',
    gap: 6,
  },
  teamBtn: {
    backgroundColor: '#00d4ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  teamBtnText: {
    color: '#0a0a0a',
    fontWeight: '600',
    fontSize: 9,
  },
  teamContent: {
    gap: 10,
  },
  teamStats: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 10,
  },
  teamStatsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#00ff88',
    textAlign: 'center',
    marginBottom: 8,
  },
  collectiveBar: {
    height: 18,
    backgroundColor: '#2a2a2a',
    borderRadius: 9,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 8,
  },
  collectiveFill: {
    height: '100%',
    backgroundColor: '#00d4ff',
  },
  teamScore: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 6,
  },
  teamGrade: {
    textAlign: 'center',
    fontSize: 16,
    marginBottom: 6,
  },
  teamMultiplier: {
    textAlign: 'center',
    color: '#00d4ff',
    fontWeight: '700',
    fontSize: 10,
  },
  teamMembers: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 10,
  },
  teamMembersTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9945ff',
    marginBottom: 8,
  },
  memberSlot: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 6,
  },
  memberAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#00d4ff',
    marginRight: 8,
  },
  memberAvatarEmpty: {
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderStyle: 'dashed',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 2,
  },
  memberScore: {
    fontSize: 10,
    color: '#00d4ff',
  },
  teamLeaderboard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 10,
  },
  leaderboardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffd700',
    textAlign: 'center',
    marginBottom: 8,
  },
  leaderboardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 6,
    marginBottom: 4,
  },
  currentTeam: {
    borderColor: '#00d4ff',
    borderWidth: 1,
  },
  teamRank: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffd700',
    width: 30,
  },
  teamNameText: {
    flex: 1,
    fontSize: 11,
    color: '#ffffff',
    marginLeft: 8,
  },
  teamScoreText: {
    fontSize: 10,
    color: '#00d4ff',
    fontWeight: '600',
  },
  
  // Progress Section
  filterButtons: {
    flexDirection: 'row',
    backgroundColor: '#2a2a2a',
    borderRadius: 20,
    padding: 2,
    marginBottom: 10,
  },
  filterBtn: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 18,
    alignItems: 'center',
  },
  filterBtnActive: {
    backgroundColor: '#00d4ff',
  },
  filterBtnText: {
    fontSize: 9,
    color: '#b0b0b0',
    fontWeight: '600',
  },
  filterBtnTextActive: {
    color: '#0a0a0a',
  },
  tierProgression: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
  },
  tierTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffd700',
    textAlign: 'center',
    marginBottom: 8,
  },
  tier: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 6,
  },
  tierActive: {
    borderColor: '#00ff88',
    backgroundColor: 'rgba(0, 255, 136, 0.1)',
  },
  tierIcon: {
    fontSize: 18,
    marginRight: 8,
    width: 30,
    textAlign: 'center',
  },
  tierInfo: {
    flex: 1,
  },
  tierName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 2,
  },
  tierRange: {
    fontSize: 10,
    color: '#b0b0b0',
  },
  tierStatus: {
    fontSize: 10,
    fontWeight: '600',
    color: '#00ff88',
  },
  
  // Charts
  charts: {
    marginBottom: 10,
  },
  chartsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9945ff',
    textAlign: 'center',
    marginBottom: 8,
  },
  chartCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  chartTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#00d4ff',
    marginBottom: 8,
  },
  chartPlaceholder: {
    height: 80,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chartText: {
    color: '#b0b0b0',
    fontSize: 10,
  },
  
  // Achievements
  achievements: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 10,
  },
  achievementsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffd700',
    textAlign: 'center',
    marginBottom: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 6,
  },
  badgeLocked: {
    opacity: 0.5,
  },
  badgeIcon: {
    fontSize: 18,
    marginRight: 8,
    width: 30,
    textAlign: 'center',
  },
  badgeInfo: {
    flex: 1,
  },
  badgeName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 2,
  },
  badgeDesc: {
    fontSize: 9,
    color: '#b0b0b0',
  },
  badgeStatus: {
    fontSize: 14,
  },
  
  // Battle Section
  battleHeader: {
    marginBottom: 10,
  },
  battleTimerContainer: {
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    padding: 8,
    borderRadius: 10,
    marginTop: 5,
  },
  battleTimerLabel: {
    fontSize: 10,
    color: '#b0b0b0',
    marginBottom: 2,
  },
  battleTimerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ff4444',
    fontFamily: 'monospace',
  },
  battleContent: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 10,
  },
  battleTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ff4444',
    textAlign: 'center',
    marginBottom: 8,
  },
  battleDescription: {
    fontSize: 10,
    color: '#b0b0b0',
    textAlign: 'center',
    marginBottom: 10,
    lineHeight: 14,
  },
  battleArenaMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  battleParticipant: {
    alignItems: 'center',
    flex: 1,
  },
  participantAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#00d4ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 2,
    borderColor: '#00d4ff',
  },
  doppelgangerAvatar: {
    backgroundColor: '#ff4444',
    borderColor: '#ff4444',
  },
  battleHealth: {
    fontSize: 8,
    fontWeight: '700',
    color: '#ffffff',
  },
  participantName: {
    fontSize: 10,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 2,
  },
  participantPower: {
    fontSize: 9,
    color: '#b0b0b0',
  },
  battleVs: {
    alignItems: 'center',
    marginHorizontal: 10,
  },
  battleStatus: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9945ff',
    marginBottom: 2,
    textAlign: 'center',
  },
  battleRound: {
    fontSize: 9,
    color: '#b0b0b0',
  },
  battleStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 10,
  },
  battleStat: {
    alignItems: 'center',
  },
  battleStatLabel: {
    fontSize: 10,
    color: '#b0b0b0',
    marginBottom: 3,
  },
  battleStatValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#00d4ff',
  },
  battleResult: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 6,
    padding: 8,
    marginBottom: 10,
  },
  battleResultText: {
    fontSize: 12,
    color: '#ffffff',
    textAlign: 'center',
    fontWeight: '600',
  },
  battleHistory: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    padding: 8,
    marginBottom: 10,
  },
  battleHistoryTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9945ff',
    marginBottom: 6,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 4,
    marginBottom: 3,
  },
  historyDate: {
    fontSize: 9,
    color: '#b0b0b0',
    flex: 1,
  },
  historyResult: {
    fontSize: 9,
    fontWeight: '600',
    marginHorizontal: 8,
  },
  victory: {
    color: '#00ff88',
  },
  defeat: {
    color: '#ff4444',
  },
  historyScore: {
    fontSize: 9,
    color: '#00d4ff',
  },
  upcomingEvents: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    padding: 8,
  },
  eventsTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffd700',
    marginBottom: 6,
  },
  eventItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 4,
    marginBottom: 3,
  },
  eventIcon: {
    fontSize: 14,
    marginRight: 8,
    width: 20,
    textAlign: 'center',
  },
  eventInfo: {
    flex: 1,
  },
  eventName: {
    fontSize: 10,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 1,
  },
  eventTime: {
    fontSize: 8,
    color: '#b0b0b0',
  },
  
  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
    padding: 30,
    width: width * 0.9,
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#00d4ff',
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#b0b0b0',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalClose: {
    fontSize: 24,
    color: '#b0b0b0',
    fontWeight: '700',
  },
  modalTabs: {
    flexDirection: 'row',
    backgroundColor: '#2a2a2a',
    borderRadius: 25,
    padding: 4,
    marginBottom: 20,
  },
  modalTab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    alignItems: 'center',
  },
  modalTabActive: {
    backgroundColor: '#00d4ff',
  },
  modalTabText: {
    color: '#b0b0b0',
    fontWeight: '600',
  },
  modalTabTextActive: {
    color: '#0a0a0a',
  },
  modalInput: {
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    padding: 15,
    color: '#ffffff',
    fontSize: 16,
    marginBottom: 20,
  },
  modalButton: {
    backgroundColor: '#00d4ff',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 25,
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#0a0a0a',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default DoppelgangerApp;