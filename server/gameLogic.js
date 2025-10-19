const TILE_TYPES = {
    EMPTY: 'empty',
    BLOCK: 'block', // Non-destructible
    ROCK: 'rock'    // Destructible
};

const BOMB_TIMER_MS = 2000; // 2 seconds

const MAP_SIZE = 19;
const PLAYER_SPAWN_POINTS = [
    { x: 0, y: 0 },
    { x: MAP_SIZE - 1, y: 0 },
    { x: 0, y: MAP_SIZE - 1 },
    { x: MAP_SIZE - 1, y: MAP_SIZE - 1 }
];

const rooms = new Map();

/**
 * Initializes the game state for a room.
 * @param {string} roomId - The ID of the room.
 * @param {Array<object>} players - The list of players in the room.
 */
function initializeGame(roomId, players) {
    const roomState = {
        map: generateMap(),
        players: {},
        bombs: [],
        explosions: [],
        powerups: [],
        gameTimer: 0,
        gameStartTime: Date.now(),
        isPaused: false,
        pausedAt: null,
        totalPausedTime: 0,
        interval: null,
        winner: null
    };

    players.forEach((player, index) => {
        roomState.players[player.id] = {
            id: player.id,
            name: player.name,
            position: {
                x: PLAYER_SPAWN_POINTS[index].x,
                y: PLAYER_SPAWN_POINTS[index].y
            },
            score: 0,
            bombPower: 1,

            bombCount: 2,
            activeBombs: 0,
            spriteIndex: index + 1
        };
    });

    rooms.set(roomId, roomState);
    console.log(`Game initialized for room ${roomId} at ${roomState.gameStartTime}`);

    return roomState;
}

/**
 * Generates a new random game map.
 * @returns {Array<Array<string>>}
 */
function generateMap() {
    const map = Array(MAP_SIZE).fill(null).map((_, y) =>
        Array(MAP_SIZE).fill(null).map((_, x) => {
            let tile = { type: TILE_TYPES.ROCK, walkable: false, x, y };

            // Indestructible pillars (only at even coords, except inside spawn zones)
            if (x % 2 === 1 && y % 2 === 1 && !isSpawnPoint(x, y)) {
                tile.type = TILE_TYPES.BLOCK;
                tile.walkable = false;
            }

            // remove spawn tiles
            else if (isSpawnPoint(x, y)) {
                tile.type = TILE_TYPES.EMPTY;
                tile.walkable = true;
            }

            return tile;
        })
    );

    return map;
}

// clear blocks in corners
function isSpawnPoint(x, y) {
    return PLAYER_SPAWN_POINTS.some(p => {
        // top left
        if (p.x === 0 && p.y === 0) {
            return (x === 0 && y === 0) || (x === 1 && y === 0) || (x === 0 && y === 1);
        }
        // top right
        if (p.x === MAP_SIZE - 1 && p.y === 0) {
            return (x === p.x && y === p.y) || (x === p.x - 1 && y === p.y) || (x === p.x && y === p.y + 1);
        }
        // bottom left
        if (p.x === 0 && p.y === MAP_SIZE - 1) {
            return (x === p.x && y === p.y) || (x === p.x + 1 && y === p.y) || (x === p.x && y === p.y - 1);
        }
        // bottom right
        if (p.x === MAP_SIZE - 1 && p.y === MAP_SIZE - 1) {
            return (x === p.x && y === p.y) || (x === p.x - 1 && y === p.y) || (x === p.x && y === p.y - 1);
        }
        return false;
    });
}

/**
 * Handles a player's movement.
 * @param {string} roomId - The ID of the room.
 * @param {string} playerId - The ID of the player's socket.
 * @param {string} direction - Movement direction.
 * @returns {object} The updated player state.
 */
function handlePlayerMove(roomId, playerId, direction) {
    const roomState = rooms.get(roomId);

    if (!roomState) {
        console.warn(`Room ${roomId} not found`);
        return null;
    }

    // Block input when paused
    if (roomState.isPaused) {
        return null;
    }

    const player = roomState.players[playerId]

    if (!player) {
        console.warn(`Player ${playerId} not found in room ${roomId}`);
        return null;
    }

    let nextX = player.position.x
    let nextY = player.position.y

    if (direction === 'up') nextY -= 1
    if (direction === 'down') nextY += 1
    if (direction === 'left') nextX -= 1
    if (direction === 'right') nextX += 1

    let pickedPowerup = null

    if (
        nextX >= 0 && nextX < MAP_SIZE &&
        nextY >= 0 && nextY < MAP_SIZE &&
        roomState.map[nextY][nextX].walkable &&
        !roomState.bombs.some(b => b.x === nextX && b.y === nextY)
    ) {
        player.position = { x: nextX, y: nextY }

        const powerupIdx = roomState.powerups.findIndex(p => p.x === nextX && p.y === nextY)
        if (powerupIdx !== -1) {
            const powerup = roomState.powerups[powerupIdx]

            if (powerup.type === 'bombCountUp') {
                console.log('Player picked up bombCountUp')
                player.bombCount++
            }
            if (powerup.type === 'explosionRadiusUp') {
                console.log('Player picked up explosionRadiusUp')
                player.bombPower++
            }

            pickedPowerup = roomState.powerups.splice(powerupIdx, 1)[0]
        }
    }

    return { player, pickedPowerup};
}

