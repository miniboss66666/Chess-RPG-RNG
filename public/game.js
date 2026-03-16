// Chess RPG RNG - Game Engine

const BOARD_SIZE = 8;

const PIECE_ICONS = {
    King:   { white: '♔', black: '♚' },
    Queen:  { white: '♕', black: '♛' },
    Rook:   { white: '♖', black: '♜' },
    Bishop: { white: '♗', black: '♝' },
    Knight: { white: '♘', black: '♞' },
    Pawn:   { white: '♙', black: '♟' },
};

const DICE_FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

const ENEMY_TYPES = [
    { name: 'Black Pawn',   icon: '♟', hp: 20, attack: 6,  defense: 2, xp: 15, gold: 5,  tier: 1 },
    { name: 'Black Rook',   icon: '♜', hp: 45, attack: 12, defense: 5, xp: 35, gold: 15, tier: 2 },
    { name: 'Black Bishop', icon: '♝', hp: 35, attack: 14, defense: 4, xp: 30, gold: 12, tier: 2 },
    { name: 'Black Knight', icon: '♞', hp: 40, attack: 16, defense: 3, xp: 40, gold: 18, tier: 2 },
    { name: 'Black Queen',  icon: '♛', hp: 70, attack: 22, defense: 8, xp: 80, gold: 40, tier: 3, isBoss: true },
    { name: 'Black King',   icon: '♚', hp: 100,attack: 28, defense: 12,xp:120, gold: 60, tier: 3, isBoss: true },
];

const ITEM_TYPES = [
    { name: 'Health Potion',  icon: '🧪', effect: 'heal',   value: 30, desc: 'Restores 30 HP' },
    { name: 'Iron Shield',    icon: '🛡', effect: 'defense', value: 3,  desc: '+3 Defense permanently' },
    { name: 'Flame Sword',    icon: '🗡', effect: 'attack',  value: 4,  desc: '+4 Attack permanently' },
    { name: 'Gold Coin Bag',  icon: '💰', effect: 'gold',    value: 25, desc: 'Gain 25 Gold' },
    { name: 'XP Tome',        icon: '📖', effect: 'xp',      value: 40, desc: 'Gain 40 XP' },
    { name: 'Elixir of Life', icon: '✨', effect: 'heal',    value: 60, desc: 'Restores 60 HP' },
];

const PLAYER_CLASSES = {
    King:   { hp: 100, attack: 10, defense: 8,  abilities: ['Royal Guard', 'Castling Strike'] },
    Queen:  { hp: 85,  attack: 16, defense: 5,  abilities: ['Diagonal Slash', 'Power Surge'] },
    Rook:   { hp: 110, attack: 12, defense: 10, abilities: ['Tower Defense', 'Straight Rush'] },
    Bishop: { hp: 75,  attack: 14, defense: 4,  abilities: ['Holy Light', 'Diagonal Bless'] },
    Knight: { hp: 90,  attack: 15, defense: 6,  abilities: ['L-Jump Attack', 'Cavalry Charge'] },
};

const ABILITY_DEFS = {
    'Royal Guard':       { desc: 'Reduce next hit by 50%', damage: 0,  cooldown: 3, effect: 'shield' },
    'Castling Strike':   { desc: 'Heavy blow (2x ATK)',     damage: 2,  cooldown: 4, effect: 'attack' },
    'Diagonal Slash':    { desc: 'Strikes all sides',       damage: 1.5,cooldown: 2, effect: 'attack' },
    'Power Surge':       { desc: 'Triple ATK for 1 turn',   damage: 3,  cooldown: 5, effect: 'attack' },
    'Tower Defense':     { desc: '+5 DEF for 2 turns',      damage: 0,  cooldown: 3, effect: 'defense' },
    'Straight Rush':     { desc: 'Charge attack (1.8x ATK)',damage: 1.8,cooldown: 3, effect: 'attack' },
    'Holy Light':        { desc: 'Heal 25 HP',              damage: 0,  cooldown: 4, effect: 'heal' },
    'Diagonal Bless':    { desc: 'Buff ATK +6 for 2 turns', damage: 0,  cooldown: 3, effect: 'buff' },
    'L-Jump Attack':     { desc: 'Surprise 2x ATK',         damage: 2,  cooldown: 3, effect: 'attack' },
    'Cavalry Charge':    { desc: 'Stun + 1.5x ATK',         damage: 1.5,cooldown: 4, effect: 'attack' },
};

