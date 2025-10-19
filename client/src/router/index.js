import { createRouter, createWebHistory } from 'vue-router'
import { useLobbyStore } from '@/stores/lobby'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      redirect: '/lobby'
    },
    {
      path: '/lobby',
      name: 'lobby',
      component: () => import('@/components/LobbyScreen.vue')
    },
    {
      path: '/game',
      name: 'game',
      component: () => import('@/components/GamePage.vue'),
      beforeEnter: (to, from, next) => {
        const lobbyStore = useLobbyStore()
                if (!lobbyStore.isConnected || !lobbyStore.currentRoom || !lobbyStore.gameStarted) {
          next('/lobby')
        } else {
          next()
        }
      }
    }
  ],
})

export default router
