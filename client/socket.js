// socket.js — Socket.IO client wrapper
// Loaded via <script type="module"> after successful login

// showToast is exposed globally by script.js bootstrap
function showToast(msg, type) {
  window.__APP__?.showToast?.(msg, type) || console.log(`[${type}]`, msg);
}

let _socket = null;

export function initSocket(token) {
  if (_socket) {
    _socket.disconnect();
  }

  // Socket.IO loaded via CDN script tag
  const socketUrl = (() => {
    const u = window.SOCKET_URL || '';
    return u.includes('__BACKEND') ? '' : u;
  })();
  _socket = window.io(socketUrl, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
  });

  _socket.on('connect', () => {
    console.log('[socket] connected:', _socket.id);
  });

  _socket.on('connect_error', (err) => {
    console.warn('[socket] connection error:', err.message);
  });

  _socket.on('disconnect', (reason) => {
    console.log('[socket] disconnected:', reason);
  });

  // ─── TEAM EVENTS ─────────────────────────────────────────────────────────
  _socket.on('team:habit_update', (data) => {
    // Only show notification for OTHER users in the team
    if (data.userId !== window.__APP__?.state?.user?.id) {
      const habitEmoji = _getHabitEmoji(data.habitId);
      const action = data.completed ? 'completed' : 'unchecked';
      showToast(`${data.username} just ${action} ${habitEmoji}`, 'info');
    }

    // Update team score display
    window.__APP__?.onTeamHabitUpdate?.(data);
  });

  _socket.on('team:score_update', (data) => {
    showToast(`Team grade changed to ${data.newGrade}!`, 'success');
    window.__APP__?.onTeamScoreUpdate?.(data);
  });

  _socket.on('team:member_joined', (data) => {
    showToast(`${data.username} joined the team!`, 'info');
    window.__APP__?.onTeamMemberJoined?.(data);
  });

  _socket.on('team:member_left', (data) => {
    showToast(`${data.username} left the team`, 'warning');
  });

  _socket.on('team:member_online', (data) => {
    window.__APP__?.onMemberOnline?.(data);
  });

  // ─── BATTLE EVENTS ────────────────────────────────────────────────────────
  _socket.on('battle:round_resolved', (data) => {
    const { round } = data;
    const won = round.winnerId === 'user';
    showToast(
      `Round ${round.dayNumber} resolved: ${won ? 'You won! 🏆' : 'Shadow won... 😈'} (${round.userScore.toFixed(0)} vs ${round.doppelgangerScore.toFixed(0)} pts)`,
      won ? 'success' : 'error'
    );
    window.__APP__?.onBattleRoundResolved?.(data);
  });

  _socket.on('battle:weekly_result', (data) => {
    const won = data.winnerId === 'user';
    showToast(
      won
        ? `Weekly battle WON! ${data.userWins}-${data.dopWins} rounds. +${data.bonusPoints} pts! 🎉`
        : `Weekly battle lost. ${data.userWins}-${data.dopWins} rounds. Shadow gains power... 👻`,
      won ? 'success' : 'error'
    );
    window.__APP__?.onBattleWeeklyResult?.(data);
  });

  _socket.on('battle:live_update', (data) => {
    window.__APP__?.onBattleLiveUpdate?.(data);
  });

  return _socket;
}

export function getSocket() {
  return _socket;
}

function _getHabitEmoji(habitId) {
  const map = {
    reading: '📚', screentime: '📵', gym: '💪', sleep: '😴',
    deepwork: '🎯', cardio: '🏃', meditation: '🧘', coldshower: '❄️', nutrition: '🍽️',
  };
  return map[habitId] || '✅';
}
