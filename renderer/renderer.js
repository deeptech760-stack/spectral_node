// Spectral Node Renderer - Main UI Logic
// Uses window.spectralConfig from preload.js

class SpectralNodeApp {
  constructor() {
    console.log('SpectralNodeApp constructor');
    const config = window.spectralConfig;
    this.devices = config.DEVICES;
    this.deviceStatus = {};
    this.sparkInProgress = false;
    this.waitingForDeepPC = false;
    
    this.canvas = null;
    this.circuitCanvas = null;
    this.nodesContainer = null;
    this.particlesContainer = null;
    this.tsParticles = null;
    
    this.init();
  }
  
  async init() {
    console.log('SpectralNodeApp init');
    this.setupDOM();
    this.initCanvas();
    this.createNodes();
    await this.initParticles();
    this.setupIPC();
    console.log('SpectralNodeApp init complete');
  }
  
  setupDOM() {
    this.canvas = document.getElementById('circuit-canvas');
    this.nodesContainer = document.getElementById('nodes-layer');
    this.particlesContainer = document.getElementById('particles-container');
    
    document.getElementById('btn-minimize').addEventListener('click', () => window.deepNet.minimize());
    document.getElementById('btn-close').addEventListener('click', () => window.deepNet.close());
  }
  
  initCanvas() {
    const config = window.spectralConfig;
    this.circuitCanvas = new CircuitCanvas(this.canvas, {
      DEVICES: config.DEVICES,
      LAYOUT_POSITIONS: config.LAYOUT_POSITIONS,
      NODE_SIZE: config.NODE_SIZE,
      COLORS: config.COLORS,
      SPARK_PATH: config.SPARK_PATH
    });
  }
  
  createNodes() {
    const config = window.spectralConfig;
    for (const device of config.DEVICES) {
      const pos = config.LAYOUT_POSITIONS[device.id];
      const size = device.position === 'center' ? config.NODE_SIZE.center : config.NODE_SIZE.default;
      
      const nodeEl = document.createElement('div');
      nodeEl.className = `node ${device.position} ${device.id === 'esp32-wol' ? 'center' : ''} offline`;
      nodeEl.dataset.deviceId = device.id;
      nodeEl.style.left = pos.x + 'px';
      nodeEl.style.top = pos.y + 'px';
      
      const iconSvg = this.getDeviceIcon(device.type);
      
      nodeEl.innerHTML = `
        <div class="node-inner">
          <div class="node-pins">
            <div class="pin-row">
              ${'<div class="pin"></div>'.repeat(size.pinCount)}
            </div>
            <div class="pin-row">
              ${'<div class="pin"></div>'.repeat(size.pinCount)}
            </div>
          </div>
          <div class="node-header">
            <div class="node-icon">${iconSvg}</div>
            <div class="node-name">${device.name}</div>
          </div>
          <div class="node-ip">${device.tailscaleIP}</div>
          <div class="node-status">
            <div class="status-dot"></div>
            <span class="status-text">○ OFFLINE</span>
          </div>
          ${device.canWake ? '<button class="wake-button" data-device-id="' + device.id + '">⚡ WAKE PC</button>' : ''}
        </div>
      `;
      
      const wakeBtn = nodeEl.querySelector('.wake-button');
      if (wakeBtn) {
        wakeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.handleWakeClick(device.id);
        });
      }
      
