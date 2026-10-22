import { desktopUiCss, desktopShellSource, uiThemeCss, uiTokens } from '../generated/ui-theme.js'
import type { GeneratedFile } from './types.js'

export function desktopUiFiles(): GeneratedFile[] {
  return [
    { path: 'app/theme.css', content: uiThemeCss },
    { path: 'app/styles.css', content: desktopUiCss },
    { path: 'app/shell.js', content: desktopShellSource },
  ]
}

export function mobileThemeFile(): GeneratedFile {
  return {
    path: 'src/theme.ts',
    content: `// Unstoppable Control palette. App-owned; keep light/dark roles aligned.
export const lightTheme = ${JSON.stringify(uiTokens.colors.light, null, 2)}
export const darkTheme = ${JSON.stringify(uiTokens.colors.dark, null, 2)}
export type ThemeColors = typeof lightTheme
`,
  }
}
