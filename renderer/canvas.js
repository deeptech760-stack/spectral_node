let pcbAnimation = null;
let bokehParticles = [];
let bokehAnimationId = null;

function initCanvas() {
  const bokehCanvas = document.getElementById('bokeh-layer');

  function resizeCanvas() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    bokehCanvas.width = width;
    bokehCanvas.height = height;
  }

  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  // Load pcb-trace-animation dynamically (local copy works in both dev and packaged)
  const script = document.createElement('script');
  script.src = 'pcb-trace-animation.js';
  script.type = 'module';
  script.onload = () => {
    import('./pcb-trace-animation.js').then(module => {
      const PCBTraceAnimation = module.default;
      pcbAnimation = new PCBTraceAnimation(bokehCanvas, {
        traceColor: '#00d4ff',
        viaColor: '#ff8c00',
        speed: 3,
        lineWidth: 2,
        lineSpacing: 15,
        lineAngleVariation: 0.01,
        lineEndCoefficient: 0.004,
        autoResize: true,
      });
      pcbAnimation.start();
    });
  };
  document.head.appendChild(script);

  // Initialize bokeh particles on DOMContentLoaded
  window.addEventListener('DOMContentLoaded', () => {
    const bokehCanvas = document.getElementById('bokeh-layer')
    const ctx = bokehCanvas.getContext('2d')
    bokehCanvas.width = window.innerWidth
    bokehCanvas.height = window.innerHeight

    const particles = Array.from({ length: 120 }, () => ({
      x: Math.random() * bokehCanvas.width,
      y: Math.random() * bokehCanvas.height,
      radius: 1.5 + Math.random() * 5,
      baseOpacity: 0.6 + Math.random() * 0.4,
      pulseSpeed: 0.0008 + Math.random() * 0.003,
      pulseOffset: Math.random() * Math.PI * 2,
      color: Math.random() > 0.25 ? '#ff8c00' : '#00d4ff'
    }))

    function drawBokeh() {
      ctx.clearRect(0, 0, bokehCanvas.width, bokehCanvas.height)
      particles.forEach(p => {
        const t = Date.now() * p.pulseSpeed + p.pulseOffset
        const opacity = p.baseOpacity * (0.4 + 0.6 * Math.abs(Math.sin(t)))
        const grad = ctx.createRadialGradient(
          p.x, p.y, 0, p.x, p.y, p.radius * 5)
        grad.addColorStop(0, p.color + 
          Math.floor(opacity * 255).toString(16).padStart(2,'0'))
        grad.addColorStop(1, p.color + '00')
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.radius * 5, 0, Math.PI * 2)
        ctx.fillStyle = grad
        ctx.fill()
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
        ctx.fillStyle = p.color
        ctx.globalAlpha = opacity
        ctx.fill()
        ctx.globalAlpha = 1
      })
      requestAnimationFrame(drawBokeh)
    }
    drawBokeh()
  })
}

function stopCanvas() {
  if (pcbAnimation) {
    pcbAnimation.stop();
    pcbAnimation = null;
  }
  if (bokehAnimationId) {
    cancelAnimationFrame(bokehAnimationId);
    bokehAnimationId = null;
  }
}

function getPCBAnimation() {
  return pcbAnimation;
}

// Make functions globally available
window.initCanvas = initCanvas;
window.stopCanvas = stopCanvas;
window.getPCBAnimation = getPCBAnimation;

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initCanvas);

// ============================================================
// CircuitCanvas class for spark animations (used by renderer.js)
// ============================================================

class CircuitCanvas {
  constructor(canvas, config) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.config = config
    this.width = 1000
    this.height = 700
    this.deviceStatus = {}
    this.animationId = null
    this.time = 0
    
    this.sparks = []
    this.chargingTraces = {}
    this.surges = []
    
