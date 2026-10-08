const DEVICES = [
  {
    id: 'esp32-wol',
    name: 'Controller',
    tailscaleIP: '100.64.0.1',
    type: 'controller',
    position: 'center',
    canWake: false,
    wakeTarget: null
  },
  {
    id: 'deep-pc',
    name: 'Workstation',
    tailscaleIP: '100.64.0.2',
    type: 'workstation',
    position: 'right',
    canWake: true,
    wakeUDP: {
      host: '100.64.0.1',
      port: 9999,
      payload: 'wake'
    }
  },
  {
    id: 'laptop-qi54k12v',
    name: 'Laptop 1',
    tailscaleIP: '100.64.0.3',
    type: 'laptop',
    position: 'bottom',
    canWake: false,
    wakeTarget: null
  },
  {
    id: 'i2405',
    name: 'Phone',
    tailscaleIP: '100.64.0.4',
    type: 'mobile',
    position: 'left',
    canWake: false,
    wakeTarget: null
  },
  {
    id: 'laptop-d57idsi3',
    name: 'Laptop 2',
    tailscaleIP: '100.64.0.5',
    type: 'laptop',
    position: 'top',
    canWake: false,
    wakeTarget: null
  }
]

const SPARK_PATH = ['laptop-qi54k12v', 'esp32-wol', 'deep-pc']

const LAYOUT_POSITIONS = {
  'esp32-wol': { x: 500, y: 350 },
  'deep-pc': { x: 850, y: 350 },
  'laptop-qi54k12v': { x: 500, y: 600 },
  'i2405': { x: 150, y: 350 },
  'laptop-d57idsi3': { x: 500, y: 100 }
}

const NODE_SIZE = {
  center: { width: 220, height: 140, pinCount: 10 },
  default: { width: 180, height: 120, pinCount: 8 }
}

const COLORS = {
  bgBase: '#050a0f',
  bgPcb: '#070d14',
  traceIdle: '#0a2a3a',
  traceActive: '#00d4ff',
  traceDead: '#0d0d0d',
  nodeOnline: '#00d4ff',
  nodeOffline: '#1a1a2e',
  nodeWaiting: '#ff8c00',
  nodeCenter: '#00d4ff',
  sparkColor: '#ffffff',
  sparkGlow: '#ff8c00',
  particleDot: '#ff8c00',
  particleDotAlt: '#00d4ff',
  textPrimary: '#00d4ff',
  textSecondary: '#2a5a7a',
  wakeButton: '#ff6600',
  wakeButtonGlow: '#ff8c00',
  connectionSurge: '#ffffff'
}

const POLL_INTERVAL = 5000
const UDP_TIMEOUT = 3000
const TAILSCALE_TIMEOUT = 3000

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    DEVICES,
    SPARK_PATH,
    LAYOUT_POSITIONS,
    NODE_SIZE,
    COLORS,
    POLL_INTERVAL,
    UDP_TIMEOUT,
    TAILSCALE_TIMEOUT
  }
}
