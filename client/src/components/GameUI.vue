<template>
  <div class="game-ui">
    <div class="game-header">
      <div class="pause-section">
        <button
          :class="['nes-btn', !gameStore.isPaused ? 'is-success' :  'is-disabled']"
          @click="handlePause"
        >
          {{ gameStore.isPaused ? 'Paused' : 'Pause' }}
        </button>
      </div>

      <div class="players-section">
        <div
          v-for="(player, index) in gameStore.players"
          :key="player.id"
          class="player-info"
          :class="{ 'current-player': player.id === gameStore.currentPlayerId }"
        >
          <div
            class="player-avatar"
            :style="{
              backgroundImage: `url('/sprites/Character${player.spriteIndex || (player.id.charCodeAt(0) % 4) + 1}.png')`,
              backgroundPosition: player.isAlive !== false ? '0 0' : '-224px -160px'
            }"
          ></div>
          <div class="player-details">
            <span class="player-name">{{ player.name || `Player ${player.id}` }}</span>
            <div class="kills-display">
              <span class="kills-count">{{ player.kills || 0 }}</span>
              <div class="stars">
                <i
                  v-for="n in Math.min(player.kills || 0, 3)"
                  :key="n"
                  class="nes-icon star"
                ></i>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="timer-section">
        <span class="timer">{{ gameStore.formattedTime }}</span>
      </div>
    </div>

    <div class="game-content">
      <slot></slot>
    </div>

    <div class="game-bottom">
      <div class="bomb-info" v-if="gameStore.currentPlayer">
        <div class="bomb-stat-container">
          <div class="bomb-label">Bombs</div>
          <div class="bomb-count">{{ gameStore.currentPlayer.bombCount}}</div>
        </div>
        <div class="bomb-stat-container">
          <div class="bomb-label">Radius</div>
          <div class="bomb-power">{{ gameStore.currentPlayer.bombPower}}</div>
        </div>
      </div>

      <div class="game-status">
        <span v-if="gameStore.gameStatus.text" 
              class="status-text nes-text" 
              :class="gameStore.gameStatus.type">
          {{ gameStore.gameStatus.text }}
        </span>
      </div>
    </div>

    <!-- Pause Menu -->
    <div v-if="gameStore.localPlayerPaused" class="pause-menu-overlay">
      <div class="nes-dialog is-dark pause-menu">
        <h3 class="nes-text is-primary">Pause Menu</h3>
        <div class="pause-menu-buttons">
          <button
            class="nes-btn is-success"
            @click="resumeGame"
          >
            Resume
          </button>
          <button
            class="nes-btn is-error"
            @click="quitGame"
          >
            Quit
          </button>
        </div>
      </div>
    </div>

    <!-- Winner Dialog -->
    <div v-if="gameStore.showWinnerDialog" class="dialog-overlay">
      <div class="nes-dialog is-dark winner-dialog">
        <form method="dialog">
          <div class="dialog-header">
            <p class="title">GAME OVER</p>
          </div>

          <div class="dialog-content">
            <div class="winner-section nes-container is-rounded is-dark" v-if="gameStore.gameEndedData && gameStore.gameEndedData.winner">
              <div class="trophy-container">
                <i class="nes-icon trophy is-large"></i>
              </div>
              <div class="winner-info">
                <p class="nes-text is-success winner-label">Winner</p>
                <p class="nes-text winner-name">{{ gameStore.gameEndedData.winner.name }}</p>
                <p class="nes-text winner-kills">Kills: {{ gameStore.gameEndedData.winner.score || 0 }}</p>
              </div>
            </div>

            <div class="winner-section nes-container is-rounded is-dark" v-else-if="gameStore.gameEndedData">
              <div class="winner-info">
                <p class="nes-text is-warning winner-label">No Clear Winner</p>
                <p class="nes-text">Nobody won</p>
              </div>
            </div>

            <div class="game-time-section nes-container is-rounded is-dark">
              <p class="nes-text game-time">Game Time: {{ gameStore.formattedTime }}</p>
            </div>
          </div>

          <div class="dialog-footer">
            <button class="nes-btn is-primary return-btn" @click="returnToLobby">
              Return to Lobby
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { useGameStore } from '@/stores/game'
import { useLobbyStore } from '@/stores/lobby'

// Initialize the game store
const gameStore = useGameStore()
const lobbyStore = useLobbyStore()
const router = useRouter()

// Handle pause button click
const handlePause = () => {
  if (gameStore.isPaused) {
    return
  }
  gameStore.pauseGame()
}

// Handle resume game from pause menu
const resumeGame = () => {
  gameStore.pauseGame()
}

// Handle quit game from pause menu
const quitGame = () => {
  // Emit quit event to server
  const currentPlayer = gameStore.currentPlayer
  if (currentPlayer) {
    gameStore.emitPlayerQuit(currentPlayer.id)
  }

  gameStore.localPlayerPaused = false
  gameStore.cleanupSocketEvents()
  gameStore.resetGame()
  router.push('/lobby')
}

const returnToLobby = () => {
  // Leave current room
  if (lobbyStore.currentRoom) {
    lobbyStore.leaveRoom(lobbyStore.currentRoom.id)
  }
  gameStore.closeWinnerDialog()
}
</script>

