import { defineStore } from 'pinia'
import { ref } from 'vue'
import socketService from '@/services/socket'
import { useGameStore } from './game'

export const useLobbyStore = defineStore('lobby', () => {
  const isConnected = ref(false)
  const connectionError = ref(null)
  const rooms = ref([])
  const currentRoom = ref(null)
  const players = ref([])
  const currentPlayerId = ref(null)
  const gameStarted = ref(false)
  const gameStartedData = ref(null) // for passing map to gamestore

  const connect = () => {
    try {
      const socket = socketService.connect()

      // Connection events
      socket.on('connect', () => {
        isConnected.value = true
        connectionError.value = null
      })

      socket.on('disconnect', () => {
        isConnected.value = false
      })

      socket.on('connect_error', (error) => {
        connectionError.value = error.message
      })

      // Room management events
      socket.on('roomsList', (roomsList) => {
        rooms.value = roomsList
      })

      socket.on('roomCreated', (room) => {
        currentRoom.value = room
        if (room.hostId) {
          currentPlayerId.value = room.hostId
        }
      })

      socket.on('roomJoined', (data) => {
        currentRoom.value = data.room
        players.value = data.players || []
        if (data.playerId) {
          currentPlayerId.value = data.playerId
        }
      })

      socket.on('roomLeft', () => {
        currentRoom.value = null
        players.value = []
        currentPlayerId.value = null
        gameStarted.value = false
        socketService.emit('getRoomsList')
      })

      socket.on('roomError', (error) => {
        connectionError.value = error.message
      })

      socket.on('playersUpdate', (newPlayers) => {
        players.value = newPlayers
      })

      socket.on('gameStarted', (data) => {
        //onsole.log('lobbystore socket received: ', data)
        gameStartedData.value = data
        //console.log(gameStartedData)
        const gameStore = useGameStore()
        gameStore.setMap(data.map)
        gameStore.setPlayers(data.players)
        gameStore.setCurrentPlayer(currentPlayerId.value)
        gameStore.startGame({ gamePlayers: data.players, map: data.map})
        gameStarted.value = true
        //console.log('lobby.js gamestarteddata: ', gameStartedData)
      })

    } catch (error) {
      connectionError.value = error.message
    }
  }


  const disconnect = () => {
    socketService.disconnect()
    isConnected.value = false
    connectionError.value = null
    players.value = []
    rooms.value = []
    currentRoom.value = null
    currentPlayerId.value = null
    gameStarted.value = false
  }

  const resetLobby = () => {
    players.value = []
    rooms.value = []
    currentRoom.value = null
    currentPlayerId.value = null
    gameStarted.value = false
  }

  const joinRoom = (roomId, playerName) => {
    if (!isConnected.value) {
      console.warn('LobbyStore: Cannot join room - not connected')
      return
    }
    socketService.emit('joinRoom', { roomId, playerName })
  }

  const leaveRoom = (roomId) => {
    if (!isConnected.value) {
      console.warn('LobbyStore: Cannot leave room - not connected')
      return
    }
    socketService.emit('leaveRoom', { roomId })
  }

  const getRoomsList = () => {
    if (!isConnected.value) {
      console.warn('LobbyStore: Cannot get rooms list - not connected')
      return
    }
    socketService.emit('getRoomsList')
  }

  const createRoom = (playerName) => {
    if (!isConnected.value) {
      console.warn('LobbyStore: Cannot create room - not connected')
      return
    }
    socketService.emit('createRoom', { playerName })
  }

  const startGame = () => {
    if (!isConnected.value) {
      console.warn('LobbyStore: Cannot start game - not connected')
      return
    }
    socketService.emit('startGame')
  }


  return {
    isConnected,
    connectionError,
    players,
    rooms,
    currentRoom,
    currentPlayerId,
    gameStarted,
    gameStartedData,
    connect,
    disconnect,
    resetLobby,
    joinRoom,
    leaveRoom,
    getRoomsList,
    createRoom,
    startGame
  }
})
