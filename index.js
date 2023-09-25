import EventEmitter from 'events'

export const PROPERTY = 'property'
export const METHOD = 'method'
export const ON_EVENT = 'on'
export const OFF_EVENT = 'off'

export const ERR_INVALID_METHOD_SYNTAX = 'Invalid Method Syntax'
export const ERR_NOT_FOUND = 'Method not found'
export const CODE_ERR_SERVER = -32000

const SDK_NAME = 'sdk'
const JSON_RPC_VERSION = '2.0'

const ON_START = 'on("'
const OFF_START = 'off("'
const EVENT_END = '")'
const METHOD_START = '('
const METHOD_END = ')'

export class HyperSDKRPCClientConnection extends EventEmitter {
  constructor (connection) {
    super()
    this.id = 0
    this.connection = connection
    this.waiting = new Map()
  }

  async write (data) {
    const encoded = JSON.stringify(data)
    this.connection.write(encoded + '\n\n')
  }

  async call (method, params) {
    const id = this.id++

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

export class HyperSDKRPCServerConnection {
  constructor (sdk, connection) {
    this.sdk = sdk
    this.connection = connection
    // name+id => function
    this.listeners = new Map()
  }

  async process () {
    // prase connection with json stream
    // iterate over it
    // invoke request
    // write response as ndjson
  }

  async call (sections, params) {
    return sections.reduce(async (objectPromise, section) => {
      const object = await objectPromise
      const { type, property, params: paramNames } = section

      if (type === ON_EVENT) {
      } else if (type === OFF_EVENT) {
      } else if (type === METHOD) {
        const args = paramNames.map((name) => params[name])
        return object[property](...args)
      } else if (type === PROPERTY) {
        return object[property]
      } else {
        throw new Error(ERR_INVALID_METHOD_SYNTAX)
      }
    }, this.sdk)
  }

  async invoke ({ method, id, params }) {
    try {
      const [sdkName, ...sections] = parseMethod(method)

      if (sdkName !== SDK_NAME) {
        throw new Error(ERR_NOT_FOUND)
      }
      const result = await this.call(sections, params)

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
      const params = rawParams.slice(0, -METHOD_END.length).split(',')

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
