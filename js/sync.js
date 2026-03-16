const Sync = (() => {
  let moveChannel = null;
  let roomChannel = null;
  let currentRoomId = null;

  function subscribeRoom(roomId, onRoomUpdate) {
    currentRoomId = roomId;
    roomChannel = supabase
      .channel('room-state-' + roomId)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'rooms',
        filter: `id=eq.${roomId}`
      }, payload => onRoomUpdate(payload.new))
      .subscribe();
  }

  function subscribeMoves(roomId, onMove) {
    moveChannel = supabase
      .channel('moves-' + roomId)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'moves',
        filter: `room_id=eq.${roomId}`
      }, payload => onMove(payload.new))
      .subscribe();
  }

  async function sendMove(roomId, fromSq, toSq, promotion) {
    const user = Auth.getUser();
    const { error } = await supabase.from('moves').insert({
      room_id: roomId,
      player_id: user.id,
      from_sq: fromSq,
      to_sq: toSq,
      promotion: promotion || null
    });
    if (error) throw error;

    await supabase.from('rooms')
      .update({ current_turn: null })
      .eq('id', roomId);
  }

  async function getMoves(roomId) {
    const { data } = await supabase
      .from('moves')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true });
    return data || [];
  }

  async function setTurn(roomId, userId) {
    await supabase.from('rooms')
      .update({ current_turn: userId })
      .eq('id', roomId);
  }

  function unsubscribe() {
    if (moveChannel) { supabase.removeChannel(moveChannel); moveChannel = null; }
    if (roomChannel) { supabase.removeChannel(roomChannel); roomChannel = null; }
    currentRoomId = null;
  }

  return { subscribeRoom, subscribeMoves, sendMove, getMoves, setTurn, unsubscribe };
})();