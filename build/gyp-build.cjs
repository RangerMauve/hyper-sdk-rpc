module.exports = load
function load (...args) {
  // const stack = new Error().stack
  // const origin = stack.split('\n')[2].split(/\s+/)[2].split('/')[1]
  // console.log('loading', args, origin)

  // TODO: How do we handle other modules?
  return require('sea-gyp')('udx-native')
}
