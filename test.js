import test from 'tape'
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
})
