import { io } from 'socket.io-client'

class SocketService {
  constructor() {
    this.socket = null
    this.isConnected = false
  }

  connect(serverUrl = 'http://localhost:3000') {
    if (!this.socket) {
      this.socket = io(serverUrl, {
        transports: ['websocket', 'polling'],
        autoConnect: true
      })

      this.socket.on('connect', () => {
        this.isConnected = true
        console.log('Connected to server:', this.socket.id)
      })

      this.socket.on('disconnect', () => {
        this.isConnected = false
        console.log('Disconnected from server')
      })

      this.socket.on('connect_error', (error) => {
        console.error('Connection error:', error)
      })
    }
    return this.socket
  }

  disconnect() {
    if (this.socket) {
      // Remove all listeners before disconnecting
      this.socket.removeAllListeners()
      this.socket.disconnect()
      this.socket = null
      this.isConnected = false
    }
  }

  removeAllListeners() {
    if (this.socket) {
      this.socket.removeAllListeners()
    }
  }

  emit(event, data) {
    if (this.socket && this.isConnected) {
      this.socket.emit(event, data)
    }
  }

  on(event, callback) {
    if (this.socket) {
      this.socket.on(event, callback)
    }
  }

  off(event, callback) {
    if (this.socket) {
      this.socket.off(event, callback)
    }
  }

  getSocket() {
    return this.socket
  }
}

export default new SocketService()
