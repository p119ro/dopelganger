// Doppelganger — Frontend (API-backed, no localStorage)
// Communicates with Node/Express backend via api.js

import api, { setAccessToken, clearAccessToken } from './api.js';
import { initSocket } from './socket.js';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
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
  { name: 'goggins',  min: 15000, icon: '🔥' },
  { name: 'diamond',  min: 7500,  icon: '💎' },
  { name: 'platinum', min: 5000,  icon: '🏆' },
  { name: 'gold',     min: 2500,  icon: '🥇' },
  { name: 'silver',   min: 1000,  icon: '🥈' },
  { name: 'bronze',   min: 0,     icon: '🥉' },
];

// ─── GLOBAL STATE ─────────────────────────────────────────────────────────────
const state = {
  user: null,
  team: null,
  currentBattle: null,
  dailyLog: null,
  streaks: [],
  viewingDateKey: getTodayKey(),
  currentSection: 'dashboard',
};

// Expose globally for socket.js callbacks
window.__APP__ = { state };

// ─── DATE UTILS ───────────────────────────────────────────────────────────────
function getTodayKey() {
  const now = new Date();
  if (now.getHours() < 4) now.setDate(now.getDate() - 1);
  return now.toISOString().slice(0, 10);
}

// ─── TOAST SYSTEM ─────────────────────────────────────────────────────────────
export function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('toast-visible'));
  setTimeout(() => {
    toast.classList.remove('toast-visible');
    toast.addEventListener('transitionend', () => toast.remove());
  }, 3000);
}

// ─── AUTH SCREEN ──────────────────────────────────────────────────────────────
function showAuthScreen() {
  document.getElementById('app-root')?.classList.add('hidden');
  let screen = document.getElementById('auth-screen');
  if (!screen) {
    screen = createAuthScreen();
    document.body.insertBefore(screen, document.body.firstChild);
  }
  screen.classList.remove('hidden');
}

function hideAuthScreen() {
  const screen = document.getElementById('auth-screen');
  screen?.classList.add('hidden');
  document.getElementById('app-root')?.classList.remove('hidden');
}

function createAuthScreen() {
  const div = document.createElement('div');
  div.id = 'auth-screen';
  div.innerHTML = `
    <div class="auth-card">
      <div class="auth-logo">
        <h1>DOPPELGANGER</h1>
        <p class="auth-tagline">Become the One Who Wins</p>
      </div>
      <div class="auth-tabs">
        <button class="auth-tab active" data-tab="login">Sign In</button>
        <button class="auth-tab" data-tab="register">Create Account</button>
      </div>

      <!-- Login form -->
      <div id="auth-login" class="auth-form">
        <div class="auth-field">
          <input type="text" id="login-identifier" placeholder="Email or username" autocomplete="username">
        </div>
        <div class="auth-field">
          <input type="password" id="login-password" placeholder="Password" autocomplete="current-password">
        </div>
        <button class="auth-btn" id="login-btn">
          <span class="btn-text">Sign In</span>
        </button>
        <p id="login-error" class="auth-error"></p>
      </div>

      <!-- Register form -->
      <div id="auth-register" class="auth-form hidden">
        <div class="auth-field">
          <input type="email"    id="reg-email"     placeholder="Email address"                    autocomplete="email">
        </div>
        <div class="auth-field">
          <input type="text"     id="reg-username"  placeholder="Username (3–20 chars, letters/numbers/_)" autocomplete="username">
        </div>
        <div class="auth-field">
          <input type="password" id="reg-password"  placeholder="Password (min 8 characters)"     autocomplete="new-password">
        </div>
        <button class="auth-btn" id="register-btn">
          <span class="btn-text">Create Account</span>
        </button>
        <p id="reg-error" class="auth-error"></p>
      </div>
    </div>`;

  // Tab switching
  div.querySelectorAll('.auth-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      div.querySelectorAll('.auth-tab').forEach(b => b.classList.remove('active'));
      div.querySelectorAll('.auth-form').forEach(f => f.classList.add('hidden'));
      btn.classList.add('active');
      div.querySelector(`#auth-${btn.dataset.tab}`).classList.remove('hidden');
    });
  });

  // Enter-key shortcuts
  const loginId   = div.querySelector('#login-identifier');
  const loginPass = div.querySelector('#login-password');
  loginId.addEventListener('keydown',   e => { if (e.key === 'Enter') loginPass.focus(); });
  loginPass.addEventListener('keydown', e => { if (e.key === 'Enter') div.querySelector('#login-btn').click(); });
  div.querySelector('#reg-email').addEventListener('keydown',    e => { if (e.key === 'Enter') div.querySelector('#reg-username').focus(); });
  div.querySelector('#reg-username').addEventListener('keydown', e => { if (e.key === 'Enter') div.querySelector('#reg-password').focus(); });
  div.querySelector('#reg-password').addEventListener('keydown', e => { if (e.key === 'Enter') div.querySelector('#register-btn').click(); });

  // ── Login ──
  div.querySelector('#login-btn').addEventListener('click', async () => {
    const identifier = loginId.value.trim();
    const password   = loginPass.value;
    const errEl      = div.querySelector('#login-error');
    const btn        = div.querySelector('#login-btn');
    errEl.textContent = '';
    if (!identifier) { errEl.textContent = 'Enter your email or username'; return; }
    btn.disabled = true;
    btn.querySelector('.btn-text').textContent = 'Signing in…';
    try {
      const data = await api.post('/api/auth/login', { identifier, password });
      setAccessToken(data.accessToken);
      storeTokenForSocket(data.accessToken);
      await initApp(data.user);
      hideAuthScreen();
      checkLegacyMigration();
    } catch (e) {
      errEl.textContent = e.message;
    } finally {
      btn.disabled = false;
      btn.querySelector('.btn-text').textContent = 'Sign In';
    }
  });

  // ── Register ──
  div.querySelector('#register-btn').addEventListener('click', async () => {
    const email    = div.querySelector('#reg-email').value.trim();
    const username = div.querySelector('#reg-username').value.trim();
    const password = div.querySelector('#reg-password').value;
    const errEl    = div.querySelector('#reg-error');
    const btn      = div.querySelector('#register-btn');
    errEl.textContent = '';
    btn.disabled = true;
    btn.querySelector('.btn-text').textContent = 'Creating…';
    try {
      const data = await api.post('/api/auth/register', { email, username, password });
      // Always auto-verified now — log straight in
      setAccessToken(data.accessToken);
      storeTokenForSocket(data.accessToken);
      await initApp(data.user);
      hideAuthScreen();
      showToast(`Welcome, ${data.user.username}! Let's win today.`, 'success');
      checkLegacyMigration();
    } catch (e) {
      errEl.textContent = e.details
        ? e.details.map(d => d.message).join(' · ')
        : e.message;
    } finally {
      btn.disabled = false;
      btn.querySelector('.btn-text').textContent = 'Create Account';
    }
  });

  return div;
}