let gameState = null;

function rng(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function rollD6() {
    return rng(1, 6);
}

function initGame() {
    const classes = Object.keys(PLAYER_CLASSES);
    const chosenClass = classes[rng(0, classes.length - 1)];
    const stats = PLAYER_CLASSES[chosenClass];

    gameState = {
        player: {
            name: `The White ${chosenClass}`,
            class: chosenClass,
            level: 1,
            maxHp: stats.hp,
            hp: stats.hp,
            attack: stats.attack,
            defense: stats.defense,
            xp: 0,
            xpNext: 100,
            gold: 0,
            abilities: stats.abilities.map(name => ({ name, cooldownLeft: 0 })),
            inventory: [],
            shieldActive: false,
            atkBuff: 0,
            atkBuffTurns: 0,
            defBuff: 0,
            defBuffTurns: 0,
        },
        board: generateBoard(),
        playerPos: { row: 7, col: 0 },
        currentEnemy: null,
        turn: 0,
        inCombat: false,
        gameOver: false,
    };

    gameState.board[7][0] = 'player';
    renderAll();
    addLog('Your adventure begins! Use Move to explore the board.', 'welcome');
}

function generateBoard() {
    const board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill('empty'));

    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            if (row === 7 && col === 0) continue;
            const roll = rng(1, 100);
            if (row < 3 && roll <= 20) {
                board[row][col] = 'boss';
            } else if (roll <= 35) {
                board[row][col] = 'enemy';
            } else if (roll <= 50) {
                board[row][col] = 'item';
            }
        }
    }
    return board;
}

function renderBoard() {
    const boardEl = document.getElementById('chess-board');
    boardEl.innerHTML = '';

    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            const cell = document.createElement('div');
            const isLight = (row + col) % 2 === 0;
            cell.className = `cell ${isLight ? 'light' : 'dark'}`;
            cell.dataset.row = row;
            cell.dataset.col = col;

            const pos = gameState.board[row][col];
            const isPlayer = row === gameState.playerPos.row && col === gameState.playerPos.col;

            if (isPlayer) {
                cell.classList.add('player');
                cell.textContent = PIECE_ICONS[gameState.player.class]?.white || '♔';
            } else if (pos === 'enemy') {
                cell.classList.add('enemy');
                cell.textContent = '♟';
            } else if (pos === 'boss') {
                cell.classList.add('boss');
                cell.textContent = '♛';
            } else if (pos === 'item') {
                cell.classList.add('item-cell');
                cell.textContent = '◈';
            } else if (pos === 'visited') {
                cell.classList.add('visited');
                cell.textContent = '·';
            }

            cell.addEventListener('click', () => onCellClick(row, col));
            boardEl.appendChild(cell);
        }
    }
}

function renderPlayerStats() {
    const p = gameState.player;
    document.getElementById('player-name').textContent = p.name;
    document.getElementById('player-class').textContent = p.class;
    document.getElementById('player-level').textContent = p.level;
    document.getElementById('player-hp').textContent = `${p.hp} / ${p.maxHp}`;
    document.getElementById('player-attack').textContent = p.attack + (p.atkBuff > 0 ? ` (+${p.atkBuff})` : '');
    document.getElementById('player-defense').textContent = p.defense + (p.defBuff > 0 ? ` (+${p.defBuff})` : '');
    document.getElementById('player-xp').textContent = `${p.xp} / ${p.xpNext}`;
    document.getElementById('player-gold').textContent = `★ ${p.gold}`;

    document.getElementById('hp-bar').style.width = `${(p.hp / p.maxHp) * 100}%`;
    document.getElementById('xp-bar').style.width = `${(p.xp / p.xpNext) * 100}%`;
}

