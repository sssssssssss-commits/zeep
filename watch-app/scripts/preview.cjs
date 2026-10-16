const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')
const QRCode = require('qrcode')

const root = path.resolve(__dirname, '..')
const devices = [
  'Amazfit Active 2 (Round)',
  'Amazfit Active 2 (Square)',
  'Amazfit Active 2 NFC (Round)',
  'Amazfit Active 2 NFC (Square)'
].join(',')

function runZeus(args) {
  return new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      [
        '-r',
        path.join(__dirname, 'capture-qr.cjs'),
        path.join(root, 'node_modules', '@zeppos', 'zeus-cli', 'bin', 'main.js'),
        ...args
      ],
      { cwd: root, stdio: 'inherit' }
    )
    child.on('exit', (code) => resolve(code || 0))
  })
}

async function main() {
  if (process.argv.includes('--relogin')) {
    const loggedOut = await runZeus(['logout'])
    if (loggedOut !== 0) process.exit(loggedOut)
  }
  // Login in its own process. zeus preview otherwise starts two logins and hangs.
  const loggedIn = await runZeus(['login'])
  if (loggedIn !== 0) process.exit(loggedIn)
  const previewed = await runZeus(['preview', '-s', '-t', devices])
  const urlFile = path.join(root, 'dist', 'install-url.txt')
  if (!fs.existsSync(urlFile)) process.exit(previewed || 1)
  const url = fs.readFileSync(urlFile, 'utf8').trim()
  const png = path.join(root, 'dist', 'install-qr.png')
  await QRCode.toFile(png, url, { width: 512, margin: 2 })
  console.log(`安装二维码已保存：${png}`)
  process.exit(previewed)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
