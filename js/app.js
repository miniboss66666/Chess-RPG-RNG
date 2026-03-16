const VERSION = 'v0.1.0';

const App = (() => {
  let currentRoom = null;
  let myRole = null;

  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('screen-' + id).classList.add('active');
  }

  function showToast(msg, type = 'info') {
    let toast = document.getElementById('toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'toast';
      toast.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:var(--bg3);border:1px solid var(--border);color:var(--text);padding:10px 20px;border-radius:8px;font-size:13px;z-index:9999;transition:opacity .3s;white-space:nowrap;pointer-events:none;';
      document.body.appendChild(toast);
    }
    toast.style.borderColor = type==='soon'?'var(--accent)':type==='error'?'var(--danger)':'var(--border)';
    toast.textContent = msg;
    toast.style.opacity = '1';
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toast.style.opacity = '0', 2500);
  }

  async function init() {
    bindEvents();
    const user = await Auth.init();
    if (!user) { showScreen('auth'); return; }

    await loadHome();

    // Check phòng waiting
    const { data: myRooms } = await window.db
      .from('rooms').select('*')
      .eq('created_by', user.id).eq('status', 'waiting').limit(1);

    if (myRooms && myRooms.length > 0) {
      const rejoin = confirm('Bạn còn phòng đang chờ đối thủ. Vào lại không?');
      if (rejoin) { showScreen('home'); enterGame(myRooms[0], 'creator'); return; }
      else await Lobby.deleteRoom(myRooms[0].id);
    }

    // Check phòng đang chơi
    const { data: playingRooms } = await window.db
      .from('rooms').select('*')
      .or(`created_by.eq.${user.id},opponent_id.eq.${user.id}`)
      .eq('status', 'playing').limit(1);

    if (playingRooms && playingRooms.length > 0) {
      const rejoin = confirm('Bạn đang có ván cờ dở. Vào lại không?');
      if (rejoin) {
        showScreen('home');
        const room = playingRooms[0];
        enterGame(room, room.created_by === user.id ? 'creator' : 'opponent');
        return;
      } else await Lobby.deleteRoom(playingRooms[0].id);
    }

    showScreen('home');
  }

  async function loadHome() {
    const profile = await Auth.getProfile();
    if (!profile) return;
    document.getElementById('home-avatar').textContent = profile.username.slice(0,2).toUpperCase();
    document.getElementById('home-username').textContent = profile.username;
    document.getElementById('home-coin').textContent = profile.coin + ' coin';
  }

  function bindEvents() {
    document.getElementById('btn-login').onclick = async () => {
      const email = document.getElementById('auth-email').value.trim();
      const pass = document.getElementById('auth-password').value;
      const msg = document.getElementById('auth-msg');
      msg.className = 'msg'; msg.textContent = '';
      try { await Auth.login(email, pass); await loadHome(); showScreen('home'); }
      catch(e) { msg.textContent = e.message; }
    };

    document.getElementById('btn-register').onclick = async () => {
      const email = document.getElementById('auth-email').value.trim();
      const pass = document.getElementById('auth-password').value;
      const msg = document.getElementById('auth-msg');
      msg.className = 'msg';
      if (!email||!pass) { msg.textContent='Nhập email và mật khẩu'; return; }
      if (pass.length<6) { msg.textContent='Mật khẩu ít nhất 6 ký tự'; return; }
      try {
        await Auth.register(email, pass);
        msg.className='msg ok';
        msg.textContent='Đăng ký thành công! Kiểm tra email xác nhận.';
      } catch(e) { msg.textContent=e.message; }
    };

    document.getElementById('btn-play').onclick = () => openLobby();
    document.getElementById('btn-dex').onclick = () => showToast('📖 Dex — coming soon!', 'soon');
    document.getElementById('btn-upgrade').onclick = () => showToast('⭐ Upgrade — coming soon!', 'soon');
    document.getElementById('btn-settings').onclick = () => openSettings();

    document.getElementById('btn-lobby-back').onclick = () => {
      Lobby.unsubscribe(); showScreen('home');
    };

    document.getElementById('btn-create-room').onclick = async () => {
      const user = Auth.getUser();
      const { data } = await window.db.from('rooms')
        .select('id').eq('created_by', user.id).eq('status', 'waiting').limit(1);
      if (data && data.length > 0) { showToast('Bạn đang có phòng chờ rồi!', 'error'); return; }
      showScreen('create-room');
    };

    document.getElementById('btn-create-back').onclick = () => showScreen('lobby');

    document.getElementById('btn-confirm-create').onclick = async () => {
      const timeLimit = parseInt(document.getElementById('setting-time').value);
      const color = document.getElementById('setting-color').value;
      const mode = document.getElementById('setting-mode').value;
      const isPrivate = document.getElementById('setting-private').checked;
      const password = isPrivate ? document.getElementById('setting-password').value : null;
      if (isPrivate && !password) { showToast('Nhập mật khẩu phòng!', 'error'); return; }
      try {
        const room = await Lobby.createRoom({ timeLimit, color, mode, isPrivate, password });
        enterGame(room, 'creator');
      } catch(e) { showToast('Lỗi tạo phòng: ' + e.message, 'error'); }
    };

    document.getElementById('setting-private').onchange = (e) => {
      document.getElementById('password-row').style.display = e.target.checked ? 'flex' : 'none';
    };

    document.getElementById('btn-game-back').onclick = async () => {
      if (currentRoom) {
        // Nếu đang chơi (có 2 người) mới cần confirm
        if (currentRoom.status === 'playing') {
          if (!confirm('Thoát ván cờ đang diễn ra?')) return;
        }
        await Lobby.deleteRoom(currentRoom.id);
      }
      leaveGame();
    };

    document.getElementById('btn-settings-back').onclick = () => showScreen('home');
    document.getElementById('btn-logout').onclick = async () => {
      if (!confirm('Đăng xuất?')) return;
      await Auth.logout(); showScreen('auth');
    };
  }

  async function openLobby() {
    showScreen('lobby');
    const rooms = await Lobby.getRooms();
    await Lobby.renderRooms(rooms);
    Lobby.subscribeRooms(async () => {
      const updated = await Lobby.getRooms();
      await Lobby.renderRooms(updated);
    });
  }

  async function openSettings() {
    const user = Auth.getUser();
    const profile = await Auth.getProfile();
    document.getElementById('settings-username').textContent = profile?.username || '...';
    document.getElementById('settings-email').textContent = user?.email || '...';
    showScreen('settings');
  }

  function showRoomInfo(room, role) {
    const infoBar = document.getElementById('room-info-bar');
    if (!infoBar) return;
    infoBar.style.display = 'flex';
    const timeLabel = room.time_limit === 0 ? '∞/lượt' : room.time_limit + 's/lượt';
    const colorLabel = role === 'creator'
      ? (room.creator_color === 'white' ? '♔ Trắng' : room.creator_color === 'black' ? '♚ Đen' : '🎲 Random')
      : (room.creator_color === 'white' ? '♚ Đen' : room.creator_color === 'black' ? '♔ Trắng' : '🎲 Random');
    document.getElementById('info-mode').textContent = room.mode === '960' ? '♟ Chess 960' : '♟ Tiêu chuẩn';
    document.getElementById('info-time').textContent = '⏱ ' + timeLabel;
    document.getElementById('info-color').textContent = colorLabel;
    document.getElementById('info-private').textContent = room.is_private ? '🔒' : '';
  }

  function enterGame(room, role) {
    currentRoom = room; myRole = role;
    Lobby.unsubscribe();
    showScreen('game');
    showRoomInfo(room, role);

    const statusEl = document.getElementById('game-status');
    const turnEl = document.getElementById('turn-indicator');

    if (role === 'creator') {
      statusEl.textContent = 'Đang chờ đối thủ...';
      if (turnEl) { turnEl.textContent = 'Chờ...'; turnEl.className = 'turn-badge'; }

      // Hiện bàn cờ preview ngay
      setTimeout(() => ChessGame.startPreview(), 50);

      Sync.subscribeRoom(room.id, (updatedRoom) => {
        if (updatedRoom.status === 'playing' && updatedRoom.opponent_id) {
          currentRoom = updatedRoom;
          statusEl.textContent = 'Bắt đầu!';
          ChessGame.destroy();
          setTimeout(() => startGame(), 100);
        }
      });
    } else {
      statusEl.textContent = 'Bắt đầu trận đấu!';
      setTimeout(() => startGame(), 50);
    }
  }

  function startGame() {
    ChessGame.start(currentRoom, myRole);
    Sync.subscribeMoves(currentRoom.id, (move) => ChessGame.handleOpponentMove(move));
  }

  function leaveGame() {
    Sync.unsubscribe();
    ChessGame.destroy();
    currentRoom = null; myRole = null;
    const infoBar = document.getElementById('room-info-bar');
    if (infoBar) infoBar.style.display = 'none';
    showScreen('home');
    loadHome();
  }

  return { init, enterGame, leaveGame, showScreen, showToast };
})();

document.addEventListener('DOMContentLoaded', () => App.init());

window.addEventListener('beforeunload', () => {
  if (currentRoom && currentRoom.status === 'waiting') {
    const key = 'apikey';
    const url = `https://dwenhgluxjixvswlzlfk.supabase.co/rest/v1/rooms?id=eq.${currentRoom.id}`;
    navigator.sendBeacon && navigator.sendBeacon(url);
  }
});