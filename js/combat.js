const Combat = (() => {
  let state = null;
  let onCombatEnd = null;
  let regenInterval = null;

  const PIECE_TYPE_MAP = {
    wP:'pawn', bP:'pawn', wN:'knight', bN:'knight',
    wB:'bishop', bB:'bishop', wR:'rook', bR:'rook',
    wQ:'queen', bQ:'queen', wK:'king', bK:'king'
  };

  const PIECE_NAME_VI = {
    pawn:'Tốt', knight:'Mã', bishop:'Tượng',
    rook:'Xe', queen:'Hậu', king:'Vua'
  };

  function getPieceType(code) { return PIECE_TYPE_MAP[code] || 'pawn'; }

  // Khởi tạo combat
  function start(attackerPiece, defenderPiece, gameCtx, myColor, callback) {
    onCombatEnd = callback;

    const atkType = getPieceType(attackerPiece);
    const defType = getPieceType(defenderPiece);

    const BASE_HP = { pawn:40, knight:65, bishop:70, rook:100, queen:120, king:80 };
    const BASE_ARMOR = { pawn:5, knight:7, bishop:8, rook:18, queen:6, king:12 };

    state = {
      myColor,
      attacker: {
        piece: attackerPiece, type: atkType,
        hp: BASE_HP[atkType], maxHp: BASE_HP[atkType],
        armor: BASE_ARMOR[atkType], baseArmor: BASE_ARMOR[atkType],
        deck: Cards.buildDeck(atkType),
        hand: [], usedRevive: false,
        effects: { armorBuff:0, armorDuration:0, damageMult:1, multDuration:0,
                   dodgeNext:false, counterDmg:0, immuneNextTurn:false,
                   passiveRevive:false, regenPerSec:0 }
      },
      defender: {
        piece: defenderPiece, type: defType,
        hp: BASE_HP[defType], maxHp: BASE_HP[defType],
        armor: BASE_ARMOR[defType], baseArmor: BASE_ARMOR[defType],
        deck: Cards.buildDeck(defType),
        hand: [], usedRevive: false,
        effects: { armorBuff:0, armorDuration:0, damageMult:1, multDuration:0,
                   dodgeNext:false, counterDmg:0, immuneNextTurn:false,
                   passiveRevive:false, regenPerSec:0, enemyDamageDebuff:0,
                   debuffDuration:0, stunTurns:0 }
      },
      gameCtx,
      myTurn: false, // defender phản đòn trước
      log: [],
      stealCardActive: false,
      freezeEnemy: 0,
    };

    drawHands();
    renderCombat();
    showCombatScreen();
  }

  function drawHands() {
    if (state.attacker.hand.length < 4 && state.attacker.deck.length > 0) {
      const needed = 4 - state.attacker.hand.length;
      state.attacker.hand.push(...state.attacker.deck.splice(0, needed));
    }
    if (state.defender.hand.length < 4 && state.defender.deck.length > 0) {
      const needed = 4 - state.defender.hand.length;
      state.defender.hand.push(...state.defender.deck.splice(0, needed));
    }
  }

  function showCombatScreen() {
    document.getElementById('screen-game').style.display = 'none';
    document.getElementById('screen-combat').style.display = 'flex';
  }

  function hideCombatScreen() {
    document.getElementById('screen-combat').style.display = 'none';
    document.getElementById('screen-game').style.display = 'flex';
  }

  function addLog(msg, type = '') {
    state.log.unshift({ msg, type, time: Date.now() });
    if (state.log.length > 20) state.log.pop();
    renderLog();
  }

  function renderLog() {
    const el = document.getElementById('combat-log');
    if (!el) return;
    el.innerHTML = state.log.slice(0, 6).map(l =>
      `<div class="log-entry ${l.type}">${l.msg}</div>`
    ).join('');
  }

  function calcDamage(rawDmg, attacker, defender) {
    let dmg = rawDmg;
    // attacker damage multiplier
    if (attacker.effects.damageMult !== 1) {
      dmg = Math.round(dmg * attacker.effects.damageMult);
    }
    // defender debuff reduces damage dealt by attacker? No — debuff is on defender reducing their OWN damage
    // armor mitigation
    const armorVal = defender.armor + (defender.effects.armorBuff
      ? (defender.effects.armorIsFlat ? defender.effects.armorBuff : defender.baseArmor * defender.effects.armorBuff)
      : 0);
    const mitigated = Math.max(0, dmg - armorVal * 0.5);
    return Math.round(mitigated);
  }

  function applyDamage(target, dmg) {
    if (target.effects.immuneNextTurn) {
      addLog('🛡 Bất tử! Không nhận damage!', 'immune');
      return 0;
    }
    if (target.effects.dodgeNext) {
      target.effects.dodgeNext = false;
      addLog('💨 Né đòn! Tránh hoàn toàn!', 'dodge');
      return 0;
    }
    const actual = Math.max(1, dmg);
    target.hp = Math.max(0, target.hp - actual);
    return actual;
  }

  function checkRevive(unit, unitName) {
    if (unit.hp <= 0 && unit.effects.passiveRevive && !unit.usedRevive) {
      unit.usedRevive = true;
      unit.effects.passiveRevive = false;
      unit.hp = Math.round(unit.maxHp * 0.25);
      addLog(`✨ ${unitName} hồi sinh! HP về 25%!`, 'revive');
      return true;
    }
    return false;
  }

  function tickEffects(unit) {
    if (unit.effects.armorDuration > 0) {
      unit.effects.armorDuration--;
      if (unit.effects.armorDuration <= 0) unit.effects.armorBuff = 0;
    }
    if (unit.effects.multDuration > 0) {
      unit.effects.multDuration--;
      if (unit.effects.multDuration <= 0) unit.effects.damageMult = 1;
    }
    if (unit.effects.debuffDuration > 0) {
      unit.effects.debuffDuration--;
      if (unit.effects.debuffDuration <= 0) unit.effects.enemyDamageDebuff = 0;
    }
    unit.effects.immuneNextTurn = false;
  }

  function playCard(cardIndex) {
    if (!state.myTurn) { App.showToast('Chờ lượt của bạn!', 'error'); return; }
    const atk = state.attacker;
    const def = state.defender;
    const card = atk.hand[cardIndex];
    if (!card) return;

    // Stun check
    if (def.effects.stunTurns > 0) {
      def.effects.stunTurns--;
      addLog('😵 Đối phương bị choáng, mất lượt!', 'stun');
    }

    const ctx = {
      attacker: { ...atk, protected: atk.effects.armorBuff > 0 },
      defender: { ...def },
      gameCtx: state.gameCtx,
      enPassantUsed: state.gameCtx?.enPassantUsed || false,
      castlingUsed: state.gameCtx?.castlingUsed || false,
      checkedKing: state.gameCtx?.checkedKing || false,
      attackDistance: state.gameCtx?.attackDistance || 0,
      gameState: {
        moveCount: state.gameCtx?.moveCount || 0,
        pawnsOnBoard: state.gameCtx?.pawnsOnBoard || 0,
        alliedKnights: state.gameCtx?.alliedKnights || 0,
        alliesOnBoard: state.gameCtx?.alliesOnBoard || true,
        hasQueenOrRook: state.gameCtx?.hasQueenOrRook || false,
        promoted: state.gameCtx?.promoted || false,
      }
    };

    const result = Cards.playCard(card, ctx);
    if (result.noEffect) { addLog(result.msg, 'info'); return; }

    addLog(result.msg, result.damage ? 'damage' : result.heal ? 'heal' : 'effect');

    // Apply heal
    if (result.heal) {
      atk.hp = Math.min(atk.maxHp, atk.hp + result.heal);
    }

    // Apply damage
    if (result.damage) {
      let dmg = calcDamage(result.damage, atk, def);
      // enemy debuff on their damage — applies when THEY attack, not now
      const actual = applyDamage(def, dmg);
      if (actual > 0) addLog(`💥 Gây ${actual} damage thực tế!`, 'damage');

      // Counter damage
      if (def.effects.counterDmg > 0) {
        const counter = Math.round(actual * def.effects.counterDmg);
        atk.hp = Math.max(0, atk.hp - counter);
        addLog(`🔄 Phản đòn: ${counter} damage!`, 'counter');
        def.effects.counterDmg = 0;
      }
    }

    // Armor buff
    if (result.armorBuff) {
      if (result.armorIsFlat) {
        atk.effects.armorBuff = result.armorBuff;
        atk.effects.armorIsFlat = true;
      } else {
        atk.effects.armorBuff = result.armorBuff;
        atk.effects.armorIsFlat = false;
      }
      atk.effects.armorDuration = result.armorDuration || 1;
    }

    // Damage multiplier
    if (result.damageMult) {
      atk.effects.damageMult = result.damageMult;
      atk.effects.multDuration = result.multDuration || 1;
    }

    // Passive effects
    if (result.dodgeNext) atk.effects.dodgeNext = true;
    if (result.counterDmg) atk.effects.counterDmg = result.counterDmg;
    if (result.immuneNextTurn) atk.effects.immuneNextTurn = true;
    if (result.passiveRevive) atk.effects.passiveRevive = true;

    // Enemy effects
    if (result.stunEnemy) def.effects.stunTurns = (def.effects.stunTurns || 0) + result.stunEnemy;
    if (result.freezeEnemy) state.freezeEnemy = result.freezeEnemy;
    if (result.enemyDamageDebuff) {
      def.effects.enemyDamageDebuff = result.enemyDamageDebuff;
      def.effects.debuffDuration = result.debuffDuration || 1;
    }

    // Regen
    if (result.regenPerSec) {
      atk.effects.regenPerSec = result.regenPerSec;
      startRegen(atk);
    }

    // Extra turn
    if (result.extraTurn) {
      const extra = typeof result.extraTurn === 'number' ? result.extraTurn : 1;
      addLog(`⚡ Thêm ${extra} lượt!`, 'effect');
      atk.hand.splice(cardIndex, 1);
      const newCards = atk.deck.splice(0, extra + 1);
      atk.hand.push(...newCards);
      renderCombat();
      checkCombatEnd();
      return;
    }

    // Steal card
    if (result.stealCard) {
      state.stealCardActive = true;
      addLog('🃏 Chọn lá bài của đối phương!', 'effect');
      atk.hand.splice(cardIndex, 1);
      renderCombat();
      return;
    }

    // Skip turn (passive cards)
    if (result.skipTurn) {
      atk.hand.splice(cardIndex, 1);
      drawHands();
      endTurn();
      return;
    }

    atk.hand.splice(cardIndex, 1);
    drawHands();
    tickEffects(atk);

    checkRevive(def, PIECE_NAME_VI[def.type] || def.type);
    checkCombatEnd();
    if (!checkCombatEnd()) {
      endTurn();
    }
  }

  function stealEnemyCard(cardIndex) {
    if (!state.stealCardActive) return;
    const stolen = state.defender.hand[cardIndex];
    if (!stolen) return;
    state.defender.hand.splice(cardIndex, 1);
    addLog(`🃏 Đã lấy "${stolen.name}" của đối phương!`, 'effect');
    const ctx = {
      attacker: state.attacker, defender: state.defender,
      gameCtx: state.gameCtx, gameState: state.gameCtx || {}
    };
    const result = Cards.playCard(stolen, ctx);
    addLog(result.msg, result.damage ? 'damage' : 'heal');
    if (result.damage) {
      const actual = applyDamage(state.defender, calcDamage(result.damage, state.attacker, state.defender));
      if (actual > 0) addLog(`💥 ${actual} damage!`, 'damage');
    }
    if (result.heal) state.attacker.hp = Math.min(state.attacker.maxHp, state.attacker.hp + result.heal);
    state.stealCardActive = false;
    drawHands();
    checkRevive(state.defender, PIECE_NAME_VI[state.defender.type]);
    if (!checkCombatEnd()) endTurn();
  }

  function discardAndDraw() {
    if (!state.myTurn) { App.showToast('Chờ lượt của bạn!', 'error'); return; }
    const atk = state.attacker;
    atk.hand = [];
    const newCards = atk.deck.splice(0, 4);
    atk.hand.push(...newCards);
    addLog('🔄 Bỏ bài và rút mới — mất lượt', 'info');
    tickEffects(atk);
    endTurn();
  }

  function startRegen(unit) {
    if (regenInterval) clearInterval(regenInterval);
    regenInterval = setInterval(() => {
      if (!state || !state.myTurn) {
        const healAmt = Math.round(unit.maxHp * unit.effects.regenPerSec);
        unit.hp = Math.min(unit.maxHp, unit.hp + healAmt);
        addLog(`💚 Hồi ${healAmt} HP (regen)`, 'heal');
        renderCombat();
      } else {
        clearInterval(regenInterval);
        unit.effects.regenPerSec = 0;
      }
    }, 1000);
  }

  function endTurn() {
    state.myTurn = false;
    renderCombat();
    // Defender đã đánh xong → attacker (AI placeholder) đánh
    simulateOpponentTurn();
  }

  function simulateOpponentTurn() {
    // Đối phương rút bài và đánh random (placeholder cho multiplayer)
    setTimeout(() => {
      if (!state) return;
      const def = state.defender;
      if (def.effects.stunTurns > 0) {
        def.effects.stunTurns--;
        addLog('😵 Đối phương bị choáng, mất lượt!', 'stun');
        state.myTurn = true;
        renderCombat();
        return;
      }
      if (def.hand.length === 0) {
        const newCards = def.deck.splice(0, 4);
        def.hand.push(...newCards);
      }
      if (def.hand.length === 0) {
        state.myTurn = true; renderCombat(); return;
      }
      const randomIdx = Math.floor(Math.random() * def.hand.length);
      const card = def.hand[randomIdx];
      const ctx = {
        attacker: { ...def, protected: def.effects.armorBuff > 0 },
        defender: { ...state.attacker },
        gameCtx: state.gameCtx,
        enPassantUsed: false, castlingUsed: false, checkedKing: false, attackDistance: 1,
        gameState: { moveCount: state.gameCtx?.moveCount||0, pawnsOnBoard: state.gameCtx?.pawnsOnBoard||0,
          alliedKnights:0, alliesOnBoard:true, hasQueenOrRook:false, promoted:false }
      };
      const result = Cards.playCard(card, ctx);
      addLog(`[Đối thủ] ${card.name}: ${result.msg}`, 'opponent');
      if (result.damage) {
        const actual = applyDamage(state.attacker, calcDamage(result.damage, def, state.attacker));
        if (actual > 0) addLog(`[Đối thủ] Gây ${actual} damage!`, 'opponent');
      }
      if (result.heal) def.hp = Math.min(def.maxHp, def.hp + result.heal);
      if (result.stunEnemy) state.attacker.effects = state.attacker.effects || {};
      def.hand.splice(randomIdx, 1);
      tickEffects(def);
      checkRevive(state.attacker, PIECE_NAME_VI[state.attacker.type]);
      if (!checkCombatEnd()) {
        state.myTurn = true;
        drawHands();
        renderCombat();
      }
    }, 1200);
  }

  function checkCombatEnd() {
    if (!state) return false;
    const atkDead = state.attacker.hp <= 0;
    const defDead = state.defender.hp <= 0;
    if (atkDead || defDead) {
      if (regenInterval) { clearInterval(regenInterval); regenInterval = null; }
      setTimeout(() => {
        const attackerWon = defDead && !atkDead;
        showResult(attackerWon);
      }, 600);
      return true;
    }
    renderCombat();
    return false;
  }

  function showResult(attackerWon) {
    const overlay = document.getElementById('combat-result');
    const title = document.getElementById('result-title');
    const sub = document.getElementById('result-sub');
    if (!overlay) return;
    title.textContent = attackerWon ? '⚔️ Thắng!' : '💀 Thua!';
    title.style.color = attackerWon ? '#4aaa6e' : '#e05555';
    sub.textContent = attackerWon
      ? `${PIECE_NAME_VI[state.attacker.type]} hạ gục ${PIECE_NAME_VI[state.defender.type]}!`
      : `${PIECE_NAME_VI[state.defender.type]} trụ vững!`;
    overlay.style.display = 'flex';
  }

  function endCombat() {
    const attackerWon = state.defender.hp <= 0;
    const freeze = state.freezeEnemy;
    const s = { ...state };
    state = null;
    if (regenInterval) { clearInterval(regenInterval); regenInterval = null; }
    hideCombatScreen();
    document.getElementById('combat-result').style.display = 'none';
    if (onCombatEnd) onCombatEnd({ attackerWon, freeze });
  }

  function hpBarColor(pct) {
    if (pct > 0.5) return '#4aaa6e';
    if (pct > 0.25) return '#f0b84a';
    return '#e05555';
  }

  function renderCombat() {
    if (!state) return;
    const atk = state.attacker;
    const def = state.defender;

    // HP bars
    const atkPct = atk.hp / atk.maxHp;
    const defPct = def.hp / def.maxHp;
    const setHP = (prefix, unit, pct) => {
      const bar = document.getElementById(prefix + '-hp-bar');
      const txt = document.getElementById(prefix + '-hp-txt');
      if (bar) { bar.style.width = (pct*100).toFixed(1)+'%'; bar.style.background = hpBarColor(pct); }
      if (txt) txt.textContent = `${Math.max(0,unit.hp)} / ${unit.maxHp}`;
    };
    setHP('atk', atk, atkPct);
    setHP('def', def, defPct);

    // Names
    const atkName = document.getElementById('atk-name');
    const defName = document.getElementById('def-name');
    if (atkName) atkName.textContent = PIECE_NAME_VI[atk.type] + ' (bạn)';
    if (defName) defName.textContent = PIECE_NAME_VI[def.type] + ' (địch)';

    // Piece symbols
    const SYMS = { wK:'♔',wQ:'♕',wR:'♖',wB:'♗',wN:'♘',wP:'♙', bK:'♚',bQ:'♛',bR:'♜',bB:'♝',bN:'♞',bP:'♟' };
    const atkSym = document.getElementById('atk-sym');
    const defSym = document.getElementById('def-sym');
    if (atkSym) atkSym.textContent = SYMS[atk.piece] || '?';
    if (defSym) defSym.textContent = SYMS[def.piece] || '?';

    // Turn indicator
    const turnEl = document.getElementById('combat-turn');
    if (turnEl) {
      turnEl.textContent = state.myTurn ? '🛡 Lượt phản đòn của bạn!' : '⚔️ Kẻ tấn công đang đánh...';
      turnEl.className = 'combat-turn ' + (state.myTurn ? 'my-turn' : 'opp-turn');
    }

    // Hand
    const handEl = document.getElementById('combat-hand');
    if (!handEl) return;
    if (state.stealCardActive) {
      handEl.innerHTML = `<div class="steal-prompt">Chọn lá bài của đối phương:</div>` +
        def.hand.map((c, i) => `
          <div class="card-item steal-card" onclick="Combat.stealEnemyCard(${i})"
               style="border-color:${Cards.getRarityColor(c.rarity)}">
            <div class="card-rarity" style="color:${Cards.getRarityColor(c.rarity)}">${c.rarity}</div>
            <div class="card-name">${c.name}</div>
            <div class="card-desc">${c.desc}</div>
          </div>`).join('');
      return;
    }

    const canPlay = state.myTurn;
    handEl.innerHTML = atk.hand.map((c, i) => `
      <div class="card-item ${canPlay?'playable':''}" onclick="${canPlay?`Combat.playCard(${i})`:''}"
           style="border-color:${Cards.getRarityColor(c.rarity)}; opacity:${canPlay?1:0.5}">
        <div class="card-rarity" style="color:${Cards.getRarityColor(c.rarity)}">${c.rarity.toUpperCase()}</div>
        <div class="card-name">${c.name}</div>
        <div class="card-desc">${c.desc}</div>
      </div>`).join('');
  }

  return { start, playCard, stealEnemyCard, discardAndDraw, endCombat, renderCombat };
})();