'use strict';

const HABITS = {
  reading:    { name: 'Read 30 minutes',         points: 10, icon: '📚' },
  screentime: { name: 'Screen time <2 hours',    points: 15, icon: '📵' },
  gym:        { name: 'Gym session',             points: 15, icon: '💪' },
  sleep:      { name: 'Sleep 7-10 hours',        points: 10, icon: '😴' },
  deepwork:   { name: '90 min deep work',        points: 15, icon: '🎯' },
  cardio:     { name: '20 min cardio',           points: 10, icon: '🏃‍♂️' },
  meditation: { name: 'Meditate 10 min',         points: 5,  icon: '🧘' },
  coldshower: { name: 'Cold shower',             points: 5,  icon: '❄️' },
  nutrition:  { name: 'No sugar/processed food', points: 10, icon: '🍽️' },
};

const TIERS = [
  { name: 'goggins',  min: 15000, multiplier: 3.0 },
  { name: 'diamond',  min: 7500,  multiplier: 2.5 },
  { name: 'platinum', min: 5000,  multiplier: 2.0 },
  { name: 'gold',     min: 2500,  multiplier: 1.5 },
  { name: 'silver',   min: 1000,  multiplier: 1.25 },
  { name: 'bronze',   min: 0,     multiplier: 1.0 },
];

const TEAM_GRADES = [
  { label: 'Legendary', emoji: '🌟', min: 450, multiplier: 1.50 },
  { label: 'Elite',     emoji: '💎', min: 350, multiplier: 1.30 },
  { label: 'Great',     emoji: '🥇', min: 250, multiplier: 1.15 },
  { label: 'Good',      emoji: '🥈', min: 150, multiplier: 1.05 },
  { label: 'Average',   emoji: '🥉', min: 75,  multiplier: 1.00 },
  { label: 'Poor',      emoji: '🔴', min: 0,   multiplier: 0.90 },
];

function getTier(totalPoints) {
  return TIERS.find(t => totalPoints >= t.min) || TIERS[TIERS.length - 1];
}

function getTierMultiplier(tierName) {
  const tier = TIERS.find(t => t.name === tierName);
  return tier ? tier.multiplier : 1.0;
}

function getStreakMultiplier(streak) {
  if (streak >= 66) return 1.50;
  if (streak >= 30) return 1.20;
  if (streak >= 7)  return 1.10;
  return 1.0;
}

function getTeamGrade(teamScore) {
  return TEAM_GRADES.find(g => teamScore >= g.min) || TEAM_GRADES[TEAM_GRADES.length - 1];
}

/**
 * Calculate base points earned from a list of completed habit IDs.
 * Does NOT apply streak or team multipliers.
 */
function calcBasePoints(completedHabits, penaltiesApplied = 0) {
  const base = completedHabits.reduce((sum, hId) => {
    return sum + (HABITS[hId]?.points || 0);
  }, 0);
  return Math.max(0, base - penaltiesApplied * 10);
}

/**
 * Points for habits missed on a day (used for doppelganger score).
 */
function calcMissedPoints(completedHabits) {
  return Object.entries(HABITS).reduce((sum, [hId, h]) => {
    return completedHabits.includes(hId) ? sum : sum + h.points;
  }, 0);
}

const PERFECT_DAY_BONUS = 5;
const TOTAL_HABITS = Object.keys(HABITS).length;

module.exports = {
  HABITS,
  TIERS,
  TEAM_GRADES,
  getTier,
  getTierMultiplier,
  getStreakMultiplier,
  getTeamGrade,
  calcBasePoints,
  calcMissedPoints,
  PERFECT_DAY_BONUS,
  TOTAL_HABITS,
};
