export function useRealtime () {
  // MVP: polling fallback every 10 seconds
  let interval: ReturnType<typeof setInterval> | null = null

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

  onBeforeUnmount(() => stopPolling())

  return { startPolling, stopPolling }
}
