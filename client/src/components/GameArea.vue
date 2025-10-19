<template>
  <div class="game-area">
    <!--Map render-->
    <div v-for="row in gameStore.map" :key="row[0].y" class="tile-row">
      <div
        v-for="tile in row"
        :key="tile.x"
        :class="[
                    'tile',
                    tile.type
                ]"
      ></div>
    </div>
    <!--Bomb (ticking) render-->
    <div
      v-for="bomb in gameStore.tickingBombs"
      :key="bomb.id"
      class="Bomb"
      :style="{ top: bomb.y * 32 + 'px', left: bomb.x * 32 + 'px' }"
    >
      <img
        src="/sprites/bomb-and-explosion.png"
        :class="['Bomb_spritesheet', 'ticking', { 'paused': gameStore.isPaused }]"
      />
    </div>

    <!-- Explosions -->
    <div
      v-for="exp in gameStore.explosions"
      :key="exp.id" class="Bomb"
      :style="{ top: exp.y*32+'px', left: exp.x*32+'px' }"
    >
      <img
        src="/sprites/bomb-and-explosion.png" class="Bomb_spritesheet"
        :class="{
                    'exploding-center': exp.type==='center',
                    'exploding-horizontal': exp.type==='horizontal',
                    'exploding-vertical': exp.type==='vertical'
                }"/>
    </div>

    <!-- Power ups -->
    <div
      v-for="p in gameStore.powerups"
      :key="p.id"
      class="powerup"
      :class="p.type"
      :style="{ top: p.y * 32 + 'px', left: p.x * 32 + 'px', position: 'absolute' }"
    ></div>

    <slot :map="gameStore.map" :dropBomb="dropBomb" :tickingBombs="gameStore.tickingBombs" :explosions="gameStore.explosions" :powerups="gameStore.powerups"></slot>   <!--slot for the bomberman in the app.vue-->
  </div>


</template>

<script setup>

import { useGameStore } from '@/stores/game'
import socketService from '@/services/socket'

const emit = defineEmits(['player-hit'])
const gameStore = useGameStore()

// Simplified bomb dropping - just send request to server
function dropBomb(x, y) {
  // Check if there's already a bomb at this position (client-side check for immediate feedback)
  if (gameStore.tickingBombs.some(b => b.x === x && b.y === y)) return

  // Send bomb placement request to server
  socketService.emit('bombPlaceRequest', { x, y })
}

</script>

<style scope>

.game-area {
  position: relative;
  width: 608px;
  height: 608px;
  background: gray;
  overflow: hidden;
  box-sizing: border-box;
}

.tile-row {
  display: flex;
}

.tile {
  width: 32px;
  height: 32px;
  /*background: lightgray;*/
  /*border: 1px solid #eee6;*/
  box-sizing: border-box;
}

.tile.block {
  background-image: url('/sprites/nondestroyableblock.png');
  background-size: cover;
}

.powerup {
  width: 32px;
  height: 32px;
  box-sizing: border-box;
  background-image: url('/sprites/PowerUps.png');
  animation: fadeIn 0.3s ease-out;
}

.powerup.healthUp {
  background-position: 0 0;
}

.powerup.explosionRadiusUp {
  background-position: 0 -64px;
}

.powerup.bombCountUp {
  background-position: 0 -32px
}

.tile.rock {
  background-image: url('/sprites/destoyableblock.png');
  background-size: cover;
}

.tile.empty {
  /* Empty tiles have no background */
  background: transparent;
}

.Bomb {
  position:absolute;
  width: 32px;
  height: 32px;
  image-rendering: pixelated;
  z-index: 2;
  overflow: hidden;
}

.Bomb_spritesheet.ticking {
  animation: moveSpriteSheet 2s steps(3);
  object-position: 0 0;
}

.Bomb_spritesheet.exploding-center {
  object-position: 0 -32px;
}

.Bomb_spritesheet.exploding-horizontal {
  object-position: -32px -32px;
}

.Bomb_spritesheet.exploding-vertical {
  object-position: -64px -32px;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-8px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes moveSpriteSheet {
  from {
    transform: translate3d(0px,0,0);
  }
  to {
    transform: translate3d(-96px,0,0);
  }
}

.Bomb_spritesheet.paused {
  animation-play-state: paused !important;
}

</style>