// ─── APP INIT ─────────────────────────────────────────────────────────────────
async function bootstrap() {
  // Wrap app content in #app-root if not already
  wrapAppRoot();

  // Listen for logout event from api.js token refresh failure
  window.addEventListener('auth:logout', () => {
    clearAccessToken();
    showAuthScreen();
    showToast('Session expired. Please log in again.', 'warning');
  });

  // Try to restore session via refresh token (httpOnly cookie)
  try {
    const data = await api.post('/api/auth/refresh');
    setAccessToken(data.accessToken);
    storeTokenForSocket(data.accessToken);
    const meData = await api.get('/api/auth/me');
    await initApp(meData.user);
    hideAuthScreen();
    checkLegacyMigration();
  } catch {
    showAuthScreen();
  }
}

function wrapAppRoot() {
  if (document.getElementById('app-root')) return;
  const header = document.querySelector('.header');
  const main = document.querySelector('.main-container');
  const footer = document.querySelector('.footer');
  const root = document.createElement('div');
  root.id = 'app-root';
  root.classList.add('hidden');
  document.body.insertBefore(root, header);
  root.appendChild(header);
  root.appendChild(main);
  if (footer) root.appendChild(footer);
}

async function initApp(userData) {
  state.user = userData;

  // Init socket
  const token = await getCurrentAccessToken();
  if (token) initSocket(token);

  // Show skeleton loaders
  showSkeletons();

  // Fetch all data in parallel
  const [logData, streakData, teamData, battleData] = await Promise.allSettled([
    api.get(`/api/habits/log/${getTodayKey()}`),
    api.get('/api/habits/streaks'),
    api.get('/api/teams/mine'),
    api.get('/api/battles/current'),
  ]);

  if (logData.status === 'fulfilled') state.dailyLog = logData.value.log;
  if (streakData.status === 'fulfilled') state.streaks = streakData.value.streaks;
  if (teamData.status === 'fulfilled') state.team = teamData.value.team;
  if (battleData.status === 'fulfilled') state.currentBattle = battleData.value;

  hideSkeletons();
  renderAll();
  setupEventListeners();
  setupNavigation();
}

// We store the access token on window.__APP__.accessToken so socket.js can read it
function storeTokenForSocket(token) {
  window.__APP__.accessToken = token;
}

async function getCurrentAccessToken() {
  return window.__APP__.accessToken || null;
}

// ─── RENDER ALL ───────────────────────────────────────────────────────────────
function renderAll() {
  renderHeader();
  renderDashboard();
  renderHabits();
  renderTeam();
  renderBattle();
  renderProgress();

  // Show admin nav button for admins
  const adminBtn = document.getElementById('adminNavBtn');
  if (adminBtn) adminBtn.style.display = state.user?.isAdmin ? '' : 'none';
}

