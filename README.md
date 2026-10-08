# Spectral Node

Spectral Node is a Windows Electron app that visualizes a Tailscale network as an animated circuit board. The renderer uses `pcb33.png` as its full-window PCB background and overlays live device cards, circuit traces, and animation effects.

## Features

- Live Tailscale status polling through the local Tailscale CLI
- Canvas-rendered circuit traces and animated status changes
- Optional Wake-on-LAN relay through a configured controller
- Frameless window with system-tray controls

## Requirements

- Windows
- Node.js 18 or newer and npm
- Tailscale installed and authenticated for live device status

## Run locally

```powershell
npm install
npm start
```

The sample configuration is in `config.example.js`. To keep personal device names and addresses out of Git, copy it to `config.local.js` and edit that local file. `config.local.js` is ignored by Git and takes precedence over the sample.

Configure each device's `tailscaleIP` to match its Tailscale address. For a Wake-on-LAN target, set `canWake` to `true` and configure `wakeUDP` with the controller's address, port, and payload. The example values are placeholders and will not match a real network.

## Build

```powershell
npm run build
```

The Windows NSIS installer is written to `dist/`. The PCB background is included in the packaged app.

## Project structure

```text
spectral-node/
├── assets/                 # App and tray icons
├── renderer/               # Window markup, styles, canvas, and UI logic
├── config.example.js       # Generic sample network configuration
├── config.js               # Loads local config or the sample
├── main.js                 # Electron main process, Tailscale polling, and UDP
├── pcb33.png               # PCB artwork used by the renderer
├── preload.js              # Renderer IPC bridge
└── package.json            # Dependencies and Windows build settings
```