<style scoped>
.game-ui {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  width: 100%;
  background-color: #2d3748;
  border: 4px solid #4a5568;
  margin: 0;
}

.game-header {
  background-color: #34495e;
  padding: 15px;
  margin-bottom: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: white;
  font-weight: bold;
  font-size: 16px;
  gap: 20px;
}

.pause-section {
  flex-shrink: 0;
}

.players-section {
  flex: 1;
  display: flex;
  justify-content: center;
  gap: 30px;
  flex-wrap: wrap;
}

.player-info {
  display: flex;
  flex-direction: row;
  align-items: center;
  min-width: 200px;
  padding: 8px 12px;
  border-radius: 8px;
  background-color: rgba(255, 255, 255, 0.1);
  border: 2px solid transparent;
  transition: all 0.3s ease;
  gap: 12px;
}

.player-info.current-player {
  border-color: #ffd700;
  background-color: rgba(255, 215, 0, 0.2);
}

.player-avatar {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  border-radius: 4px;
  background-repeat: no-repeat;
  background-size: 256px 192px;
  overflow: hidden;
}

.player-details {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}

.player-name {
  font-size: 14px;
  color: #ffffff;
}

.kills-display {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 32px;
}

.kills-count {
  font-size: 16px;
  font-weight: bold;
  color: #ffd700;
}

.stars {
  display: flex;
  align-items: center;
  gap: 2px;
}

.timer-section {
  flex-shrink: 0;
}

.timer {
  font-size: 20px;
  font-weight: bold;
  color: #ffd700;
  padding: 8px 16px;
  background-color: rgba(0, 0, 0, 0.3);
  border-radius: 8px;
}

.game-content {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden;
  min-height: 80vh;
}

.game-bottom {
  background-color: #34495e;
  padding: 15px;
  margin-top: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: white;
  font-weight: bold;
  font-size: 16px;
  position: relative;
}

.bomb-info {
  flex-shrink: 0;
  display: flex;
  gap: 15px;
}

.bomb-stat-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  font-weight: bold;
  padding: 8px 16px;
  background-color: rgba(0, 0, 0, 0.3);
  border-radius: 8px;
  min-width: 60px;
}

.bomb-label {
  font-size: 12px;
  color: #ffffff;
  text-transform: uppercase;
  font-weight: normal;
}

.bomb-count, .bomb-power {
  font-size: 16px;
  font-weight: bold;
  color: #ffd700;
}

.game-status {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  z-index: 1;
}

.status-text {
  padding: 8px 16px;
  border-radius: 8px;
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 1px;
}

/* Use nes.css standard classes for consistent styling */
.status-text.is-error {
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0% { opacity: 1; }
  50% { opacity: 0.7; }
  100% { opacity: 1; }
}

/* Pause Menu Overlay */
.pause-menu-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.8);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.pause-menu {
  min-width: 300px;
  max-width: 400px;
  padding: 2rem;
  text-align: center;
}

.pause-menu h3 {
  margin-bottom: 2rem;
  font-size: 1.5rem;
}

.pause-menu-buttons {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.pause-menu-buttons .nes-btn {
  font-size: 1rem;
  padding: 0.75rem 1.5rem;
}

/* Responsive design for smaller screens */
@media (max-width: 768px) {
  .game-header {
    flex-direction: column;
    gap: 15px;
    padding: 10px;
  }

  .players-section {
    gap: 15px;
  }

  .player-info {
    padding: 6px 10px;
    gap: 8px;
  }

  .player-avatar {
    width: 28px;
    height: 28px;
    background-size: 224px 168px;
  }

  .player-name {
    font-size: 12px;
  }

  .player-details {
    gap: 2px;
  }

  .timer {
    font-size: 18px;
    padding: 6px 12px;
  }

  .game-bottom {
    flex-direction: column;
    gap: 10px;
  }

  .bomb-info {
    gap: 10px;
    justify-content: center;
  }

  .bomb-stat-container {
    padding: 6px 12px;
    min-width: 50px;
  }

  .bomb-label {
    font-size: 10px;
  }

  .bomb-count, .bomb-power {
    font-size: 14px;
  }

  .pause-menu {
    min-width: 250px;
    margin: 1rem;
  }

  .pause-menu h3 {
    font-size: 1.25rem;
    margin-bottom: 1.5rem;
  }
}

.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

/* Winner Dialog Styles */
.winner-dialog {
  min-width: 400px;
  max-width: 500px;
}

.dialog-header {
  text-align: center;
  margin-bottom: 1.5rem;
}

.dialog-header .title {
  font-size: 2rem;
  margin: 0;
}

.dialog-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.winner-section {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
}

.trophy-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-width: 60px;
}

.winner-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.winner-label {
  font-size: 1.25rem;
  margin: 0;
}

.winner-name {
  font-size: 1.5rem;
  font-weight: bold;
  margin: 0;
}

.winner-kills {
  font-size: 1rem;
  margin: 0;
}

.game-time-section {
  text-align: center;
  padding: 1rem;
}

.game-time {
  font-size: 1.25rem;
  margin: 0;
}

.dialog-footer {
  display: flex;
  justify-content: center;
  margin-top: 1.5rem;
}

.return-btn {
  font-size: 1.125rem;
  padding: 0.75rem 2rem;
}
</style>
