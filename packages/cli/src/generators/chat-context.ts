import { runtimeSources } from '../generated/runtime-ai.js'

/** Legacy test/export seam; apps consume the runtime package directly. */
export const chatContextSource = runtimeSources['history.js']
