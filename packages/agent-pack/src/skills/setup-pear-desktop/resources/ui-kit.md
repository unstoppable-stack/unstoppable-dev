# UI Component Kit for Pear Desktop Apps

A set of ready-to-use styled-components for Pear desktop apps. These are
inspired by the QVAC Workbench (a production Pear app) and follow the dark theme
design language.

Use these as starting points — copy what you need and customize.

## Button

```tsx
import React from "react"
import styled, { css } from "styled-components"

type ButtonVariant = "primary" | "secondary" | "ghost"

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: "sm" | "md" | "lg"
}

const variantStyles = {
  primary: css`
    background: ${(p) => p.theme.colors.primary};
    color: ${(p) => p.theme.colors.background};
    border: 1px solid ${(p) => p.theme.colors.primary};
    &:hover:not(:disabled) {
      filter: brightness(1.1);
    }
  `,
  secondary: css`
    background: transparent;
    color: ${(p) => p.theme.colors.textPrimary};
    border: 1px solid ${(p) => p.theme.colors.border};
    &:hover:not(:disabled) {
      border-color: ${(p) => p.theme.colors.primary};
      color: ${(p) => p.theme.colors.primary};
    }
  `,
  ghost: css`
    background: transparent;
    color: ${(p) => p.theme.colors.textSecondary};
    border: none;
    &:hover:not(:disabled) {
      background: ${(p) => p.theme.colors.surfaceHover};
      color: ${(p) => p.theme.colors.textPrimary};
    }
  `,
}

const sizeStyles = {
  sm: css`padding: 4px 10px; font-size: 12px;`,
  md: css`padding: 6px 14px; font-size: 14px;`,
  lg: css`padding: 10px 20px; font-size: 16px;`,
}

const StyledButton = styled.button<{ $variant: ButtonVariant; $size: string }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border-radius: ${(p) => p.theme.radii.sm};
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s ease;
  white-space: nowrap;

  ${(p) => variantStyles[p.$variant]}
  ${(p) => sizeStyles[p.$size as keyof typeof sizeStyles]}

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`

export const Button: React.FC<ButtonProps> = ({
  variant = "secondary",
  size = "md",
  children,
  ...rest
}) => (
  <StyledButton $variant={variant} $size={size} {...rest}>
    {children}
  </StyledButton>
)
```

## TextInput

```tsx
import React from "react"
import styled from "styled-components"

interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`

const Label = styled.label`
  font-size: 12px;
  font-weight: 500;
  color: ${(p) => p.theme.colors.textSecondary};
  letter-spacing: 0.5px;
`

const Input = styled.input<{ $hasError: boolean }>`
  background: ${(p) => p.theme.colors.surface};
  border: 1px solid ${(p) => p.$hasError ? p.theme.colors.error : p.theme.colors.border};
  border-radius: ${(p) => p.theme.radii.sm};
  color: ${(p) => p.theme.colors.textPrimary};
  padding: 8px 12px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s ease;

  &:focus {
    border-color: ${(p) => p.$hasError ? p.theme.colors.error : p.theme.colors.borderFocus};
  }

  &::placeholder {
    color: ${(p) => p.theme.colors.textMuted};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`

const ErrorText = styled.span`
  font-size: 11px;
  color: ${(p) => p.theme.colors.error};
`

export const TextInput: React.FC<TextInputProps> = ({
  label,
  error,
  ...rest
}) => (
  <Wrapper>
    {label && <Label>{label}</Label>}
    <Input $hasError={!!error} {...rest} />
    {error && <ErrorText>{error}</ErrorText>}
  </Wrapper>
)
```

## TextArea

```tsx
import React from "react"
import styled from "styled-components"

const StyledTextArea = styled.textarea`
  background: ${(p) => p.theme.colors.surface};
  border: 1px solid ${(p) => p.theme.colors.border};
  border-radius: ${(p) => p.theme.radii.sm};
  color: ${(p) => p.theme.colors.textPrimary};
  padding: 10px 12px;
  font-size: 14px;
  line-height: 1.5;
  resize: vertical;
  min-height: 80px;
  outline: none;
  transition: border-color 0.2s ease;
  font-family: inherit;

  &:focus {
    border-color: ${(p) => p.theme.colors.borderFocus};
  }

  &::placeholder {
    color: ${(p) => p.theme.colors.textMuted};
  }
`

export const TextArea: React.FC<
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
> = (props) => <StyledTextArea {...props} />
```

## Card

```tsx
import styled from "styled-components"

export const Card = styled.div<{ $interactive?: boolean }>`
  background: ${(p) => p.theme.colors.surface};
  border: 1px solid ${(p) => p.theme.colors.border};
  border-radius: ${(p) => p.theme.radii.md};
  padding: ${(p) => p.theme.spacing.md};

  ${(p) =>
    p.$interactive &&
    `
    cursor: pointer;
    transition: all 0.2s ease;
    &:hover {
      border-color: ${p.theme.colors.primary};
      background: ${p.theme.colors.surfaceHover};
    }
  `}
`

export const CardTitle = styled.h3`
  font-size: 15px;
  font-weight: 600;
  color: ${(p) => p.theme.colors.textPrimary};
  margin-bottom: 4px;
`

export const CardDescription = styled.p`
  font-size: 13px;
  color: ${(p) => p.theme.colors.textSecondary};
  line-height: 1.4;
`
```

## Modal

```tsx
import React, { useEffect, useRef } from "react"
import styled from "styled-components"
import { Button } from "./Button"

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  actions?: React.ReactNode
}

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
`

const Dialog = styled.div`
  background: ${(p) => p.theme.colors.surface};
  border: 1px solid ${(p) => p.theme.colors.border};
  border-radius: ${(p) => p.theme.radii.lg};
  padding: 24px;
  min-width: 360px;
  max-width: 520px;
  max-height: 80vh;
  overflow-y: auto;
`

const Title = styled.h2`
  font-size: 16px;
  font-weight: 600;
  color: ${(p) => p.theme.colors.textPrimary};
  margin-bottom: 16px;
`

const Actions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 20px;
`

export const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  children,
  actions,
}) => {
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    if (open) window.addEventListener("keydown", handleEscape)
    return () => window.removeEventListener("keydown", handleEscape)
  }, [open, onClose])

  if (!open) return null

  return (
    <Overlay ref={overlayRef} onClick={(e) => e.target === overlayRef.current && onClose()}>
      <Dialog>
        <Title>{title}</Title>
        {children}
        {actions && <Actions>{actions}</Actions>}
      </Dialog>
    </Overlay>
  )
}
```

## Layout Primitives

```tsx
import styled from "styled-components"

/** Full-page layout with sidebar + content */
export const PageLayout = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  background: ${(p) => p.theme.colors.background};
`

/** Collapsible sidebar */
export const Sidebar = styled.aside<{ $width?: number }>`
  width: ${(p) => p.$width || 240}px;
  height: 100%;
  background: ${(p) => p.theme.colors.surface};
  border-right: 1px solid ${(p) => p.theme.colors.border};
  display: flex;
  flex-direction: column;
  overflow-y: auto;
`

/** Main content area */
export const Content = styled.main`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  padding: ${(p) => p.theme.spacing.lg};
`

/** Header bar within content */
export const ContentHeader = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: ${(p) => p.theme.spacing.md};
  border-bottom: 1px solid ${(p) => p.theme.colors.border};
  margin-bottom: ${(p) => p.theme.spacing.lg};
`

/** Flex row with gap */
export const Row = styled.div<{ $gap?: string; $align?: string }>`
  display: flex;
  align-items: ${(p) => p.$align || "center"};
  gap: ${(p) => p.$gap || p.theme.spacing.sm};
`

/** Flex column with gap */
export const Stack = styled.div<{ $gap?: string }>`
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.$gap || p.theme.spacing.md};
`

/** Section divider label */
export const SectionLabel = styled.div`
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: ${(p) => p.theme.colors.textMuted};
  padding: 0 12px;
  margin: 12px 0 4px;
