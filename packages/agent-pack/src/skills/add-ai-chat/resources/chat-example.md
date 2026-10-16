# Extend the generated session

In a desktop worker, use the existing `ai` session. In Node, use `setupAI().session`. Do not create a second model/session for the same chat panel.

```js
await ai.load({ modelConstant, modelType: 'llm', modelConfig, onProgress })
for await (const token of ai.stream(history, { requestId, signal, onTrim })) {
  renderOrSendToken({ requestId, token })
}
// Stop from another task while the stream is actively being consumed:
await ai.cancel(requestId)
// On shutdown, after any active stream is being consumed/settled:
await ai.close()
```

Use the model/config already present in generated app code and its manifest. These names are app variables, not magic globals. Change prompts in the load options; keep dependency and model changes deliberate. The app owns history and whether a stopped partial answer is stored. A consumer breaking iteration also cancels native work. Keep consuming or return the iterator; do not suspend it and wait for cancellation settlement in the same loop body.
