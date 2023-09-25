# hyper-sdk-rpc
JSON-RPC wrapper for hyper-sdk to enable embedding into other applications.

## TODO:

- [ ] Pick JSON RPC library
- [ ] Codegen connections to hyper-sdk
	- [ ] invoke methods
	- [ ] access properties
	- [ ] subscribe to events
- [ ] Define JSON Schema for APIs
- [ ] Set up tcp server
- [ ] Set up cli
- [ ] publish binary
- [ ] Websocket server support


## RPC Schema

In order to facilitate codegen fo both the sdk and client applications, we have a JSON based format describing all the available APIs.
This format also handles specifying what sort of response can be expected.

In order to speed up client development we make use of the [JSON-RPC](https://www.jsonrpc.org/specification) specification.
hyper-sdk API calls are represented in the `method` field with psudocode like `sdk.get(url).mirror(location)` with the named arguments going into the `params` field like `{url:"hyper://whatever", location:"/dev/null"}`.

There are three types of method calls in the API:

- *Method Invocations*: When an api ends with barackets `()` it means a method will be invoked, and the return value will be placed in the response. Some JS apis are async and return promises, in which case the promise will be awaited before responding.
- *Property accessors*: When an api call ends without a method invocation like `sdk.publicKey`, the property will be accessed and returned in the response.
- *Event listeners*: When an api ends with `.on("event")` or `.off("event")` it will register or un register listeners for an event. Make sure to use the same `id` when calling `.on` or `.off`. Once subscribed you will start getting responses for each event of that type until invoking `.off("event")`.


### Binary data in RPC:

Everywhere that there is usage of binary data, it will be encoded in base64 when sent over the rpc bridge. This means that there's a major efficiency loss due to needing to parse the json and decode the base64 string.
When possible, you should make use of the `drive.mirror` API to save and load files from the filesystem.

## RPC methods:

```
sdk.getDrive(url).mirror(out)
```
