import { createApp } from 'vue'
import { createPinia } from 'pinia'
import 'nes.css/css/nes.min.css';

import App from './App.vue'
import router from './router'
import { soundManager } from './manager/soundManager';

const app = createApp(App)

soundManager.init()
soundManager.resumeLastTrack()

router.afterEach((to) => {
    if (to.path.startsWith('/lobby')) {
        soundManager.playMusic('lobbyMusic')
    } else if (to.path.startsWith('/game')) {
        soundManager.playMusic('gameMusic')
    }
})


app.use(createPinia())
app.use(router)

app.mount('#app')
