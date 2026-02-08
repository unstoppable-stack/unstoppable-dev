# Pear Desktop App — Full Working Example

A complete, minimal Pear desktop app with React, styled-components, and a dark
theme. These files are verified working — copy them to get a running desktop app.

## File: `index.js` (project root — Pear native entry point)

This file runs in the Pear/Bare runtime. It is NOT compiled by SWC.

```js
import Runtime from 'pear-electron'
import Bridge from 'pear-bridge'

const bridge = new Bridge({ waypoint: '/index.html' })
await bridge.ready()

const runtime = new Runtime()
const pipe = await runtime.start({ bridge })
pipe.on('close', () => Pear.exit())

Pear.teardown(() => pipe.destroy())
```

## File: `index.html` (web entrypoint loaded by the bridge)

```html
<!doctype html>
<html>
  <head>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { height: 100%; overflow: hidden; }
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
          "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans",
          "Helvetica Neue", sans-serif;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        background-color: #171817;
        color: #ECF1EE;
      }
      #bar {
        -webkit-app-region: drag;
        height: 24px;
        position: fixed;
        top: 0; left: 0; right: 0;
        z-index: 9999;
      }
      #bar:has(pear-ctrl[data-platform="darwin"]) {
        height: 24px;
      }
      #root { height: 100%; padding-top: 24px; }
      pear-ctrl[data-platform="darwin"] {
        margin-top: 6px;
        margin-left: 8px;
      }
    </style>
  </head>
  <body>
    <div id="bar"><pear-ctrl></pear-ctrl></div>
    <div id="root"></div>
    <script src="./dist/src/live-reload.js" type="module"></script>
  </body>
</html>
```

**Important:** The script src is `./dist/src/live-reload.js` because SWC
compiles `src/live-reload.ts` to `dist/src/live-reload.js` (it preserves the
`src/` directory inside `dist/`).

## File: `src/live-reload.ts` (bootstrap — NOT `app.ts`)

Named `live-reload.ts` to avoid case collision with `App.tsx` on macOS.

```ts
declare global {
  interface Window {
    $RefreshReg$?: (type: unknown, id: string) => void
    $RefreshSig$?: () => (type: unknown) => unknown
  }
}

interface RefreshRuntime {
  injectIntoGlobalHook: (window: Window) => void
  register: (type: unknown, id: string) => void
  createSignatureFunctionForTransform: () => (type: unknown) => unknown
}

async function initializeReactRefresh(): Promise<void> {
  try {
    // @ts-expect-error - no types for react-refresh/runtime
    const runtime = (await import('react-refresh/runtime')) as { default: RefreshRuntime }
    const RefreshRuntime = runtime.default
    RefreshRuntime.injectIntoGlobalHook(window)
    window.$RefreshReg$ = RefreshRuntime.register
    window.$RefreshSig$ = RefreshRuntime.createSignatureFunctionForTransform
  } catch (err) {
    console.error('Could not initialize React Refresh:', err)
  }
}

declare const Pear: any

if (typeof Pear !== 'undefined' && Pear.config?.dev) {
  void initializeReactRefresh()
}

void import('./index')

export {}
```

## File: `src/index.tsx`

```tsx
import { createRoot } from "react-dom/client"
import { ThemeProvider } from "styled-components"
import { App } from "./App.js"
import { darkTheme } from "./styles/theme.js"
import { GlobalStyles } from "./styles/GlobalStyles.js"

const rootElement = document.getElementById("root")
if (!rootElement) throw new Error("Root element not found")

const root = createRoot(rootElement)
root.render(
  <ThemeProvider theme={darkTheme}>
    <GlobalStyles />
    <App />
  </ThemeProvider>
)
```

**Note:** All imports use `.js` extensions — SWC preserves import specifiers
as-is, and at runtime the browser resolves `.js` files.

## File: `src/App.tsx`

```tsx
import React, { useState } from "react"
import styled from "styled-components"

const AppWrapper = styled.div`
  width: 100%;
  height: 100%;
  background: ${(p) => p.theme.colors.background};
  display: flex;
`

const Sidebar = styled.aside<{ $open: boolean }>`
  width: ${(p) => (p.$open ? "240px" : "60px")};
  height: 100%;
  background: ${(p) => p.theme.colors.surface};
  border-right: 1px solid ${(p) => p.theme.colors.border};
  transition: width 0.3s ease;
  display: flex;
  flex-direction: column;
  padding: 16px 12px;