function renderHeader() {
  const u = state.user;
  if (!u) return;
  const tierEl    = document.getElementById('currentTier');
  const scoreEl   = document.getElementById('dailyScore');
  const totalEl   = document.getElementById('totalScore');
  if (tierEl)  tierEl.textContent  = u.username || u.tier;
  if (scoreEl) scoreEl.textContent = `${Math.round(state.dailyLog?.pointsEarned || 0)} today`;
  if (totalEl) totalEl.textContent = `${Math.round(u.totalPowerPoints).toLocaleString()} total pts`;
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function renderDashboard() {
  const u = state.user;
  if (!u) return;

  // Stats
  setText('currentStreak', u.currentStreak);
  setText('tierProgress', calcTierProgress(u.totalPowerPoints));

  // Avatar vs Doppelganger — Balance of Power
  const total    = u.totalPowerPoints;
  const dopTotal = u.doppelgangerPowerPoints;
  const combined = total + dopTotal || 1;
  const userPct  = Math.round((total / combined) * 100);
  const el = document.getElementById('strengthMeter');
  if (el) el.style.width = `${userPct}%`;

  // Power point labels beneath the bar
  const userPtsLabel = document.getElementById('powerLabelUser');
  const dopPtsLabel  = document.getElementById('powerLabelDop');
  if (userPtsLabel) userPtsLabel.textContent = `You: ${Math.round(total).toLocaleString()} pts`;
  if (dopPtsLabel)  dopPtsLabel.textContent  = `Shadow: ${Math.round(dopTotal).toLocaleString()} pts`;

  // Tooltip on the bar
  const barEl = document.querySelector('.meter-bar');
  if (barEl) barEl.title = `You ${userPct}% vs Shadow ${100 - userPct}%`;

  // Monthly total in the "Monthly Points" stat card
  setText('monthlyPoints', Math.round(u.monthlyPoints).toLocaleString());

  setText('avatarLevel', `Level ${u.avatarLevel}`);
  setText('avatarExp', `${Math.round(total)} / ${getNextTierThreshold(u.totalPowerPoints)} XP`);
  setText('doppelgangerLevel', `Level ${Math.floor(u.avatarLevel * 0.8) || 1}`);
  setText('doppelgangerPower', `${Math.round(dopTotal)} pts`);

  // Team rank
  if (state.team) {
    setText('teamRank', `#--`); // would need leaderboard rank endpoint
  }

  // Quick habit list
  renderHabitQuickList();
}

function renderHabitQuickList() {
  const list = document.getElementById('habitQuickList');
  if (!list) return;
  const completed = state.dailyLog?.completedHabits || [];
  list.innerHTML = Object.entries(HABITS).map(([id, h]) => `
    <div class="quick-habit ${completed.includes(id) ? 'done' : ''}">
      <span>${h.icon}</span>
      <span>${h.name}</span>
      ${completed.includes(id) ? '<span class="check">✓</span>' : ''}
    </div>
  `).join('');

  const pct = Math.round((completed.length / Object.keys(HABITS).length) * 100);
  const circle = document.querySelector('#dailyCompletion .completion-percentage');
  if (circle) circle.textContent = `${pct}%`;
}

// ─── HABITS ───────────────────────────────────────────────────────────────────
function renderHabits(triggerConfetti = false) {
  const completed = state.dailyLog?.completedHabits || [];

  Object.keys(HABITS).forEach(id => {
    const cb   = document.getElementById(`${id}-checkbox`);
    const card = document.querySelector(`[data-habit="${id}"]`);
    const done = completed.includes(id);

    if (cb)   cb.checked = done;
    if (card) card.classList.toggle('completed', done);

    const streakEl = document.getElementById(`${id}-streak`);
    if (streakEl) {
      const s = state.streaks.find(s => s.habitId === id);
      streakEl.textContent = s?.currentStreak || 0;
    }

    // Streak progress bar (towards 66-day goal)
    const prog = document.getElementById(`${id}-progress`);
    if (prog) {
      const streak = state.streaks.find(s => s.habitId === id)?.currentStreak || 0;
      prog.style.width = `${Math.min((streak / 66) * 100, 100)}%`;
    }
  });

  // Fire confetti when all habits done (only on toggle, not initial render)
  if (triggerConfetti && completed.length === Object.keys(HABITS).length) {
    launchConfetti();
    showToast('🎉 Perfect day! All habits complete!', 'success');
  }

  // Summary
  const pts = Math.round(state.dailyLog?.pointsEarned || 0);
  setText('completedCount', `${completed.length}/9`);
  setText('pointsEarned', pts);
  setText('finalScore', pts);

  // Date display
  const dateEl = document.getElementById('currentDate');
  if (dateEl) {
    dateEl.textContent = state.viewingDateKey === getTodayKey()
      ? 'Today'
      : formatDate(state.viewingDateKey);
  }
}

// ─── TEAM ─────────────────────────────────────────────────────────────────────
function renderTeam() {
  const team = state.team;

  if (!team) {
    document.querySelector('.team-content')?.classList.add('no-team');
    setText('teamNameDisplay', '');
    const codeEl = document.getElementById('teamCodeDisplay');
    if (codeEl) codeEl.style.display = 'none';
    return;
  }

  // Show team name and join code
  setText('teamNameDisplay', team.name);
  setText('teamJoinCode', team.joinCode);
  const codeEl = document.getElementById('teamCodeDisplay');
  if (codeEl) codeEl.style.display = 'flex';

  setText('teamScore', Math.round(team.teamScore));
  const fill = document.getElementById('collectiveFill');
  if (fill) fill.style.width = `${Math.min((team.teamScore / 500) * 100, 100)}%`;
  setText('teamGrade', `${team.gradeEmoji} ${team.grade}`);
  setText('teamMultiplier', `×${team.multiplier.toFixed(2)}`);

  const isOwner = team.members.some(m => m.id === state.user?.id && m.role === 'owner')
    || team.ownerId === state.user?.id;

  const list = document.getElementById('membersList');
  if (!list) return;
  list.innerHTML = '';

  for (let i = 0; i < 5; i++) {
    const member = team.members[i];
    const slot = document.createElement('div');
    slot.className = `member-slot ${member ? '' : 'empty'}`;
    if (member) {
      const isMe = member.id === state.user?.id;
      const kickBtn = (isOwner && !isMe)
        ? `<button onclick="kickMember('${member.id}')" style="margin-left:auto;background:none;border:1px solid #ff4444;color:#ff4444;border-radius:4px;padding:2px 8px;cursor:pointer;font-size:.75rem;">Kick</button>`
        : '';
      slot.innerHTML = `
        <div class="member-avatar" style="background: ${tierColor(member.tier)}"></div>
        <div class="member-info">
          <div class="member-name">${member.username}${member.role === 'owner' ? ' 👑' : ''}</div>
          <div class="member-score">${Math.round(member.todayPoints)} pts today</div>
          <div class="member-streak">🔥 ${member.currentStreak}</div>
        </div>
        <div class="member-tier">${member.tier}</div>
        ${kickBtn}`;
    } else {
      slot.innerHTML = `
        <div class="member-avatar placeholder"></div>
        <div class="member-info"><div class="member-name">Empty Slot</div><div class="member-score">--</div></div>`;
    }
    list.appendChild(slot);
  }
}

async function kickMember(userId) {
  if (!confirm('Kick this member from your team?')) return;
  try {
    await api.delete(`/api/teams/members/${userId}`);
    const data = await api.get('/api/teams/mine');
    state.team = data.team;
    renderTeam();
    showToast('Member kicked.', 'success');
  } catch (err) {
    showToast(err.message || 'Failed to kick member', 'error');
  }
}

// ─── BATTLE ───────────────────────────────────────────────────────────────────
function renderBattle() {
  const battle = state.currentBattle?.battle;
  const projected = state.currentBattle?.projected;
  if (!battle) return;

  const rounds = battle.rounds || [];
  const userWins = rounds.filter(r => r.winnerId === 'user').length;
  const dopWins = rounds.filter(r => r.winnerId === 'doppelganger').length;

  // Health bars (% of 7 rounds won)
  const avatarHp = Math.round((userWins / 7) * 100);
  const dopHp = Math.round((dopWins / 7) * 100);
  setText('avatarHealth', `${avatarHp}%`);
  setText('doppelgangerHealth', `${dopHp}%`);

  // Current round
  const resolvedCount = rounds.length;
  setText('battleRound', `Round ${resolvedCount + 1}/7`);

  const statusEl = document.getElementById('battleStatus');
  if (statusEl) {
    if (battle.status === 'completed') {
      statusEl.textContent = battle.winnerId === 'user' ? '🏆 Victory!' : '💀 Defeated';
    } else {
      statusEl.textContent = projected
        ? `Today: You ${projected.userScore.toFixed(0)} vs Shadow ${projected.doppelgangerScore.toFixed(0)}`
        : 'Battle in progress';
    }
  }

  // Battle log
  const log = document.getElementById('battleLog');
  if (log) {
    if (rounds.length === 0) {
      log.innerHTML = '<div class="log-entry">Battle has begun. Complete habits to fight your shadow!</div>';
    } else {
      log.innerHTML = rounds.map(r => {
        const won = r.winnerId === 'user';
        return `<div class="log-entry ${won ? 'win' : 'loss'}">
          Day ${r.dayNumber}: You ${r.userScore.toFixed(0)} pts vs Shadow ${r.doppelgangerScore.toFixed(0)} pts
          — <strong>${won ? 'You won! 🏆' : 'Shadow won 😈'}</strong>
        </div>`;
      }).join('');
    }
  }
}

function renderBattleHistory() {
  api.get('/api/battles/history?limit=10').then(data => {
    const list = document.getElementById('battleHistory');
    if (!list) return;
    if (!data.battles?.length) {
      list.innerHTML = '<div class="history-item"><div class="history-date">No battles yet</div></div>';
      return;
    }
    list.innerHTML = data.battles.map(b => {
      const userWins = b.rounds.filter(r => r.winnerId === 'user').length;
      const dopWins = b.rounds.filter(r => r.winnerId === 'doppelganger').length;
      const won = b.winnerId === 'user';
      return `<div class="history-item">
        <div class="history-date">${b.weekStartDate} — ${b.weekEndDate}</div>
        <div class="history-result ${won ? 'win' : 'loss'}">${won ? 'Victory' : 'Defeat'}</div>
        <div class="history-score">${userWins}-${dopWins} rounds</div>
      </div>`;
    }).join('');
  }).catch(() => {});
}

// ─── PROGRESS ─────────────────────────────────────────────────────────────────
function renderProgress() {
  const u = state.user;
  if (!u) return;

  TIERS.forEach(tier => {
    const statusEl = document.getElementById(`${tier.name}-status`);
    const tierEl = document.querySelector(`[data-tier="${tier.name}"]`);
    if (!statusEl || !tierEl) return;

    tierEl.classList.remove('active', 'unlocked', 'locked');
    if (u.tier === tier.name) {
      tierEl.classList.add('active');
      statusEl.textContent = 'Current';
    } else if (u.totalPowerPoints >= tier.min) {
      tierEl.classList.add('unlocked');
      statusEl.textContent = '✓';
    } else {
      tierEl.classList.add('locked');
      statusEl.textContent = `${tier.min.toLocaleString()} pts`;
    }
  });

  // Simple points chart (last 7 days from history)
  api.get('/api/habits/history?days=7').then(data => {
    drawPointsChart(data.logs);
  }).catch(() => {});
}

function drawPointsChart(logs) {
  const canvas = document.querySelector('#pointsChart canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  if (!logs?.length) {
    ctx.fillStyle = '#666';
    ctx.font = '14px sans-serif';
    ctx.fillText('No data yet', w / 2 - 40, h / 2);
    return;
  }

  const sorted = [...logs].sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  const max = Math.max(...sorted.map(l => l.pointsEarned), 1);
  const step = w / Math.max(sorted.length - 1, 1);

  ctx.strokeStyle = '#00d4ff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  sorted.forEach((l, i) => {
    const x = i * step;
    const y = h - (l.pointsEarned / max) * (h - 20) - 10;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Labels
  ctx.fillStyle = '#888';
  ctx.font = '10px sans-serif';
  sorted.forEach((l, i) => {
    const x = i * step;
    ctx.fillText(l.dateKey.slice(5), x - 10, h - 2);
  });
}

// ─── CONFETTI ─────────────────────────────────────────────────────────────────
function launchConfetti() {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:99999';
  document.body.appendChild(canvas);
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  const ctx = canvas.getContext('2d');

  const COLORS = ['#00d4ff', '#00ff88', '#ffd700', '#9945ff', '#ff6b6b', '#fff'];
  const pieces = Array.from({ length: 180 }, () => ({
    x:     Math.random() * canvas.width,
    y:     -Math.random() * canvas.height * 0.5,
    size:  Math.random() * 9 + 4,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    vx:    (Math.random() - 0.5) * 5,
    vy:    Math.random() * 4 + 2,
    angle: Math.random() * Math.PI * 2,
    spin:  (Math.random() - 0.5) * 0.25,
    shape: Math.random() > 0.5 ? 'rect' : 'circle',
  }));

  let frameId;
  const start = performance.now();
  const DURATION = 4500;

  function draw(now) {
    const elapsed = now - start;
    const fade = Math.max(0, 1 - (elapsed - DURATION * 0.6) / (DURATION * 0.4));
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = fade;
    pieces.forEach(p => {
      p.x     += p.vx;
      p.y     += p.vy;
      p.angle += p.spin;
      p.vy    += 0.08; // gentle gravity
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillStyle = p.color;
      if (p.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      }
      ctx.restore();
    });
    if (elapsed < DURATION) {
      frameId = requestAnimationFrame(draw);
    } else {
      canvas.remove();
    }
  }
  frameId = requestAnimationFrame(draw);
  setTimeout(() => { cancelAnimationFrame(frameId); canvas.remove(); }, DURATION + 200);
}

// ─── EVENT LISTENERS ──────────────────────────────────────────────────────────
function setupEventListeners() {
  // Habit checkboxes
  document.querySelectorAll('.habit-checkbox').forEach(cb => {
    cb.addEventListener('change', handleHabitToggle);
  });

  // Penalty button
  document.getElementById('screentime-penalty-btn')?.addEventListener('click', handlePenalty);

  // Team buttons
  document.getElementById('createTeamBtn')?.addEventListener('click', () => {
    showTeamModal('create');
  });
  document.getElementById('joinTeamBtn')?.addEventListener('click', () => {
    showTeamModal('join');
  });

  // Modal
  document.getElementById('modalClose')?.addEventListener('click', hideModal);
  document.getElementById('modalOverlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'modalOverlay') hideModal();
  });

  document.getElementById('createTeamAction')?.addEventListener('click', handleCreateTeam);
  document.getElementById('joinTeamAction')?.addEventListener('click', handleJoinTeam);

  // Modal tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`${btn.dataset.tab}Tab`)?.classList.add('active');
    });
  });

  // Date nav
  document.getElementById('prevDay')?.addEventListener('click', () => navigateDate(-1));
  document.getElementById('nextDay')?.addEventListener('click', () => navigateDate(1));

  // Admin user search
  const adminSearch = document.getElementById('adminUserSearch');
  if (adminSearch) {
    let searchTimer;
    adminSearch.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => adminSearchUsers(adminSearch.value.trim()), 400);
    });
  }

  // Logout (add to header if needed)
  addLogoutButton();

  // Socket callbacks
  window.__APP__.onTeamHabitUpdate = (data) => {
    if (state.team) {
      // Refresh team data
      api.get('/api/teams/mine').then(d => {
        state.team = d.team;
        renderTeam();
      }).catch(() => {});
    }
  };

  window.__APP__.onBattleRoundResolved = (data) => {
    api.get('/api/battles/current').then(d => {
      state.currentBattle = d;
      renderBattle();
    }).catch(() => {});
  };

  window.__APP__.onBattleWeeklyResult = (data) => {
    api.get('/api/battles/current').then(d => {
      state.currentBattle = d;
      renderBattle();
    }).catch(() => {});
    api.get('/api/auth/me').then(d => {
      state.user = d.user;
      renderHeader();
      renderDashboard();
    }).catch(() => {});
  };

  window.__APP__.onBattleLiveUpdate = (data) => {
    if (state.currentBattle) {
      state.currentBattle.projected = {
        userScore: data.todayScore,
        doppelgangerScore: 0, // will be recalculated
      };
      renderBattle();
    }
  };
}

