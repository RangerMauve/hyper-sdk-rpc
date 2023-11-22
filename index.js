import StreamValues from 'stream-json/streamers/StreamValues.js'

export const PROPERTY = 'property'
export const METHOD = 'method'
export const ON_EVENT = 'on'
export const OFF_EVENT = 'off'

export const ERR_INVALID_METHOD_SYNTAX = 'Invalid Method Syntax'
export const ERR_NOT_FOUND = 'Method not found'
export const ERR_NOT_LISTENING = 'Listener not registered'

export const CODE_ERR_SERVER = -32000

const SDK_NAME = 'sdk.'
const JSON_RPC_VERSION = '2.0'

const ON_START = 'on("'
const OFF_START = 'off("'
const EVENT_END = '")'
const METHOD_START = '('
const METHOD_END = ')'
const LISTENER_SPLIT = '-'

export class ClientConnection {
  constructor (connection) {
    this.id = 0
    this.connection = connection
    this.waiting = new Map()
    // id => function
    this.listeners = new Map()
    // method => Set<id>
    this.reverseListeners = new Map()
  }

  async process () {
    const parser = StreamValues.withParser()
    // TODO: error handling
    this.connection.pipe(parser)

    for await (const { value: response } of parser) {
      const { id } = response
      // TODO: handle unknown IDs
      // TODO: Handle notifications by emitting events
      const deferred = this.waiting.get(id)
      if (deferred) {
        deferred.resolve(response)
      } else if (this.listeners.has(id)) {
        this.listeners.get(id)(...response.result)
      } else {
        throw new Error(ERR_NOT_FOUND)
      }
    }

    // prase connection with json stream
    // iterate over it
    // invoke request
    // write response as ndjson
  }

  async write (data) {
    const encoded = JSON.stringify(data)
    this.connection.write(encoded)
    this.connection.write('\n')
  }

  async on (path, event, listener, params = {}) {
    const id = this.id++
    const method = `${path}.on("${event}")`
    const key = `${path}:${event}${JSON.stringify(params)}`
    await this.call(method, params)
    if (!this.reverseListeners.has(key)) {
      this.reverseListeners.set(key, new Set())
    }
    this.listeners.set(id, listener)
    this.reverseListeners.get(key).add(id)
  }

  async off (path, event, listener, params = {}) {
    const method = `${path}.off("${event}")`
    const key = `${path}:${event}${JSON.stringify(params)}`
    if (!this.reverseListeners.has(key)) {
      throw new Error(ERR_NOT_LISTENING)
    }
    let foundId = null
    for (const id of this.reverseListeners.get(key)) {
      if (this.listeners.get(id) === listener) {
        foundId = id
      }
    }
    if (!foundId) {
      throw new Error(ERR_NOT_LISTENING)
    }
    await this.call(method, params, foundId)
    this.listeners.delete(foundId)
    this.reverseListeners.get(key).delete(foundId)
  }

  async call (method, params = {}, id = this.id++) {
    const deferred = new Deferred()
    this.waiting.set(id, deferred)

    this.write({
      jsonrpc: JSON_RPC_VERSION,
      id,
      method,
      params
    })

    const response = await deferred

    if (response.error) {
      const { code, message, data } = response.error

      const error = new Error(message)
      error.code = code
      error.data = data
      throw error
    }

    return response.result
  }
}

export class ServerConnection {
  constructor (sdk, connection) {
    this.sdk = sdk
    this.connection = connection
    // method+id => {listener, id}
    this.listeners = new Map()
  }

  async process () {
    const parser = StreamValues.withParser()
    // TODO: error handling
    this.connection.pipe(parser)

    for await (const { value: request } of parser) {
      const response = await this.invoke(request)
      this.write(response)
    }
    // prase connection with json stream
    // iterate over it
    // invoke request
    // write response as ndjson
  }

  async write (data) {
    const encoded = JSON.stringify(data)
    this.connection.write(encoded)
    this.connection.write('\n')
  }

  async call (method, params, id) {
    const sections = parseMethod(method.slice(SDK_NAME.length))

    return sections.reduce(async (objectPromise, section) => {
      const object = await objectPromise
      const { type, property, params: paramNames } = section

      if (type === ON_EVENT) {
        const key = makeListenerKey(method, id)
        // TODO: check for duplicate listeners
        const listener = (...result) => this.write({
          jsonrpc: JSON_RPC_VERSION,
          id,
          result
        })
        this.listeners.set(key, listener)
        object.on(property, listener)
        return null
      } else if (type === OFF_EVENT) {
        const key = makeListenerKey(method, id)
        const listener = this.listeners.get(key)
        if (!listener) {
          throw new Error(ERR_NOT_LISTENING)
        }
        object.removeListener(property, listener)
        return null
      } else if (type === METHOD) {
        const args = paramNames.map((name) => params[name])
        const value = await object[property](...args)
        if (value && value[Symbol.asyncIterator]) {
          return collect(value)
        }
        return value
      } else if (type === PROPERTY) {
        return object[property]
      } else {
        throw new Error(ERR_INVALID_METHOD_SYNTAX)
      }
    }, this.sdk)
  }

  async invoke ({ method, id, params }) {
    try {
      if (!method.startsWith(SDK_NAME)) {
        throw new Error(ERR_NOT_FOUND)
      }
      // TODO: Verify method name and params against the schema
      const result = await this.call(method, params, id)

      return {
        jsonrpc: JSON_RPC_VERSION,
        id,
        result
      }
    } catch (e) {
      // TODO: log errors?
      return {
        jsonrpc: JSON_RPC_VERSION,
        id,
        error: {
          code: CODE_ERR_SERVER,
          message: e.stack
        }
      }
    }
  }
}

export function parseMethod (method) {
  const sections = method.split('.')

  return sections.map((section) => {
    if (!section.includes(METHOD_START)) {
      return {
        property: section,
        type: PROPERTY
      }
    } else if (section.startsWith(ON_START)) {
      if (!section.endsWith(EVENT_END)) {
        throw new Error(ERR_INVALID_METHOD_SYNTAX)
      }

      const property = section.slice(ON_START.length, -EVENT_END.length)

      return {
        property,
        type: ON_EVENT
      }
    } else if (section.startsWith(OFF_START)) {
      if (!section.endsWith(EVENT_END)) {
        throw new Error(ERR_INVALID_METHOD_SYNTAX)
      }

      const property = section.slice(OFF_START.length, -EVENT_END.length)

      return {
        property,
        type: OFF_EVENT
      }
    } else {
      if (!section.endsWith(METHOD_END)) {
        throw new Error(ERR_INVALID_METHOD_SYNTAX)
      }

      const [property, rawParams] = section.split(METHOD_START)
      const params = rawParams === METHOD_END ? [] : rawParams.slice(0, -METHOD_END.length).split(',')

      return {
        property,
        type: METHOD,
        params
      }
    }
  })
}

// Exported just for testing
export class Deferred {
  constructor () {
    this.promise = new Promise((resolve, reject) => {
      this.resolve = resolve
      this.reject = reject
    })
  }

  then (...args) {
    return this.promise.then(...args)
  }
}

function makeListenerKey (property, id) {
  return id + LISTENER_SPLIT + property
}

/*
function parseListenerKey (key) {
  const [id, ...eventSegments] = key.split(LISTENER_SPLIT)
  const property = eventSegments.join(LISTENER_SPLIT)

  return { property, id }
}
*/

async function collect (iterator) {
  const buffer = []
  for await (const chunk of iterator) {
    buffer.push(chunk)
  }

  return buffer
}
