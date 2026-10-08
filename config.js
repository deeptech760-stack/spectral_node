const fs = require('fs')
const path = require('path')

const localConfigPath = path.join(__dirname, 'config.local.js')
const configPath = fs.existsSync(localConfigPath)
  ? localConfigPath
  : path.join(__dirname, 'config.example.js')
const config = require(configPath)

if (typeof module !== 'undefined' && module.exports) {
  module.exports = config
}

if (typeof window !== 'undefined') {
  Object.assign(window, config)
}