function renderAbilities() {
    const container = document.getElementById('abilities-list');
    container.innerHTML = '';
    gameState.player.abilities.forEach(ab => {
        const def = ABILITY_DEFS[ab.name];
        const div = document.createElement('div');
        div.className = 'ability-item';
        div.innerHTML = `
            <div class="ability-name">${ab.name}</div>
            <div class="ability-desc">${def.desc}</div>
            <div class="ability-cooldown">${ab.cooldownLeft > 0 ? `⏳ Cooldown: ${ab.cooldownLeft}` : '✓ Ready'}</div>
        `;
        if (gameState.inCombat && ab.cooldownLeft === 0) {
            div.style.cursor = 'pointer';
            div.addEventListener('click', () => useAbility(ab.name));
            div.style.borderColor = '#27ae60';
        }
        container.appendChild(div);
    });
}

function renderInventory() {
    const container = document.getElementById('inventory-list');
    container.innerHTML = '';
    const items = gameState.player.inventory;
    if (items.length === 0) {
        container.innerHTML = '<p class="empty-msg">No items yet</p>';
        return;
    }
    items.forEach((item, idx) => {
        const div = document.createElement('div');
        div.className = 'item-card';
        div.innerHTML = `<span>${item.icon} ${item.name}</span><span class="item-desc">${item.desc}</span>`;
        if (item.effect === 'heal') {
            div.style.cursor = 'pointer';
            div.title = 'Click to use';
            div.addEventListener('click', () => useInventoryItem(idx));
        }
        container.appendChild(div);
    });
}

function renderEncounter() {
    const container = document.getElementById('encounter-info');
    if (!gameState.currentEnemy) {
        container.innerHTML = '<p class="empty-msg">No encounter — move to explore!</p>';
        return;
    }
    const e = gameState.currentEnemy;
    const hpPct = (e.hp / e.maxHp) * 100;
    container.innerHTML = `
        <div class="encounter-enemy">
            <div class="enemy-icon">${e.icon}</div>
            <div class="enemy-name">${e.name}${e.isBoss ? ' ⚠ BOSS' : ''}</div>
            <div class="enemy-stats">HP: ${e.hp}/${e.maxHp} | ATK: ${e.attack} | DEF: ${e.defense}</div>
            <div class="enemy-hp-bar-container">
                <div class="enemy-hp-bar" style="width: ${hpPct}%"></div>
            </div>
        </div>
    `;
}

function renderButtons() {
    document.getElementById('btn-attack').disabled = !gameState.inCombat;
    document.getElementById('btn-move').disabled = gameState.inCombat;
    document.getElementById('btn-rest').disabled = gameState.inCombat;
    const hasUsableItem = gameState.player.inventory.some(i => i.effect === 'heal');
    document.getElementById('btn-item').disabled = !hasUsableItem;
}

function renderAll() {
    renderBoard();
    renderPlayerStats();
    renderAbilities();
    renderInventory();
    renderEncounter();
    renderButtons();
}

function addLog(msg, type = 'info') {
    const log = document.getElementById('battle-log');
    const entry = document.createElement('p');
    entry.className = `log-entry ${type}`;
    entry.textContent = msg;
    log.appendChild(entry);
    log.scrollTop = log.scrollHeight;
}

function onCellClick(row, col) {
    if (gameState.inCombat) return;
    const dr = Math.abs(row - gameState.playerPos.row);
    const dc = Math.abs(col - gameState.playerPos.col);
    const isAdjacent = dr <= 1 && dc <= 1 && !(dr === 0 && dc === 0);
    if (!isAdjacent) return;
    movePlayer(row, col);
}

function playerAction(action) {
    if (gameState.gameOver) return;

    if (action === 'move') {
        addLog('Click an adjacent cell to move.', 'info');
    } else if (action === 'attack') {
        if (!gameState.inCombat || !gameState.currentEnemy) return;
        doPlayerAttack();
    } else if (action === 'item') {
        const idx = gameState.player.inventory.findIndex(i => i.effect === 'heal');
        if (idx !== -1) useInventoryItem(idx);
    } else if (action === 'rest') {
        if (gameState.inCombat) return;
        const heal = 10;
        gameState.player.hp = Math.min(gameState.player.maxHp, gameState.player.hp + heal);
        addLog(`You rest and recover ${heal} HP.`, 'info');
        renderAll();
    }
}