/**
 * Handles a bomb being placed by a player.
 * @param {string} roomId - The ID of the room.
 * @param {string} playerId - The ID of the player's socket.
 * @param {{x: number, y: number}} bombPos - The position where the bomb is placed.
 * @returns {object} The new bomb object.
 */
function handleBombPlace(roomId, playerId, bombPos) {
    const roomState = rooms.get(roomId);

    if (!roomState) {
        console.warn(`Room ${roomId} not found`);
        return null;
    }

    if (roomState.isPaused) {
        return null;
    }

    const player = roomState.players[playerId]
    if (!player) return null

        // bomb cooldown -- 2 bombs at the start
    if (player.activeBombs >= player.bombCount) {
        return null
    }

    // Check if there's already a bomb at this position
    if (roomState.bombs.some(bomb => bomb.x === bombPos.x && bomb.y === bombPos.y)) {
        return null;
    }

    const now = Date.now();
    const bomb = {
        id: `bomb-${now}-${Math.random()}`,
        ownerId: playerId,
        x: bombPos.x,
        y: bombPos.y,
        state: 'ticking',
        createdAt: now,
        explodeAt: now + BOMB_TIMER_MS, // explosion time
        remainingTime: null // used when paused
    };

    roomState.bombs.push(bomb);
    // add to count
    player.activeBombs++

    // Set timer for explosion
    setTimeout(() => {
        checkBombExplosions(roomId);
    }, BOMB_TIMER_MS);

    return bomb;
}

/**
 * Handles bomb explosion and map destruction.
 * @param {string} roomId - The ID of the room.
 * @param {string} bombId - The ID of the bomb.
 */
