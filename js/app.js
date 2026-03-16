const App = (() => {
  let currentRoom = null;
  let myRole = null;

  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('screen-' + id).classList.add('active');
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
    const initials = profile.username.slice(0, 2).toUpperCase();
    document.getElementById('home-avatar').textContent = initials;
    document.getElementById('home-username').textContent = profile.username;
    document.getElementById('home-coin').textContent = profile.coin + ' coin';
  }

  function bindEvents() {
    // Auth
    document.getElementById('btn-login').onclick = async () => {
      const email = document.getElementById('auth-email').value.trim();
      const pass = document.getElementById('auth-password').value;
      const msg = document.getElementById('auth-msg');
      msg.className = 'msg';
      msg.textContent = '';
      try {
        await Auth.login(email, pass);
        await loadHome();
        showScreen('home');
      } catch (e) {
        msg.textContent = e.message;
      }
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
      } catch (e) {
        msg.textContent = e.message;
      }
    };

    // Home nav
    document.getElementById('btn-play').onclick = () => openLobby();
    document.getElementById('btn-dex').onclick = () => alert('Dex — coming soon!');
    document.getElementById('btn-upgrade').onclick = () => alert('Upgrade — coming soon!');
    document.getElementById('btn-settings').onclick = async () => {
      if (confirm('Đăng xuất?')) {
        await Auth.logout();
        showScreen('auth');
      }
    };

    // Lobby
    document.getElementById('btn-lobby-back').onclick = () => {
      Lobby.unsubscribe();
      showScreen('home');
    };

    document.getElementById('btn-create-room').onclick = async () => {
      try {
        const room = await Lobby.createRoom();
        enterGame(room, 'creator');
      } catch (e) {
        alert('Lỗi tạo phòng: ' + e.message);
      }
    };

    // Game
    document.getElementById('btn-game-back').onclick = () => {
      if (!confirm('Thoát ván cờ? Bạn sẽ thua.')) return;
      leaveGame();
    };
  }

  async function openLobby() {
    showScreen('lobby');
    const rooms = await Lobby.getRooms();
    Lobby.renderRooms(rooms, (room) => enterGame(room, 'opponent'));

    Lobby.subscribeRooms(async () => {
      const updated = await Lobby.getRooms();
      Lobby.renderRooms(updated, (room) => enterGame(room, 'opponent'));
    });
  }

  function enterGame(room, role) {
    currentRoom = room;
    myRole = role;

    Lobby.unsubscribe();
    showScreen('game');

    const statusEl = document.getElementById('game-status');

    if (role === 'creator') {
      statusEl.textContent = 'Đang chờ đối thủ...';

      // Watch for opponent joining
      Sync.subscribeRoom(room.id, (updatedRoom) => {
        if (updatedRoom.status === 'playing' && updatedRoom.opponent_id) {
          currentRoom = updatedRoom;
          statusEl.textContent = 'Đối thủ đã vào! Bắt đầu...';
          startGame();
        }
      });
    } else {
      // opponent joined, start immediately
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

  return { init, enterGame, leaveGame, showScreen };
})();

document.addEventListener('DOMContentLoaded', () => App.init());