async function handleHabitToggle(e) {
  const cb = e.target;
  const habitId = cb.id.replace('-checkbox', '');
  const completed = cb.checked;

  // Optimistic update
  if (!state.dailyLog) state.dailyLog = { completedHabits: [], penaltiesApplied: 0, pointsEarned: 0 };
  const prev = [...(state.dailyLog.completedHabits || [])];
  if (completed && !prev.includes(habitId)) state.dailyLog.completedHabits = [...prev, habitId];
  else state.dailyLog.completedHabits = prev.filter(h => h !== habitId);
  renderHabits();
  renderDashboard();

  try {
    const data = await api.post('/api/habits/toggle', {
      habitId,
      completed,
      dateKey: state.viewingDateKey,
    });
    state.dailyLog = data.log;
    state.user = { ...state.user, ...data.user };
    renderHabits(completed); // pass true when checking, triggers confetti check
    renderHeader();
    renderDashboard();

    if (completed) {
      const allDone = data.log.completedHabits.length === Object.keys(HABITS).length;
      if (!allDone) {
        showToast(`${HABITS[habitId].icon} ${HABITS[habitId].name} done! +${HABITS[habitId].points} pts`, 'success');
      }
    }
  } catch (err) {
    // Revert
    state.dailyLog.completedHabits = prev;
    cb.checked = !completed;
    renderHabits();
    showToast(err.message, 'error');
  }
}

