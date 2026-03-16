const Sync = (() => {
  let moveChannel = null;
  let roomChannel = null;

  function subscribeRoom(roomId, onRoomUpdate) {
    roomChannel = db
      .channel('room-state-' + roomId)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'rooms',
        filter: `id=eq.${roomId}`
      }, payload => onRoomUpdate(payload.new))
      .subscribe();
  }

  function subscribeMoves(roomId, onMove) {
    moveChannel = db
      .channel('moves-' + roomId)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'moves',
        filter: `room_id=eq.${roomId}`
      }, payload => onMove(payload.new))
      .subscribe();
  }

  async function sendMove(roomId, fromSq, toSq, promotion) {
    const user = Auth.getUser();
    const { error } = await db.from('moves').insert({
      room_id: roomId,
      player_id: user.id,
      from_sq: fromSq,
      to_sq: toSq,
      promotion: promotion || null
    });
    if (error) throw error;
  }

  async function getMoves(roomId) {
    const { data } = await db
      .from('moves').select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true });
    return data || [];
  }

  function unsubscribe() {
    if (moveChannel) { db.removeChannel(moveChannel); moveChannel = null; }
    if (roomChannel) { db.removeChannel(roomChannel); roomChannel = null; }
  }

  return { subscribeRoom, subscribeMoves, sendMove, getMoves, unsubscribe };
})();