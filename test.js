import test from 'tape'
import net from 'node:net'
import getPort from 'get-port'

import DuplexPair from 'native-duplexpair'

import { ClientConnection, ServerConnection } from './index.js'

const SAMPLE_STRING = 'Hello World'

test('Call API from client on server', async function (t) {
  const { socket1: clientConnection, socket2: serverConnection } = new DuplexPair()

  const sdk = {
    example () {
      t.pass('Invoked method over rpc')
      return SAMPLE_STRING
    },
    get someProperty () {
      return SAMPLE_STRING
    },
    async * iterable () {
      yield 'Hello'
      yield 'World'
    }
  }

  const client = new ClientConnection(clientConnection)
  const server = new ServerConnection(sdk, serverConnection)

  client.process().catch((e) => t.fail(e))
  server.process().catch((e) => t.fail(e))

  const result = await client.call('sdk.example()')

  t.equal(result, SAMPLE_STRING, 'Got expected result from method')

  const someProperty = await client.call('sdk.someProperty')
  t.equal(someProperty, SAMPLE_STRING, 'Got expected result from property')

  const streamResult = await client.call('sdk.iterable()')

  t.deepEqual(streamResult, ['Hello', 'World'], 'Able to get async iterable into an array')
})

test('Call over TCP', async (t) => {
  const port = await getPort()
  const sdk = {
    example () {
      t.pass('Invoked method over rpc')
      return SAMPLE_STRING
    },
    get someProperty () {
      return SAMPLE_STRING
    }
  }

  const server = net.createServer(async (connection) => {
    const rpc = new ServerConnection(sdk, connection)
    t.pass('Able to set up server connection')
    try {
      await rpc.process()
      t.pass('Finished processing')
    } catch (e) {
      t.fail(e)
    }
  })
  try {
    await new Promise((resolve, reject) => {
      server.listen(port, (e) => {
        if (e) { reject(e) } else { resolve() }
      })
    })
    const clientConnection = net.connect(port)
    const client = new ClientConnection(clientConnection)
    client.process().catch((e) => t.fail(e))

    const result = await client.call('sdk.example()')

    t.equal(result, SAMPLE_STRING, 'Got expected result from method')

    const someProperty = await client.call('sdk.someProperty')
    t.equal(someProperty, SAMPLE_STRING, 'Got expected result from property')

    clientConnection.end()
  } finally {
    await new Promise((resolve, reject) => {
      server.close((e) => {
        if (e) { reject(e) } else { resolve() }
      })
    })
  }
})
