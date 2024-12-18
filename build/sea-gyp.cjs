const { dlopen } = require('node:process')
const { constants } = require('node:os')
const { join } = require('node:path')
const { writeFileSync } = require('node:fs')
const sea = require('node:sea')

let binCache = process.env.HYPER_RPC_STORAGE || __dirname

load.setBinCache = setBinCache
module.exports = load

function load (name) {
  const mod = {
    exports: {}
  }

  const binLoc = join(binCache, `${name}.node`)

  if (sea.isSea()) {
    const key = `${name}-bin`
    const value = sea.getRawAsset(key)
    writeFileSync(binLoc, new DataView(value))
  }

  dlopen(
    mod,
    binLoc,
    constants.dlopen.RTLD_NOW
  )

  return mod.exports
}

function setBinCache (location) {
  binCache = location
}
