const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } = require('electron')
const { execSync } = require('child_process')
const dgram = require('dgram')
const path = require('path')
const { DEVICES, POLL_INTERVAL, TAILSCALE_TIMEOUT, UDP_TIMEOUT } = require('./config.js')

if (process.argv.includes('--remote-debug')) {
  app.commandLine.appendSwitch('remote-debugging-port', '9222')
}

let mainWindow = null
let tray = null
let statusPollInterval = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    frame: false,
    transparent: true,
    backgroundColor: '#0a0e0a',
    resizable: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: false,
      nodeIntegration: true
    }
  })
  
  if (process.argv.includes('--remote-debug')) {
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  }

  mainWindow.loadFile(path.join(__dirname, 'renderer/index.html'))

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault()
      mainWindow.hide()
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function createTray() {
  const iconPath = path.join(__dirname, 'assets/icon.ico')
  let trayIcon = nativeImage.createFromPath(iconPath)
  
  if (trayIcon.isEmpty()) {
    const fallbackPath = path.join(__dirname, 'assets/icon-256.png')
    trayIcon = nativeImage.createFromPath(fallbackPath)
  }

  tray = new Tray(trayIcon.resize({ width: 16, height: 16 }))
  tray.setToolTip('Spectral Node')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show',
      click: () => {
        if (mainWindow) mainWindow.show()
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.isQuitting = true
        app.quit()
      }
    }
  ])

  tray.setContextMenu(contextMenu)
  tray.on('double-click', () => {
    if (mainWindow) mainWindow.show()
  })
}

function getTailscaleStatus() {
  try {
    const raw = execSync('tailscale status --json', { timeout: TAILSCALE_TIMEOUT, encoding: 'utf8' })
    const data = JSON.parse(raw)
    
    const peers = data.Peer || {}
    const deviceStatuses = {}
    
    // Include Self node (this machine) in the peer list
    const allPeers = { ...peers }
    if (data.Self) {
      allPeers['self'] = data.Self
    }
    
    for (const peerKey of Object.keys(allPeers)) {
      const peer = allPeers[peerKey]
      if (peer.TailscaleIPs && peer.TailscaleIPs.length > 0) {
        const ip = peer.TailscaleIPs[0]
        // Consider online if either Online or Active is true
        const isOnline = peer.Online === true || peer.Active === true
        deviceStatuses[ip] = {
          online: isOnline,
          lastSeen: peer.LastSeen || null
        }
      }
    }
    
    return DEVICES.map(device => {
      const status = deviceStatuses[device.tailscaleIP]
      return {
        id: device.id,
        online: status ? status.online : false,
        lastSeen: status ? status.lastSeen : null
      }
    })
  } catch (err) {
    console.error('Tailscale status error:', err.message)
    return DEVICES.map(d => ({ id: d.id, online: false, lastSeen: null }))
  }
}

function startStatusPolling() {
  if (statusPollInterval) clearInterval(statusPollInterval)
  
  statusPollInterval = setInterval(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      const status = getTailscaleStatus()
      mainWindow.webContents.send('status-update', status)
    }
  }, POLL_INTERVAL)
  
  const initialStatus = getTailscaleStatus()
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('status-update', initialStatus)
  }
}

function stopStatusPolling() {
  if (statusPollInterval) {
    clearInterval(statusPollInterval)
    statusPollInterval = null
  }
}

ipcMain.handle('wake-device', async (event, deviceId) => {
  const device = DEVICES.find(d => d.id === deviceId)
  if (!device?.canWake || !device.wakeUDP) {
    return { success: false, error: 'Device not wakeable' }
  }
  
  return new Promise((resolve) => {
    const client = dgram.createSocket('udp4')
    const msg = Buffer.from(device.wakeUDP.payload)
    
    client.send(msg, device.wakeUDP.port, device.wakeUDP.host, (err) => {
      client.close()
      if (err) {
        resolve({ success: false, error: err.message })
      } else {
        resolve({ success: true })
      }
    })
    
    client.on('error', (err) => {
      client.close()
      resolve({ success: false, error: err.message })
    })
  })
})

ipcMain.on('minimize-window', () => {
  if (mainWindow) mainWindow.minimize()
})

ipcMain.on('close-window', () => {
  if (mainWindow) mainWindow.hide()
})

app.whenReady().then(() => {
  createWindow()
  createTray()
  startStatusPolling()
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    stopStatusPolling()
    app.quit()
  }
})

app.on('before-quit', () => {
  app.isQuitting = true
  stopStatusPolling()
})