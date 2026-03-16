# Chess RPG RNG

A roguelike chess adventure game with random number generation mechanics. Play as a chess piece hero, explore an 8x8 board, battle enemy chess pieces, collect items, and level up.

## Architecture

- **Runtime**: Node.js 20 with Express
- **Frontend**: Vanilla HTML, CSS, JavaScript (in `/public`)
- **Server**: `server.js` serves static files on port 5000

## Project Structure

```
├── server.js          # Express web server (port 5000)
├── package.json       # Node.js dependencies
├── public/
│   ├── index.html     # Game UI layout
│   ├── style.css      # Dark RPG theme styles
│   └── game.js        # Full game engine (RPG/RNG logic)
```

## Running

```bash
node server.js
```

The game runs at `http://0.0.0.0:5000`.

## Gameplay

- **Board**: 8×8 chess board with enemies, bosses, and item pickups
- **Classes**: 5 chess piece classes (King, Queen, Rook, Bishop, Knight) randomly assigned
- **Combat**: Turn-based with D6 dice rolls affecting damage
- **Abilities**: Each class has 2 unique abilities with cooldowns
- **Progression**: XP, leveling, stat increases, inventory system
- **RNG**: Random board generation, enemy selection, loot drops, dice rolls

## Deployment

Configured for autoscale deployment via `node server.js`.
