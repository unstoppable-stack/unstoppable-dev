"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Check, Copy } from "lucide-react";
import Prism from "prismjs";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-json";

Prism.manual = true;

const languageAliases: Record<string, string> = {
  js: "javascript",
  ts: "typescript",
  sh: "bash",
  shell: "bash",
};

function renderTokens(tokens: string | Prism.Token | (string | Prism.Token)[]): ReactNode {
  if (typeof tokens === "string") return tokens;
  if (Array.isArray(tokens)) {
    return tokens.map((token, index) => (
      <span key={index}>{renderTokens(token)}</span>
    ));
  }
  const aliases = tokens.alias ? [tokens.alias].flat().join(" ") : "";
  return <span className={`token ${tokens.type} ${aliases}`}>{renderTokens(tokens.content)}</span>;
}

interface CodeBlockProps {
  code: string;
  language?: string;
}

export function CodeBlock({ code, language = "bash" }: CodeBlockProps) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const highlightedCode = useMemo(() => {
    const grammar = Prism.languages[languageAliases[language] || language];
    return grammar ? renderTokens(Prism.tokenize(code, grammar)) : code;
  }, [code, language]);

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
      <pre className="syntax-code p-5 overflow-x-auto leading-7" tabIndex={0} aria-label={`${language} code example`}>
        <code>{highlightedCode}</code>
      </pre>
    </div>
  );
}
