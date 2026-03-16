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
      toast.style.cssText = `
        position:fixed; bottom:24px; left:50%; transform:translateX(-50%);
        background:var(--bg3); border:1px solid var(--border);
        color:var(--text); padding:10px 20px; border-radius:8px;
        font-size:13px; z-index:9999; transition:opacity .3s;
        white-space:nowrap;
      `;
      document.body.appendChild(toast);
    }
    if (type === 'soon') toast.style.borderColor = 'var(--accent)';
    else if (type === 'error') toast.style.borderColor = 'var(--danger)';
    else toast.style.borderColor = 'var(--border)';
    toast.textContent = msg;
    toast.style.opacity = '1';
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toast.style.opacity = '0', 2500);
  }

  async function init() {
    const user = await Auth.init();
    if (user) {
      await loadHome();
      showScreen('home');
    } else {
      showScreen('auth');
    }
    bindEvents();
  }

  async function loadHome() {
    const profile = await Auth.getProfile();
    if (!profile) return;
    document.getElementById('home-avatar').textContent = profile.username.slice(0, 2).toUpperCase();
    document.getElementById('home-username').textContent = profile.username;
    document.getElementById('home-coin').textContent = profile.coin + ' coin';
  }

  function bindEvents() {
    document.getElementById('btn-login').onclick = async () => {
      const email = document.getElementById('auth-email').value.trim();
      const pass = document.getElementById('auth-password').value;
      const msg = document.getElementById('auth-msg');
      msg.className = 'msg'; msg.textContent = '';
      try {
        await Auth.login(email, pass);
        await loadHome();
        showScreen('home');
      } catch (e) { msg.textContent = e.message; }
    };

    document.getElementById('btn-register').onclick = async () => {
      const email = document.getElementById('auth-email').value.trim();
      const pass = document.getElementById('auth-password').value;
      const msg = document.getElementById('auth-msg');
      msg.className = 'msg';
      if (!email || !pass) { msg.textContent = 'Nhập email và mật khẩu'; return; }
      if (pass.length < 6) { msg.textContent = 'Mật khẩu ít nhất 6 ký tự'; return; }
      try {
        await Auth.register(email, pass);
        msg.className = 'msg ok';
        msg.textContent = 'Đăng ký thành công! Kiểm tra email xác nhận.';
      } catch (e) { msg.textContent = e.message; }
    };

    document.getElementById('btn-play').onclick = () => openLobby();

    document.getElementById('btn-dex').onclick = () => {
      showToast('📖 Dex — coming soon!', 'soon');
    };

    document.getElementById('btn-upgrade').onclick = () => {
      showToast('⭐ Upgrade — coming soon!', 'soon');
    };

    document.getElementById('btn-settings').onclick = () => openSettings();

    document.getElementById('btn-lobby-back').onclick = () => {
      Lobby.unsubscribe();
      showScreen('home');
    };

    document.getElementById('btn-create-room').onclick = async () => {
      try {
        const room = await Lobby.createRoom();
        enterGame(room, 'creator');
      } catch (e) { showToast('Lỗi tạo phòng: ' + e.message, 'error'); }
    };

    document.getElementById('btn-game-back').onclick = () => {
      if (!confirm('Thoát ván cờ?')) return;
      leaveGame();
    };

    document.getElementById('btn-settings-back').onclick = () => showScreen('home');

    document.getElementById('btn-logout').onclick = async () => {
      if (!confirm('Đăng xuất?')) return;
      await Auth.logout();
      showScreen('auth');
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

  function enterGame(room, role) {
    currentRoom = room;
    myRole = role;
    Lobby.unsubscribe();
    showScreen('game');

    const statusEl = document.getElementById('game-status');

    if (role === 'creator') {
      statusEl.textContent = 'Đang chờ đối thủ...';
      Sync.subscribeRoom(room.id, (updatedRoom) => {
        if (updatedRoom.status === 'playing' && updatedRoom.opponent_id) {
          currentRoom = updatedRoom;
          statusEl.textContent = 'Bắt đầu!';
          startGame();
        }
      });
    } else {
      statusEl.textContent = 'Bắt đầu trận đấu!';
      startGame();
    }
  }

  function startGame() {
    ChessGame.start(currentRoom, myRole);
    Sync.subscribeMoves(currentRoom.id, (move) => {
      ChessGame.handleOpponentMove(move);
    });
  }

  function leaveGame() {
    Sync.unsubscribe();
    ChessGame.destroy();
    currentRoom = null;
    myRole = null;
    showScreen('home');
    loadHome();
  }

  return { init, enterGame, leaveGame, showScreen, showToast };
})();

document.addEventListener('DOMContentLoaded', () => App.init());