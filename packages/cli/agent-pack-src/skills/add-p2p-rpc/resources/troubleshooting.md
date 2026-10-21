# P2P RPC — Troubleshooting

> **Legacy custom transport/storage reference only.** New apps use
> `@unstoppable-stack/p2p` through `/service`, `/rpc`, `/data` or `/sync`.
> Read the parent skill first. These snippets do not implement the library
> protocol or its pairing/grants; do not layer them around managed helpers.


## `TypeError: rpc.register is not a function`
- `bare-rpc` does NOT have a `register()` method — that API does not exist
- Use the `createRPCServer` / `createRPCClient` wrapper pattern instead
- The raw API uses `new RPC(stream, handler)` with a single request handler function

## `TypeError: rpc.destroy is not a function`
- `bare-rpc` does NOT have a `destroy()` method
- To clean up, call `socket.destroy()` on the underlying stream instead

## `Error: No binaries found for target 'darwin-arm64'`
- Add `shamefully-hoist=true` to your `.npmrc` file
- This is required for `bare-rpc` (and any package with Bare native binaries) in pnpm projects
- After adding, run `npm install` again

## Peers never connect / discovery fails
- Both peers MUST join with `{ server: true, client: true }` for mutual discovery
  (or use explicit server/client roles: one side `{ server: true, client: false }`, other `{ server: false, client: true }`)
- Use `const discovery = swarm.join(topic, opts); await discovery.flushed()` — NOT `await swarm.flush()`
- Ensure both sides join the same 32-byte topic

## Requests hang forever
- Ensure the server has a handler registered for the method you're calling
- Add a timeout to client requests (default 10s in the wrapper)
- Check that the RPC handler calls `req.reply()` or `req.createResponseStream()` — if neither is called, the client hangs
- Destroy sockets on close/error to reject pending requests

## `type` field collision in RPC messages
- **Do NOT use `type` as the routing field** in your RPC envelope
- Application payloads often have their own `type` field (e.g., `type: 'order'`)
- Use `method` instead: `{ method: 'submitOrder', payload: orderData }`
- This was a real bug: `OrderMessage` had `type: 'order'` which overwrote the routing `type: 'submitOrder'`

## Requests fail after disconnect
- Destroy the socket on both `close` and `error` events
- In the wrapper, `client.destroy()` / `server.destroy()` calls `socket.destroy()` internally
- This will reject pending promises on the client side

## Method not found errors
- Check the handler map has the exact method name (case-sensitive)
- Ensure you're using `{ method: 'name', payload: data }` envelope format

## Streaming responses don't arrive
- Ensure the server handler is an `async function*` generator that `yield`s values
- The server must call `stream.end()` after yielding all values
- Check that the client uses `for await...of client.stream()` to consume

## Memory leaks
- Create one RPC server/client per peer connection, not a global singleton
- Destroy sockets when peers disconnect
- For Protomux: clear timeouts when requests resolve or reject

## TypeScript: bare-rpc has no types
- Create a `types.d.ts` file with correct declarations (see full-example.md)
- The correct types use `RPC.IncomingRequest` and `RPC.OutgoingRequest` namespaces
- Do NOT use the incorrect register/request(string)/destroy types from older docs
