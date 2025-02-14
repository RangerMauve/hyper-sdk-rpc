import net from 'node:net'
import * as SDK from 'hyper-sdk'
import { asyncExitHook } from 'exit-hook'
import { parseArgs } from 'node:util'

import { ServerConnection } from './index.js'

const DEFAULT_PORT = 4772 // HRPC on a dial pad

const options = {
  help: {
    type: 'boolean',
    short: 'h'
  }
}

main()

async function main () {
  const parsed = parseArgs({
    args: process.argv.slice(1),
    options,
    allowPositionals: true
  })

  if (parsed.values.help) {
    console.log('hyper-sdk-rpc --help')
    console.log('Set HYPER_RPC_PORT to change the port')
    console.log('Set HYPER_RPC_STORAGE to change the storage location')
    process.exit(0)
  }

  const port = process.env.HYPER_RPC_PORT ? parseInt(process.env.HYPER_RPC_PORT, 10) : DEFAULT_PORT
  const storage = process.env.HYPER_RPC_STORAGE || false

  // TODO: Pass storage location from args
  const sdk = await SDK.create({
    storage
  })

  let connectionCount = 0

  const server = net.createServer(async (connection) => {
    const id = connectionCount++
    console.log(id, 'Connected')
    const rpc = new ServerConnection(sdk, connection)
    try {
      await rpc.process()
    } catch (e) {
      console.error(id, e.stack)
    }
    console.log(id, 'Disconnected')
  })

  server.listen(port, () => {
    console.log(`Listening on tcp://localhost:${port}`)
  })

  asyncExitHook(async () => {
    console.log('closing')
    server.close()
    await sdk.close()
  }, { wait: 3000 })
}