async function handlePenalty() {
  const prev = state.dailyLog ? { ...state.dailyLog } : null;

  try {
    const data = await api.post('/api/habits/penalty', { dateKey: state.viewingDateKey });
    state.dailyLog = data.log;
    state.user = { ...state.user, ...data.user };
    renderHabits();
    renderHeader();
    renderDashboard();
    showToast('Screen time penalty applied: -10 pts', 'warning');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleCreateTeam() {
  const name = document.getElementById('teamName')?.value.trim();
  const description = document.getElementById('teamDescription')?.value.trim();
  if (!name) return showToast('Team name required', 'error');

  try {
    const data = await api.post('/api/teams/create', { name, description });
    state.team = data.team;
    hideModal();
    renderTeam();
    showToast(`Team "${name}" created! Code: ${data.team.joinCode}`, 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleJoinTeam() {
  const code = document.getElementById('teamCode')?.value.trim().toUpperCase();
  if (!code) return showToast('Enter a team code', 'error');

  try {
    const data = await api.post('/api/teams/join', { joinCode: code });
    state.team = data.team;
    hideModal();
    renderTeam();
    showToast(`Joined ${data.team.name}!`, 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function navigateDate(delta) {
  const d = new Date(state.viewingDateKey + 'T12:00:00Z');
  d.setDate(d.getDate() + delta);
  const newKey = d.toISOString().slice(0, 10);
  const today = getTodayKey();

  if (newKey > today) return; // Can't view future

  state.viewingDateKey = newKey;

  try {
    const data = await api.get(`/api/habits/log/${newKey}`);
    state.dailyLog = data.log;
    renderHabits();
    renderDashboard();
  } catch {}
}

// ─── NAV ──────────────────────────────────────────────────────────────────────
function setupNavigation() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const section = btn.dataset.section;
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(section)?.classList.add('active');
      state.currentSection = section;

      if (section === 'battle') renderBattleHistory();
      if (section === 'progress') renderProgress();
      if (section === 'team') renderTeamLeaderboard();
      if (section === 'admin') { loadAdminStats(); loadAdminTeams(); }
    });
  });
}

async function renderTeamLeaderboard() {
  const listEl = document.getElementById('teamLeaderboard');
  if (!listEl) return;
  try {
    const data = await api.get('/api/teams/leaderboard');
    listEl.innerHTML = data.teams.map(t => `
      <div class="leaderboard-item">
        <span class="lb-rank">#${t.rank}</span>
        <span class="lb-name">${t.name}</span>
        <span class="lb-score">${Math.round(t.weeklyPoints)} pts</span>
        <span class="lb-members">${t.memberCount} members</span>
      </div>`).join('');
  } catch {}
}

// ─── MODAL ────────────────────────────────────────────────────────────────────
function showTeamModal(tab = 'create') {
  const overlay = document.getElementById('modalOverlay');
  if (!overlay) return;
  overlay.classList.add('active');
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tab);
  });
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.getElementById(`${tab}Tab`)?.classList.add('active');
}

