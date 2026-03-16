const ChessGame = (() => {
  let game = null;
  let scene = null;
  let roomData = null;
  let myRole = null;
  let myColor = null;

  const SQ = 64;
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

  const SYMBOLS = {
    wK:'♔',wQ:'♕',wR:'♖',wB:'♗',wN:'♘',wP:'♙',
    bK:'♚',bQ:'♛',bR:'♜',bB:'♝',bN:'♞',bP:'♟'
  };

  function copyBoard(b) { return b.map(r => [...r]); }
  function sqToRC(sq) { return [8 - parseInt(sq[1]), COLS.indexOf(sq[0])]; }
  function rcToSq(r, c) { return COLS[c] + (8 - r); }
  function inB(r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8; }

  class ChessScene extends Phaser.Scene {
    constructor() {
      super('ChessScene');
      this.board = copyBoard(INIT_BOARD);
      this.selected = null;
      this.validMoves = []; // [{r,c,type}] type: normal|capture|enpassant|castleK|castleQ|promote
      this.turn = 'w';
      this.myTurn = false;
      this.flipped = false;
      this.validDots = [];
      this.selectedRect = null;
      this.pieceTexts = [];
      // state
      this.moveCount = 0;
      this.enPassantSq = null; // {r,c} ô có thể en passant
      this.castling = { wK:true, wRh:true, wRa:true, bK:true, bRh:true, bRa:true };
      this.lastEnPassant = false;
      this.castlingUsed = false;
      this.promotedFromPawn = false;
      this.attackDistance = 0;
      this.pendingPromotion = null; // {fr,fc,tr,tc,color}
    }

    preload() {}

    create() {
      scene = this;
      this.flipped = (myColor === 'black');
      this.drawBoard();
      this.drawPieces();
      if (myColor) this.input.on('pointerdown', this.onTileClick, this);
    }

    drawBoard() {
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const dr = this.flipped ? 7-r : r;
          const dc = this.flipped ? 7-c : c;
          const light = (dr+dc)%2===0;
          this.add.rectangle(c*SQ+SQ/2, r*SQ+SQ/2, SQ, SQ, light?0xf0d9b5:0xb58863);
        }
      }
      for (let i = 0; i < 8; i++) {
        const rank = this.flipped ? i+1 : 8-i;
        const file = this.flipped ? COLS[7-i] : COLS[i];
        this.add.text(2, i*SQ+4, rank, {fontSize:'11px', color:(i%2===0)?'#b58863':'#f0d9b5'});
        this.add.text(i*SQ+SQ-10, 8*SQ-14, file, {fontSize:'11px', color:(i%2===0)?'#b58863':'#f0d9b5'});
      }
    }

    drawPieces() {
      if (this.pieceTexts) this.pieceTexts.forEach(t => t.destroy());
      this.pieceTexts = [];
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const piece = this.board[r][c];
          if (!piece) continue;
          const dr = this.flipped ? 7-r : r;
          const dc = this.flipped ? 7-c : c;
          const isWhite = piece[0]==='w';
          const txt = this.add.text(
            dc*SQ+SQ/2, dr*SQ+SQ/2, SYMBOLS[piece],
            { fontSize:'40px', color: isWhite?'#ffffff':'#1a1a1a',
              stroke: isWhite?'#333333':'#cccccc', strokeThickness:2 }
          ).setOrigin(0.5);
          this.pieceTexts.push(txt);
        }
      }
    }

    getValidMoves(r, c) {
      const piece = this.board[r][c];
      if (!piece) return [];
      const color = piece[0];
      const type = piece[1];
      const moves = [];

      const isEmpty = (r,c) => inB(r,c) && !this.board[r][c];
      const isEnemy = (r,c) => inB(r,c) && this.board[r][c] && this.board[r][c][0]!==color;
      const canLand = (r,c) => isEmpty(r,c)||isEnemy(r,c);

      const slide = (dirs) => {
        for (const [dr,dc] of dirs) {
          let nr=r+dr, nc=c+dc;
          while (inB(nr,nc)) {
            if (this.board[nr][nc]) {
              if (this.board[nr][nc][0]!==color) moves.push({r:nr,c:nc,type:'capture'});
              break;
            }
            moves.push({r:nr,c:nc,type:'normal'});
            nr+=dr; nc+=dc;
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
        const dir = color==='w' ? -1 : 1;
        const startRow = color==='w' ? 6 : 1;
        const promRow = color==='w' ? 0 : 7;

        // Tiến 1
        if (isEmpty(r+dir,c)) {
          const t = (r+dir===promRow) ? 'promote' : 'normal';
          moves.push({r:r+dir,c,type:t});
          // Tiến 2 từ ô xuất phát
          if (r===startRow && isEmpty(r+2*dir,c))
            moves.push({r:r+2*dir,c,type:'normal'});
        }
        // Ăn chéo
        for (const dc of [-1,1]) {
          if (isEnemy(r+dir,c+dc)) {
            const t = (r+dir===promRow) ? 'promote' : 'capture';
            moves.push({r:r+dir,c:c+dc,type:t});
          }
          // En passant
          if (this.enPassantSq &&
              this.enPassantSq.r===r+dir && this.enPassantSq.c===c+dc) {
            moves.push({r:r+dir,c:c+dc,type:'enpassant'});
          }
        }
      } else if (type==='R') {
        slide([[0,1],[0,-1],[1,0],[-1,0]]);
      } else if (type==='B') {
        slide([[1,1],[1,-1],[-1,1],[-1,-1]]);
      } else if (type==='Q') {
        slide([[0,1],[0,-1],[1,0],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]]);
      } else if (type==='N') {
        jump([[2,1],[2,-1],[-2,1],[-2,-1],[1,2],[1,-2],[-1,2],[-1,-2]]);
      } else if (type==='K') {
        jump([[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]);
        // Nhập thành kingside
        const row = color==='w'?7:0;
        if (r===row && c===4) {
          if (color==='w' && this.castling.wK && this.castling.wRh &&
              !this.board[row][5] && !this.board[row][6] && this.board[row][7]==='wR') {
            moves.push({r:row,c:6,type:'castleK'});
          }
          if (color==='w' && this.castling.wK && this.castling.wRa &&
              !this.board[row][3] && !this.board[row][2] && !this.board[row][1] && this.board[row][0]==='wR') {
            moves.push({r:row,c:2,type:'castleQ'});
          }
          if (color==='b' && this.castling.bK && this.castling.bRh &&
              !this.board[row][5] && !this.board[row][6] && this.board[row][7]==='bR') {
            moves.push({r:row,c:6,type:'castleK'});
          }
          if (color==='b' && this.castling.bK && this.castling.bRa &&
              !this.board[row][3] && !this.board[row][2] && !this.board[row][1] && this.board[row][0]==='bR') {
            moves.push({r:row,c:2,type:'castleQ'});
          }
        }
      }

      return moves;
    }

    clearHighlights() {
      if (this.validDots) { this.validDots.forEach(d=>d.destroy()); this.validDots=[]; }
      if (this.selectedRect) { this.selectedRect.destroy(); this.selectedRect=null; }
    }

    highlightMoves(moves) {
      this.clearHighlights();
      // Highlight ô đang chọn
      const dr = this.flipped?7-this.selected[0]:this.selected[0];
      const dc = this.flipped?7-this.selected[1]:this.selected[1];
      this.selectedRect = this.add.rectangle(dc*SQ+SQ/2, dr*SQ+SQ/2, SQ, SQ, 0x7c6fea, 0.4);

      for (const m of moves) {
        const mr = this.flipped?7-m.r:m.r;
        const mc = this.flipped?7-m.c:m.c;
        if (m.type==='capture'||m.type==='enpassant') {
          // Highlight ô địch
          const ring = this.add.graphics();
          ring.lineStyle(3, 0xe05555, 0.8);
          ring.strokeRect(mc*SQ+2, mr*SQ+2, SQ-4, SQ-4);
          this.validDots.push(ring);
        } else if (m.type==='castleK'||m.type==='castleQ') {
          const dot = this.add.circle(mc*SQ+SQ/2, mr*SQ+SQ/2, 12, 0x378add, 0.7);
          this.validDots.push(dot);
        } else {
          const dot = this.add.circle(mc*SQ+SQ/2, mr*SQ+SQ/2, 10, 0x4aaa6e, 0.7);
          this.validDots.push(dot);
        }
      }
    }

    onTileClick(pointer) {
      if (!this.myTurn) return;
      if (this.pendingPromotion) return; // đang chọn phong cấp

      const dc = Math.floor(pointer.x/SQ);
      const dr = Math.floor(pointer.y/SQ);
      if (dc<0||dc>7||dr<0||dr>7) return;
      const c = this.flipped?7-dc:dc;
      const r = this.flipped?7-dr:dr;

      const piece = this.board[r][c];

      // Đang có quân được chọn
      if (this.selected) {
        const move = this.validMoves.find(m=>m.r===r&&m.c===c);
        if (move) {
          this.doMove(this.selected[0], this.selected[1], r, c, move.type);
          return;
        }
      }

      // Chọn quân mới
      if (piece && piece[0]===myColor[0]) {
        this.selected = [r,c];
        this.validMoves = this.getValidMoves(r,c);
        this.highlightMoves(this.validMoves);
      } else {
        this.selected = null;
        this.validMoves = [];
        this.clearHighlights();
      }
    }

    doMove(fr, fc, tr, tc, moveType) {
      const fromSq = rcToSq(fr,fc);
      const toSq = rcToSq(tr,tc);
      const piece = this.board[fr][fc];
      const color = piece[0];
      const captured = this.board[tr][tc];

      this.lastEnPassant = false;
      this.attackDistance = Math.max(Math.abs(tr-fr), Math.abs(tc-fc));

      // En passant
      if (moveType==='enpassant') {
        const capturedPawnRow = color==='w' ? tr+1 : tr-1;
        const defender = this.board[capturedPawnRow][tc];
        this.board[capturedPawnRow][tc] = null;
        this.board[tr][tc] = piece;
        this.board[fr][fc] = null;
        this.lastEnPassant = true;
        this.enPassantSq = null;
        this.selected=null; this.validMoves=[]; this.clearHighlights();
        this.drawPieces();
        this.myTurn = false;
        this._finishMove(fromSq, toSq, null, true, null, false, defender);
        return;
      }

      // Nhập thành
      if (moveType==='castleK'||moveType==='castleQ') {
        const row = fr;
        this.board[tr][tc] = piece;
        this.board[fr][fc] = null;
        if (moveType==='castleK') {
          this.board[row][5] = this.board[row][7];
          this.board[row][7] = null;
        } else {
          this.board[row][3] = this.board[row][0];
          this.board[row][0] = null;
        }
        this.castlingUsed = true;
        if (color==='w') { this.castling.wK=false; this.castling.wRh=false; this.castling.wRa=false; }
        else { this.castling.bK=false; this.castling.bRh=false; this.castling.bRa=false; }
        this.enPassantSq = null;
        this.selected=null; this.validMoves=[]; this.clearHighlights();
        this.drawPieces(); this.myTurn=false;
        this._finishMove(fromSq, toSq, null, false, moveType, false, null);
        return;
      }

      // Phong cấp — hiện dialog
      if (moveType==='promote') {
        this.board[fr][fc] = null;
        this.pendingPromotion = { fr,fc,tr,tc,color,fromSq,toSq,captured };
        this.selected=null; this.validMoves=[]; this.clearHighlights();
        this.drawPieces();
        this._showPromotionUI(color);
        return;
      }

      // Di chuyển thường
      this.board[tr][tc] = piece;
      this.board[fr][fc] = null;

      // Set en passant target nếu tốt đi 2
      this.enPassantSq = null;
      if (piece[1]==='P' && Math.abs(tr-fr)===2) {
        this.enPassantSq = { r:(fr+tr)/2, c:fc };
      }

      // Update castling rights
      if (piece==='wK') { this.castling.wK=false; }
      if (piece==='bK') { this.castling.bK=false; }
      if (piece==='wR' && fc===7) this.castling.wRh=false;
      if (piece==='wR' && fc===0) this.castling.wRa=false;
      if (piece==='bR' && fc===7) this.castling.bRh=false;
      if (piece==='bR' && fc===0) this.castling.bRa=false;

      this.selected=null; this.validMoves=[]; this.clearHighlights();
      this.drawPieces();
      this.myTurn=false;
      this._finishMove(fromSq, toSq, captured, false, null, false, captured);
    }

    _showPromotionUI(color) {
      const pieces = ['Q','R','B','N'];
      const labels = { Q:'Hậu ♕', R:'Xe ♖', B:'Tượng ♗', N:'Mã ♘' };
      const el = document.getElementById('promotion-ui');
      if (!el) {
        // Tạo UI nếu chưa có
        const div = document.createElement('div');
        div.id = 'promotion-ui';
        div.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:999;';
        div.innerHTML = `<div style="background:#1a1a24;border:1px solid #2e2e3e;border-radius:12px;padding:20px;display:flex;flex-direction:column;gap:10px;align-items:center;">
          <div style="font-size:14px;font-weight:600;color:#e8e8f0;margin-bottom:4px;">Chọn quân phong cấp</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;" id="promo-btns"></div>
        </div>`;
        document.body.appendChild(div);
      }
      const btnContainer = document.getElementById('promo-btns');
      btnContainer.innerHTML = pieces.map(p => `
        <button onclick="ChessGame._promote('${color}${p}')"
          style="background:#24242f;border:1px solid #2e2e3e;border-radius:8px;padding:12px 20px;
                 color:#e8e8f0;font-size:20px;cursor:pointer;transition:background .15s;"
          onmouseover="this.style.background='#7c6fea'" onmouseout="this.style.background='#24242f'">
          ${labels[p]}
        </button>`).join('');
      document.getElementById('promotion-ui').style.display='flex';
    }

    _finishMove(fromSq, toSq, captured, isEnPassant, castleType, isPromotion, capturedPiece) {
      this.moveCount++;
      const statusEl = document.getElementById('turn-indicator');
      if (statusEl) { statusEl.textContent='Lượt đối thủ'; statusEl.className='turn-badge'; }

      if (capturedPiece && !isPromotion) {
        // Tính context cho combat
        const gameCtx = this._buildGameCtx();
        const sceneRef = this;
        Combat.start(
          this._lastMovedPiece || 'wP',
          capturedPiece,
          gameCtx,
          myColor,
          (result) => {
            if (!result.attackerWon) {
              // Attacker thua — quay lại ô cũ (đã move rồi, undo)
              const [fr2,fc2] = sqToRC(fromSq);
              const [tr2,tc2] = sqToRC(toSq);
              sceneRef.board[fr2][fc2] = sceneRef._lastMovedPiece;
              sceneRef.board[tr2][tc2] = capturedPiece;
            }
            if (result.freeze) {
              // TODO: áp dụng freeze cho đối thủ
            }
            sceneRef.drawPieces();
            sceneRef.myTurn = false;
            Sync.sendMove(roomData.id, fromSq, toSq, isPromotion?sceneRef.board[sqToRC(toSq)[0]][sqToRC(toSq)[1]]:null)
              .catch(e=>console.error(e));
          }
        );
      } else {
        Sync.sendMove(roomData.id, fromSq, toSq, isPromotion?this.board[sqToRC(toSq)[0]][sqToRC(toSq)[1]]:null)
          .catch(e=>console.error(e));
      }
    }

    _buildGameCtx() {
      let pawnsOnBoard=0, alliedKnights=0, hasQueenOrRook=false, alliesOnBoard=false;
      const col = myColor[0];
      for (let r=0;r<8;r++) for (let c=0;c<8;c++) {
        const p=this.board[r][c]; if (!p) continue;
        if (p[0]===col) {
          if(p[1]==='P') pawnsOnBoard++;
          if(p[1]==='N') alliedKnights++;
          if(p[1]==='Q'||p[1]==='R') hasQueenOrRook=true;
          alliesOnBoard=true;
        }
      }
      return {
        moveCount: this.moveCount,
        attackDistance: this.attackDistance,
        pawnsOnBoard, alliedKnights, hasQueenOrRook, alliesOnBoard,
        enPassantUsed: this.lastEnPassant,
        castlingUsed: this.castlingUsed,
        checkedKing: false,
        promoted: this.promotedFromPawn,
      };
    }

    applyOpponentMove(fromSq, toSq, promotion) {
      const [fr,fc] = sqToRC(fromSq);
      const [tr,tc] = sqToRC(toSq);
      const piece = this.board[fr][fc];
      if (!piece) return;

      const captured = this.board[tr][tc];
      const moveType = piece[1]==='P' && Math.abs(tr-fr)===2 ? 'double'
        : piece[1]==='K' && Math.abs(tc-fc)===2 ? (tc>fc?'castleK':'castleQ')
        : piece[1]==='P' && fc!==tc && !captured ? 'enpassant'
        : promotion ? 'promote' : 'normal';

      if (moveType==='enpassant') {
        const capRow = piece[0]==='w'?tr+1:tr-1;
        this.board[capRow][tc]=null;
      }
      if (moveType==='castleK') {
        const row=fr;
        this.board[row][5]=this.board[row][7]; this.board[row][7]=null;
      }
      if (moveType==='castleQ') {
        const row=fr;
        this.board[row][3]=this.board[row][0]; this.board[row][0]=null;
      }

      this.board[tr][tc] = promotion || piece;
      this.board[fr][fc] = null;

      if (piece[1]==='P'&&Math.abs(tr-fr)===2) {
        this.enPassantSq={r:(fr+tr)/2,c:fc};
      } else {
        this.enPassantSq=null;
      }

      this.moveCount++;
      this.drawPieces();
      this.myTurn=true;

      const statusEl=document.getElementById('turn-indicator');
      if (statusEl) { statusEl.textContent='Lượt của bạn!'; statusEl.className='turn-badge my-turn'; }
    }
  }

  // Phong cấp callback từ UI
  function _promote(pieceCode) {
    document.getElementById('promotion-ui').style.display='none';
    if (!scene || !scene.pendingPromotion) return;
    const { tr,tc,fromSq,toSq,captured } = scene.pendingPromotion;
    scene.board[tr][tc] = pieceCode;
    scene.promotedFromPawn = true;
    scene.pendingPromotion = null;
    scene._lastMovedPiece = pieceCode;
    scene.drawPieces();
    scene.myTurn=false;
    scene._finishMove(fromSq, toSq, captured, false, null, true, captured);
  }

  function start(room, role) {
    roomData = room; myRole = role;
    myColor = (role==='creator') ? 'white' : 'black';
    const firstTurn = (myColor==='white');
    if (game) { game.destroy(true); game=null; scene=null; }
    const container = document.getElementById('phaser-container');
    const size = Math.min(window.innerWidth, window.innerHeight - 120, 512);
    if (container) {
      container.style.width = size + 'px';
      container.style.height = size + 'px';
      container.style.margin = '0 auto';
    }
    game = new Phaser.Game({
      type: Phaser.CANVAS,
      width: size, height: size,
      backgroundColor: '#0f0f13',
      parent: 'phaser-container',
      scene: ChessScene,
      scale: { mode: Phaser.Scale.NONE }
    });
    game.events.on('ready', () => {
      if (scene) scene.myTurn = firstTurn;
      const statusEl = document.getElementById('turn-indicator');
      if (statusEl) {
        statusEl.textContent = firstTurn ? 'Lượt của bạn!' : 'Lượt đối thủ';
        statusEl.className = 'turn-badge' + (firstTurn ? ' my-turn' : '');
      }
    });
  }

  function startPreview() {
    myColor = null;
    if (game) { game.destroy(true); game=null; scene=null; }
    const container = document.getElementById('phaser-container');
    const size = Math.min(window.innerWidth, window.innerHeight - 120, 512);
    if (container) {
      container.style.width = size + 'px';
      container.style.height = size + 'px';
      container.style.margin = '0 auto';
    }
    game = new Phaser.Game({
      type: Phaser.CANVAS,
      width: size, height: size,
      backgroundColor: '#0f0f13',
      parent: 'phaser-container',
      scene: ChessScene,
      scale: { mode: Phaser.Scale.NONE }
    });
  }

  function handleOpponentMove(move) {
    if (!scene) return;
    const userId = Auth.getUser()?.id;
    if (move.player_id===userId) return;
    scene.applyOpponentMove(move.from_sq, move.to_sq, move.promotion);
  }

  function destroy() {
    if (game) { game.destroy(true); game=null; scene=null; }
    const promoUI = document.getElementById('promotion-ui');
    if (promoUI) promoUI.remove();
  }

  return { start, startPreview, handleOpponentMove, destroy, _promote };
})();