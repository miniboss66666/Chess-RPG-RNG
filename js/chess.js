const ChessGame = (() => {
  let game = null;
  let scene = null;
  let roomData = null;
  let myRole = null; // 'creator' | 'opponent'
  let myColor = null; // 'white' | 'black'

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
    wK:'♔', wQ:'♕', wR:'♖', wB:'♗', wN:'♘', wP:'♙',
    bK:'♚', bQ:'♛', bR:'♜', bB:'♝', bN:'♞', bP:'♟'
  };

  // Deep copy board
  function copyBoard(b) { return b.map(r => [...r]); }

  // Square name to [row, col]
  function sqToRC(sq) {
    const col = COLS.indexOf(sq[0]);
    const row = 8 - parseInt(sq[1]);
    return [row, col];
  }

  // [row, col] to square name
  function rcToSq(r, c) { return COLS[c] + (8 - r); }

  class ChessScene extends Phaser.Scene {
    constructor() {
      super('ChessScene');
      this.board = copyBoard(INIT_BOARD);
      this.selected = null;
      this.validMoves = [];
      this.turn = 'white';
      this.myTurn = false;
      this.tiles = [];
      this.pieceTexts = [];
      this.flipped = false;
    }

    preload() {}

    create() {
      scene = this;
      this.flipped = (myColor === 'black');
      this.drawBoard();
      this.drawPieces();
      this.input.on('pointerdown', this.onTileClick, this);
    }

    drawBoard() {
      this.tiles = [];
      for (let r = 0; r < 8; r++) {
        this.tiles[r] = [];
        for (let c = 0; c < 8; c++) {
          const dr = this.flipped ? 7 - r : r;
          const dc = this.flipped ? 7 - c : c;
          const light = (dr + dc) % 2 === 0;
          const color = light ? 0xf0d9b5 : 0xb58863;
          const rect = this.add.rectangle(
            c * SQ + SQ / 2, r * SQ + SQ / 2, SQ, SQ, color
          );
          rect.setInteractive();
          rect.boardRow = r;
          rect.boardCol = c;
          this.tiles[r][c] = rect;
        }
      }

      // Rank/file labels
      for (let i = 0; i < 8; i++) {
        const rank = this.flipped ? (i + 1) : (8 - i);
        const file = this.flipped ? COLS[7 - i] : COLS[i];
        this.add.text(2, i * SQ + 4, rank, { fontSize: '11px', color: (i % 2 === 0) ? '#b58863' : '#f0d9b5' });
        this.add.text(i * SQ + SQ - 10, 8 * SQ - 14, file, { fontSize: '11px', color: (i % 2 === 0) ? '#b58863' : '#f0d9b5' });
      }
    }

    drawPieces() {
      if (this.pieceTexts) this.pieceTexts.forEach(t => t.destroy());
      this.pieceTexts = [];

      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const piece = this.board[r][c];
          if (!piece) continue;
          const dr = this.flipped ? 7 - r : r;
          const dc = this.flipped ? 7 - c : c;
          const sym = SYMBOLS[piece];
          const isWhite = piece[0] === 'w';
          const txt = this.add.text(
            dc * SQ + SQ / 2, dr * SQ + SQ / 2,
            sym,
            {
              fontSize: '40px',
              color: isWhite ? '#ffffff' : '#1a1a1a',
              stroke: isWhite ? '#333333' : '#cccccc',
              strokeThickness: 2
            }
          ).setOrigin(0.5);
          txt.boardRow = r;
          txt.boardCol = c;
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

      const inBounds = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
      const isEnemy = (r, c) => inBounds(r,c) && this.board[r][c] && this.board[r][c][0] !== color;
      const isEmpty = (r, c) => inBounds(r,c) && !this.board[r][c];
      const canLand = (r, c) => isEmpty(r,c) || isEnemy(r,c);

      const slide = (dirs) => {
        for (const [dr, dc] of dirs) {
          let nr = r + dr, nc = c + dc;
          while (inBounds(nr, nc)) {
            if (this.board[nr][nc]) {
              if (this.board[nr][nc][0] !== color) moves.push([nr, nc]);
              break;
            }
            moves.push([nr, nc]);
            nr += dr; nc += dc;
          }
        }
      };

      const jump = (dests) => {
        for (const [dr, dc] of dests) {
          const nr = r + dr, nc = c + dc;
          if (inBounds(nr, nc) && (isEmpty(nr, nc) || isEnemy(nr, nc))) moves.push([nr, nc]);
        }
      };

      if (type === 'P') {
        const dir = color === 'w' ? -1 : 1;
        const startRow = color === 'w' ? 6 : 1;
        if (isEmpty(r + dir, c)) {
          moves.push([r + dir, c]);
          if (r === startRow && isEmpty(r + 2 * dir, c)) moves.push([r + 2 * dir, c]);
        }
        for (const dc of [-1, 1]) {
          if (isEnemy(r + dir, c + dc)) moves.push([r + dir, c + dc]);
        }
      } else if (type === 'R') {
        slide([[0,1],[0,-1],[1,0],[-1,0]]);
      } else if (type === 'B') {
        slide([[1,1],[1,-1],[-1,1],[-1,-1]]);
      } else if (type === 'Q') {
        slide([[0,1],[0,-1],[1,0],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]]);
      } else if (type === 'N') {
        jump([[2,1],[2,-1],[-2,1],[-2,-1],[1,2],[1,-2],[-1,2],[-1,-2]]);
      } else if (type === 'K') {
        jump([[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]);
      }

      return moves;
    }

    highlightMoves(moves) {
      this.clearHighlights();
      for (const [mr, mc] of moves) {
        const dr = this.flipped ? 7 - mr : mr;
        const dc = this.flipped ? 7 - mc : mc;
        const dot = this.add.circle(dc * SQ + SQ / 2, dr * SQ + SQ / 2, 10, 0x4aaa6e, 0.7);
        dot.setName('highlight');
        this.validDots = this.validDots || [];
        this.validDots.push(dot);
      }
    }

    clearHighlights() {
      if (this.validDots) { this.validDots.forEach(d => d.destroy()); this.validDots = []; }
      if (this.selectedRect) { this.selectedRect.destroy(); this.selectedRect = null; }
    }

    onTileClick(pointer) {
      if (!this.myTurn) return;

      const dc = Math.floor(pointer.x / SQ);
      const dr = Math.floor(pointer.y / SQ);
      const c = this.flipped ? 7 - dc : dc;
      const r = this.flipped ? 7 - dr : dr;

      if (r < 0 || r > 7 || c < 0 || c > 7) return;

      const piece = this.board[r][c];

      if (this.selected) {
        const isValid = this.validMoves.some(([vr, vc]) => vr === r && vc === c);
        if (isValid) {
          this.doMove(this.selected[0], this.selected[1], r, c);
          return;
        }
      }

      if (piece && piece[0] === myColor[0]) {
        this.selected = [r, c];
        this.validMoves = this.getValidMoves(r, c);
        this.clearHighlights();

        const selDr = this.flipped ? 7 - r : r;
        const selDc = this.flipped ? 7 - c : c;
        this.selectedRect = this.add.rectangle(
          selDc * SQ + SQ / 2, selDr * SQ + SQ / 2, SQ, SQ, 0x7c6fea, 0.4
        );
        this.highlightMoves(this.validMoves);
      } else {
        this.selected = null;
        this.validMoves = [];
        this.clearHighlights();
      }
    }

    doMove(fr, fc, tr, tc) {
      const fromSq = rcToSq(fr, fc);
      const toSq = rcToSq(tr, tc);
      const attackerPiece = this.board[fr][fc];
      const defenderPiece = this.board[tr][tc];
      const isCapture = !!defenderPiece;

      if (isCapture) {
        // Tính khoảng cách di chuyển
        const dist = Math.max(Math.abs(tr - fr), Math.abs(tc - fc));
        // Đếm tốt trên bàn
        let pawnsOnBoard = 0, alliedKnights = 0, hasQueenOrRook = false, alliesOnBoard = false;
        for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
          const p = this.board[r][c];
          if (!p) continue;
          if (p[0] === myColor[0]) {
            if (p[1]==='P') pawnsOnBoard++;
            if (p[1]==='N') alliedKnights++;
            if (p[1]==='Q'||p[1]==='R') hasQueenOrRook = true;
            if (p !== attackerPiece) alliesOnBoard = true;
          }
        }
        const gameCtx = {
          moveCount: this._moveCount || 0,
          attackDistance: dist,
          pawnsOnBoard, alliedKnights, hasQueenOrRook, alliesOnBoard,
          enPassantUsed: this._lastEnPassant || false,
          castlingUsed: this._castlingUsed || false,
          checkedKing: this._checkedKing || false,
          promoted: this._promoted || false,
        };
        const sceneRef = this;
        const roomRef = roomData;
        Combat.start(attackerPiece, defenderPiece, gameCtx, myColor, (result) => {
          if (result.attackerWon) {
            sceneRef.board[tr][tc] = attackerPiece;
            sceneRef.board[fr][fc] = null;
          } else {
            sceneRef.board[fr][fc] = null;
          }
          if (sceneRef.board[tr][tc] === 'wP' && tr === 0) { sceneRef.board[tr][tc] = 'wQ'; sceneRef._promoted = true; }
          if (sceneRef.board[tr][tc] === 'bP' && tr === 7) { sceneRef.board[tr][tc] = 'bQ'; sceneRef._promoted = true; }
          sceneRef.drawPieces();
          sceneRef.myTurn = false;
          Sync.sendMove(roomRef.id, fromSq, toSq, null, result.attackerWon).catch(e => console.error(e));
        });
        this._moveCount = (this._moveCount || 0) + 1;
        this.selected = null; this.validMoves = []; this.clearHighlights();
        return;
      }

      this.board[tr][tc] = this.board[fr][fc];
      this.board[fr][fc] = null;
      if (this.board[tr][tc] === 'wP' && tr === 0) this.board[tr][tc] = 'wQ';
      if (this.board[tr][tc] === 'bP' && tr === 7) this.board[tr][tc] = 'bQ';
      this._moveCount = (this._moveCount || 0) + 1;
      this.selected = null; this.validMoves = []; this.clearHighlights();
      this.drawPieces();
      this.myTurn = false;
      const statusEl = document.getElementById('turn-indicator');
      if (statusEl) { statusEl.textContent = 'Lượt đối thủ'; statusEl.className = 'turn-badge'; }
      Sync.sendMove(roomData.id, fromSq, toSq).catch(e => console.error('Send move error', e));
    }

    applyOpponentMove(fromSq, toSq) {
      const [fr, fc] = sqToRC(fromSq);
      const [tr, tc] = sqToRC(toSq);

      this.board[tr][tc] = this.board[fr][fc];
      this.board[fr][fc] = null;

      if (this.board[tr][tc] === 'wP' && tr === 0) this.board[tr][tc] = 'wQ';
      if (this.board[tr][tc] === 'bP' && tr === 7) this.board[tr][tc] = 'bQ';

      this.drawPieces();
      this.myTurn = true;

      const statusEl = document.getElementById('turn-indicator');
      if (statusEl) { statusEl.textContent = 'Lượt của bạn!'; statusEl.className = 'turn-badge my-turn'; }
    }
  }

  function start(room, role) {
    roomData = room;
    myRole = role;
    myColor = (role === 'creator') ? 'white' : 'black';

    const firstTurn = (myColor === 'white');

    if (game) { game.destroy(true); game = null; }

    const size = Math.min(window.innerWidth, 512);
    game = new Phaser.Game({
      type: Phaser.AUTO,
      width: size,
      height: size,
      backgroundColor: '#0f0f13',
      parent: 'phaser-container',
      scene: ChessScene,
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
      }
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

  function handleOpponentMove(move) {
    if (!scene) return;
    const userId = Auth.getUser()?.id;
    if (move.player_id === userId) return;
    scene.applyOpponentMove(move.from_sq, move.to_sq);
  }

  function destroy() {
    if (game) { game.destroy(true); game = null; scene = null; }
  }

  return { start, handleOpponentMove, destroy };
})();