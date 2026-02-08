# Pear Desktop App — Troubleshooting

## Critical Launch Errors

### `Cannot find module '/'`

**Cause**: Missing `index.js`, or missing `"pre"` / `"routes"` in pear config.

**Fix**:
1. Ensure `index.js` exists at project root with pear-electron + pear-bridge:
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
2. Ensure `package.json` has all required pear config fields:
   ```json
   "pear": {
     "name": "my-app",
     "type": "desktop",
     "pre": "pear-electron/pre",
     "routes": "."
   }
   ```

### `ERR_INVALID_APP_NAME`

**Cause**: `pear.name` contains uppercase letters or spaces.

**Fix**: Use only lowercase letters, numbers, and hyphens:
```json
"pear": { "name": "my-app" }
```
NOT: `"name": "My App"` or `"name": "MyApp"`

### `--dev` flag not recognized / app doesn't open in dev mode

**Cause**: Using `--dev` long flag instead of `-d` short flag.

**Fix**: Use `pear run -d .` (NOT `pear run --dev .`).

Update scripts:
```json
"dev": "bun run build && concurrently \"npm:watch\" \"pear run -d .\""
```

### Window opens but is blank / white screen

**Cause**: JavaScript failed to load or execute.

**Fix**:
1. Check dev tools console (opens automatically with `pear run -d .`)
2. Verify `dist/src/` exists: `ls dist/src/` — if empty, run `bun run build`
3. Check `index.html` script path — must be `./dist/src/live-reload.js` (note
   the `src/` inside `dist/`)
4. Ensure SWC compiled successfully (check terminal for errors)
5. Verify `pear-bridge` is installed: `bun add pear-bridge`

### Module resolution errors at runtime

**Cause**: Import specifiers don't use `.js` extensions.

**Fix**: SWC preserves import specifiers exactly as written. All imports in
`.ts`/`.tsx` files must use `.js` extensions:

```ts
// WRONG — fails at runtime
import { App } from './App'
import { theme } from './styles/theme.ts'

// CORRECT
import { App } from './App.js'
import { theme } from './styles/theme.js'
```

## Build Issues

### SWC `--watch` fails or doesn't detect changes

**Cause**: Missing `chokidar` dependency.

**Fix**: Install it as a devDependency:
```bash
bun add -D chokidar
```
`@swc/cli` uses chokidar for file watching, and it's an optional dependency
that isn't always installed automatically.

### Two source files collide in output (macOS)

**Cause**: Files like `app.ts` and `App.tsx` compile to the same output on
macOS's case-insensitive filesystem.

**Fix**: Never have two files in the same directory that differ only by case.
Rename the bootstrap file to `live-reload.ts` (not `app.ts`).

### SWC output directory structure unexpected

**Behavior**: `bunx swc src -d dist` compiles `src/foo.ts` to `dist/src/foo.js`
(NOT `dist/foo.js`). The `src/` prefix is preserved.

**Impact**: HTML `<script>` tags and any hardcoded paths must reference
`./dist/src/...`, not `./dist/...`.

### React Refresh not working (full page reloads)

**Cause**: `.swcrc.dev` missing or `react-refresh` not installed.

**Fix**:
1. Ensure `react-refresh` is in `devDependencies`
2. Ensure `.swcrc.dev` has `"refresh": true`:
   ```json
   { "jsc": { "transform": { "react": { "refresh": true } } } }
   ```
3. Make sure `watch` script uses `--config-file .swcrc.dev`
4. Ensure `src/live-reload.ts` initializes React Refresh runtime

## Window / UI Issues

### `<pear-ctrl>` not showing window controls

**Fix**:
1. Ensure `<pear-ctrl></pear-ctrl>` is in `index.html`
2. The parent `#bar` div should have `position: fixed` and high `z-index`
3. On macOS, traffic lights need margin:
   ```css
   pear-ctrl[data-platform="darwin"] {
     margin-top: 6px;
     margin-left: 8px;
   }
   ```

### Window title bar not draggable

**Fix**: Add to the bar element:
```css
#bar {
  -webkit-app-region: drag;
}
```

Buttons/inputs inside a draggable region need:
```css
button, input, a { -webkit-app-region: no-drag; }
```

### Flash of wrong background color on app start

**Fix**: Set `pear.gui.backgroundColor` in `package.json` to match your theme:
```json
{ "pear": { "gui": { "backgroundColor": "#171817" } } }
```

Also set `background-color` on `<body>` in `index.html`'s inline `<style>`.

### styled-components theme types not working

**Fix**: Create `src/styles/styled.d.ts`:
```ts
import "styled-components"
import type { AppTheme } from "./theme.js"

declare module "styled-components" {
  export interface DefaultTheme extends AppTheme {}
}
```

## Runtime Issues

### `bun run dev` hangs or doesn't open the app

**Fix**:
1. Ensure `concurrently` is in `devDependencies`
2. Ensure `pear` is installed globally: `npm i -g pear`
3. Ensure Pear bin is in PATH: `export PATH="$HOME/Library/Application Support/pear/bin:$PATH"`
4. Test Pear independently: `pear run -d .`
5. Test build independently: `bun run build`

### Production build too large

**Fix**:
1. Add `pear.stage.ignore` to exclude source files:
   ```json
   {
     "pear": {
       "stage": {
         "ignore": ["src", "*.log", ".swcrc*", "tsconfig.json", ".git"]
       }
     }
   }
   ```
2. Exclude unnecessary prebuilds:
   ```json
   "ignore": [
     "node_modules/**/prebuilds/android-*",
     "node_modules/**/prebuilds/ios-*"
   ]
   ```

### Platform-specific UI differences

The Pear window behaves differently on macOS vs Windows/Linux:

- **macOS**: Smaller title bar with traffic light buttons
- **Windows/Linux**: Taller title bar with explicit close/minimize/maximize

Detect platform in JS:
```ts
const isMac = process.platform === "darwin"
```

Or in CSS:
```css
#bar:has(pear-ctrl[data-platform="darwin"]) {
  height: 24px;
}
```

## Getting Help

- Pear documentation: https://docs.pears.com/
- Pear configuration: https://docs.pears.com/reference/configuration.html
- Pear troubleshooting: https://docs.pears.com/reference/troubleshooting.html