    this.resize()
    window.addEventListener('resize', () => this.resize())
  }
  
  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect()
    this.width = rect.width || 1000
    this.height = rect.height || 700
    this.canvas.width = this.width
    this.canvas.height = this.height
    this.canvas.style.width = this.width + 'px'
    this.canvas.style.height = this.height + 'px'
    
    this.recalculateTracePaths()
    this.initCurrentDots()
  }
  
  recalculateTracePaths() {
    this.tracePaths = {}
    const center = this.config.LAYOUT_POSITIONS['esp32-wol']
    
    for (const device of this.config.DEVICES) {
      if (device.id === 'esp32-wol') continue
      const pos = this.config.LAYOUT_POSITIONS[device.id]
      this.tracePaths[device.id] = this.createPCBTrace(pos, center)
    }
  }
  
  createPCBTrace(from, to) {
    const path = []
    const midX = to.x
    const midY = from.y
    
    path.push({ x: from.x, y: from.y })
    path.push({ x: midX, y: midY })
    path.push({ x: to.x, y: to.y })
    
    return path
  }
  
  initCurrentDots() {
    this.currentDots = []
    
    for (const device of this.config.DEVICES) {
      if (device.id === 'esp32-wol') continue
      const path = this.tracePaths[device.id]
      if (!path) continue
      
      const traceLength = this.getPathLength(path)
      const dotCount = 5
      
      for (let i = 0; i < dotCount; i++) {
        this.currentDots.push({
          deviceId: device.id,
          progress: i / dotCount,
          speed: 0.0005 + Math.random() * 0.00025,
          radius: 3,
          traceLength
        })
      }
    }
  }
  
  getPathLength(path) {
    let length = 0
    for (let i = 1; i < path.length; i++) {
      const dx = path[i].x - path[i-1].x
      const dy = path[i].y - path[i-1].y
      length += Math.sqrt(dx * dx + dy * dy)
    }
    return length
  }
  
  getPointOnPath(path, progress) {
    const totalLength = this.getPathLength(path)
    const targetLength = totalLength * progress
    let currentLength = 0
    
    for (let i = 1; i < path.length; i++) {
      const dx = path[i].x - path[i-1].x
      const dy = path[i].y - path[i-1].y
      const segmentLength = Math.sqrt(dx * dx + dy * dy)
      
      if (currentLength + segmentLength >= targetLength) {
        const t = (targetLength - currentLength) / segmentLength
        return {
          x: path[i-1].x + dx * t,
          y: path[i-1].y + dy * t
        }
      }
      currentLength += segmentLength
    }
    
    return { x: path[path.length-1].x, y: path[path.length-1].y }
  }
  
  updateStatus(statusArray) {
    this.deviceStatus = {}
    for (const s of statusArray) {
      this.deviceStatus[s.id] = s
    }
  }
  
  update(deltaTime) {
    this.time += deltaTime
    
    for (const dot of this.currentDots) {
      const deviceStatus = this.deviceStatus[dot.deviceId]
      if (deviceStatus && deviceStatus.online) {
        dot.progress += dot.speed * deltaTime
        if (dot.progress > 1) dot.progress -= 1
      }
    }
  }
  
  draw() {
    const ctx = this.ctx
    ctx.clearRect(0, 0, this.width, this.height)
    
    this.drawMainTraces()
    this.drawVias()
    this.drawCurrentDots()
    this.drawSparks()
    this.drawChargingTraces()
    this.drawSurges()
  }
  
  drawMainTraces() {
    const ctx = this.ctx
    const center = this.config.LAYOUT_POSITIONS['esp32-wol']
    
    for (const device of this.config.DEVICES) {
      if (device.id === 'esp32-wol') continue
      const path = this.tracePaths[device.id]
      if (!path) continue
      
      const status = this.deviceStatus[device.id]
      const isOnline = status && status.online
      
      ctx.beginPath()
      ctx.moveTo(path[0].x, path[0].y)
      for (let i = 1; i < path.length; i++) {
        ctx.lineTo(path[i].x, path[i].y)
      }
      
      if (isOnline) {
        ctx.strokeStyle = this.config.COLORS.traceActive
        ctx.lineWidth = 4
        ctx.shadowColor = this.config.COLORS.traceActive
        ctx.shadowBlur = 20
      } else if (status && status.online === false) {
        ctx.strokeStyle = this.config.COLORS.traceIdle
        ctx.lineWidth = 2.5
        ctx.shadowBlur = 0
      } else {
        ctx.strokeStyle = this.config.COLORS.traceDead
        ctx.lineWidth = 2
        ctx.shadowBlur = 0
      }
      
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.stroke()
      ctx.shadowBlur = 0
    }
  }
  
  drawVias() {
    const ctx = this.ctx
    const center = this.config.LAYOUT_POSITIONS['esp32-wol']
    
    for (const device of this.config.DEVICES) {
      if (device.id === 'esp32-wol') continue
      const path = this.tracePaths[device.id]
      if (!path) continue
      
      const status = this.deviceStatus[device.id]
      const isOnline = status && status.online
      
      for (let i = 1; i < path.length - 1; i++) {
        const via = path[i]
        
        ctx.beginPath()
        ctx.arc(via.x, via.y, isOnline ? 6 : 4, 0, Math.PI * 2)
        ctx.fillStyle = isOnline ? this.config.COLORS.traceActive : this.config.COLORS.traceIdle
        ctx.globalAlpha = isOnline ? 1 : 0.5
        ctx.shadowColor = isOnline ? this.config.COLORS.traceActive : this.config.COLORS.traceIdle
        ctx.shadowBlur = isOnline ? 12 : 0
        ctx.fill()
        
        ctx.beginPath()
        ctx.arc(via.x, via.y, isOnline ? 3.5 : 2.5, 0, Math.PI * 2)
        ctx.fillStyle = this.config.COLORS.bgBase
        ctx.globalAlpha = 1
        ctx.shadowBlur = 0
        ctx.fill()
      }
      
      const end = path[path.length - 1]
      ctx.beginPath()
      ctx.arc(end.x, end.y, isOnline ? 8 : 5, 0, Math.PI * 2)
      ctx.fillStyle = isOnline ? this.config.COLORS.traceActive : this.config.COLORS.traceIdle
      ctx.globalAlpha = isOnline ? 1 : 0.5
      ctx.shadowColor = isOnline ? this.config.COLORS.traceActive : this.config.COLORS.traceIdle
      ctx.shadowBlur = isOnline ? 15 : 0
      ctx.fill()
      
      ctx.beginPath()
      ctx.arc(end.x, end.y, isOnline ? 4 : 3, 0, Math.PI * 2)
      ctx.fillStyle = this.config.COLORS.bgBase
      ctx.globalAlpha = 1
      ctx.shadowBlur = 0
      ctx.fill()
    }
    
    ctx.beginPath()
    ctx.arc(center.x, center.y, 10, 0, Math.PI * 2)
    ctx.fillStyle = this.config.COLORS.nodeCenter
    ctx.shadowColor = this.config.COLORS.nodeCenter
    ctx.shadowBlur = 20
    ctx.fill()
    
    ctx.beginPath()
    ctx.arc(center.x, center.y, 5, 0, Math.PI * 2)
    ctx.fillStyle = this.config.COLORS.bgBase
    ctx.shadowBlur = 0
    ctx.fill()
    
    ctx.shadowBlur = 0
    ctx.globalAlpha = 1
  }
  
  drawCurrentDots() {
    const ctx = this.ctx
    
    for (const dot of this.currentDots) {
      const deviceStatus = this.deviceStatus[dot.deviceId]
      if (!deviceStatus || !deviceStatus.online) continue
      
      const path = this.tracePaths[dot.deviceId]
      if (!path) continue
      
      const point = this.getPointOnPath(path, dot.progress)
      
      ctx.beginPath()
      ctx.arc(point.x, point.y, dot.radius, 0, Math.PI * 2)
      const gradient = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, dot.radius * 2.5)
      gradient.addColorStop(0, this.config.COLORS.particleDot)
      gradient.addColorStop(0.4, this.config.COLORS.particleDot)
      gradient.addColorStop(1, 'rgba(255,140,0,0)')
      ctx.fillStyle = gradient
      ctx.shadowColor = this.config.COLORS.particleDot
      ctx.shadowBlur = 15
      ctx.fill()
      ctx.shadowBlur = 0
    }
  }
  
  drawSparks() {
    if (!this.sparks || this.sparks.length === 0) return
    
    const ctx = this.ctx
    const stillActive = []
    
    for (const spark of this.sparks) {
      const path = this.tracePaths[spark.deviceId]
      if (!path) continue
      
      const point = this.getPointOnPath(path, spark.progress)
      if (!isFinite(point.x) || !isFinite(point.y)) continue
      
      spark.trail.push({ x: point.x, y: point.y, life: 1 })
      
      if (spark.trail.length > 25) spark.trail.shift()
      
      for (const t of spark.trail) {
        t.life -= 0.05
        const alpha = Math.max(0, Math.min(1, t.life))
        if (alpha <= 0) continue
        const radius = spark.radius * alpha
        if (!isFinite(radius) || radius <= 0.5) continue
        if (!isFinite(t.x) || !isFinite(t.y)) continue
        
        ctx.beginPath()
        ctx.arc(t.x, t.y, radius, 0, Math.PI * 2)
        const gradient = ctx.createRadialGradient(t.x, t.y, 0, t.x, t.y, radius)
        gradient.addColorStop(0, this.config.COLORS.sparkColor)
        gradient.addColorStop(0.3, this.config.COLORS.sparkGlow)
        gradient.addColorStop(0.7, this.config.COLORS.particleDot)
        gradient.addColorStop(1, 'rgba(255,140,0,0)')
        ctx.fillStyle = gradient
        ctx.shadowColor = this.config.COLORS.sparkGlow
        ctx.shadowBlur = 25 * alpha
        ctx.globalAlpha = alpha
        ctx.fill()
      }
      
      if (!isFinite(point.x) || !isFinite(point.y) || !isFinite(spark.radius) || spark.radius <= 0.5) {
      } else {
        ctx.beginPath()
        ctx.arc(point.x, point.y, spark.radius, 0, Math.PI * 2)
        const coreGradient = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, spark.radius)
        coreGradient.addColorStop(0, '#ffffff')
        coreGradient.addColorStop(0.1, this.config.COLORS.sparkColor)
        coreGradient.addColorStop(0.3, this.config.COLORS.sparkGlow)
        coreGradient.addColorStop(0.6, this.config.COLORS.particleDot)
        coreGradient.addColorStop(1, 'rgba(255,140,0,0)')
        ctx.fillStyle = coreGradient
        ctx.shadowColor = this.config.COLORS.sparkGlow
        ctx.shadowBlur = 35
        ctx.globalAlpha = 1
        ctx.fill()
      }
      ctx.shadowBlur = 0
      ctx.globalAlpha = 1
      
      spark.progress += spark.speed
      
      if (spark.progress >= 1) {
        if (spark.onComplete) spark.onComplete()
      } else {
        stillActive.push(spark)
      }
    }
    
    this.sparks = stillActive
  }
  
  drawChargingTraces() {
    if (!this.chargingTraces || Object.keys(this.chargingTraces).length === 0) return
    
    const ctx = this.ctx
    let hasActive = false
    
    for (const [deviceId, charge] of Object.entries(this.chargingTraces)) {
      const path = this.tracePaths[deviceId]
      if (!path) continue
      
      const deviceStatus = this.deviceStatus[deviceId]
      if (deviceStatus && deviceStatus.online) {
        delete this.chargingTraces[deviceId]
        continue
      }
      
      hasActive = true
      
      ctx.beginPath()
      ctx.moveTo(path[0].x, path[0].y)
      for (let i = 1; i < path.length; i++) {
        ctx.lineTo(path[i].x, path[i].y)
      }
      ctx.strokeStyle = this.config.COLORS.nodeWaiting
      ctx.lineWidth = 2.5
      ctx.setLineDash([6, 10])
      ctx.lineDashOffset = -this.time * 0.2
      ctx.globalAlpha = 0.4 + 0.2 * Math.sin(this.time * 0.01)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.globalAlpha = 1
      
      for (const dotProgress of charge.dots) {
        const point = this.getPointOnPath(path, (dotProgress + this.time * 0.0004) % 1)
        ctx.beginPath()
        ctx.arc(point.x, point.y, 4, 0, Math.PI * 2)
        ctx.fillStyle = this.config.COLORS.nodeWaiting
        ctx.shadowColor = this.config.COLORS.nodeWaiting
        ctx.shadowBlur = 12
        ctx.globalAlpha = 0.6 + 0.2 * Math.sin(this.time * 0.01)
        ctx.fill()
        ctx.shadowBlur = 0
        ctx.globalAlpha = 1
      }
    }
  }
  
  drawSurges() {
    if (!this.surges || this.surges.length === 0) return
    
    const ctx = this.ctx
    const stillActive = []
    
    for (const surge of this.surges) {
      const path = this.tracePaths[surge.deviceId]
      if (!path) continue
      
      const point = this.getPointOnPath(path, surge.progress)
      if (!isFinite(point.x) || !isFinite(point.y)) continue
      
      surge.trail.push({ x: point.x, y: point.y, life: 1 })
      
      if (surge.trail.length > 35) surge.trail.shift()
      
      for (const t of surge.trail) {
        t.life -= 0.03
        const alpha = Math.max(0, Math.min(1, t.life))
        if (alpha <= 0) continue
        const radius = surge.radius * alpha * 1.5
        if (!isFinite(radius) || radius <= 0.5) continue
        if (!isFinite(t.x) || !isFinite(t.y)) continue
        
        ctx.beginPath()
        ctx.arc(t.x, t.y, radius, 0, Math.PI * 2)
        const gradient = ctx.createRadialGradient(t.x, t.y, 0, t.x, t.y, radius)
        gradient.addColorStop(0, this.config.COLORS.connectionSurge)
        gradient.addColorStop(0.2, this.config.COLORS.sparkGlow)
        gradient.addColorStop(0.5, this.config.COLORS.particleDot)
        gradient.addColorStop(1, 'rgba(255,140,0,0)')
        ctx.fillStyle = gradient
        ctx.shadowColor = this.config.COLORS.sparkGlow
        ctx.shadowBlur = 50 * alpha
        ctx.globalAlpha = alpha * 0.7
        ctx.fill()
      }
      
      if (!isFinite(point.x) || !isFinite(point.y) || !isFinite(surge.radius) || surge.radius <= 0.5) {
      } else {
        ctx.beginPath()
        ctx.arc(point.x, point.y, surge.radius * 1.2, 0, Math.PI * 2)
        const coreGradient = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, surge.radius * 1.2)
        coreGradient.addColorStop(0, '#ffffff')
        coreGradient.addColorStop(0.08, this.config.COLORS.connectionSurge)
        coreGradient.addColorStop(0.2, this.config.COLORS.sparkColor)
        coreGradient.addColorStop(0.5, this.config.COLORS.sparkGlow)
        coreGradient.addColorStop(0.8, this.config.COLORS.particleDot)
        coreGradient.addColorStop(1, 'rgba(255,140,0,0)')
        ctx.fillStyle = coreGradient
        ctx.shadowColor = this.config.COLORS.sparkGlow
        ctx.shadowBlur = 60
        ctx.globalAlpha = 1
        ctx.fill()
      }
      ctx.shadowBlur = 0
      ctx.globalAlpha = 1
      
      surge.progress += surge.speed
      
      if (surge.progress >= 1) {
        if (surge.onComplete) surge.onComplete()
      } else {
        stillActive.push(surge)
      }
    }
    
    this.surges = stillActive
  }
  
  animate() {
    const now = performance.now()
    const deltaTime = this.lastTime ? now - this.lastTime : 16
    this.lastTime = now
    
    this.update(deltaTime)
    this.draw()
    
    this.animationId = requestAnimationFrame(() => this.animate())
  }
  
  start() {
    this.lastTime = performance.now()
    this.animate()
  }
  
  stop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId)
      this.animationId = null
    }
  }
  
  triggerSpark(deviceId, onComplete) {
    const path = this.tracePaths[deviceId]
    if (!path) {
      console.log('triggerSpark: path not found for', deviceId)
      if (onComplete) onComplete()
      return
    }
    
    console.log('triggerSpark: starting spark for', deviceId)
    const spark = {
      deviceId,
      progress: 0,
      speed: 0.025,
      radius: 8,
      trail: [],
      active: true,
      onComplete
    }
    
    this.sparks = this.sparks || []
    this.sparks.push(spark)
  }
  
  triggerChargeTrace(deviceId) {
    const path = this.tracePaths[deviceId]
    if (!path) return
    
    this.chargingTraces = this.chargingTraces || {}
    this.chargingTraces[deviceId] = {
      progress: 0,
      dots: Array.from({ length: 12 }, (_, i) => i / 12)
    }
  }
  
  stopChargeTrace(deviceId) {
    if (this.chargingTraces) {
      delete this.chargingTraces[deviceId]
    }
  }
  
  triggerSurge(deviceId, onComplete) {
    const path = this.tracePaths[deviceId]
    if (!path) {
      if (onComplete) onComplete()
      return
    }
    
    const surge = {
      deviceId,
      progress: 0,
      speed: 0.035,
      radius: 12,
      trail: [],
      active: true,
      onComplete
    }
    
    this.surges = this.surges || []
    this.surges.push(surge)
  }
}

window.CircuitCanvas = CircuitCanvas