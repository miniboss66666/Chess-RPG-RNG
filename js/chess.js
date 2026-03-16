const ChessGame = (() => {
  let canvas = null;
  let ctx = null;
  let roomData = null;
  let myRole = null;
  let myColor = null;
  let SQ = 60;

  const COLS = 'abcdefgh';
  const INIT_BOARD = [
    ['bR','bN','bB','bQ','bK','bB','bN','bR'],
    ['bP','bP','bP','bP','bP','bP','bP','bP'],
    [null,null,null,null,null,null,null,null],
    [null,null,null,null,null,null,null,null],
    [null,null,null,null,null,null,null,null],
    [null,null,null,null,null,null,null,null],
    ['wP','wP','wP','wP','wP','wP','wP','wP'],
    ['wR','wN','wB','wQ','wK','wB','wN','wR'],
  ];
  const SYMS = {
    wK:'♔',wQ:'♕',wR:'♖',wB:'♗',wN:'♘',wP:'♙',
    bK:'♚',bQ:'♛',bR:'♜',bB:'♝',bN:'♞',bP:'♟'
  };

  // Game state
  let board = [], selected = null, validMoves = [], myTurn = false, flipped = false;
  let enPassantSq = null, castling = {}, moveCount = 0;
  let lastEnPassant = false, castlingUsed = false, promotedFromPawn = false, attackDistance = 0;
  let pendingPromotion = null;

  function copyBoard(b) { return b.map(r => [...r]); }
  function sqToRC(sq) { return [8 - parseInt(sq[1]), COLS.indexOf(sq[0])]; }
  function rcToSq(r, c) { return COLS[c] + (8 - r); }
  function inB(r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8; }

  function initState() {
    board = copyBoard(INIT_BOARD);
    selected = null; validMoves = []; myTurn = false;
    enPassantSq = null; moveCount = 0;
    lastEnPassant = false; castlingUsed = false;
    promotedFromPawn = false; attackDistance = 0;
    pendingPromotion = null;
    castling = { wK:true, wRh:true, wRa:true, bK:true, bRh:true, bRa:true };
  }

  function setupCanvas(preview) {
    const container = document.getElementById('phaser-container');
    if (!container) return;
    container.innerHTML = '';
    const maxSize = Math.min(window.innerWidth - 20, window.innerHeight - 140, 520);
    SQ = Math.floor(maxSize / 8);
    const size = SQ * 8;
    canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    canvas.style.display = 'block';
    canvas.style.margin = '0 auto';
    canvas.style.cursor = preview ? 'default' : 'pointer';
    container.appendChild(canvas);
    ctx = canvas.getContext('2d');
    if (!preview) canvas.addEventListener('click', onCanvasClick);
    draw();
  }

  function draw() {
    if (!ctx) return;
    // Squares
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const dr = flipped ? 7-r : r;
        const dc = flipped ? 7-c : c;
        // Check highlight
        const isSelected = selected && selected[0]===r && selected[1]===c;
        const isValid = validMoves.find(m => m.r===r && m.c===c);
        if (isSelected) ctx.fillStyle = '#7c6fea88';
        else if ((dr+dc)%2===0) ctx.fillStyle = '#f0d9b5';
        else ctx.fillStyle = '#b58863';
        ctx.fillRect(dc*SQ, dr*SQ, SQ, SQ);
        // Valid move dots
        if (isValid) {
          if (isValid.type==='capture'||isValid.type==='enpassant') {
            ctx.strokeStyle = '#e05555cc';
            ctx.lineWidth = 3;
            ctx.strokeRect(dc*SQ+2, dr*SQ+2, SQ-4, SQ-4);
          } else if (isValid.type==='castleK'||isValid.type==='castleQ') {
            ctx.fillStyle = '#378add88';
            ctx.beginPath();
            ctx.arc(dc*SQ+SQ/2, dr*SQ+SQ/2, SQ*0.2, 0, Math.PI*2);
            ctx.fill();
          } else {
            ctx.fillStyle = '#4aaa6e88';
            ctx.beginPath();
            ctx.arc(dc*SQ+SQ/2, dr*SQ+SQ/2, SQ*0.18, 0, Math.PI*2);
            ctx.fill();
          }
        }
      }
    }
    // Labels
    ctx.font = `${SQ*0.18}px sans-serif`;
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i%2===0 ? '#b58863' : '#f0d9b5';
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText(flipped?i+1:8-i, 3, i*SQ+3);
      ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
      ctx.fillText(flipped?COLS[7-i]:COLS[i], (i+1)*SQ-3, 8*SQ-3);
    }
    // Pieces
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (!p) continue;
        const dr = flipped?7-r:r;
        const dc = flipped?7-c:c;
        ctx.font = `${SQ*0.78}px serif`;
        ctx.fillStyle = p[0]==='w' ? '#ffffff' : '#1a1a1a';
        ctx.strokeStyle = p[0]==='w' ? '#44444488' : '#cccccc88';
        ctx.lineWidth = 1;
        ctx.strokeText(SYMS[p], dc*SQ+SQ/2, dr*SQ+SQ/2+SQ*0.04);
        ctx.fillText(SYMS[p], dc*SQ+SQ/2, dr*SQ+SQ/2+SQ*0.04);
      }
    }
  }

  function onCanvasClick(e) {
    if (!myTurn || pendingPromotion) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const dc = Math.floor(x * scaleX / SQ);
    const dr = Math.floor(y * scaleY / SQ);
    if (dc<0||dc>7||dr<0||dr>7) return;
    const c = flipped?7-dc:dc;
    const r = flipped?7-dr:dr;

    if (selected) {
      const move = validMoves.find(m => m.r===r && m.c===c);
      if (move) { doMove(selected[0], selected[1], r, c, move.type); return; }
    }
    if (board[r][c] && board[r][c][0]===myColor[0]) {
      selected = [r,c];
      validMoves = getValidMoves(r,c);
    } else {
      selected = null; validMoves = [];
    }
    draw();
  }

  function getValidMoves(r, c) {
    const piece = board[r][c];
    if (!piece) return [];
    const color = piece[0], type = piece[1];
    const moves = [];
    const isEmpty = (r,c) => inB(r,c) && !board[r][c];
    const isEnemy = (r,c) => inB(r,c) && board[r][c] && board[r][c][0]!==color;

    const slide = (dirs) => {
      for (const [dr,dc] of dirs) {
        let nr=r+dr, nc=c+dc;
        while (inB(nr,nc)) {
          if (board[nr][nc]) {
            if (board[nr][nc][0]!==color) moves.push({r:nr,c:nc,type:'capture'});
            break;
          }
          moves.push({r:nr,c:nc,type:'normal'}); nr+=dr; nc+=dc;
        }
      }
    };
    const jump = (dests) => {
      for (const [dr,dc] of dests) {
        const nr=r+dr, nc=c+dc;
        if (!inB(nr,nc)) continue;
        if (isEmpty(nr,nc)) moves.push({r:nr,c:nc,type:'normal'});
        else if (isEnemy(nr,nc)) moves.push({r:nr,c:nc,type:'capture'});
      }
    };

    if (type==='P') {
      const dir=color==='w'?-1:1, startRow=color==='w'?6:1, promRow=color==='w'?0:7;
      if (isEmpty(r+dir,c)) {
        moves.push({r:r+dir,c,type:r+dir===promRow?'promote':'normal'});
        if (r===startRow&&isEmpty(r+2*dir,c)) moves.push({r:r+2*dir,c,type:'normal'});
      }
      for (const dc of [-1,1]) {
        if (isEnemy(r+dir,c+dc)) moves.push({r:r+dir,c:c+dc,type:r+dir===promRow?'promote':'capture'});
        if (enPassantSq&&enPassantSq.r===r+dir&&enPassantSq.c===c+dc)
          moves.push({r:r+dir,c:c+dc,type:'enpassant'});
      }
    } else if (type==='R') { slide([[0,1],[0,-1],[1,0],[-1,0]]);
    } else if (type==='B') { slide([[1,1],[1,-1],[-1,1],[-1,-1]]);
    } else if (type==='Q') { slide([[0,1],[0,-1],[1,0],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]]);
    } else if (type==='N') { jump([[2,1],[2,-1],[-2,1],[-2,-1],[1,2],[1,-2],[-1,2],[-1,-2]]);
    } else if (type==='K') {
      jump([[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]);
      const row=color==='w'?7:0;
      if (r===row&&c===4) {
        if (color==='w') {
          if (castling.wK&&castling.wRh&&!board[row][5]&&!board[row][6]&&board[row][7]==='wR') moves.push({r:row,c:6,type:'castleK'});
          if (castling.wK&&castling.wRa&&!board[row][3]&&!board[row][2]&&!board[row][1]&&board[row][0]==='wR') moves.push({r:row,c:2,type:'castleQ'});
        } else {
          if (castling.bK&&castling.bRh&&!board[row][5]&&!board[row][6]&&board[row][7]==='bR') moves.push({r:row,c:6,type:'castleK'});
          if (castling.bK&&castling.bRa&&!board[row][3]&&!board[row][2]&&!board[row][1]&&board[row][0]==='bR') moves.push({r:row,c:2,type:'castleQ'});
        }
      }
    }
    return moves;
  }

  function doMove(fr, fc, tr, tc, moveType) {
    const fromSq=rcToSq(fr,fc), toSq=rcToSq(tr,tc);
    const piece=board[fr][fc], captured=board[tr][tc];
    lastEnPassant=false; attackDistance=Math.max(Math.abs(tr-fr),Math.abs(tc-fc));

    if (moveType==='enpassant') {
      const capRow=piece[0]==='w'?tr+1:tr-1;
      const epCaptured=board[capRow][tc];
      board[capRow][tc]=null; board[tr][tc]=piece; board[fr][fc]=null;
      lastEnPassant=true; enPassantSq=null;
      selected=null; validMoves=[]; draw();
      myTurn=false; updateTurnUI(false);
      triggerCombatOrSync(fromSq, toSq, fr, fc, piece, epCaptured);
      return;
    }
    if (moveType==='castleK'||moveType==='castleQ') {
      board[tr][tc]=piece; board[fr][fc]=null;
      if (moveType==='castleK') { board[fr][5]=board[fr][7]; board[fr][7]=null; }
      else { board[fr][3]=board[fr][0]; board[fr][0]=null; }
      castlingUsed=true;
      if (piece[0]==='w') { castling.wK=false; castling.wRh=false; castling.wRa=false; }
      else { castling.bK=false; castling.bRh=false; castling.bRa=false; }
      enPassantSq=null; selected=null; validMoves=[]; draw();
      myTurn=false; updateTurnUI(false);
      syncMove(fromSq, toSq, null);
      return;
    }
    if (moveType==='promote') {
      board[fr][fc]=null; board[tr][tc]=null;
      pendingPromotion={fr,fc,tr,tc,piece,captured,fromSq,toSq};
      selected=null; validMoves=[]; draw();
      showPromotionUI(piece[0]);
      return;
    }
    // Normal / capture
    board[tr][tc]=piece; board[fr][fc]=null;
    enPassantSq=(piece[1]==='P'&&Math.abs(tr-fr)===2)?{r:(fr+tr)/2,c:fc}:null;
    if (piece==='wK') castling.wK=false;
    if (piece==='bK') castling.bK=false;
    if (piece==='wR'&&fc===7) castling.wRh=false;
    if (piece==='wR'&&fc===0) castling.wRa=false;
    if (piece==='bR'&&fc===7) castling.bRh=false;
    if (piece==='bR'&&fc===0) castling.bRa=false;
    selected=null; validMoves=[]; draw();
    myTurn=false; updateTurnUI(false);
    triggerCombatOrSync(fromSq, toSq, fr, fc, piece, captured);
  }

  function triggerCombatOrSync(fromSq, toSq, fr, fc, piece, captured) {
    moveCount++;
    if (captured) {
      const gameCtx = buildGameCtx(piece);
      Combat.start(piece, captured, gameCtx, myColor, (result) => {
        if (!result.attackerWon) {
          const [tr2,tc2]=sqToRC(toSq);
          board[fr][fc]=piece; board[tr2][tc2]=captured;
          draw();
        }
        syncMove(fromSq, toSq, null);
      });
    } else {
      syncMove(fromSq, toSq, null);
    }
  }

  function syncMove(fromSq, toSq, promotion) {
    if (!roomData) return;
    Sync.sendMove(roomData.id, fromSq, toSq, promotion).catch(e => console.error('sync error', e));
  }

  function buildGameCtx(piece) {
    let pawnsOnBoard=0, alliedKnights=0, hasQueenOrRook=false, alliesOnBoard=false;
    const col=myColor[0];
    for (let r=0;r<8;r++) for (let c=0;c<8;c++) {
      const p=board[r][c]; if (!p||p[0]!==col) continue;
      if(p[1]==='P') pawnsOnBoard++;
      if(p[1]==='N') alliedKnights++;
      if(p[1]==='Q'||p[1]==='R') hasQueenOrRook=true;
      if(p!==piece) alliesOnBoard=true;
    }
    return { moveCount, attackDistance, pawnsOnBoard, alliedKnights,
             hasQueenOrRook, alliesOnBoard, enPassantUsed:lastEnPassant,
             castlingUsed, checkedKing:false, promoted:promotedFromPawn };
  }

  function showPromotionUI(color) {
    let el = document.getElementById('promotion-ui');
    if (!el) {
      el = document.createElement('div');
      el.id = 'promotion-ui';
      el.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.75);display:flex;align-items:center;justify-content:center;z-index:999;';
      document.body.appendChild(el);
    }
    const opts = [['Q','Hậu ♕'],['R','Xe ♖'],['B','Tượng ♗'],['N','Mã ♘']];
    el.innerHTML = `<div style="background:#1a1a24;border:1px solid #2e2e3e;border-radius:12px;padding:20px;display:flex;flex-direction:column;gap:10px;align-items:center;">
      <div style="font-size:14px;font-weight:600;color:#e8e8f0">Chọn quân phong cấp</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        ${opts.map(([p,l]) => `<button onclick="ChessGame._promote('${color}${p}')"
          style="background:#24242f;border:1px solid #2e2e3e;border-radius:8px;padding:12px 20px;color:#e8e8f0;font-size:18px;cursor:pointer;"
          onmouseover="this.style.background='#7c6fea'" onmouseout="this.style.background='#24242f'">${l}</button>`).join('')}
      </div>
    </div>`;
    el.style.display = 'flex';
  }

  function _promote(pieceCode) {
    const el = document.getElementById('promotion-ui');
    if (el) el.style.display = 'none';
    if (!pendingPromotion) return;
    const {fr,fc,tr,tc,piece,captured,fromSq,toSq} = pendingPromotion;
    board[tr][tc] = pieceCode;
    promotedFromPawn = true;
    pendingPromotion = null;
    draw();
    myTurn=false; updateTurnUI(false);
    triggerCombatOrSync(fromSq, toSq, fr, fc, pieceCode, captured);
  }

  function applyOpponentMove(fromSq, toSq, promotion) {
    const [fr,fc]=sqToRC(fromSq), [tr,tc]=sqToRC(toSq);
    const piece=board[fr][fc];
    if (!piece) return;
    const captured=board[tr][tc];
    const isEP=piece[1]==='P'&&fc!==tc&&!captured;
    const isCastle=piece[1]==='K'&&Math.abs(tc-fc)===2;

    if (isEP) { const capRow=piece[0]==='w'?tr+1:tr-1; board[capRow][tc]=null; }
    if (isCastle) {
      if (tc>fc) { board[fr][5]=board[fr][7]; board[fr][7]=null; }
      else { board[fr][3]=board[fr][0]; board[fr][0]=null; }
    }
    board[tr][tc]=promotion||piece; board[fr][fc]=null;
    enPassantSq=piece[1]==='P'&&Math.abs(tr-fr)===2?{r:(fr+tr)/2,c:fc}:null;
    moveCount++;
    draw();
    myTurn=true; updateTurnUI(true);
  }

  function updateTurnUI(isMyTurn) {
    const statusEl=document.getElementById('game-status');
    const turnEl=document.getElementById('turn-indicator');
    if (statusEl) statusEl.textContent = isMyTurn?'Ván cờ đang diễn ra':'Ván cờ đang diễn ra';
    if (turnEl) {
      turnEl.textContent = isMyTurn?'Lượt của bạn!':'Lượt đối thủ';
      turnEl.className = 'turn-badge'+(isMyTurn?' my-turn':'');
    }
  }

  function startPreview() {
    myColor = null;
    initState();
    setupCanvas(true);
  }

  function start(room, role) {
    roomData=room; myRole=role;
    myColor=(role==='creator')?'white':'black';
    flipped=(myColor==='black');
    initState();
    setupCanvas(false);
    const firstTurn=(myColor==='white');
    myTurn=firstTurn;
    updateTurnUI(firstTurn);
  }

  function handleOpponentMove(move) {
    const userId=Auth.getUser()?.id;
    if (move.player_id===userId) return;
    applyOpponentMove(move.from_sq, move.to_sq, move.promotion);
  }

  function destroy() {
    const container=document.getElementById('phaser-container');
    if (container) container.innerHTML='';
    canvas=null; ctx=null;
    const promoUI=document.getElementById('promotion-ui');
    if (promoUI) promoUI.remove();
  }

  return { start, startPreview, handleOpponentMove, destroy, _promote };
})();