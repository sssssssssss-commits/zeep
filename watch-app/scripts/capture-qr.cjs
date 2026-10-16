const fs = require('fs')
const path = require('path')

const urlFile = path.resolve(process.cwd(), 'dist', 'install-url.txt')
const Module = require('module')
const aliasRoot = path.resolve(
  __dirname,
  '../node_modules/@zeppos/zeus-cli/private-modules/zeppos-app-utils'
)
const aliasName = 'zeppos-app-utils'
const originalResolve = Module._resolveFilename
const originalRequire = Module.prototype.require

// zeus-cli aliases this private package, but a hoisted module-alias reads the
// app package.json instead. Resolve the alias before that lookup.
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request === aliasName || request.startsWith(`${aliasName}/`)) {
    request = path.join(aliasRoot, request.slice(aliasName.length))
  }
  return originalResolve.call(this, request, parent, isMain, options)
}

function remember(url) {
  fs.mkdirSync(path.dirname(urlFile), { recursive: true })
  fs.writeFileSync(urlFile, String(url))
}

function hook(mod) {
  if (!mod || mod.__railQr || typeof mod.generate !== 'function') return
  const generate = mod.generate.bind(mod)
  mod.generate = (url, options) => {
    remember(url)
    return generate(url, options)
  }
  mod.__railQr = true
}

Module.prototype.require = function (id) {
  const loaded = originalRequire.apply(this, arguments)
  if (id === 'qrcode-terminal') {
    hook(loaded)
    hook(loaded && loaded.default)
  }
  return loaded
}
