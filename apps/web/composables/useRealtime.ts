import { io, Socket } from 'socket.io-client'

export function useRealtime () {
  // Socket.IO connection
  let socket: Socket | null = null
  // Polling fallback
  let interval: ReturnType<typeof setInterval> | null = null
  let isConnected = false

  function connect (token: string): Socket {
    if (socket?.connected) return socket

    const wsUrl = useRuntimeConfig().public.wsUrl || 'ws://localhost:3000'
    socket = io(`${wsUrl}/agent-hub/v1`, {
      query: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    })

    socket.on('connect', () => {
      isConnected = true
      console.log('[realtime] connected')
    })

    socket.on('disconnect', () => {
      isConnected = false
      console.log('[realtime] disconnected')
    })

    socket.on('connect_error', (err) => {
      console.warn('[realtime] connection error:', err.message)
    })

    return socket
  }

  function disconnect (): void {
    if (socket) {
      socket.disconnect()
      socket = null
      isConnected = false
    }
    stopPolling()
  }

  function onApprovalUpdate (handler: (data: any) => void): () => void {
    if (!socket) {
      console.warn('[realtime] socket not connected, using polling fallback')
      return () => {}
    }
    socket.on('approval_request', handler)
    return () => { socket?.off('approval_request', handler) }
  }

  function onTaskUpdate (handler: (data: any) => void): () => void {
    if (!socket) {
      console.warn('[realtime] socket not connected, using polling fallback')
      return () => {}
    }
    socket.on('progress', handler)
    return () => { socket?.off('progress', handler) }
  }

  function startPolling (cb: () => void | Promise<void>, ms = 10000): void {
    stopPolling()
    interval = setInterval(() => { void cb() }, ms)
  }

  function stopPolling (): void {
    if (interval) {
      clearInterval(interval)
      interval = null
    }
  }

  onBeforeUnmount(() => {
    disconnect()
  })

  return {
    connect,
    disconnect,
    onApprovalUpdate,
    onTaskUpdate,
    startPolling,
    stopPolling,
    get isConnected () { return isConnected },
  }
}