function hideModal() {
  document.getElementById('modalOverlay')?.classList.remove('active');
}

// ─── ADMIN ────────────────────────────────────────────────────────────────────
async function loadAdminStats() {
  try {
    const data = await api.get('/api/admin/stats');
    setText('adminStatUsers', data.totalUsers);
    setText('adminStatVerified', data.verifiedUsers);
    setText('adminStatTeams', data.totalTeams);
    setText('adminStatActive', data.activeToday);
  } catch (err) {
    showToast('Failed to load admin stats: ' + err.message, 'error');
  }
}

async function adminSearchUsers(query = '') {
  const list = document.getElementById('adminUserList');
  if (!list) return;
  list.innerHTML = '<div style="color:#555;padding:12px;">Loading...</div>';
  try {
    const url = query ? `/api/admin/users?search=${encodeURIComponent(query)}&limit=20` : '/api/admin/users?limit=20';
    const data = await api.get(url);
    if (!data.users.length) {
      list.innerHTML = '<div style="color:#555;padding:12px;">No users found.</div>';
      return;
    }
    list.innerHTML = data.users.map(u => `
      <div style="background:#1a1a2e;border:1px solid #2a2a3e;border-radius:8px;padding:12px 16px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
        <div style="flex:1;min-width:150px;">
          <div style="color:#fff;font-weight:700;">${u.username} ${u.isAdmin ? '<span style="color:#ff9900;font-size:.75rem;">[admin]</span>' : ''}</div>
          <div style="color:#555;font-size:.8rem;">${u.email}</div>
          <div style="color:#888;font-size:.75rem;">${u.tier} · ${u.totalPowerPoints} pts · streak ${u.currentStreak}</div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          ${!u.emailVerified ? `<button onclick="adminVerifyUser('${u.id}')" style="background:#00d4ff;color:#000;border:none;border-radius:4px;padding:4px 10px;cursor:pointer;font-size:.75rem;font-weight:700;">Verify</button>` : '<span style="color:#00ff88;font-size:.75rem;">✓ Verified</span>'}
          <button onclick="adminToggleAdmin('${u.id}')" style="background:#ff9900;color:#000;border:none;border-radius:4px;padding:4px 10px;cursor:pointer;font-size:.75rem;font-weight:700;">${u.isAdmin ? 'Revoke Admin' : 'Make Admin'}</button>
          <button onclick="adminDeleteUser('${u.id}', '${u.username}')" style="background:#ff4444;color:#fff;border:none;border-radius:4px;padding:4px 10px;cursor:pointer;font-size:.75rem;font-weight:700;">Delete</button>
        </div>
      </div>`).join('');
  } catch (err) {
    list.innerHTML = `<div style="color:#ff4444;padding:12px;">${err.message}</div>`;
  }
}