`

/** Sidebar navigation item */
export const NavItem = styled.button<{ $active?: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  border: none;
  border-radius: ${(p) => p.theme.radii.sm};
  background: ${(p) => (p.$active ? p.theme.colors.surfaceActive : "transparent")};
  color: ${(p) => (p.$active ? p.theme.colors.primary : p.theme.colors.textSecondary)};
  cursor: pointer;
  font-size: 13px;
  text-align: left;
  transition: all 0.15s ease;

  &:hover {
    background: ${(p) => p.theme.colors.surfaceHover};
    color: ${(p) => p.theme.colors.textPrimary};
  }
`
```

## EmptyState

```tsx
import React from "react"
import styled from "styled-components"

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
`

const Title = styled.h3`
  font-size: 16px;
  font-weight: 500;
  color: ${(p) => p.theme.colors.textPrimary};
  margin-bottom: 8px;
`

const Description = styled.p`
  font-size: 13px;
  color: ${(p) => p.theme.colors.textSecondary};
  max-width: 320px;
  line-height: 1.5;
`

interface EmptyStateProps {
  title: string
  description?: string
  action?: React.ReactNode
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  action,
}) => (
  <Wrapper>
    <Title>{title}</Title>
    {description && <Description>{description}</Description>}
    {action && <div style={{ marginTop: 16 }}>{action}</div>}
  </Wrapper>
)
```

## LoadingSpinner

```tsx
import styled, { keyframes } from "styled-components"

const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`

export const LoadingSpinner = styled.div<{ $size?: number }>`
  width: ${(p) => p.$size || 24}px;
  height: ${(p) => p.$size || 24}px;
  border: 2px solid ${(p) => p.theme.colors.border};
  border-top-color: ${(p) => p.theme.colors.primary};
  border-radius: 50%;
  animation: ${spin} 0.8s linear infinite;
`
```

## Badge

```tsx
import styled from "styled-components"

type BadgeVariant = "default" | "success" | "warning" | "error"

const colorMap = {
  default: { bg: "surfaceActive", text: "textSecondary" },
  success: { bg: "primaryDim", text: "primary" },
  warning: { bg: "warning", text: "background" },
  error: { bg: "error", text: "textPrimary" },
}

export const Badge = styled.span<{ $variant?: BadgeVariant }>`
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 99px;
  font-size: 11px;
  font-weight: 500;
  background: ${(p) => p.theme.colors[colorMap[p.$variant || "default"].bg as keyof typeof p.theme.colors]};
  color: ${(p) => p.theme.colors[colorMap[p.$variant || "default"].text as keyof typeof p.theme.colors]};
`
```

## Usage Notes

- All components use the `AppTheme` type from `styles/theme.ts` via
  styled-components' `DefaultTheme`
- The theme provides consistent spacing, colors, and radii tokens
- Components follow transient prop convention (`$prop`) to avoid DOM warnings
- Customize colors in `styles/colors.ts` and they propagate everywhere
- These are starting points — combine and extend them for your specific app
