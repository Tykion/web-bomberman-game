<template>
    <GameUI>
      <GameArea v-slot="{ map, dropBomb, tickingBombs, explosions}">
        <Bomberman
          v-for="player in gameStore.players"
          :key="player.id"
          :player="player"
          :map="map"
          :dropBomb="dropBomb"
          :tickingBombs="tickingBombs"
          :explosions="explosions"
          @player-hit="handlePlayerHit"
        />
      </GameArea>
    </GameUI>
  </template>

  <script setup>
  import { onMounted, onUnmounted, watch } from 'vue'
  import { useRouter } from 'vue-router'
  import { useGameStore } from '@/stores/game'
  import { useLobbyStore } from '@/stores/lobby'
  import GameArea from './GameArea.vue'
  import Bomberman from './Bomberman.vue'
  import GameUI from './GameUI.vue'
  import { soundManager } from '@/manager/soundManager'

  const router = useRouter()
  const gameStore = useGameStore()
  const lobbyStore = useLobbyStore()

  // Watch for navigation triggers from store
  watch(() => gameStore.shouldNavigateToLobby, (newValue) => {
    if (newValue) {
      router.push('/lobby')
      gameStore.resetNavigationState()
    }
  })

  function handlePlayerHit({ x, y }) {
    console.log('Player hit at', x, y)
    soundManager.playSound('death')
  }

  onMounted(() => {
    // Initialize socket events in store
    gameStore.initializeSocketEvents()

    // Initialize game with players from lobby if available
    if (lobbyStore.players.length > 0) {

      lobbyStore.players.forEach((player, index) => {
        player.spriteIndex = index + 1  // Character1.png, Character2.png, etc.
      })
    }
  })

  onUnmounted(() => {
    // Clean up game state when leaving the game page
    gameStore.stopTimer()
    gameStore.cleanupSocketEvents()
    gameStore.resetGame()
    // Clean up lobby
    lobbyStore.resetLobby()
  })
  </script>
