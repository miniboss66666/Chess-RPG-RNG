const Lobby = (() => {
  let roomChannel = null;
  let miniBoards = {};

  async function getRooms() {
    const { data, error } = await window.db
      .from('rooms')
      .select('*')
      .in('status', ['waiting', 'playing'])
      .order('created_at', { ascending: false });
    if (error) { console.error('getRooms', error); return []; }
    return data || [];
  }

  async function createRoom(settings) {
    const user = Auth.getUser();
    const { data, error } = await window.db
      .from('rooms')
      .insert({
        created_by: user.id,
        status: 'waiting',
        time_limit: settings.timeLimit,
        creator_color: settings.color,
        is_private: settings.isPrivate,
        password: settings.password || null,
        mode: settings.mode,
        board_state: ''
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async function joinRoom(roomId, password) {
    const user = Auth.getUser();
    const { data: room } = await window.db
      .from('rooms').select('*').eq('id', roomId).single();
    if (room.is_private && room.password !== password) throw new Error('Sai mật khẩu!');
    const { data, error } = await window.db
      .from('rooms')
      .update({ opponent_id: user.id, status: 'playing' })
      .eq('id', roomId).eq('status', 'waiting')
      .select().single();
    if (error) throw error;
    return data;
  }

  async function deleteRoom(roomId) {
    await window.db.from('moves').delete().eq('room_id', roomId);
    await window.db.from('rooms').delete().eq('id', roomId);
  }

  function subscribeRooms(onChange) {
    roomChannel = window.db
      .channel('rooms-lobby')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, onChange)
      .subscribe();
  }

  function unsubscribe() {
    if (roomChannel) { window.db.removeChannel(roomChannel); roomChannel = null; }
  }

  function renderMiniBoard(canvas, boardState) {
    const ctx = canvas.getContext('2d');
    const S = canvas.width / 8;
    const SYMBOLS = {
      wK:'♔',wQ:'♕',wR:'♖',wB:'♗',wN:'♘',wP:'♙',
      bK:'♚',bQ:'♛',bR:'♜',bB:'♝',bN:'♞',bP:'♟'
    };
    let board;
    try {
      board = boardState ? JSON.parse(boardState) : null;
    } catch(e) { board = null; }
    if (!board) {
      board = [
        ['bR','bN','bB','bQ','bK','bB','bN','bR'],
        ['bP','bP','bP','bP','bP','bP','bP','bP'],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        ['wP','wP','wP','wP','wP','wP','wP','wP'],
        ['wR','wN','wB','wQ','wK','wB','wN','wR'],
      ];
    }
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        ctx.fillStyle = (r + c) % 2 === 0 ? '#f0d9b5' : '#b58863';
        ctx.fillRect(c * S, r * S, S, S);
        const p = board[r][c];
        if (p) {
          ctx.font = `${S * 0.75}px serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = p[0] === 'w' ? '#fff' : '#1a1a1a';
          ctx.strokeStyle = p[0] === 'w' ? '#555' : '#ccc';
          ctx.lineWidth = 0.5;
          ctx.strokeText(SYMBOLS[p], c * S + S/2, r * S + S/2);
          ctx.fillText(SYMBOLS[p], c * S + S/2, r * S + S/2);
        }
      }
    }
  }

  async function renderRooms(rooms) {
    const grid = document.getElementById('room-grid');
    const empty = document.getElementById('lobby-empty');
    if (!grid) return;

    const user = Auth.getUser();
    const ids = [...new Set(rooms.filter(r=>r.created_by).map(r=>r.created_by))];
    let nameMap = {};
    if (ids.length > 0) {
      const { data: profiles } = await window.db
        .from('profiles').select('id,username').in('id', ids);
      (profiles||[]).forEach(p => nameMap[p.id] = p.username);
    }

    if (rooms.length === 0) {
      grid.innerHTML = '';
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';

    grid.innerHTML = rooms.map(r => {
      const name = nameMap[r.created_by] || 'Ẩn danh';
      const isOwn = r.created_by === user?.id;
      const isWaiting = r.status === 'waiting';
      const timeLbl = r.time_limit === 0 ? '∞' : r.time_limit + 's';
      const modeLbl = r.mode === '960' ? 'Chess960' : 'Tiêu chuẩn';
      const statusLbl = isWaiting ? 'Chờ người chơi' : 'Đang chơi';
      const statusColor = isWaiting ? '#4aaa6e' : '#f0b84a';

      return `<div class="room-card" id="rcard-${r.id}">
        <canvas class="mini-board" id="mb-${r.id}" width="120" height="120"></canvas>
        <div class="room-card-info">
          <div class="room-card-name">${isOwn ? '⚑ Phòng của bạn' : 'Phòng của ' + name}</div>
          <div class="room-card-meta">
            <span style="color:${statusColor}">${statusLbl}</span>
            · ${timeLbl}/lượt · ${modeLbl}
            ${r.is_private ? ' · 🔒' : ''}
          </div>
          <div class="room-card-actions">
            ${isWaiting && !isOwn
              ? `<button class="join-btn" onclick="Lobby._join('${r.id}',${r.is_private})">Vào</button>`
              : isWaiting && isOwn
              ? `<span class="waiting-lbl">Chờ đối thủ...</span>`
              : `<button class="watch-btn" onclick="Lobby._watch('${r.id}')">Xem live</button>`
            }
          </div>
        </div>
      </div>`;
    }).join('');

    rooms.forEach(r => {
      const canvas = document.getElementById('mb-' + r.id);
      if (canvas) renderMiniBoard(canvas, r.board_state);
    });
  }

  function _join(roomId, isPrivate) {
    let pw = null;
    if (isPrivate) {
      pw = prompt('Nhập mật khẩu phòng:');
      if (pw === null) return;
    }
    Lobby.joinRoom(roomId, pw)
      .then(room => App.enterGame(room, 'opponent'))
      .catch(e => App.showToast(e.message, 'error'));
  }

  function _watch(roomId) {
    App.showToast('Tính năng xem live đang phát triển!', 'soon');
  }

  return { getRooms, createRoom, joinRoom, deleteRoom, subscribeRooms, unsubscribe, renderRooms, _join, _watch };
})();