function movePlayer(row, col) {
    const prevRow = gameState.playerPos.row;
    const prevCol = gameState.playerPos.col;

    if (gameState.board[prevRow][prevCol] === 'player') {
        gameState.board[prevRow][prevCol] = 'visited';
    }

    gameState.playerPos = { row, col };
    gameState.turn++;

    const cellType = gameState.board[row][col];

    if (cellType === 'enemy') {
        startCombat(false);
    } else if (cellType === 'boss') {
        startCombat(true);
    } else if (cellType === 'item') {
        collectItem(row, col);
    } else {
        addLog(`You move to (${String.fromCharCode(65 + col)}${8 - row}).`, 'move');
    }

    gameState.board[row][col] = 'player';

    tickBuffs();
    renderAll();
}

function startCombat(isBoss) {
    const pool = isBoss
        ? ENEMY_TYPES.filter(e => e.isBoss)
        : ENEMY_TYPES.filter(e => !e.isBoss);

    const template = pool[rng(0, pool.length - 1)];
    const hpBonus = (gameState.player.level - 1) * 5;

    gameState.currentEnemy = {
        ...template,
        hp: template.hp + hpBonus,
        maxHp: template.hp + hpBonus,
    };
    gameState.inCombat = true;
    addLog(`⚔ ${isBoss ? 'BOSS BATTLE! ' : ''}You encounter ${gameState.currentEnemy.name}!`, 'attack');
}

function doPlayerAttack(multiplier = 1, label = 'attack') {
    if (!gameState.currentEnemy) return;

    const p = gameState.player;
    const e = gameState.currentEnemy;
    const atkTotal = p.attack + (p.atkBuff || 0);
    const roll = rollD6();
    const baseDmg = Math.max(1, atkTotal * multiplier - e.defense + roll);
    const dmg = Math.floor(baseDmg);

    e.hp = Math.max(0, e.hp - dmg);
    addLog(`You ${label} ${e.name} for ${dmg} damage! (Roll: ${roll}) [Enemy HP: ${e.hp}/${e.maxHp}]`, 'attack');

    if (e.hp <= 0) {
        endCombatVictory();
        return;
    }

    enemyAttack();
}

function enemyAttack() {
    const p = gameState.player;
    const e = gameState.currentEnemy;
    const roll = rollD6();
    let dmg = Math.max(1, e.attack - p.defense - (p.defBuff || 0) + roll);

    if (p.shieldActive) {
        dmg = Math.floor(dmg / 2);
        p.shieldActive = false;
        addLog(`Your Royal Guard blocked half the damage!`, 'info');
    }

    p.hp = Math.max(0, p.hp - dmg);
    addLog(`${e.name} attacks you for ${dmg} damage! (Roll: ${roll}) [Your HP: ${p.hp}/${p.maxHp}]`, 'enemy-attack');

    if (p.hp <= 0) {
        endCombatDeath();
        return;
    }

    renderAll();
}

function endCombatVictory() {
    const e = gameState.currentEnemy;
    addLog(`Victory! You defeated ${e.name}!`, 'victory');
    addLog(`Gained ${e.xp} XP and ${e.gold} Gold!`, 'loot');

    gameState.player.xp += e.xp;
    gameState.player.gold += e.gold;
    gameState.inCombat = false;
    gameState.currentEnemy = null;

    checkLevelUp();

    if (rng(1, 100) <= 30) {
        const item = ITEM_TYPES[rng(0, ITEM_TYPES.length - 1)];
        addLog(`Loot! Found ${item.icon} ${item.name}: ${item.desc}`, 'loot');
        gameState.player.inventory.push({ ...item });
    }

    renderAll();
}

function endCombatDeath() {
    gameState.gameOver = true;
    gameState.inCombat = false;
    addLog('You have been defeated! Game Over.', 'death');
    showModal('☠ Defeat!', `You were slain in battle at level ${gameState.player.level} with ${gameState.player.gold} gold. Refresh to start a new adventure!`);
    renderAll();
}

function checkLevelUp() {
    const p = gameState.player;
    while (p.xp >= p.xpNext) {
        p.xp -= p.xpNext;
        p.level++;
        p.xpNext = Math.floor(p.xpNext * 1.5);
        p.maxHp += 15;
        p.hp = Math.min(p.maxHp, p.hp + 15);
        p.attack += 2;
        p.defense += 1;
        addLog(`🎉 LEVEL UP! You are now Level ${p.level}! HP +15, ATK +2, DEF +1.`, 'levelup');
    }
}