async function loadAdminTeams() {
  const list = document.getElementById('adminTeamList');
  if (!list) return;
  list.innerHTML = '<div style="color:#555;padding:12px;">Loading...</div>';
  try {
    const data = await api.get('/api/admin/teams');
    if (!data.teams.length) {
      list.innerHTML = '<div style="color:#555;padding:12px;">No teams yet.</div>';
      return;
    }
    list.innerHTML = data.teams.map(t => `
      <div style="background:#1a1a2e;border:1px solid #2a2a3e;border-radius:8px;padding:12px 16px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
        <div style="flex:1;min-width:150px;">
          <div style="color:#fff;font-weight:700;">${t.name}</div>
          <div style="color:#888;font-size:.8rem;">Code: <span style="color:#00d4ff;">${t.joinCode}</span> · Owner: ${t.owner} · ${t.memberCount} members</div>
          <div style="color:#555;font-size:.75rem;">${t.members.map(m => `${m.username}${m.role === 'owner' ? '👑' : ''}`).join(', ')}</div>
        </div>
        <button onclick="adminDeleteTeam('${t.id}', '${t.name.replace(/'/g, "\\'")}')" style="background:#ff4444;color:#fff;border:none;border-radius:4px;padding:4px 10px;cursor:pointer;font-size:.75rem;font-weight:700;">Delete</button>
      </div>`).join('');
  } catch (err) {
    list.innerHTML = `<div style="color:#ff4444;padding:12px;">${err.message}</div>`;
  }
}

async function adminVerifyUser(userId) {
  try {
    await api.post(`/api/admin/users/${userId}/verify`);
    showToast('User email verified.', 'success');
    adminSearchUsers(document.getElementById('adminUserSearch')?.value || '');
  } catch (err) { showToast(err.message, 'error'); }
}

async function adminToggleAdmin(userId) {
  try {
    const data = await api.post(`/api/admin/users/${userId}/toggle-admin`);
    showToast(`Admin status ${data.isAdmin ? 'granted' : 'revoked'}.`, 'success');
    adminSearchUsers(document.getElementById('adminUserSearch')?.value || '');
  } catch (err) { showToast(err.message, 'error'); }
}

async function adminDeleteUser(userId, username) {
  if (!confirm(`Delete user "${username}"? This cannot be undone.`)) return;
  try {
    await api.delete(`/api/admin/users/${userId}`);
    showToast(`User "${username}" deleted.`, 'success');
    adminSearchUsers(document.getElementById('adminUserSearch')?.value || '');
  } catch (err) { showToast(err.message, 'error'); }
}

async function adminDeleteTeam(teamId, name) {
  if (!confirm(`Delete team "${name}"? All members will be removed.`)) return;
  try {
    await api.delete(`/api/admin/teams/${teamId}`);
    showToast(`Team "${name}" deleted.`, 'success');
    loadAdminTeams();
  } catch (err) { showToast(err.message, 'error'); }
}

// Expose admin functions globally (called from inline onclick)
window.kickMember = kickMember;
window.adminVerifyUser = adminVerifyUser;
window.adminToggleAdmin = adminToggleAdmin;
window.adminDeleteUser = adminDeleteUser;
window.adminDeleteTeam = adminDeleteTeam;

// ─── SKELETONS ────────────────────────────────────────────────────────────────
function showSkeletons() {
  document.querySelectorAll('.stat-value').forEach(el => {
    el.classList.add('skeleton');
    el.dataset.original = el.textContent;
    el.textContent = '';
  });
}

