import { execSync } from 'node:child_process'
import { writeFile, copyFile, mkdir } from 'node:fs/promises'
import os from 'node:os'
import * as esbuild from 'esbuild'

const ARCH = process.env.npm_config_arch || os.arch()
const PLATFORM = process.env.npm_config_platform || os.platform()

const BUNDLE_FILE = 'build/bundle.cjs'
const BLOB_FILE = './build/hyper-sdk-rpc.blob'
let BIN_FILE = './build/hyper-sdk-rpc'
const SEA_CONFIG_FILE = './build/sea-config.json'

if (PLATFORM === 'win32') {
  BIN_FILE += '.exe'
}

const natives = [
  'sodium-native',
  'simdle-native',
  'quickbit-native',
  'crc-native',
  'udx-native',
  'fs-native-extensions'
]

const alias = {
  'node-gyp-build': './build/gyp-build.cjs',
  'sea-gyp': './build/sea-gyp.cjs'
}

// TODO: Calculate from node target
const buildType = `${PLATFORM}-${ARCH}`

await mkdir('./patches', { recursive: true })

for (const name of natives) {
  const patch = `./patches/${name}.cjs`
  genPatch(name, patch)

  copyBin(name)
  alias[name] = patch
}

delete alias['udx-native']

await esbuild.build({
  entryPoints: ['bin.js'],
  platform: 'node',
  bundle: true,
  outfile: BUNDLE_FILE,
  alias
})

const assets = {}

for (const name of natives) {
  assets[`${name}-bin`] = `./build/${name}.node`
}

const seaConfig = {
  main: BUNDLE_FILE,
  output: BLOB_FILE,
  assets
}

console.log('Writing SEA config')
await writeFile(
  SEA_CONFIG_FILE,
  JSON.stringify(seaConfig, null, '  ')
)

execSync(`node --experimental-sea-config ${SEA_CONFIG_FILE}`)

await copyFile(process.execPath, BIN_FILE)

console.log('Postjecting BIN')
execSync(`npx postject ${BIN_FILE} NODE_SEA_BLOB ${BLOB_FILE} --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2`)

async function copyBin (name) {
  await copyFile(
    `./node_modules/${name}/prebuilds/${buildType}/${name}.node`,
    `./build/${name}.node`
  )
}

async function genPatch (name, patch) {
  await writeFile(patch, `module.exports = require('sea-gyp')('${name}')`)
}
