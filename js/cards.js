const Cards = (() => {

  // Helper
  function clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }

  // Card định nghĩa theo piece type
  // Mỗi card: { id, name, desc, type, piece, rarity, effect(ctx) }
  // ctx = { attacker, defender, gameState, enPassantUsed, castlingUsed, checkedKing }
  // attacker/defender = { hp, maxHp, armor, piece, color }
  // gameState = { moveCount, pawnsOnBoard, knightsOnBoard, promoted }
  // return { damage, heal, armorBuff, armorDebuff, damageMult, skipTurn, extraTurn, passive, msg }

  const CARD_DEFS = [

    // =========== 5 LÁ CƠ BẢN (tất cả chất) ===========
    { id:'basic_atk1',   name:'Tấn công',      piece:'all', rarity:'common',
      desc:'Gây 10 damage',
      effect(ctx) { return { damage: 10, msg:'Tấn công cơ bản 10 damage' }; }
    },
    { id:'basic_atk2',   name:'Tấn công',      piece:'all', rarity:'common',
      desc:'Gây 10 damage',
      effect(ctx) { return { damage: 10, msg:'Tấn công cơ bản 10 damage' }; }
    },
    { id:'basic_atk3',   name:'Tấn công',      piece:'all', rarity:'common',
      desc:'Gây 10 damage',
      effect(ctx) { return { damage: 10, msg:'Tấn công cơ bản 10 damage' }; }
    },
    { id:'basic_heal1',  name:'Hồi máu',       piece:'all', rarity:'common',
      desc:'Hồi 10 HP',
      effect(ctx) { return { heal: 10, msg:'Hồi 10 HP' }; }
    },
    { id:'basic_heal2',  name:'Hồi máu',       piece:'all', rarity:'common',
      desc:'Hồi 10 HP',
      effect(ctx) { return { heal: 10, msg:'Hồi 10 HP' }; }
    },

    // =========== TỐT (10 lá) ===========
    { id:'pawn_armor1',  name:'Tăng giáp',     piece:'pawn', rarity:'common',
      desc:'Tăng 10% giáp trong lượt này',
      effect(ctx) { return { armorBuff: 0.10, armorDuration: 1, msg:'Tăng 10% giáp 1 lượt' }; }
    },
    { id:'pawn_armor2',  name:'Tăng giáp',     piece:'pawn', rarity:'common',
      desc:'Tăng 10% giáp trong lượt này',
      effect(ctx) { return { armorBuff: 0.10, armorDuration: 1, msg:'Tăng 10% giáp 1 lượt' }; }
    },
    { id:'pawn_block',   name:'Chặn đường',    piece:'pawn', rarity:'rare',
      desc:'Đối phương không thể di chuyển 2 lượt sau khi kết thúc battle',
      effect(ctx) { return { freezeEnemy: 2, msg:'Đối phương bị chặn 2 lượt!' }; }
    },
    { id:'pawn_rage',    name:'Phẫn nộ',       piece:'pawn', rarity:'rare',
      desc:'Máu càng thấp, damage càng cao (10→50)',
      effect(ctx) {
        const hpPct = ctx.attacker.hp / ctx.attacker.maxHp;
        const dmg = Math.round(clamp(10 + (1 - hpPct) * 50, 10, 50));
        return { damage: dmg, msg:`Phẫn nộ: ${dmg} damage (máu ${Math.round(hpPct*100)}%)` };
      }
    },
    { id:'pawn_army',    name:'Sức mạnh đoàn kết', piece:'pawn', rarity:'rare',
      desc:'10 damage/tốt còn trên bàn cờ',
      effect(ctx) {
        const dmg = (ctx.gameState.pawnsOnBoard || 1) * 10;
        return { damage: dmg, msg:`Đoàn kết: ${ctx.gameState.pawnsOnBoard} tốt × 10 = ${dmg} damage` };
      }
    },
    { id:'pawn_fort1',   name:'Kiên cường',    piece:'pawn', rarity:'uncommon',
      desc:'Tăng 50% giáp 1 lượt',
      effect(ctx) { return { armorBuff: 0.50, armorDuration: 1, msg:'Kiên cường: +50% giáp 1 lượt' }; }
    },
    { id:'pawn_fort2',   name:'Kiên cường',    piece:'pawn', rarity:'uncommon',
      desc:'Tăng 50% giáp 1 lượt',
      effect(ctx) { return { armorBuff: 0.50, armorDuration: 1, msg:'Kiên cường: +50% giáp 1 lượt' }; }
    },
    { id:'pawn_ep1',     name:'En Passant',    piece:'pawn', rarity:'uncommon',
      desc:'20 damage, 40 nếu vừa đi en passant',
      effect(ctx) {
        const dmg = ctx.enPassantUsed ? 40 : 20;
        return { damage: dmg, msg:`En Passant: ${dmg} damage${ctx.enPassantUsed?' (en passant bonus!)':''}` };
      }
    },
    { id:'pawn_ep2',     name:'En Passant',    piece:'pawn', rarity:'uncommon',
      desc:'20 damage, 40 nếu vừa đi en passant',
      effect(ctx) {
        const dmg = ctx.enPassantUsed ? 40 : 20;
        return { damage: dmg, msg:`En Passant: ${dmg} damage${ctx.enPassantUsed?' (en passant bonus!)':''}` };
      }
    },
    { id:'pawn_ep3',     name:'En Passant',    piece:'pawn', rarity:'uncommon',
      desc:'20 damage, 40 nếu vừa đi en passant',
      effect(ctx) {
        const dmg = ctx.enPassantUsed ? 40 : 20;
        return { damage: dmg, msg:`En Passant: ${dmg} damage${ctx.enPassantUsed?' (en passant bonus!)':''}` };
      }
    },

    // =========== MÃ (10 lá) ===========
    { id:'knight_extra1', name:'Cú lộn',       piece:'knight', rarity:'uncommon',
      desc:'Lấy thêm 1 lượt rút bài',
      effect(ctx) { return { extraTurn: true, msg:'Rút thêm 1 lượt!' }; }
    },
    { id:'knight_extra2', name:'Cú lộn',       piece:'knight', rarity:'uncommon',
      desc:'Lấy thêm 1 lượt rút bài',
      effect(ctx) { return { extraTurn: true, msg:'Rút thêm 1 lượt!' }; }
    },
    { id:'knight_steal',  name:'Phản kế',      piece:'knight', rarity:'epic',
      desc:'Chọn 1 lá bài của đối phương và dùng luôn',
      effect(ctx) { return { stealCard: true, msg:'Chọn lá bài của đối phương!' }; }
    },
    { id:'knight_dodge1', name:'Né đòn',       piece:'knight', rarity:'rare',
      desc:'Né toàn bộ damage ở lượt tiếp theo của đối phương',
      effect(ctx) { return { dodgeNext: true, msg:'Sẽ né đòn lượt tiếp theo!' }; }
    },
    { id:'knight_dodge2', name:'Né đòn',       piece:'knight', rarity:'rare',
      desc:'Né toàn bộ damage ở lượt tiếp theo của đối phương',
      effect(ctx) { return { dodgeNext: true, msg:'Sẽ né đòn lượt tiếp theo!' }; }
    },
    { id:'knight_amp1',   name:'Tập trung',    piece:'knight', rarity:'uncommon',
      desc:'Tăng 50% damage lượt tiếp theo',
      effect(ctx) { return { damageMult: 1.5, multDuration: 1, msg:'+50% damage lượt sau!' }; }
    },
    { id:'knight_amp2',   name:'Tập trung',    piece:'knight', rarity:'uncommon',
      desc:'Tăng 50% damage lượt tiếp theo',
      effect(ctx) { return { damageMult: 1.5, multDuration: 1, msg:'+50% damage lượt sau!' }; }
    },
    { id:'knight_guard_atk', name:'Đột kích',  piece:'knight', rarity:'rare',
      desc:'20 damage, 50 nếu đang được bảo vệ',
      effect(ctx) {
        const dmg = ctx.attacker.protected ? 50 : 20;
        return { damage: dmg, msg:`Đột kích: ${dmg} damage${ctx.attacker.protected?' (bảo vệ bonus!)':''}` };
      }
    },
    { id:'knight_guard_def', name:'Tư thế',    piece:'knight', rarity:'uncommon',
      desc:'Đang bảo vệ: +30% giáp, không: +10%',
      effect(ctx) {
        const buff = ctx.attacker.protected ? 0.30 : 0.10;
        return { armorBuff: buff, armorDuration: 1, msg:`Tư thế: +${buff*100}% giáp` };
      }
    },
    { id:'knight_heal',   name:'Dưỡng thương', piece:'knight', rarity:'uncommon',
      desc:'Hồi 25% máu, 50% nếu có Mã cùng màu',
      effect(ctx) {
        const pct = ctx.gameState.alliedKnights > 0 ? 0.50 : 0.25;
        const heal = Math.round(ctx.attacker.maxHp * pct);
        return { heal, msg:`Dưỡng thương: hồi ${heal} HP (${pct*100}%)` };
      }
    },

    // =========== TƯỢNG (10 lá) ===========
    { id:'bishop_sniper1', name:'Xạ thủ',      piece:'bishop', rarity:'rare',
      desc:'20 damage, 50 nếu tấn công từ >3 ô chéo',
      effect(ctx) {
        const dmg = (ctx.attackDistance || 0) > 3 ? 50 : 20;
        return { damage: dmg, msg:`Xạ thủ: ${dmg} damage (khoảng cách ${ctx.attackDistance||'?'})` };
      }
    },
    { id:'bishop_sniper2', name:'Xạ thủ',      piece:'bishop', rarity:'rare',
      desc:'20 damage, 50 nếu tấn công từ >3 ô chéo',
      effect(ctx) {
        const dmg = (ctx.attackDistance || 0) > 3 ? 50 : 20;
        return { damage: dmg, msg:`Xạ thủ: ${dmg} damage (khoảng cách ${ctx.attackDistance||'?'})` };
      }
    },
    { id:'bishop_time1',  name:'Tích lũy',     piece:'bishop', rarity:'uncommon',
      desc:'10 + move hiện tại damage (max 50 ở move 40)',
      effect(ctx) {
        const moves = clamp(ctx.gameState.moveCount || 0, 0, 40);
        const dmg = 10 + moves;
        return { damage: dmg, msg:`Tích lũy: 10 + ${moves} moves = ${dmg} damage` };
      }
    },
    { id:'bishop_time2',  name:'Tích lũy',     piece:'bishop', rarity:'uncommon',
      desc:'10 + move hiện tại damage (max 50 ở move 40)',
      effect(ctx) {
        const moves = clamp(ctx.gameState.moveCount || 0, 0, 40);
        const dmg = 10 + moves;
        return { damage: dmg, msg:`Tích lũy: 10 + ${moves} moves = ${dmg} damage` };
      }
    },
    { id:'bishop_cross',  name:'Thánh giá',    piece:'bishop', rarity:'epic',
      desc:'Hồi 75% máu + 25% giáp cho lần đỡ tiếp theo',
      effect(ctx) {
        const heal = Math.round(ctx.attacker.maxHp * 0.75);
        return { heal, armorBuff: 0.25, armorDuration: 1, msg:`Thánh giá: hồi ${heal} HP + 25% giáp` };
      }
    },
    { id:'bishop_regen1', name:'Tái sinh',     piece:'bishop', rarity:'uncommon',
      desc:'Hồi 5% HP mỗi giây đối phương chần chừ',
      effect(ctx) { return { regenPerSec: 0.05, msg:'Đang hồi máu theo thời gian...' }; }
    },
    { id:'bishop_regen2', name:'Tái sinh',     piece:'bishop', rarity:'uncommon',
      desc:'Hồi 5% HP mỗi giây đối phương chần chừ',
      effect(ctx) { return { regenPerSec: 0.05, msg:'Đang hồi máu theo thời gian...' }; }
    },
    { id:'bishop_revive', name:'Hồi sinh',     piece:'bishop', rarity:'legendary',
      desc:'Mất lượt, nhưng nếu HP xuống <10% sẽ hồi về 25%',
      effect(ctx) { return { passiveRevive: true, skipTurn: true, msg:'Hồi sinh passive được kích hoạt! Mất lượt.' }; }
    },
    { id:'bishop_debuff1', name:'Trừ nguyền',  piece:'bishop', rarity:'uncommon',
      desc:'Giảm 50% damage tiếp theo của đối phương',
      effect(ctx) { return { enemyDamageDebuff: 0.5, debuffDuration: 1, msg:'Đối phương mất 50% damage lượt sau!' }; }
    },
    { id:'bishop_debuff2', name:'Trừ nguyền',  piece:'bishop', rarity:'uncommon',
      desc:'Giảm 50% damage tiếp theo của đối phương',
      effect(ctx) { return { enemyDamageDebuff: 0.5, debuffDuration: 1, msg:'Đối phương mất 50% damage lượt sau!' }; }
    },

    // =========== XE (10 lá) ===========
    { id:'rook_exec1',   name:'Trảm',          piece:'rook', rarity:'rare',
      desc:'Máu đối phương càng thấp, damage càng cao (10→40)',
      effect(ctx) {
        const hpPct = ctx.defender.hp / ctx.defender.maxHp;
        const dmg = hpPct >= 1 ? 10 : hpPct <= 0.25 ? 40 : Math.round(10 + (1 - hpPct) * 40);
        return { damage: dmg, msg:`Trảm: ${dmg} damage (địch còn ${Math.round(hpPct*100)}% máu)` };
      }
    },
    { id:'rook_exec2',   name:'Trảm',          piece:'rook', rarity:'rare',
      desc:'Máu đối phương càng thấp, damage càng cao (10→40)',
      effect(ctx) {
        const hpPct = ctx.defender.hp / ctx.defender.maxHp;
        const dmg = hpPct >= 1 ? 10 : hpPct <= 0.25 ? 40 : Math.round(10 + (1 - hpPct) * 40);
        return { damage: dmg, msg:`Trảm: ${dmg} damage (địch còn ${Math.round(hpPct*100)}% máu)` };
      }
    },
    { id:'rook_check1',  name:'Chiếu tướng',   piece:'rook', rarity:'uncommon',
      desc:'15 damage, 40 nếu xe từng chiếu vua',
      effect(ctx) {
        const dmg = ctx.checkedKing ? 40 : 15;
        return { damage: dmg, msg:`Chiếu tướng: ${dmg} damage${ctx.checkedKing?' (chiếu vua bonus!)':''}` };
      }
    },
    { id:'rook_check2',  name:'Chiếu tướng',   piece:'rook', rarity:'uncommon',
      desc:'15 damage, 40 nếu xe từng chiếu vua',
      effect(ctx) {
        const dmg = ctx.checkedKing ? 40 : 15;
        return { damage: dmg, msg:`Chiếu tướng: ${dmg} damage${ctx.checkedKing?' (chiếu vua bonus!)':''}` };
      }
    },
    { id:'rook_castle1', name:'Nhập thành',    piece:'rook', rarity:'uncommon',
      desc:'+10% giáp, +40% nếu xe từng nhập thành (1 lượt)',
      effect(ctx) {
        const buff = ctx.castlingUsed ? 0.40 : 0.10;
        return { armorBuff: buff, armorDuration: 1, msg:`Nhập thành: +${buff*100}% giáp${ctx.castlingUsed?' (nhập thành bonus!)':''}` };
      }
    },
    { id:'rook_castle2', name:'Nhập thành',    piece:'rook', rarity:'uncommon',
      desc:'+10% giáp, +40% nếu xe từng nhập thành (1 lượt)',
      effect(ctx) {
        const buff = ctx.castlingUsed ? 0.40 : 0.10;
        return { armorBuff: buff, armorDuration: 1, msg:`Nhập thành: +${buff*100}% giáp${ctx.castlingUsed?' (nhập thành bonus!)':''}` };
      }
    },
    { id:'rook_counter', name:'Phản đòn',      piece:'rook', rarity:'rare',
      desc:'Phản lại 20% damage nhận được',
      effect(ctx) { return { counterDmg: 0.20, msg:'Phản đòn: 20% damage sẽ bị phản lại!' }; }
    },
    { id:'rook_extra',   name:'Thêm lượt',     piece:'rook', rarity:'common',
      desc:'Rút thêm 1 lượt',
      effect(ctx) { return { extraTurn: true, msg:'Rút thêm 1 lượt!' }; }
    },
    { id:'rook_stun1',   name:'Khống chế',     piece:'rook', rarity:'rare',
      desc:'Đối phương mất 1 lượt, không được rút bài',
      effect(ctx) { return { stunEnemy: 1, msg:'Đối phương bị khống chế 1 lượt!' }; }
    },
    { id:'rook_stun2',   name:'Khống chế',     piece:'rook', rarity:'rare',
      desc:'Đối phương mất 1 lượt, không được rút bài',
      effect(ctx) { return { stunEnemy: 1, msg:'Đối phương bị khống chế 1 lượt!' }; }
    },

    // =========== HẬU (10 lá) ===========
    { id:'queen_smite',  name:'Trừng phạt',    piece:'queen', rarity:'epic',
      desc:'30 damage, 50 nếu là hậu chuyển sinh từ tốt',
      effect(ctx) {
        const dmg = ctx.gameState.promoted ? 50 : 30;
        return { damage: dmg, msg:`Trừng phạt: ${dmg} damage${ctx.gameState.promoted?' (chuyển sinh bonus!)':''}` };
      }
    },
    { id:'queen_tank1',  name:'Chống chịu',    piece:'queen', rarity:'uncommon',
      desc:'+20% giáp và đối phương -20% damage',
      effect(ctx) { return { armorBuff: 0.20, armorDuration: 1, enemyDamageDebuff: 0.20, debuffDuration: 1, msg:'+20% giáp, đối phương -20% damage!' }; }
    },
    { id:'queen_tank2',  name:'Chống chịu',    piece:'queen', rarity:'uncommon',
      desc:'+20% giáp và đối phương -20% damage',
      effect(ctx) { return { armorBuff: 0.20, armorDuration: 1, enemyDamageDebuff: 0.20, debuffDuration: 1, msg:'+20% giáp, đối phương -20% damage!' }; }
    },
    { id:'queen_range1', name:'Tầm xa',        piece:'queen', rarity:'rare',
      desc:'20 damage, 50 nếu di chuyển >3 ô',
      effect(ctx) {
        const dmg = (ctx.attackDistance || 0) > 3 ? 50 : 20;
        return { damage: dmg, msg:`Tầm xa: ${dmg} damage (${ctx.attackDistance||'?'} ô)` };
      }
    },
    { id:'queen_range2', name:'Tầm xa',        piece:'queen', rarity:'rare',
      desc:'20 damage, 50 nếu di chuyển >3 ô',
      effect(ctx) {
        const dmg = (ctx.attackDistance || 0) > 3 ? 50 : 20;
        return { damage: dmg, msg:`Tầm xa: ${dmg} damage (${ctx.attackDistance||'?'} ô)` };
      }
    },
    { id:'queen_heal1',  name:'Phục hồi',      piece:'queen', rarity:'uncommon',
      desc:'Hồi 45% máu + 10 giáp (1 lượt)',
      effect(ctx) {
        const heal = Math.round(ctx.attacker.maxHp * 0.45);
        return { heal, armorBuff: 10, armorIsFlat: true, armorDuration: 1, msg:`Phục hồi: +${heal} HP, +10 giáp` };
      }
    },
    { id:'queen_heal2',  name:'Phục hồi',      piece:'queen', rarity:'uncommon',
      desc:'Hồi 45% máu + 10 giáp (1 lượt)',
      effect(ctx) {
        const heal = Math.round(ctx.attacker.maxHp * 0.45);
        return { heal, armorBuff: 10, armorIsFlat: true, armorDuration: 1, msg:`Phục hồi: +${heal} HP, +10 giáp` };
      }
    },
    { id:'queen_triple', name:'Ba lượt',       piece:'queen', rarity:'epic',
      desc:'Thêm 3 lượt rút bài',
      effect(ctx) { return { extraTurn: 3, msg:'Thêm 3 lượt rút bài!' }; }
    },
    { id:'queen_immune', name:'Bất tử',        piece:'queen', rarity:'legendary',
      desc:'Bất tử 1 lượt đối phương, họ không thể gây damage',
      effect(ctx) { return { immuneNextTurn: true, msg:'BẤT TỬ! Đối phương không thể gây damage lượt sau!' }; }
    },
    { id:'queen_overkill', name:'Khắc tử',     piece:'queen', rarity:'legendary',
      desc:'Gây 120 damage',
      effect(ctx) { return { damage: 120, msg:'KHẮC TỬ: 120 damage!' }; }
    },

    // =========== VUA (10 lá) ===========
    { id:'king_revive1', name:'Hồi sinh',      piece:'king', rarity:'legendary',
      desc:'Hồi sinh 1 lần/battle nếu còn quân khác trên bàn',
      effect(ctx) {
        if (!ctx.gameState.alliesOnBoard) return { msg:'Không có quân đồng minh, không hồi sinh được!', noEffect: true };
        return { passiveRevive: true, skipTurn: true, msg:'Hồi sinh passive kích hoạt! Mất lượt.' };
      }
    },
    { id:'king_revive2', name:'Hồi sinh',      piece:'king', rarity:'legendary',
      desc:'Hồi sinh 1 lần/battle nếu còn quân khác trên bàn',
      effect(ctx) {
        if (!ctx.gameState.alliesOnBoard) return { msg:'Không có quân đồng minh, không hồi sinh được!', noEffect: true };
        return { passiveRevive: true, skipTurn: true, msg:'Hồi sinh passive kích hoạt! Mất lượt.' };
      }
    },
    { id:'king_fullheal1', name:'Thánh phục',  piece:'king', rarity:'epic',
      desc:'Hồi 100% máu',
      effect(ctx) { return { heal: ctx.attacker.maxHp, msg:`Thánh phục: hồi đầy ${ctx.attacker.maxHp} HP!` }; }
    },
    { id:'king_fullheal2', name:'Thánh phục',  piece:'king', rarity:'epic',
      desc:'Hồi 100% máu',
      effect(ctx) { return { heal: ctx.attacker.maxHp, msg:`Thánh phục: hồi đầy ${ctx.attacker.maxHp} HP!` }; }
    },
    { id:'king_stun1',   name:'Choáng',        piece:'king', rarity:'rare',
      desc:'Đối phương mất lượt + 5 damage',
      effect(ctx) { return { damage: 5, stunEnemy: 1, msg:'Choáng: 5 damage + đối phương mất lượt!' }; }
    },
    { id:'king_stun2',   name:'Choáng',        piece:'king', rarity:'rare',
      desc:'Đối phương mất lượt + 5 damage',
      effect(ctx) { return { damage: 5, stunEnemy: 1, msg:'Choáng: 5 damage + đối phương mất lượt!' }; }
    },
    { id:'king_force',   name:'Ý chí vua',     piece:'king', rarity:'epic',
      desc:'40 damage, 60 nếu có Hậu hoặc Xe trên bàn',
      effect(ctx) {
        const dmg = ctx.gameState.hasQueenOrRook ? 60 : 40;
        return { damage: dmg, msg:`Ý chí vua: ${dmg} damage${ctx.gameState.hasQueenOrRook?' (có Hậu/Xe!)':''}` };
      }
    },
    { id:'king_invincible', name:'Bất bại',    piece:'king', rarity:'legendary',
      desc:'Phản 50% damage nhận được về đối thủ',
      effect(ctx) { return { counterDmg: 0.50, msg:'Bất bại: 50% damage sẽ bị phản lại!' }; }
    },
    { id:'king_hpscale', name:'Máu thép',      piece:'king', rarity:'rare',
      desc:'Máu càng thấp, damage càng cao',
      effect(ctx) {
        const hpPct = ctx.attacker.hp / ctx.attacker.maxHp;
        const dmg = Math.round(clamp((1 - hpPct) * 80 + 10, 10, 80));
        return { damage: dmg, msg:`Máu thép: ${dmg} damage (còn ${Math.round(hpPct*100)}% máu)` };
      }
    },
    { id:'king_youth',   name:'Ta mạnh khi trẻ', piece:'king', rarity:'epic',
      desc:'Nước đi càng ít, damage càng cao (97→10)',
      effect(ctx) {
        const move = clamp(ctx.gameState.moveCount || 1, 1, 90);
        const dmg = Math.round(clamp(100 - move, 10, 97));
        return { damage: dmg, msg:`Ta mạnh khi trẻ: move ${move} → ${dmg} damage` };
      }
    },
  ];

  // Build deck cho từng piece type (5 cơ bản + 10 đặc trưng)
  function getDeckPool(pieceType) {
    const basics = CARD_DEFS.filter(c => c.piece === 'all');
    const specific = CARD_DEFS.filter(c => c.piece === pieceType);
    return [...basics, ...specific];
  }

  // Shuffle
  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // Tạo deck (shuffle pool, lấy đúng 15 lá)
  function buildDeck(pieceType) {
    const pool = getDeckPool(pieceType);
    return shuffle(pool).slice(0, 15);
  }

  // Rút 4 lá từ deck
  function drawHand(deck) {
    return deck.splice(0, 4);
  }

  // Thực thi effect của lá bài
  function playCard(card, ctx) {
    return card.effect(ctx);
  }

  // Rarity color
  const RARITY_COLOR = {
    common: '#888780',
    uncommon: '#4aaa6e',
    rare: '#378add',
    epic: '#7c6fea',
    legendary: '#f0b84a',
  };

  function getRarityColor(rarity) {
    return RARITY_COLOR[rarity] || '#888';
  }

  return { CARD_DEFS, getDeckPool, buildDeck, drawHand, playCard, getRarityColor };
})();