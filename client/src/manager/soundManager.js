class SoundManager {
    constructor() {
        this.sounds = {
            explosion: new Audio('/sounds/explosion.mp3'),
            death: new Audio('/sounds/death.mp3'),
        }
        
        this.tracks = {
            lobbyMusic: new Audio('/sounds/lobbyMusic.mp3'),
            gameMusic: new Audio('/sounds/gameMusic.mp3'),
        }

        Object.values(this.tracks).forEach(track => {
            track.loop = true
            track.volume = 0.01
        })

        this.currentTrack = null
        this.pendingTrack = null
        this.userInteracted = false  
    }

    init() {
        const startTrack = () => {
        this.userInteracted = true
        if (this.pendingTrack) {
            this._playTrack(this.pendingTrack)
            this.pendingTrack = null
        }
        window.removeEventListener('click', startTrack)
        window.removeEventListener('keydown', startTrack)
        }

        window.addEventListener('click', startTrack)
        window.addEventListener('keydown', startTrack)
    }

    _playTrack(name) {
        const track = this.tracks[name]
        if (!track) return

        if (this.currentTrack) {
            this.currentTrack.pause()
            this.currentTrack.currentTime = 0
        }

        this.currentTrack = track
        track.play().catch(() => {
        // autoplay blocked: do nothing, will retry on next interaction
        })
        localStorage.setItem('currentTrack', name)
    }

    playMusic(name) {
        if (!this.tracks[name]) return

        if (this.userInteracted) {
            this._playTrack(name)
        } else {
            this.pendingTrack = name
        }
    }

    stopMusic() {
        if (!this.currentTrack) return
        this.currentTrack.pause()
        this.currentTrack.currentTime = 0
        this.currentTrack = null
        localStorage.removeItem('lastMusic')
    }

    playSound(name, volume = 0.01) {
        const sound = this.sounds[name]
        if (!sound) return

        const clone = sound.cloneNode()
        clone.volume = volume
        clone.play()
    }

    resumeLastTrack() {
        const lastTrack = localStorage.getItem('currentTrack')
        if (lastTrack && this.tracks[lastTrack]) {
            this.pendingTrack = lastTrack
        }
    }
}

// export a singleton
export const soundManager = new SoundManager()