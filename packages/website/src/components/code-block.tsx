"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

interface CodeBlockProps {
  code: string;
  language?: string;
}

export function CodeBlock({ code, language = "bash" }: CodeBlockProps) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
    setTimeout(() => setCopyState("idle"), 2500);
  };

  return (
    <div className="group relative rounded-xl border border-border bg-surface font-mono text-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-surface-light">
        <span className="text-xs text-text-muted">{language}</span>
        <button
          type="button"
          onClick={handleCopy}
          aria-label={language === "bash" || language === "sh" ? "Copy command" : "Copy text"}
          className="flex items-center gap-1 rounded text-xs text-text-muted transition-colors hover:text-text-secondary"
        >
          {copyState === "copied" ? (
            <>
              <Check className="h-3.5 w-3.5" />
              Copied
            </>
          ) : copyState === "failed" ? (
            "Select and copy"
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              Copy
            </>
          )}
        </button>
        <span className="sr-only" aria-live="polite">
          {copyState === "copied" ? "Command copied to clipboard." : copyState === "failed" ? "Copy failed. Select the command and copy it manually." : ""}
        </span>
      </div>
      <pre className="p-4 overflow-x-auto">
        <code>
          {language === "bash" || language === "sh" ? <span aria-hidden="true" className="text-text-muted">$ </span> : null}
          <span className="text-accent">{code}</span>
        </code>
      </pre>
    </div>
  );
}