function hideSkeletons() {
  document.querySelectorAll('.skeleton').forEach(el => {
    el.classList.remove('skeleton');
    if (el.dataset.original !== undefined) {
      el.textContent = el.dataset.original;
      delete el.dataset.original;
    }
  });
}

// ─── LOGOUT ───────────────────────────────────────────────────────────────────
function addLogoutButton() {
  const userInfo = document.querySelector('.user-info');
  if (!userInfo || userInfo.querySelector('.logout-btn')) return;
  const btn = document.createElement('button');
  btn.className = 'logout-btn';
  btn.textContent = 'Logout';
  btn.addEventListener('click', async () => {
    try { await api.post('/api/auth/logout'); } catch {}
    clearAccessToken();
    state.user = null;
    state.team = null;
    showAuthScreen();
  });
  userInfo.appendChild(btn);
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function calcTierProgress(pts) {
  const tier = TIERS.find(t => pts >= t.min) || TIERS[TIERS.length - 1];
  const next = TIERS[TIERS.indexOf(tier) - 1];
  if (!next) return '100%';
  const pct = Math.round(((pts - tier.min) / (next.min - tier.min)) * 100);
  return `${Math.min(pct, 100)}%`;
}

function getNextTierThreshold(pts) {
  const tier = TIERS.find(t => pts >= t.min) || TIERS[TIERS.length - 1];
  const next = TIERS[TIERS.indexOf(tier) - 1];
  return next ? next.min : tier.min;
}

function tierColor(tier) {
  const map = { goggins: '#ff4500', diamond: '#00d4ff', platinum: '#e5e4e2', gold: '#ffd700', silver: '#c0c0c0', bronze: '#cd7f32' };
  return map[tier] || '#888';
}

function formatDate(dateKey) {
  return new Date(dateKey + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

// ─── LEGACY LOCALSTORAGE MIGRATION ───────────────────────────────────────────
// Called after a successful login or session restore.
// If the user has old localStorage data (from before the API-backed version),
// offer to import it once, then clear it.
async function checkLegacyMigration() {
  const MIGRATED_KEY = 'dg_migrated_v1';
  if (localStorage.getItem(MIGRATED_KEY)) return; // already done

  let legacyRaw;
  try { legacyRaw = localStorage.getItem('doppelganger_data'); } catch { return; }
  if (!legacyRaw) return;

  let legacyData;
  try { legacyData = JSON.parse(legacyRaw); } catch { return; }

  const dailyData = legacyData.dailyData;
  if (!dailyData || !Object.keys(dailyData).length) {
    localStorage.setItem(MIGRATED_KEY, '1');
    return;
  }

  // Show a non-blocking toast asking to migrate
  showMigrationBanner(dailyData);
}

function showMigrationBanner(dailyData) {
  const days = Object.keys(dailyData).length;
  const banner = document.createElement('div');
  banner.id = 'migration-banner';
  banner.style.cssText = `
    position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:9998;
    background:#1a1a2e;border:1px solid rgba(0,212,255,.3);border-radius:10px;
    padding:18px 22px;width:420px;max-width:95vw;box-shadow:0 8px 30px rgba(0,0,0,.7);
  `;
  banner.innerHTML = `
    <p style="color:#00d4ff;font-weight:700;margin:0 0 6px;">Import your old progress?</p>
    <p style="color:#888;font-size:.85rem;margin:0 0 14px;">
      We found <strong style="color:#fff">${days} days</strong> of local data from the old version.
      Import it to your account so you never lose your streak.
    </p>
    <div style="display:flex;gap:10px;">
      <button id="migrate-yes" style="flex:1;padding:9px;background:#00d4ff;color:#000;border:none;
              border-radius:6px;font-weight:700;cursor:pointer;">Import</button>
      <button id="migrate-no"  style="flex:1;padding:9px;background:transparent;color:#666;
              border:1px solid #333;border-radius:6px;cursor:pointer;">Skip</button>
    </div>`;

  document.body.appendChild(banner);

  document.getElementById('migrate-yes').addEventListener('click', async () => {
    banner.remove();
    try {
      const result = await api.post('/api/auth/import-legacy', { dailyData });
      localStorage.setItem('dg_migrated_v1', '1');
      showToast(`Imported ${result.imported} days of history!`, 'success');
      // Refresh user data
      const meData = await api.get('/api/auth/me').catch(() => null);
      if (meData) { state.user = meData.user; renderAll(); }
    } catch (e) {
      showToast(`Import failed: ${e.message}`, 'error');
    }
  });

  document.getElementById('migrate-no').addEventListener('click', () => {
    banner.remove();
    localStorage.setItem('dg_migrated_v1', '1');
  });
}

// Handle ?verified=1 query param (redirect from email verification link)
function checkVerifiedParam() {
  if (new URLSearchParams(window.location.search).get('verified') === '1') {
    // Clean URL
    window.history.replaceState({}, '', window.location.pathname);
    showToast('Email verified! You can now log in.', 'success');
  }
}

// ─── BOOT ─────────────────────────────────────────────────────────────────────
window.__APP__ = window.__APP__ || {};
window.__APP__.showToast = showToast;

document.addEventListener('DOMContentLoaded', () => {
  checkVerifiedParam();
  bootstrap();
});