function tickBuffs() {
    const p = gameState.player;
    if (p.atkBuffTurns > 0) {
        p.atkBuffTurns--;
        if (p.atkBuffTurns === 0) p.atkBuff = 0;
    }
    if (p.defBuffTurns > 0) {
        p.defBuffTurns--;
        if (p.defBuffTurns === 0) p.defBuff = 0;
    }
    gameState.player.abilities.forEach(ab => {
        if (ab.cooldownLeft > 0) ab.cooldownLeft--;
    });
}

function collectItem(row, col) {
    const item = ITEM_TYPES[rng(0, ITEM_TYPES.length - 1)];
    const p = gameState.player;

    if (item.effect === 'heal') {
        p.inventory.push({ ...item });
        addLog(`Found ${item.icon} ${item.name}! Added to inventory.`, 'loot');
    } else if (item.effect === 'attack') {
        p.attack += item.value;
        addLog(`Found ${item.icon} ${item.name}! Attack +${item.value}.`, 'loot');
    } else if (item.effect === 'defense') {
        p.defense += item.value;
        addLog(`Found ${item.icon} ${item.name}! Defense +${item.value}.`, 'loot');
    } else if (item.effect === 'gold') {
        p.gold += item.value;
        addLog(`Found ${item.icon} ${item.name}! Gained ${item.value} Gold.`, 'loot');
    } else if (item.effect === 'xp') {
        p.xp += item.value;
        addLog(`Found ${item.icon} ${item.name}! Gained ${item.value} XP.`, 'loot');
        checkLevelUp();
    }
}

function useInventoryItem(idx) {
    const item = gameState.player.inventory[idx];
    if (!item) return;

    if (item.effect === 'heal') {
        const before = gameState.player.hp;
        gameState.player.hp = Math.min(gameState.player.maxHp, gameState.player.hp + item.value);
        const healed = gameState.player.hp - before;
        addLog(`Used ${item.icon} ${item.name}! Restored ${healed} HP.`, 'loot');
        gameState.player.inventory.splice(idx, 1);
    }
    renderAll();
}

function useAbility(name) {
    if (!gameState.inCombat) return;
    const ab = gameState.player.abilities.find(a => a.name === name);
    if (!ab || ab.cooldownLeft > 0) return;
    const def = ABILITY_DEFS[name];
    const p = gameState.player;

    if (def.effect === 'attack') {
        doPlayerAttack(def.damage, name);
    } else if (def.effect === 'shield') {
        p.shieldActive = true;
        addLog(`You activate ${name}! Next hit blocked 50%.`, 'info');
    } else if (def.effect === 'heal') {
        p.hp = Math.min(p.maxHp, p.hp + 25);
        addLog(`${name} restores 25 HP!`, 'loot');
    } else if (def.effect === 'defense') {
        p.defBuff = 5;
        p.defBuffTurns = 2;
        addLog(`${name} grants +5 DEF for 2 turns!`, 'info');
    } else if (def.effect === 'buff') {
        p.atkBuff = 6;
        p.atkBuffTurns = 2;
        addLog(`${name} grants +6 ATK for 2 turns!`, 'info');
    }

    ab.cooldownLeft = def.cooldown;
    renderAll();
}

function rollDice() {
    const diceEl = document.getElementById('dice-display');
    const resultEl = document.getElementById('dice-result');
    diceEl.classList.add('rolling');

    let count = 0;
    const interval = setInterval(() => {
        diceEl.textContent = DICE_FACES[rng(0, 5)];
        count++;
        if (count >= 8) {
            clearInterval(interval);
            diceEl.classList.remove('rolling');
            const finalRoll = rollD6();
            diceEl.textContent = DICE_FACES[finalRoll - 1];
            resultEl.textContent = `Rolled a ${finalRoll}!`;

            const events = [
                `The dice whisper... ${finalRoll}`,
                `Fortune smiles: ${finalRoll}`,
                `The board shakes: ${finalRoll}`,
                `Fate decrees: ${finalRoll}`,
            ];
            addLog(events[rng(0, events.length - 1)], 'info');
        }
    }, 60);
}

function showModal(title, body) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').textContent = body;
    document.getElementById('modal').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('modal').classList.add('hidden');
}

// Initialize game on load
window.addEventListener('load', () => {
    initGame();
});
