const { initializeGame } = require('./gameLogic.js')

const rooms = new Map();
const MAX_PLAYERS = 4;

function generateRoomId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

/**
 * Creates a new room and adds the host.
 * @param {string} hostId - The socket ID of the host.
 * @param {string} playerName - The player's name.
 * @returns {{room: object, player: object}} - The created room and player object.
 */
function createRoom(hostId, playerName) {
    const roomId = generateRoomId();
    const player = { id: hostId, name: playerName };
    const room = {
        id: roomId,
        hostId: hostId,
        players: [player],
        gameStarted: false
    };

    rooms.set(roomId, room);
    console.log(`Room ${roomId} created by player ${playerName} (ID: ${hostId})`);
    return { room, player };
}

/**
 * Adds a player to a room.
 * @param {string} roomId - The ID of the room.
 * @param {string} playerId - The socket ID of the player.
 * @param {string} playerName - The player's name.
 * @returns {{room: object, players: array}} - The room object and a list of players, or null on failure.
 */
function joinRoom(roomId, playerId, playerName) {
    const room = rooms.get(roomId);

    if (!room) {
        return { error: 'Room not found' };
    }

    if (room.players.length >= MAX_PLAYERS) {
        return { error: 'Room is full' };
    }

    if (room.gameStarted) {
        return { error: 'Game has already started' };
    }

    const newPlayer = { id: playerId, name: playerName, x:0, y:0 };
    room.players.push(newPlayer);
    console.log(`Player ${playerName} (ID: ${playerId}) joined room ${roomId}`);
    return { room, players: room.players };
}

/**
 * Removes a player from a room.
 * @param {string} playerId - The socket ID of the player.
 */
function leaveRoom(playerId) {
    for (const [roomId, room] of rooms.entries()) {
        const playerIndex = room.players.findIndex(p => p.id === playerId);
        if (playerIndex > -1) {
            const playerName = room.players[playerIndex].name;
            const wasHost = room.hostId === playerId;

            room.players.splice(playerIndex, 1);
            console.log(`Player ${playerName} left room ${roomId}`);

            if (wasHost || room.players.length === 0) {
                rooms.delete(roomId);
                console.log(`Room ${roomId} deleted because ${wasHost ? 'host left' : 'empty'}`);
                return null;
            }

            return room;
        }
    }
    return null;
}

/**
 * Starts the game in the specified room.
 * @param {string} roomId - The ID of the room.
 * @param {string} playerId - The socket ID of the player trying to start the game (must be the host).
 * @returns {object} - The room object or null on failure.
 */
function startGame(roomId, playerId) {
    const room = rooms.get(roomId);

    if (!room) {
        return { error: 'Room not found' };
    }

    if (room.hostId !== playerId) {
        return { error: 'Only the host can start the game' };
    }

    if (room.players.length < 2) {
        return { error: 'Not enough players to start the game (minimum 2)' };
    }

    if (room.gameStarted) {
        return { error: 'Game has already started' };
    }
    // to sync lobby room with game room
    initializeGame(roomId, room.players)
    room.gameStarted = true;
    console.log(`Game in room ${roomId} has started!`);
    return { room };
}

/**
 * Returns a list of all active rooms.
 * @returns {array}
 */
function getRooms() {
    return Array.from(rooms.values()).map(room => ({
        id: room.id,
        playerCount: room.players.length,
        gameStarted: room.gameStarted,
        playerNames: room.players.map(player => player.name)    //Needed for player's name validation
    }));
}

module.exports = {
    createRoom,
    joinRoom,
    leaveRoom,
    startGame,
    getRooms,
    rooms
};