const { ipcRenderer } = require('electron')
const path = require('path')

// Load config
const config = require(path.join(__dirname, 'config.js'))

// Expose globally
window.spectralConfig = {
  DEVICES: config.DEVICES,
  SPARK_PATH: config.SPARK_PATH,
  LAYOUT_POSITIONS: config.LAYOUT_POSITIONS,
  NODE_SIZE: config.NODE_SIZE,
  COLORS: config.COLORS,
  POLL_INTERVAL: config.POLL_INTERVAL
}

let statusUpdateHandler = null

window.deepNet = {
  onStatusUpdate: (callback) => {
    // Remove existing handler if any
    if (statusUpdateHandler) {
      ipcRenderer.off('status-update', statusUpdateHandler)
    }
    statusUpdateHandler = (_, data) => callback(data)
    ipcRenderer.on('status-update', statusUpdateHandler)
    return () => {
      if (statusUpdateHandler) {
        ipcRenderer.off('status-update', statusUpdateHandler)
        statusUpdateHandler = null
      }
    }
  },
  wakeDevice: (deviceId) => ipcRenderer.invoke('wake-device', deviceId),
  minimize: () => ipcRenderer.send('minimize-window'),
  close: () => ipcRenderer.send('close-window')
}

console.log('[PRELOAD] Exposed spectralConfig and deepNet')