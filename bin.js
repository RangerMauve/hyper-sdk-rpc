import net from 'node:net'
import * as SDK from 'hyper-sdk'
import { asyncExitHook } from 'exit-hook'

import { ServerConnection } from './index.js'

const DEFAULT_PORT = 4772 // HRPC on a dial pad

// TODO: get from cli args
const port = DEFAULT_PORT

// TODO: Pass storage location from args
const sdk = await SDK.create({
  storage: false
})

const server = net.createServer(async (connection) => {
  const rpc = new ServerConnection(sdk, connection)
  try {
    await rpc.process()
  } catch (e) {
    console.error(e.stack)
  }
})

server.listen(port, () => {
  console.log(`Listening on tcp://localhost:${port}`)
})

asyncExitHook(async () => {
  console.log('closing')
  server.close()
  await sdk.close()
}, { wait: 3000 })
