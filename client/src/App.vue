<template>
  <div id="app">
    <router-view />
  </div>
</template>

<script setup>
import { onMounted, onUnmounted } from 'vue'
import { useLobbyStore } from '@/stores/lobby'

const lobbyStore = useLobbyStore()

// Global connection management
onMounted(() => {
  lobbyStore.connect()
})

onUnmounted(() => {
  lobbyStore.disconnect()
})

// Handle page refresh/close
window.addEventListener('beforeunload', () => {
  lobbyStore.disconnect()
})
</script>

<style>

    body {
        overflow: hidden;
    }

</style>
