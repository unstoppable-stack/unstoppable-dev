# Tool Schema Best Practices

## Install Zod v4

`@qvac/sdk` depends on Zod v4 internally. Install `zod@^4` (not v3):
```bash
npm i zod@^4
```
If you have Zod v3 installed, `ToolInput` types will produce confusing TypeScript errors.

## Use Base Zod Types Only

The QVAC SDK's Zod instance only supports base shapes. Avoid chained refinements.

### Good
```ts
parameters: z.object({
  query: z.string().describe('Search query'),
  limit: z.number().describe('Max results')
})
```

### Bad
```ts
parameters: z.object({
  query: z.string().min(1).max(100),  // ❌ refinements
  limit: z.number().integer().min(1)   // ❌ .integer() not supported
})
```

## Validate in the Handler

```ts
handler: async ({ query, limit }) => {
  if (!query || query.length > 100) return { error: 'Invalid query' }
  const safeLimit = Math.max(1, Math.min(50, Math.floor(limit)))
  // ... use safeLimit
}
```

## Handler Contract

- Receives `Record<string, unknown>` matching the schema shape
- Must return JSON-serializable value (object, string, number, boolean, array)
- If handler throws, `call.invoke()` rejects — catch errors and return structured payloads
