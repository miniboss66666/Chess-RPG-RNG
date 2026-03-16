const Lobby = (() => {
  let roomChannel = null;

  async function getRooms() {
    const { data, error } = await window.db
      .from('rooms')
      .select('id, created_by, status, created_at')
      .eq('status', 'waiting')
      .order('created_at', { ascending: false });
    if (error) { console.error('getRooms error', error); return []; }
    return data || [];
  }

  async function createRoom() {
    const user = Auth.getUser();
    const { data, error } = await window.db
      .from('rooms')
      .insert({ created_by: user.id, status: 'waiting' })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async function joinRoom(roomId) {
    const user = Auth.getUser();
    const { data, error } = await window.db
      .from('rooms')
      .update({ opponent_id: user.id, status: 'playing' })
      .eq('id', roomId)
      .eq('status', 'waiting')
      .select()
      .single();
    if (error) throw error;
    return data;
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

  async function renderRooms(rooms) {
    const list = document.getElementById('room-list');
    const empty = document.getElementById('lobby-empty');
    const waiting = (rooms || []).filter(r => r.status === 'waiting');

    if (waiting.length === 0) {
      list.innerHTML = '';
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';

    // fetch usernames separately
    const ids = [...new Set(waiting.map(r => r.created_by))];
    const { data: profiles } = await window.db
      .from('profiles')
      .select('id, username')
      .in('id', ids);
    const nameMap = {};
    (profiles || []).forEach(p => nameMap[p.id] = p.username);

    list.innerHTML = waiting.map(r => {
      const name = nameMap[r.created_by] || 'Ẩn danh';
      const time = new Date(r.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
      const isOwn = r.created_by === Auth.getUser()?.id;
      return `
        <div class="room-item">
          <div>
            <div class="room-name">Phòng của ${name}</div>
            <div class="room-meta">Tạo lúc ${time}</div>
          </div>
          ${isOwn
            ? '<span style="font-size:12px;color:var(--text2)">Chờ đối thủ...</span>'
            : `<button class="join-btn" onclick="Lobby._join('${r.id}')">Vào</button>`
          }
        </div>`;
    }).join('');
  }

  function _join(roomId) {
    Lobby.joinRoom(roomId)
      .then(room => App.enterGame(room, 'opponent'))
      .catch(e => alert('Không thể vào phòng: ' + e.message));
  }

  return { getRooms, createRoom, joinRoom, subscribeRooms, unsubscribe, renderRooms, _join };
})();