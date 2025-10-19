import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import socketService from '@/services/socket'
import { soundManager } from '@/manager/soundManager'

export const useGameStore = defineStore('game', () => {
  // Game state
  const isGameActive = ref(false)
  const isPaused = ref(false)
  const localPlayerPaused = ref(false)
  const pausedByPlayer = ref(null)
  const gameTimer = ref(0)
  const timerInterval = ref(null)

  // Navigation state
  const shouldNavigateToLobby = ref(false)
  const gameEndedData = ref(null)
  const showWinnerDialog = ref(false)
  const playerQuitMessage = ref('')
  const showPlayerQuitMessage = ref(false)
  const playerQuitMessageType = ref('')
  const gameResumedMessage = ref('')
  const showGameResumedMessage = ref(false)

  // Players data
  const players = ref([])
  const currentPlayerId = ref(null)

  // Bombs && map state
  const tickingBombs = ref([]) // [{id, x, y, state: 'ticking'}]
  const explosions = ref([]) //
  const powerups = ref([]) // [{id, x, y, type}]
  const map = ref([])

  // Computed properties
  const formattedTime = computed(() => {
    // Show elapsed time in MM:SS format
    const totalSeconds = gameTimer.value
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  })

  const currentPlayer = computed(() => {
    return players.value.find(player => player.id === currentPlayerId.value)
  })

  const gameStatus = computed(() => {
    if (showGameResumedMessage.value) {
      return {
        text: gameResumedMessage.value,
        type: 'is-success'
      }
    }

    if (showPlayerQuitMessage.value) {
      return {
        text: playerQuitMessage.value,
        type: playerQuitMessageType.value === 'finished' ? 'is-error' : 'is-warning'
      }
    }

    if (gameEndedData.value && !isGameActive.value) {
      return {
        text: 'GAME FINISHED',
        type: 'is-error'
      }
    }

    if (isPaused.value) {
      return {
        text: pausedByPlayer.value
          ? `GAME PAUSED BY ${pausedByPlayer.value.name}`
          : 'GAME PAUSED',
        type: 'is-error'
      }
    }

    if (isGameActive.value) {
      return {
        text: 'GAME ACTIVE',
        type: 'is-success'
      }
    }

    return {
      text: '',
      type: ''
    }
  })

  // Timer functions
  const startTimer = () => {
    if (!timerInterval.value) {
      timerInterval.value = setInterval(() => {
        if (!isPaused.value && isGameActive.value) {
          gameTimer.value++
        }
      }, 1000)
    }
  }

  const stopTimer = () => {
    if (timerInterval.value) {
      clearInterval(timerInterval.value)
      timerInterval.value = null
    }
  }

  const resetTimer = () => {
    stopTimer()
    gameTimer.value = 0
  }

  function setMap(newMap) {
    map.value = newMap
  }

  // Map update function для синхронизации с сервером
  function updateMap(updatedMap) {
    if (Array.isArray(updatedMap)) {
      map.value = updatedMap.map(row =>
        row.map(tile => ({ ...tile }))
      )
    }
  }

  const addPowerup = (powerup) => {
    powerups.value.push(powerup)
    socketService.emit('addPowerups', powerup)
  }

  const removePowerup = (id) => {
    powerups.value = powerups.value.filter(p => p.id !== id)
    socketService.emit('removePowerups', { id })
  }

  const clearPowerups = () => {
    powerups.value = []
    socketService.emit('clearPowerups')
  }

  // Bomb && explosion management
  const addBomb = (bomb) => {
    tickingBombs.value.push(bomb)
    // Не отправляем bombPlaced здесь, так как это теперь делается через bombPlaceRequest
  }

  const removeBomb = (id) => {
    tickingBombs.value = tickingBombs.value.filter(b => b.id !== id)
  }

  const clearBombs = () => {
    tickingBombs.value = []
  }

  const addExplosion = (explosion) => {
    explosions.value.push(explosion)
  }

  const removeExplosion = (id) => {
    explosions.value = explosions.value.filter(e => e.id !== id)
  }

  const clearExplosion = () => {
    explosions.value = []
  }

  // Socket event cleanup
  const cleanupSocketEvents = () => {
    const socket = socketService.getSocket()
    if (!socket) return

    socket.off('gameEnded')
    socket.off('playerLeft')
    socket.off('playerQuit')
    socket.off('playerKilled')
    socket.off('playerMoved')
    socket.off('playerUpdated')
    socket.off('gameStateUpdate')
    socket.off('gamePaused')
    socket.off('bombPlaced')
    socket.off('explosionUpdate')
  }

  // Socket initialization
  const initializeSocketEvents = () => {
    const socket = socketService.getSocket()
    if (!socket) {
      console.warn('GameStore: Socket not available, skipping event initialization')
      return
    }

    // Clean up listeners to prevent duplicates
    cleanupSocketEvents()

    // powerups
    socket.on('addPowerup', (powerup) => {
      if (!powerups.value.find(p => p.id === powerup.id)) powerups.value.push(powerup)
    })

    socket.on('removePowerup', ({ id }) => {
      //console.log('Removing powerup:', id, 'before:', powerups.value)
      powerups.value = powerups.value.filter(p => p.id !== id)
      //console.log('After:', powerups.value)
    })

    socket.on('clearPowerup', () => powerups.value = [])

    // Bomb events from server
    socket.on('bombPlaced', (bomb) => {
      if (!tickingBombs.value.find(b => b.id === bomb.id)) {
        tickingBombs.value.push(bomb)
      }
    })

    // Новый обработчик для получения данных взрыва от сервера
    socket.on('explosionUpdate', (explosionData) => {
      console.log('Received explosion update:', explosionData)

      // Удаляем бомбу
      if (explosionData.bombId) {
        tickingBombs.value = tickingBombs.value.filter(b => b.id !== explosionData.bombId)
      }

      // Обновляем карту
      if (explosionData.updatedMap) {
        updateMap(explosionData.updatedMap)
      }

      if (explosionData.killedPlayers) {
        explosionData.killedPlayers.forEach(victimId => {
          eliminatePlayer(victimId, explosionData.ownerId)
        })
      }

      // Добавляем взрывы
      if (explosionData.explosions) {
        explosions.value = explosionData.explosions
        soundManager.playSound('explosion')

        // Автоматически очищаем взрывы через 500мс
        setTimeout(() => {
          explosions.value = []
        }, 500)
      }

      // Можно добавить powerups здесь если сервер их отправляет
      if (explosionData.powerups) {
        explosionData.powerups.forEach(powerup => {
          if (!powerups.value.find(p => p.id === powerup.id)) {
            powerups.value.push(powerup)
          }
        })
      }
    })

    socket.on('gameEnded', (data) => {
      gameEndedData.value = data
      showWinnerDialog.value = true
      stopTimer()
    })

    socket.on('playerLeft', (data) => {
      if (data.playerId) {
        eliminatePlayer(data.playerId)
      }
    })

    socket.on('playerQuit', (data) => {
      if (data.playerId) {
        const player = players.value.find(p => p.id === data.playerId)
        const playerName = player ? player.name : 'Player'

        const remainingPlayersCount = players.value.length - 1
        removePlayer(data.playerId)
        if (remainingPlayersCount <= 1) {
          playerQuitMessage.value = `${playerName} quit the game. Game finished!`
          playerQuitMessageType.value = 'finished'
        } else {
          playerQuitMessage.value = `${playerName} quit the game. Game resumed!`
          playerQuitMessageType.value = 'resumed'
        }

        showPlayerQuitMessage.value = true

        // Auto-hide message after 4 seconds
        setTimeout(() => {
          showPlayerQuitMessage.value = false
          playerQuitMessage.value = ''
          playerQuitMessageType.value = ''
        }, 4000)
      }
    })

    // Existing game events
    socket.on('playerKilled', (data) => {
      eliminatePlayer(data.playerId, data.killedBy)
    })

    socket.on('playerMoved', (data) => {
      updatePlayerPosition(data.playerId, data.position, false)
    })

    socket.on('playerUpdated', (data) => {
      const player = players.value.find(p => p.id === data.playerId)
      if (player) {
        if (data.bombCount !== undefined) player.bombCount = data.bombCount
        if (data.bombPower !== undefined) player.bombPower = data.bombPower
        if (data.score !== undefined) player.score = data.score
      }
    })

    socket.on('gameStateUpdate', (gameState) => {
      players.value = gameState.players
      gameTimer.value = gameState.timer
      isPaused.value = gameState.isPaused
    })

    socket.on('gamePaused', (data) => {
      const wasGamePaused = isPaused.value
      console.log('gamePaused event:', { wasGamePaused, data })

      isPaused.value = data.isPaused
      pausedByPlayer.value = data.pausedByPlayer || null

      // Show resume message when game is resumed
      if (wasGamePaused && !data.isPaused && data.pausedByPlayer) {
        gameResumedMessage.value = `GAME RESUMED BY ${data.pausedByPlayer.name}`
        showGameResumedMessage.value = true

        // Auto-hide message after 4 seconds
        setTimeout(() => {
          showGameResumedMessage.value = false
          gameResumedMessage.value = ''
        }, 4000)
      }
    })
  }

  // Game control functions
  const startGame = ({gamePlayers = [], map: serverMap = [] } = {}) => {
    isGameActive.value = true
    isPaused.value = false
    players.value = gamePlayers.map(player => ({
      ...player,
      kills: player.kills || 0,
      isAlive: player.isAlive !== false,
      position: player.position || { x: 0, y: 0 }
    }))

    if (Array.isArray(serverMap)) {
      map.value = serverMap.map(row =>
        row.map(tile => ({ ...tile })) // keep type, walkable, x, y
      )
    }
    resetTimer()
    startTimer()
  }

  const pauseGame = () => {
    localPlayerPaused.value = !localPlayerPaused.value

    socketService.emit('pauseGame', {
      isPaused: !isPaused.value, // Send the new state
      pausedByPlayer: currentPlayer.value
    })
  }

  const emitPlayerQuit = (playerId) => {
    socketService.emit('playerQuit', {
      playerId
    })
  }

  const endGame = () => {
    // Prevent multiple calls
    if (!isGameActive.value) return

    isGameActive.value = false
    isPaused.value = false
    stopTimer()

    // Find winner (last alive player)
    const alivePlayers = players.value.filter(p => p.isAlive)
    let winner

    if (alivePlayers.length === 1) {
      const w = alivePlayers[0]
      winner = {
        id: w.id,
        name: w.name,
        score: w.kills
      }
    }

    const gameEndedData = {
      winner,
      players: players.value,
      gameTime: formattedTime.value
    }

    showWinnerDialog.value = true

    socketService.emit('gameEnded', gameEndedData)
    console.log(gameEndedData.winner)
  }

  const resetGame = () => {
    isGameActive.value = false
    isPaused.value = false
    localPlayerPaused.value = false
    pausedByPlayer.value = null
    players.value = []
    currentPlayerId.value = null
    playerQuitMessage.value = ''
    showPlayerQuitMessage.value = false
    playerQuitMessageType.value = ''
    gameResumedMessage.value = ''
    showGameResumedMessage.value = false
    resetTimer()
    clearBombs()
    clearPowerups()
    clearExplosion()
    cleanupSocketEvents()
  }

  // Navigation helpers
  const resetNavigationState = () => {
    shouldNavigateToLobby.value = false
    gameEndedData.value = null
    showWinnerDialog.value = false
    playerQuitMessage.value = ''
    showPlayerQuitMessage.value = false
    playerQuitMessageType.value = ''
    gameResumedMessage.value = ''
    showGameResumedMessage.value = false
  }

  const closeWinnerDialog = () => {
    showWinnerDialog.value = false
    resetGame()
    shouldNavigateToLobby.value = true
  }

  // Player management functions
  const updatePlayerKills = (playerId, kills) => {
    const player = players.value.find(p => p.id === playerId)
    if (player) {
      player.kills = kills
    }
  }

  const eliminatePlayer = (playerId, killedById = null) => {
    const player = players.value.find(p => p.id === playerId)
    if (!player || !player.isAlive) return

    player.isAlive = false

    if (killedById && killedById !== playerId) {
      const killer = players.value.find(p => p.id === killedById);
      if (killer) killer.kills++;
    }

    // Delay winner check to handle simultaneous deaths
    setTimeout(() => {
      const alivePlayers = players.value.filter(p => p.isAlive)
      if (alivePlayers.length <= 1) {
        endGame()
      }
    }, 100)
  }

  const removePlayer = (playerId) => {
    const playerIndex = players.value.findIndex(p => p.id === playerId)
    if (playerIndex > -1) {
      players.value.splice(playerIndex, 1)
    }

    const alivePlayers = players.value.filter(p => p.isAlive)
    if (alivePlayers.length <= 1) {
      endGame()
    }
  }

  const requestMove = (playerId, direction) => {
    socketService.emit('playerMoveRequest', { playerId, direction })
  }

  const updatePlayerPosition = (playerId, position, isLocal = true) => {
    const player = players.value.find(p => p.id === playerId)
    if(!player) return

    player.position = {
      x: position.x,
      y: position.y
    }
  }

  const setCurrentPlayer = (playerId) => {
    currentPlayerId.value = playerId
  }

  const setPlayers = (newPlayers) => {
    players.value = newPlayers.map(player => ({
      ...player,
      kills: player.kills || 0,
      isAlive: player.isAlive !== false
    }))
  }

  return {
    // State
    isGameActive,
    isPaused,
    localPlayerPaused,
    pausedByPlayer,
    gameTimer,
    players,
    powerups,
    tickingBombs,
    explosions,
    currentPlayerId,
    shouldNavigateToLobby,
    gameEndedData,
    showWinnerDialog,
    playerQuitMessage,
    showPlayerQuitMessage,
    playerQuitMessageType,
    gameResumedMessage,
    showGameResumedMessage,

    // Computed
    formattedTime,
    currentPlayer,
    gameStatus,

    //map
    map,
    setMap,
    updateMap,

    // Bombs
    addBomb,
    removeBomb,
    clearBombs,

    // Powerups
    addPowerup,
    removePowerup,
    clearPowerups,

    // Explosions
    addExplosion,
    removeExplosion,
    clearExplosion,

    // Actions
    startGame,
    pauseGame,
    emitPlayerQuit,
    endGame,
    resetGame,
    initializeSocketEvents,
    cleanupSocketEvents,
    resetNavigationState,
    closeWinnerDialog,
    updatePlayerKills,
    eliminatePlayer,
    removePlayer,
    updatePlayerPosition,
    requestMove,
    setCurrentPlayer,
    setPlayers,
    startTimer,
    stopTimer,
    resetTimer
  }
})