      this.nodesContainer.appendChild(nodeEl);
    }
  }
  
  getDeviceIcon(type) {
    const icons = {
      controller: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="18" rx="2"/><path d="M6 9h12M6 15h8"/></svg>`,
      workstation: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M2 17h20"/><path d="M6 17v4M18 17v4"/></svg>`,
      laptop: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M2 17h20"/><path d="M6 17v4M18 17v4"/></svg>`,
      mobile: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/></svg>`
    };
    return icons[type] || icons.controller;
  }
  
  async initParticles() {
    const config = window.spectralConfig;
    if (window.tsParticles) {
      this.tsParticles = await window.tsParticles.load({
        id: 'tsparticles',
        container: this.particlesContainer,
        options: {
          background: { color: 'transparent' },
          fullScreen: { enable: false },
          particles: {
            number: { value: 0 },
            color: { value: config.COLORS.particleDot },
            shape: { type: 'circle' },
            opacity: { value: 1 },
            size: { value: { min: 2, max: 6 } },
            move: { enable: false },
            life: { duration: { sync: false, value: 1 } }
          },
          emitters: [],
          interactivity: { events: { onHover: { enable: false }, onClick: { enable: false } } }
        }
      });
    }
  }
  
  setupIPC() {
    this.cleanupStatusUpdate = window.deepNet.onStatusUpdate((status) => {
      this.handleStatusUpdate(status);
    });
  }
  
  handleStatusUpdate(statusArray) {
    if (!Array.isArray(statusArray)) {
      console.error('statusArray is not an array:', statusArray);
      return;
    }
    try {
      this.deviceStatus = {};
      for (const s of statusArray) {
        this.deviceStatus[s.id] = s;
      }
    } catch (e) {
      console.error('Error in handleStatusUpdate loop:', e.message, e.stack);
      throw e;
    }
    
    this.circuitCanvas.updateStatus(statusArray);
    this.updateNodeVisuals();
    
    if (this.waitingForDeepPC) {
      const deepPCStatus = this.deviceStatus['deep-pc'];
      if (deepPCStatus && deepPCStatus.online) {
        this.onDeepPCOnline();
      }
    }
  }
  
  updateNodeVisuals() {
    const config = window.spectralConfig;
    for (const device of config.DEVICES) {
      const nodeEl = this.nodesContainer.querySelector(`[data-device-id="${device.id}"]`);
      if (!nodeEl) continue;
      
      const status = this.deviceStatus[device.id];
      const isOnline = status && status.online;
      const isWaiting = nodeEl.classList.contains('waiting');
      
      nodeEl.classList.remove('online', 'offline', 'waiting');
      nodeEl.classList.add(isWaiting ? 'waiting' : (isOnline ? 'online' : 'offline'));
      
      const statusText = nodeEl.querySelector('.status-text');
      const statusDot = nodeEl.querySelector('.status-dot');
      
      if (isWaiting) {
        statusText.textContent = '◌ BOOTING...';
        statusText.style.color = config.COLORS.nodeWaiting;
        statusDot.style.background = config.COLORS.nodeWaiting;
        statusDot.style.boxShadow = `0 0 8px ${config.COLORS.nodeWaiting}`;
      } else if (isOnline) {
        statusText.textContent = '● ONLINE';
        statusText.style.color = config.COLORS.nodeOnline;
        statusDot.style.background = config.COLORS.nodeOnline;
        statusDot.style.boxShadow = `0 0 8px ${config.COLORS.nodeOnline}`;
      } else {
        statusText.textContent = '○ OFFLINE';
        statusText.style.color = config.COLORS.textSecondary;
        statusDot.style.background = config.COLORS.nodeOffline;
        statusDot.style.boxShadow = `0 0 6px ${config.COLORS.nodeOffline}`;
      }
      
      const wakeBtn = nodeEl.querySelector('.wake-button');
      if (wakeBtn) {
        wakeBtn.disabled = isOnline || isWaiting;
      }
    }
  }
  
  async handleWakeClick(deviceId) {
    if (this.sparkInProgress) return;
    if (deviceId !== 'deep-pc') return;
    
    this.sparkInProgress = true;
    this.waitingForDeepPC = true;
    
    const originNode = this.nodesContainer.querySelector('[data-device-id="laptop-qi54k12v"]');
    const esp32Node = this.nodesContainer.querySelector('[data-device-id="esp32-wol"]');
    const deepPCNode = this.nodesContainer.querySelector('[data-device-id="deep-pc"]');
    
    const wakeBtn = deepPCNode.querySelector('.wake-button');
    if (wakeBtn) wakeBtn.style.display = 'none';
    
    await this.playSparkSequence(originNode, esp32Node, deepPCNode);
  }
  
  async playSparkSequence(originNode, esp32Node, deepPCNode) {
    const config = window.spectralConfig;
    const tl = gsap.timeline();
    
    tl.call(() => this.burstParticlesAtNode(originNode, config.COLORS.sparkColor, 30))
      .to(originNode, {
        scale: 1.1,
        duration: 0.3,
        ease: 'power2.out',
        onStart: () => originNode.classList.add('charging')
      })
      .to(originNode, { scale: 1, duration: 0.2, ease: 'power2.in' }, '+=0');
    
    tl.call(() => {
      this.circuitCanvas.triggerSpark('laptop-qi54k12v', () => {
        this.onSparkReachedESP32(esp32Node, deepPCNode);
      });
    });
    
    await this.waitForTimeline(tl);
  }
  
  onSparkReachedESP32(esp32Node, deepPCNode) {
    const config = window.spectralConfig;
    this.burstParticlesAtNode(esp32Node, config.COLORS.sparkGlow, 40);
    
    esp32Node.classList.remove('online', 'offline');
    esp32Node.classList.add('waiting');
    
    const esp32StatusText = esp32Node.querySelector('.status-text');
    esp32StatusText.textContent = '◌ RELAYING...';
    esp32StatusText.style.color = config.COLORS.nodeWaiting;
    
    window.deepNet.wakeDevice('deep-pc').then(result => {
      if (!result.success) {
        console.error('Wake failed:', result.error);
      }
    });
    
    this.circuitCanvas.triggerChargeTrace('deep-pc');
    
    deepPCNode.classList.remove('online', 'offline');
    deepPCNode.classList.add('waiting');
    const deepPCStatusText = deepPCNode.querySelector('.status-text');
    deepPCStatusText.textContent = '◌ BOOTING...';
    deepPCStatusText.style.color = config.COLORS.nodeWaiting;
  }
  
  async onDeepPCOnline() {
    this.waitingForDeepPC = false;
    this.circuitCanvas.stopChargeTrace('deep-pc');
    
    const esp32Node = this.nodesContainer.querySelector('[data-device-id="esp32-wol"]');
    const deepPCNode = this.nodesContainer.querySelector('[data-device-id="deep-pc"]');
    
    const tl = gsap.timeline();
    
    tl.call(() => {
      this.circuitCanvas.triggerSurge('deep-pc', () => {
        this.onSurgeComplete(esp32Node, deepPCNode);
      });
    });
    
    await this.waitForTimeline(tl);
  }
  
  onSurgeComplete(esp32Node, deepPCNode) {
    const config = window.spectralConfig;
    this.burstParticlesAtNode(deepPCNode, config.COLORS.sparkColor, 50);
    
    deepPCNode.classList.remove('waiting', 'offline');
    deepPCNode.classList.add('online');
    
    const deepPCStatusText = deepPCNode.querySelector('.status-text');
    deepPCStatusText.textContent = '● ONLINE';
    deepPCStatusText.style.color = config.COLORS.nodeOnline;
    
    esp32Node.classList.remove('waiting');
    const esp32Status = this.deviceStatus['esp32-wol'];
    esp32Node.classList.add(esp32Status && esp32Status.online ? 'online' : 'offline');
    
    const esp32StatusText = esp32Node.querySelector('.status-text');
    if (esp32Status && esp32Status.online) {
      esp32StatusText.textContent = '● ONLINE';
      esp32StatusText.style.color = config.COLORS.nodeOnline;
    } else {
      esp32StatusText.textContent = '○ OFFLINE';
      esp32StatusText.style.color = config.COLORS.textSecondary;
    }
    
    setTimeout(() => {
      this.burstParticlesAtNode(deepPCNode, config.COLORS.particleDotAlt, 30);
    }, 500);
    
    setTimeout(() => {
      this.sparkInProgress = false;
      this.updateNodeVisuals();
    }, 1000);
  }
  
  burstParticlesAtNode(nodeEl, color, count) {
    if (!this.tsParticles || !this.tsParticles.emitters) {
      console.warn('tsParticles not ready, skipping burst');
      return;
    }
    
    const rect = nodeEl.getBoundingClientRect();
    const containerRect = this.particlesContainer.getBoundingClientRect();
    const x = rect.left + rect.width / 2 - containerRect.left;
    const y = rect.top + rect.height / 2 - containerRect.top;
    
    try {
      this.tsParticles.emitters.addEmitter({
        position: { x, y },
        rate: { quantity: count, delay: 0.01 },
        life: { duration: 0.5 },
        particles: {
          color: { value: color },
          shape: { type: 'circle' },
          size: { value: { min: 3, max: 8 } },
          opacity: { value: 1 },
          move: {
            speed: { min: 50, max: 150 },
            direction: 'none',
            gravity: { enable: true, force: 20, direction: 'bottom' }
          },
          life: { duration: { sync: false, value: { min: 0.3, max: 0.8 } } }
        }
      });
    } catch (e) {
      console.error('Failed to add emitter:', e.message);
      return;
    }
    
    setTimeout(() => {
      try {
        if (this.tsParticles && this.tsParticles.emitters && this.tsParticles.emitters.list.length > 0) {
          this.tsParticles.emitters.removeEmitter(this.tsParticles.emitters.list[0]);
        }
      } catch (e) {
        console.error('Failed to remove emitter:', e.message);
      }
    }, 600);
  }
  
  waitForTimeline(tl) {
    return new Promise(resolve => {
      tl.eventCallback('onComplete', resolve);
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.app = new SpectralNodeApp();
});