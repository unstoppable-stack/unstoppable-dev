# 06 — UI Patterns in Pear Desktop

## React in Pear

Pear Desktop uses standard React (v19) loaded in the Chromium renderer. The browser context supports all standard Web APIs — it's essentially React in Electron.

### Entry Point Chain

```
index.html
  └── <script src="./dist/src/live-reload.js">
        └── import("./index")  (React app)
              └── createRoot(document.getElementById("root"))
              └── render(<App />)
```

### Important: What the Renderer CAN Use

- All DOM APIs
- `fetch()` for HTTP requests
- `localStorage` / `sessionStorage`
- `WebSocket`
- `TextEncoder` / `TextDecoder`
- `URL` / `URLSearchParams`
- `crypto.subtle` (Web Crypto)
- CSS animations, transitions
- Web Workers (browser-level, not Pear workers)
- `window.dispatchEvent()` / `window.addEventListener()`

### Important: What the Renderer CANNOT Use

- `node:*` modules
- `bare-*` modules
- `hyperswarm`, `hypercore`, `hyperbee`
- `@qvac/sdk`
- Any npm package that transitively imports the above

## The `<pear-ctrl>` Custom Element

Every Pear Desktop app should include `<pear-ctrl>` for native window controls:

```html
<div id="bar"><pear-ctrl></pear-ctrl></div>
```

```css
#bar {
  -webkit-app-region: drag;    /* Makes the bar draggable */
  height: 40px;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 9999;
}

/* macOS: shorter bar, traffic lights at top-left */
#bar:has(pear-ctrl[data-platform="darwin"]) {
  height: 24px;
}

pear-ctrl[data-platform="darwin"] {
  margin-top: 10px;
  margin-left: 8px;
}

/* Account for the fixed bar */
#root {
  padding-top: 24px;
}
```

The `<pear-ctrl>` element renders platform-specific window controls:
- **macOS**: Traffic light buttons (close, minimize, maximize)
- **Windows/Linux**: Standard minimize/maximize/close buttons

## State Management: Zustand

The workbench uses Zustand (not Redux, not Context alone) for state management:

```typescript
import { create } from "zustand"

interface ProjectStore {
  projects: Project[]
  currentProjectId: string | null
  addProject: (project: Project) => void
  setCurrentProject: (id: string) => void
}

const useProjectStore = create<ProjectStore>((set) => ({
  projects: [],
  currentProjectId: null,
  addProject: (project) =>
    set((state) => ({ projects: [...state.projects, project] })),
  setCurrentProject: (id) => set({ currentProjectId: id }),
}))
```

### Persistence with WorkerClient

State that needs to persist across restarts is stored via the worker (in Hyperbee), not in localStorage:

```typescript
// Save to P2P storage (via worker)
await workerClient.setItem("settings", JSON.stringify(settings))

// Load from P2P storage
const raw = await workerClient.getItem("settings")
const settings = raw ? JSON.parse(raw) : defaults
```

For non-P2P persistence, `localStorage` works in the renderer (it's a browser).

## Styled Components

The workbench uses styled-components v6 for CSS-in-JS:

```typescript
import styled from "styled-components"

const ChatContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  background: ${props => props.theme.background};
`

const MessageBubble = styled.div<{ $isUser: boolean }>`
  background: ${props => props.$isUser ? "#0066cc" : "#2a2a2a"};
  border-radius: 12px;
  padding: 8px 12px;
`
```

Component organization pattern:
```
components/
├── ChatPanel/
│   ├── ChatPanel.tsx      # Component logic
│   └── styles.ts          # Styled components
├── Sidebar/
│   ├── Sidebar.tsx
│   └── styles.ts
```

## Hook-Based Architecture

The app uses custom hooks to separate concerns:

| Hook | Responsibility |
|------|---------------|
| `useChatLogic` | Chat input, message sending, keyboard events |
| `useFileHandling` | File uploads, drag-drop, RAG document processing |
| `useProjectManagement` | Project CRUD, thread creation, navigation |
| `useModelState` | Model loading, progress, configuration |
| `CoreAppContext` | Shared state (projects, threads, messages, refs) |

### Composition Pattern

```typescript
function ChatPage() {
  const { projects, currentProject } = useCoreAppContext()
  const { input, setInput, sendMessage } = useChatLogic()
  const { isLoading, modelInfo } = useModelState()

  return (
    <ChatContainer>
      <MessageList messages={currentProject?.messages ?? []} />
      <InputBar
        value={input}
        onChange={setInput}
        onSend={sendMessage}
        disabled={isLoading}
      />
    </ChatContainer>
  )
}
```

## Streaming UI Updates

AI completions stream tokens from the worker. The UI updates incrementally:

```typescript
// In the store/workerClient handler
case "token":
  // Append token to current message
  useThreadStore.getState().appendToken(message.data)
  break

case "end":
  // Completion finished, show stats
  useThreadStore.getState().completeMessage(message.data)
  break
```

The key to smooth streaming:
1. Worker batches tokens (flush every ~150ms, not per-token)
2. UI appends to existing string (not re-rendering full message)
3. Auto-scroll follows new content

## Event Bridge: Worker → Store

The workbench uses `window.dispatchEvent()` to bridge worker events to React:

```typescript
// In workerClient.ts (when receiving data updates from worker)
window.dispatchEvent(
  new CustomEvent("autobase-update", {
    detail: { key: message.key }
  })
)

// In a React hook
useEffect(() => {
  const handler = (e: CustomEvent) => {
    refreshData(e.detail.key)
  }
  window.addEventListener("autobase-update", handler)
  return () => window.removeEventListener("autobase-update", handler)
}, [])
```

This pattern avoids tight coupling between the worker client and React components.

## Portal Pattern for Modals

The HTML includes a dedicated portal root:

```html
<div id="root"></div>
<div id="portal"></div>  <!-- For modals, dropdowns, tooltips -->
```

React portals render modals outside the main tree to avoid CSS stacking issues:

```typescript
import { createPortal } from "react-dom"

function Modal({ children }) {
  return createPortal(children, document.getElementById("portal")!)
}
```
