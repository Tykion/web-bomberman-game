<script setup>
import {ref, onMounted, onUnmounted, watch} from 'vue'
import {useRouter} from 'vue-router'
import {useLobbyStore} from '@/stores/lobby'

const lobbyStore = useLobbyStore()
const router = useRouter()

// Navigate to game if gameStarted
watch(() => lobbyStore.gameStarted, (newValue) => {
  if (newValue) {
    router.push('/game')
  }
})

// Name dialog state
const showDialog = ref(false)
const dialogPlayerName = ref('')
const dialogAction = ref('')
const dialogRoomId = ref('')
const nameValidationError = ref('')


// Show name dialog
const showNameDialog = (action, roomId = null) => {
  // Check if join action is allowed for this room
  if (action === 'join' && roomId) {
    const room = lobbyStore.rooms.find(r => r.id === roomId)
    if (room && !canJoinRoom(room)) {
      return // Don't show dialog if can't join
    }
  }

  dialogAction.value = action
  dialogRoomId.value = roomId
  dialogPlayerName.value = ''
  showDialog.value = true
}

// Cancel dialog
const cancelDialog = () => {
  showDialog.value = false
  dialogPlayerName.value = ''
  dialogAction.value = ''
  dialogRoomId.value = ''
  nameValidationError.value = ''
}

// Validate name on input change
const onNameInput = () => {
  nameValidationError.value = validatePlayerName(dialogPlayerName.value, dialogRoomId.value)
}

// Check if dialog can be confirmed
const canConfirmDialog = () => {
  return dialogPlayerName.value.trim() && !nameValidationError.value
}

// Confirm dialog and perform action
const confirmDialog = () => {
  const validationError = validatePlayerName(dialogPlayerName.value, dialogRoomId.value)
  if (validationError) {
    nameValidationError.value = validationError
    return
  }

  if (dialogAction.value === 'create') {
    createRoom()
  } else if (dialogAction.value === 'join') {
    joinRoom(dialogRoomId.value)
  }

  cancelDialog()
}

// Join room
const joinRoom = (roomId) => {
  if (roomId && dialogPlayerName.value.trim()) {
    lobbyStore.joinRoom(roomId, dialogPlayerName.value.trim())
  }
}

// Leave current room
const leaveRoom = () => {
  if (lobbyStore.currentRoom) {
    lobbyStore.leaveRoom(lobbyStore.currentRoom.id)
  }
}

// Create a new room
const createRoom = () => {
  if (dialogPlayerName.value.trim()) {
    lobbyStore.createRoom(dialogPlayerName.value.trim())
  }
}

// Refresh the rooms list
const refreshRooms = () => {
  lobbyStore.getRoomsList()
}

// Check if user can join a room
const canJoinRoom = (room) => {
  return room.playerCount < 4 && !room.gameStarted
}

// Validate player name is unique
const validatePlayerName = (name, roomId = null) => {
  const trimmedName = name.trim()
  if (!trimmedName) {
    return 'Name cannot be empty'
  }

  if (dialogAction.value === 'join' && roomId) {
    const room = lobbyStore.rooms.find(r => r.id === roomId)
    if (room && room.playerNames && room.playerNames.includes(trimmedName)) {
      return 'This name is already taken'
    }
  }

  return ''
}


// Check if current user is the host of the room
const isHost = () => {
  return lobbyStore.currentRoom &&
    lobbyStore.currentPlayerId === lobbyStore.currentRoom.hostId
}

// Check if game can be started (at least 2 players)
const canStartGame = () => {
  return lobbyStore.players && lobbyStore.players.length >= 2
}

// Start the game (only for host)
const startGame = () => {
  if (!canStartGame()) {
    return
  }

  console.log('Starting game...')
  lobbyStore.startGame()
}

onMounted(() => {
  // Wait for connection and get rooms list
  const checkConnectionAndRefresh = () => {
    if (lobbyStore.isConnected) {
      refreshRooms()
    } else {
      // Keep checking until connected
      setTimeout(checkConnectionAndRefresh, 100)
    }
  }
  checkConnectionAndRefresh()
})

// onUnmounted(() => {
//   // Clean up room state when leaving lobby
//   if (lobbyStore.currentRoom && !lobbyStore.gameStarted) {
//     lobbyStore.leaveRoom(lobbyStore.currentRoom.id)
//   }
// })
</script>

