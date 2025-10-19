<template>

    <div class="Character" :style="{ top: position.y + 'px', left: position.x + 'px' }">
        <img
            :src="`/sprites/Character${player.spriteIndex}.png`"
            alt="Bomberman"
            :class="[
                'Character_spritesheet',
                 isDead ? 'death' : (isWalking ? `walking_${direction}` : 'idle'),
                 { 'paused': gameStore.isPaused }
                ]"
        />
    </div>

</template>

<script setup>

    import { computed, ref } from 'vue'
    import { onMounted, onUnmounted } from 'vue'
    import { watch } from 'vue'
    import { useGameStore } from '@/stores/game'


    const gameStore = useGameStore()
    const currentPlayer = computed(() => gameStore.currentPlayer)

    const props = defineProps({
        map: {
            type: Array,
            required: true
        },
        dropBomb: Function,
        tickingBombs: Array,
        explosions: Array,
        player: Object
    })

        // GRID SETTINGS
    const gridSize = 32
    const moveSpeed = 0.6

    const gridPos = ref({ x: props.player.position.x, y: props.player.position.y }) // current tile
    const position = ref({ x: gridPos.value.x * gridSize, y: gridPos.value.y * gridSize })
    let targetPos = { ...position.value }
    const isWalking = ref(false)
    const direction = ref('')

    let animationFrame = null

    const isDead = ref(false)
    const emit = defineEmits(['player-hit'])

    watch(
        () => props.explosions,
            (newExplosions) => {
                if (!isDead.value) {
                newExplosions.forEach(exp => {
                    if (gridPos.value.x === exp.x &&
                        gridPos.value.y === exp.y) {
                        die()
                        emit('player-hit', { x: gridPos.value.x, y: gridPos.value.y })
                    }
                })
                }
            },
        { deep: true }
    )

    // Handle pause/unpause animation
    watch(
        () => gameStore.isPaused,
        (isPaused) => {
            if (isPaused) {
                // Cancel animation when pausing
                if (animationFrame) {
                    cancelAnimationFrame(animationFrame)
                    animationFrame = null
                }
            } else if (!isPaused && targetPos && !isDead.value && !animationFrame) {
                // Resume animation when unpausing
                animateMove()
            }
        }
    )

   // movement and animation
    watch(
        () => ({ pos: props.player.position, allPlayers: gameStore.players }),
        ({ pos, allPlayers }) => {
            if (isDead.value) return

            const playerInStore = allPlayers.find(p => p.id === props.player.id)
            if (!playerInStore) return

            const newTargetPos = {
            x: playerInStore.position.x * gridSize,
            y: playerInStore.position.y * gridSize
            }

            gridPos.value = { ...playerInStore.position }

            // Determine direction for non-local players
            if (props.player.id !== currentPlayer.value.id) {
                const dx = newTargetPos.x - position.value.x
                const dy = newTargetPos.y - position.value.y

                if (Math.abs(dx) > Math.abs(dy)) direction.value = dx > 0 ? 'right' : 'left'
                    else direction.value = dy > 0 ? 'down' : 'up'
                }

            targetPos = newTargetPos
            if (!animationFrame) animateMove()
        },
        { deep: true }
    )

    function moveTile(dir) {
        if (isWalking.value || isDead.value) return // ignore new moves while moving
        direction.value = dir

        // Store movements with socket id and {x, y}
        if (props.player.id === currentPlayer.value.id) {
            gameStore.requestMove(props.player.id, dir)
        }
        
    }

    function die() {
        isDead.value = true
        isWalking.value = false
        targetPos = null
        if (animationFrame) {
            cancelAnimationFrame(animationFrame)
            animationFrame = null
        }

        position.value.x = gridPos.value.x * gridSize
        position.value.y = gridPos.value.y * gridSize
    }

    // character animation
    function animateMove() {
        if (!targetPos || isDead.value) return
        
        // If paused, cancel animation frame and return
        if (gameStore.isPaused) {
            if (animationFrame) {
                cancelAnimationFrame(animationFrame)
                animationFrame = null
            }
            return
        }

        const dx = targetPos.x - position.value.x
        const dy = targetPos.y - position.value.y

        if (Math.abs(dx) <= moveSpeed && Math.abs(dy) <= moveSpeed) {
            position.value.x = targetPos.x
            position.value.y = targetPos.y
            isWalking.value = false
            animationFrame = null
            return
        }

        position.value.x += Math.sign(dx) * Math.min(moveSpeed, Math.abs(dx))
        position.value.y += Math.sign(dy) * Math.min(moveSpeed, Math.abs(dy))

        isWalking.value = true
        animationFrame = requestAnimationFrame(animateMove)
    }

    // Keyboard input
    function handleKeydown(e) {
        //console.log('currentplayer: ', currentPlayer.value.id, 'props player id is: ', props.player.id)
        if(!currentPlayer.value.id || props.player.id !== currentPlayer.value.id) return

        // Block input when paused
        if (gameStore.isPaused) return

        //console.log('keydown received', e.key, currentPlayer.value.id, props.player.id)

        if (e.key === 'ArrowUp') moveTile('up')
        if (e.key === 'ArrowDown') moveTile('down')
        if (e.key === 'ArrowLeft') moveTile('left')
        if (e.key === 'ArrowRight') moveTile('right')

        if((e.key === ' ' || e.code === 'Space') && !isDead.value) {
            //console.log('Dropping bomb at:', gridPos.value.x, gridPos.value.y)
            e.preventDefault()
            props.dropBomb(gridPos.value.x, gridPos.value.y)
        }
    }

    onMounted(() => {
         window.addEventListener('keydown', handleKeydown)
    })

    onUnmounted(() => {
        window.removeEventListener('keydown', handleKeydown)
    })

</script>

<style scoped>

    .Character {
        position: absolute;
        image-rendering: pixelated;
        width: 32px;
        height: 32px;
        overflow: hidden;
    }

    .Character_spritesheet.idle {
        animation: moveSpriteSheet 1.5s steps(8) infinite;
        object-position: 0 0px;
    }

    .Character_spritesheet.walking_down {
        animation: moveSpriteSheet 0.7s steps(8) infinite;
        object-position: 0 -32px;
    }

    .Character_spritesheet.walking_right {
        animation: moveSpriteSheet 0.7s steps(8) infinite;
        object-position: 0 -64px;
    }

    .Character_spritesheet.walking_left {
        animation: moveSpriteSheet 0.7s steps(8) infinite;
        object-position: 0 -96px;
    }

    .Character_spritesheet.death {
        animation: deathAnimation 1s steps(7) forwards !important;
        object-position: 0 -160px !important;
    }

    .Character_spritesheet.walking_up {
        animation: moveSpriteSheet 0.7s steps(8) infinite;
        object-position: 0 -128px;
    }

    .Character_spritesheet.paused {
        animation-play-state: paused !important;
    }

    @keyframes deathAnimation {
        from {
            transform: translate3d(0px,0,0);
        }
        to {
            transform: translate3d(-224px,0,0); /* Stop at 7th frame instead of 8th */
        }
    }

    @keyframes moveSpriteSheet {
        from {
            transform: translate3d(0px,0,0);
        }
        to {
            transform: translate3d(-256px,0,0);
        }
    }

</style>
