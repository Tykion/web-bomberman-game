const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');
const roomManager = require('./roomManager');
const { handlePlayerMove, handleBombPlace, setPaused, rooms: gameRooms } = require('./gameLogic');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, '../client/dist')));

io.on('connect', (socket) => {
    console.log(`User connected: ${socket.id}`);

    socket.emit('roomsList', roomManager.getRooms());

    socket.on('getRoomsList', () => {
        socket.emit('roomsList', roomManager.getRooms());
    });

    socket.on('createRoom', ({ playerName }) => {
        const { room, player } = roomManager.createRoom(socket.id, playerName);
        if (room) {
            socket.join(room.id);
            socket.emit('roomCreated', room);
            socket.emit('roomJoined', { room, players: room.players, playerId: player.id });
            io.emit('roomsList', roomManager.getRooms());
        }
    });

    socket.on('leaveRoom', ({ roomId }) => {
        const room = roomManager.leaveRoom(socket.id);
        if (room) {
            if (room.players.length > 0) {
                io.to(room.id).emit('playersUpdate', room.players);
            }
            io.emit('roomsList', roomManager.getRooms());
        } else {
            // If room was deleted, notify all players and disconnect all sockets in the room
            io.to(roomId).emit('roomLeft');
            io.in(roomId).socketsLeave(roomId);
        }
        socket.leave(roomId); // Leave the socket.io room
        socket.emit('roomLeft');
    });

    socket.on('joinRoom', ({ roomId, playerName }) => {
        const result = roomManager.joinRoom(roomId, socket.id, playerName);
        if (result.error) {
            socket.emit('roomError', { message: result.error });
        } else {
            const { room } = result;
            socket.join(room.id);
            socket.emit('roomJoined', { room, players: room.players, playerId: socket.id });
            io.to(room.id).emit('playersUpdate', room.players);
            io.emit('roomsList', roomManager.getRooms());
        }
    });

    socket.on('startGame', () => {
        const playerRoom = Array.from(socket.rooms).find(room => room !== socket.id);
        const result = roomManager.startGame(playerRoom, socket.id);
        const gameState = gameRooms.get(playerRoom)
        if (result.error) {
            socket.emit('roomError', { message: result.error });
        } else {
            io.to(result.room.id).emit('gameStarted', { map: gameState.map, players: Object.values(gameState.players) });
            io.emit('roomsList', roomManager.getRooms());
        }
    });

    socket.on('pauseGame', ({ isPaused, pausedByPlayer }) => {
        const playerRoom = Array.from(socket.rooms).find(room => room !== socket.id);
        if (playerRoom) {
            setPaused(playerRoom, isPaused);
            io.to(playerRoom).emit('gamePaused', {
                isPaused,
                pausedByPlayer
            });
        }
    });

    socket.on('playerQuit', ({ playerId }) => {
        console.log(`Player ${playerId} quit the game`);
        const playerRoom = Array.from(socket.rooms).find(room => room !== socket.id);

        if (playerRoom) {
            // Resume game if it was paused
            const gameState = gameRooms.get(playerRoom);
            if (gameState && gameState.isPaused) {
                setPaused(playerRoom, false);
                socket.to(playerRoom).emit('gamePaused', {
                    isPaused: false,
                    pausedByPlayer: null
                });
            }

            socket.to(playerRoom).emit('playerQuit', { playerId });
            roomManager.leaveRoom(playerId);
            socket.leave(playerRoom);
        }
    });

    socket.on('gameEnded', (gameEndData) => {
        console.log(`Game ended. Winner: ${gameEndData.winner ? gameEndData.winner.name : 'None'}`);
        const playerRoom = Array.from(socket.rooms).find(room => room !== socket.id);

        if (playerRoom) {
            io.to(playerRoom).emit('gameEnded', gameEndData);
            socket.leave(playerRoom);
        }
    });

    socket.on('bombPlaceRequest', ({ x, y }) => {
        const playerRoom = Array.from(socket.rooms).find(room => room !== socket.id);
        if (playerRoom) {
            const bomb = handleBombPlace(playerRoom, socket.id, { x, y });
            if (bomb) {
                io.to(playerRoom).emit('bombPlaced', bomb);
                console.log(`Bomb placed in room ${playerRoom}:`, bomb);
            }
        }
    });

    socket.on('bombExplosion', (explosionData) => {
        const playerRoom = Array.from(socket.rooms).find(room => room !== socket.id);
        if (playerRoom) {
            io.to(playerRoom).emit('explosionUpdate', explosionData);
        }
    });

    socket.on('playerLeft', (data) => {
        const playerRoom = Array.from(socket.rooms).find(room => room !== socket.id);
        if (playerRoom) {
            socket.to(playerRoom).emit('playerLeft', data);
            console.log(`Player left in room ${playerRoom}:`, data);
        }
    });

    socket.on('gameStateUpdate', (gameState) => {
        const playerRoom = Array.from(socket.rooms).find(room => room !== socket.id);
        if (playerRoom) {
            socket.to(playerRoom).emit('gameStateUpdate', gameState);
        }
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        const room = roomManager.leaveRoom(socket.id);
        if (room) {
            if (room.players.length > 0) {
                io.to(room.id).emit('playersUpdate', room.players);
            }
            io.emit('roomsList', roomManager.getRooms());
        }
    });

    socket.on('playerMoveRequest', ({ playerId, direction }) => {
        const playerRoom = Array.from(socket.rooms).find(room => room !== socket.id);
        const result = handlePlayerMove(playerRoom, playerId, direction)

        if (result) {
            const { player, pickedPowerup} = result

            io.to(playerRoom).emit('playerMoved', {
                playerId,
                position: player.position,
            })

            if (pickedPowerup) {
                io.to(playerRoom).emit('removePowerup', { id: pickedPowerup.id })
                
                // Send updated player properties when powerup is picked up
                io.to(playerRoom).emit('playerUpdated', {
                    playerId,
                    bombCount: player.bombCount,
                    bombPower: player.bombPower,
                    score: player.score
                })
            }
        }
    });

    function broadcastExplosion(roomId, explosionData) {
        io.to(roomId).emit('explosionUpdate', explosionData);
    }

    function broadcastPlayerKilled(roomId, data) {
        io.to(roomId).emit('playerKilled', data);
    };

    global.broadcastExplosion = broadcastExplosion;
    global.broadcastPlayerKilled = broadcastPlayerKilled
});

server.listen(PORT, () => {
    console.log(`Server is running and listening on port ${PORT}`);
});