function handleBombExplosion(roomId, bombId) {
    const roomState = rooms.get(roomId);

    if (!roomState) {
        console.warn(`Room ${roomId} not found during explosion`);
        return;
    }

    const bombIndex = roomState.bombs.findIndex(bomb => bomb.id === bombId);
    if (bombIndex === -1) {
        console.warn(`Bomb ${bombId} not found in room ${roomId}`);
        return;
    }

    const bomb = roomState.bombs[bombIndex];
    const explosions = [];
    const destroyedBlocks = [];

    // Remove the bomb
    roomState.bombs.splice(bombIndex, 1);

    const owner = roomState.players[bomb.ownerId]
    if (owner && owner.activeBombs > 0) {
        owner.activeBombs--
    }


    // Add center explosion
    const centerId = `explosion-${bomb.x}-${bomb.y}-${Date.now()}`;
    explosions.push({ id: centerId, x: bomb.x, y: bomb.y, type: 'center', ownerId: bomb.ownerId });

    // Explosion directions
    const directions = [
        { dx: 0, dy: -1, type: 'vertical' }, // up
        { dx: 0, dy: 1, type: 'vertical' },  // down
        { dx: -1, dy: 0, type: 'horizontal' }, // left
        { dx: 1, dy: 0, type: 'horizontal' }   // right
    ];

    const radius = owner ? owner.bombPower : 1

    // Process each direction
    directions.forEach(dir => {
        for (let i = 1; i <= radius; i++) {
            const newX = bomb.x + dir.dx * i;
            const newY = bomb.y + dir.dy * i;

            // Check boundaries
            if (newX < 0 || newX >= MAP_SIZE || newY < 0 || newY >= MAP_SIZE) {
                break;
            }

            const tile = roomState.map[newY][newX];

            // Stop at indestructible blocks
            if (tile.type === TILE_TYPES.BLOCK) {
                break;
            }

            // Add explosion
            const expId = `explosion-${newX}-${newY}-${Date.now()}`;
            explosions.push({ id: expId, x: newX, y: newY, type: dir.type, ownerId: bomb.ownerId });

            // Destroy rocks
            if (tile.type === TILE_TYPES.ROCK) {
                tile.type = TILE_TYPES.EMPTY;
                tile.walkable = true;
                destroyedBlocks.push({ x: newX, y: newY });

                // Generate powerups randomly
                if (Math.random() < 0.15) {
                    const types = ['bombCountUp', 'explosionRadiusUp'];
                    const type = types[Math.floor(Math.random() * types.length)];
                    const powerupId = `powerup-${newX}-${newY}-${Date.now()}`;

                    // Add powerup to room state if you have powerups array
                    roomState.powerups.push({ id: powerupId, x: newX, y: newY, type });
                }

                break; // Stop after destroying a rock
            }

            for (const playerId in roomState.players) {
                const player = roomState.players[playerId]
                if (!player.isDead) {
                    if (
                    (player.position.x === newX && player.position.y === newY) ||
                    (player.position.x === bomb.x && player.position.y === bomb.y)
                ) {
                        if (owner && playerId !== bomb.ownerId) {
                            owner.score = (owner.score || 0) + 1
                        }

                        player.isDead = true

                        if (global.broadcastPlayerKilled) {
                            global.broadcastPlayerKilled(roomId, { playerId, killedBy: bomb.ownerId })
                        }
                    }
                }
            }
        }
    });

    if (global.broadcastExplosion) {
        global.broadcastExplosion(roomId, {
            bombId,
            explosions,
            destroyedBlocks,
            updatedMap: roomState.map,
            powerups: roomState.powerups,
        });
    }
    
    return {
        explosions,
        destroyedBlocks,
        updatedMap: roomState.map,
        powerups: roomState.powerups,
    };
}
/*
/**
 * Checks for collisions between players and explosions.
 * @param {string} roomId - The ID of the room.
 *
function checkCollisions(roomId) {
    const roomState = rooms.get(roomId);

    for (const playerId in roomState.players) {
        const player = roomState.players[playerId];
        for (const explosion of roomState.explosions) {
            if (player.position.x === explosion.x && player.position.y === explosion.y) {
                player.lives--;
                console.log(`${player.name} was hit! Lives left: ${player.lives}`);

                const spawnPoint = PLAYER_SPAWN_POINTS.find(p => roomState.map[p.y][p.x].type === TILE_TYPES.EMPTY);
                if (spawnPoint) {
                    player.position.x = spawnPoint.x;
                    player.position.y = spawnPoint.y;
                } else {
                    console.warn(`No empty spawn point found for player ${player.name}`);
                }

                if (player.lives <= 0) {
                    delete roomState.players[playerId];
                    console.log(`${player.name} has been eliminated.`);
                    const remainingPlayers = Object.keys(roomState.players);
                    if (remainingPlayers.length === 1) {
                        const winnerId = remainingPlayers[0];
                        roomState.winner = roomState.players[winnerId];
                        console.log(`Game over! Winner is ${roomState.winner.name}`);
                    }
                }
            }
        }
    }
}*/

function checkBombExplosions(roomId) {
    const roomState = rooms.get(roomId);
    if (!roomState || roomState.isPaused) return;

    const now = Date.now();
    const bombsToExplode = roomState.bombs.filter(bomb => bomb.explodeAt <= now);

    bombsToExplode.forEach(bomb => {
        handleBombExplosion(roomId, bomb.id);
    });
}

function setPaused(roomId, isPaused) {
    const roomState = rooms.get(roomId);
    if (!roomState) return;

    const now = Date.now();

    if (isPaused && !roomState.isPaused) {
        // when paused - save the remaining time for all bombs
        roomState.pausedAt = now;
        roomState.bombs.forEach(bomb => {
            bomb.remainingTime = bomb.explodeAt - now;
        });
        console.log(`Game in room ${roomId} paused at ${now}`);
    } else if (!isPaused && roomState.isPaused) {
        // when resume - update explosion time
        const pauseDuration = now - roomState.pausedAt;
        roomState.totalPausedTime += pauseDuration;

        roomState.bombs.forEach(bomb => {
            if (bomb.remainingTime !== null) {
                bomb.explodeAt = now + bomb.remainingTime;
                const timeToExplode = bomb.remainingTime;
                bomb.remainingTime = null;

                if (timeToExplode > 0) {
                    setTimeout(() => {
                        checkBombExplosions(roomId);
                    }, timeToExplode);
                } else {
                    checkBombExplosions(roomId);
                }
            }
        });

        roomState.pausedAt = null;
        console.log(`Game in room ${roomId} resumed at ${now} (paused for ${pauseDuration}ms)`);
    }

    roomState.isPaused = isPaused;
}

module.exports = {
    initializeGame,
    handlePlayerMove,
    handleBombPlace,
    handleBombExplosion,
    //checkCollisions,
    setPaused,
    checkBombExplosions,
    rooms
};