`

const MainContent = styled.main`
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 24px;
  overflow-y: auto;
`

const Title = styled.h1`
  font-size: 20px;
  font-weight: 600;
  color: ${(p) => p.theme.colors.textPrimary};
  margin-bottom: 16px;
`

const Subtitle = styled.p`
  font-size: 14px;
  color: ${(p) => p.theme.colors.textSecondary};
  line-height: 1.5;
`

export const App: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true)

  return (
    <AppWrapper>
      <Sidebar $open={sidebarOpen}>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          style={{
            background: "none",
            border: "none",
            color: "inherit",
            cursor: "pointer",
            fontSize: 18,
          }}
        >
          {sidebarOpen ? "◀" : "▶"}
        </button>
      </Sidebar>
      <MainContent>
        <Title>Unstoppable App</Title>
        <Subtitle>
          Your Pear desktop app is running. Edit src/App.tsx to start building.
        </Subtitle>
      </MainContent>
    </AppWrapper>
  )
}
```

## File: `src/styles/theme.ts`

```ts
export const darkTheme = {
  name: "dark" as const,
  colors: {
    background: "#171817",
    surface: "#222322",
    surfaceHover: "#2a2b2a",
    surfaceActive: "#333433",
    primary: "#16E3C1",
    primaryDim: "#30504B",
    textPrimary: "#ECF1EE",
    textSecondary: "#979797",
    textMuted: "#a7a7a7",
    border: "#333433",
    borderFocus: "#16E3C1",
    error: "#E34D4D",
    warning: "#E3A816",
    success: "#16E3C1",
  },
  spacing: {
    xs: "4px",
    sm: "8px",
    md: "16px",
    lg: "24px",
    xl: "32px",
  },
  radii: {
    sm: "4px",
    md: "8px",
    lg: "12px",
  },
  fonts: {
    body: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    mono: '"SF Mono", "Fira Code", "Fira Mono", Menlo, monospace',
  },
} as const

export type AppTheme = typeof darkTheme
```

## File: `src/styles/GlobalStyles.ts`

```ts
import { createGlobalStyle } from "styled-components"

export const GlobalStyles = createGlobalStyle`
  *, *::before, *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  html, body, #root {
    height: 100%;
  }

  body {
    font-family: ${(p) => p.theme.fonts.body};
    background: ${(p) => p.theme.colors.background};
    color: ${(p) => p.theme.colors.textPrimary};
    font-size: 14px;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
  }

  * {
    scrollbar-width: none;
    -ms-overflow-style: none;
    &::-webkit-scrollbar { display: none; }
  }

  input, textarea, button {
    font-family: inherit;
    font-size: inherit;
  }

  a {
    color: ${(p) => p.theme.colors.primary};
    text-decoration: none;
  }
`
```

## File: `src/styles/styled.d.ts`

Typed theme for styled-components (enables autocomplete):

```ts
import "styled-components"
import type { AppTheme } from "./theme.js"

declare module "styled-components" {
  export interface DefaultTheme extends AppTheme {}
}
```

## File: `package.json`

```json
{
  "name": "my-app",
  "version": "0.1.0",
  "pear": {
    "name": "my-app",
    "type": "desktop",
    "pre": "pear-electron/pre",
    "routes": ".",
    "gui": {
      "width": 1024,
      "height": 768,
      "minWidth": 600,
      "minHeight": 400,
      "backgroundColor": "#171817"
    }
  },
  "type": "module",
  "scripts": {
    "dev": "bun run build && concurrently \"npm:watch\" \"pear run -d .\"",
    "build": "bun run clean && bunx swc src -d dist --source-maps",
    "watch": "bunx swc src -d dist --source-maps --watch --config-file .swcrc.dev",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "styled-components": "^6.1.0",
    "pear-electron": "^1.7.0",
    "pear-bridge": "^1.2.4"
  },
  "devDependencies": {
    "@swc/cli": "^0.7.0",
    "@swc/core": "^1.3.0",
    "@types/react": "^19.1.0",
    "@types/react-dom": "^19.1.0",
    "chokidar": "^4.0.3",
    "concurrently": "^9.0.0",
    "pear-hotmods": "^1.0.0",
    "pear-interface": "^1.0.0",
    "react-refresh": "^0.17.0",
    "typescript": "^5.0.0"
  }
}
```

## Running

```bash
# Install dependencies
bun install

# Development (builds + runs Pear with live reload)
bun run dev

# Production build only
bun run build

# Stage for distribution
pear stage dev
pear seed dev
```