<template>
  <div class="nes-container is-dark lobby-container">

    <div class="game-title-section">
      <h1 class="nes-text game-title">BOMBERMAN</h1>
    </div>

    <!-- Connection Status -->
    <div v-if="!lobbyStore.isConnected" class="nes-container is-dark is-rounded">
      <p class="nes-text is-disabled">Connecting to server...</p>
      <p v-if="lobbyStore.connectionError" class="nes-text is-error">
        {{ lobbyStore.connectionError }}
      </p>
    </div>


    <div v-else class="lobby-content">
      <!-- Current Room Info -->
      <div v-if="lobbyStore.currentRoom" class="nes-container is-dark is-rounded current-room">
        <h3 class="nes-text is-success">Current Room: {{ lobbyStore.currentRoom.id }}</h3>
        <div class="players-list">
          <h4>Players ({{ lobbyStore.players.length }}/4)</h4>
          <div class="nes-list is-circle">
            <ul>
              <li v-for="player in lobbyStore.players" :key="player.id">
                {{ player.name }}
                <span v-if="player.id === lobbyStore.currentRoom.hostId"
                      class="nes-text is-warning"> (Host)</span>
              </li>
            </ul>
          </div>
        </div>

        <!-- Game controls -->
        <div class="game-controls">
          <div v-if="isHost()" class="host-controls">
            <button
              :class="['nes-btn', canStartGame() ? 'is-success' :  'is-disabled']"
              @click="startGame"
            >
              Start Game
            </button>
          </div>
          <div v-else class="waiting-message">
            <p class="nes-text is-disabled">
              Waiting for host to start the game
            </p>
          </div>
        </div>

        <button class="nes-btn is-error" @click="leaveRoom">
          Leave Room
        </button>
      </div>

      <!-- Main Lobby Content -->
      <div v-else>
        <!-- Available Rooms -->
        <div class="nes-container is-dark is-rounded rooms-section">
          <h3>Available Rooms</h3>
          <div class="action-buttons">
            <button class="nes-btn is-warning" @click="refreshRooms">
              Refresh
            </button>
            <button class="nes-btn is-success" @click="showNameDialog('create')">
              Create Room
            </button>
          </div>

          <div v-if="lobbyStore.rooms.length === 0" class="nes-text is-disabled">
            No rooms available. Create one to get started!
          </div>

          <div v-else class="rooms-list">
            <div
              v-for="room in lobbyStore.rooms"
              :key="room.id"
              class="nes-container room-item"
            >
              <div class="room-info">
                <h4>Room: {{ room.id }}</h4>
                <p>
                  Players: {{ room.playerCount }}/4
                  <span v-if="room.gameStarted" class="nes-text is-success"> (Game Started)</span>
                </p>
              </div>
              <button
                :class="['nes-btn', canJoinRoom(room) ? 'is-primary' : 'is-disabled']"
                @click="showNameDialog('join', room.id)"
              >
                Join Room
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Name Input Dialog -->
    <div v-if="showDialog" class="dialog-overlay">
      <div class="nes-dialog is-dark name-dialog">
        <h3>Enter Your Name</h3>
        <div class="nes-field">
          <label for="dialog-name">Your Name:</label>
          <input
            id="dialog-name"
            v-model="dialogPlayerName"
            type="text"
            :class="['nes-input', 'is-dark', nameValidationError ? 'is-error' : '']"
            placeholder="Enter your name"
            maxlength="20"
            @input="onNameInput"
            @keyup.enter="confirmDialog"
          />
          <p v-if="nameValidationError" class="nes-text is-error validation-error">
            {{ nameValidationError }}
          </p>
        </div>
        <div class="dialog-menu">
          <button class="nes-btn" @click="cancelDialog">Cancel</button>
          <button
            :class="['nes-btn', canConfirmDialog() ? 'is-primary' : 'is-disabled']"
            @click="confirmDialog"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  </div>
</template>


<style scoped>
.lobby-container {
  min-height: 99vh;
  height: 100%;
}

.nes-container .game-title {
  font-size: 3rem;
  text-align: center;
  margin: 1rem 0 2rem 0;
  text-shadow: 4px 4px 0px #000;
}

.game-title-section {
  text-align: center;
  margin-bottom: 2rem;
}

.action-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 1rem;
}

.rooms-section {
  margin: 2rem auto;
  max-width: 800px;
  padding: 2rem 1rem;
}

.rooms-section h3 {
  margin-bottom: 1rem;
}

.rooms-section .nes-container.room-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
  padding: 0.75rem;
  border-color: #4a5568;
}

.room-info {
  flex-grow: 1;
}

.nes-container .room-info h4 {
  margin: 0 0 0.25rem 0;
  font-size: 0.9rem;
}

.nes-container .room-info p {
  margin: 0;
}

.rooms-section .room-item .nes-btn {
  padding: 0.5rem 1rem;
  min-height: auto;
}

.rooms-list {
  margin-top: 0.5rem;
  max-height: 50vh;
  overflow-y: auto;
  padding-right: 0.5rem;
  scrollbar-width: thin;
  scrollbar-color: #4a5568 #1a202c;
}


/* Current room and game controls */
.current-room {
  margin: 2rem auto;
  max-width: 800px;
  padding: 2rem 1rem;
}

.players-list h4 {
  margin-bottom: 0.5rem;
}

.game-controls {
  margin: 1.5rem 0;
}

.host-controls p {
  margin-top: 0.5rem;
  margin-bottom: 0;
}

.waiting-message p {
  margin: 0;
  text-align: center;
}

/* dark theme styling */

.nes-container.is-dark {
  background-color: #2d3748;
  border-color: #4a5568;
}

.dialog-menu {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  margin-top: 1.5rem;
  padding: 0;
}

/* Dialog overlay styling */
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

.name-dialog {
  width: 90vw;
  max-width: 500px;
  margin: 1rem;
}

.validation-error {
  margin-top: 0.5rem;
  margin-bottom: 0;
  font-size: 0.8rem;
}

</style>
