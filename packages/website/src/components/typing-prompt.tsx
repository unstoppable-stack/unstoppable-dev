"use client";

import { useEffect, useState, useCallback } from "react";

const prompts = [
  "a P2P encrypted chat app with no servers",
  "a local AI assistant that works offline",
  "a file sharing app that syncs peer-to-peer",
  "a crypto payment gateway with self-custody",
  "a collaborative notes app with P2P sync",
  "a private health tracker with on-device AI",
  "a mobile app that syncs with my Unstoppable Node",
  "a P2P video call app with end-to-end encryption",
  "a local-first todo app that syncs across devices",
  "an AI agent that searches the web without API keys",
  "a photo backup app that seeds to my Node over P2P",
  "an AI-powered translator that never phones home",
];

const TYPING_SPEED = 40;
const DELETING_SPEED = 25;
const PAUSE_AFTER_TYPE = 2000;
const PAUSE_AFTER_DELETE = 400;

export function TypingPrompt() {
  const [promptIndex, setPromptIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const currentPrompt = prompts[promptIndex];
  const displayedText = currentPrompt.slice(0, charIndex);

  const tick = useCallback(() => {
    if (isPaused) return;

    if (!isDeleting) {
      // Typing
      if (charIndex < currentPrompt.length) {
        setCharIndex((prev) => prev + 1);
      } else {
        // Finished typing — pause then start deleting
        setIsPaused(true);
        setTimeout(() => {
          setIsPaused(false);
          setIsDeleting(true);
        }, PAUSE_AFTER_TYPE);
      }
    } else {
      // Deleting
      if (charIndex > 0) {
        setCharIndex((prev) => prev - 1);
      } else {
        // Finished deleting — pause then go to next prompt
        setIsPaused(true);
        setIsDeleting(false);
        setTimeout(() => {
          setIsPaused(false);
          setPromptIndex((prev) => (prev + 1) % prompts.length);
        }, PAUSE_AFTER_DELETE);
      }
    }
  }, [charIndex, currentPrompt, isDeleting, isPaused]);

  useEffect(() => {
    const speed = isDeleting ? DELETING_SPEED : TYPING_SPEED;
    const timer = setTimeout(tick, speed);
    return () => clearTimeout(timer);
  }, [tick, isDeleting]);

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        {/* Window chrome */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-surface-light">
          <div className="flex gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
            <div className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
            <div className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
          </div>
          <span className="text-[10px] text-text-muted ml-2 font-mono">AI Assistant</span>
        </div>

        {/* Prompt area */}
        <div className="p-5 md:p-6 min-h-[80px] flex items-start gap-3">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-accent/10 text-accent mt-0.5">
            <svg
              className="h-3.5 w-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 6V2H8" />
              <path d="m8 18-4 4V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2Z" />
              <path d="M2 12h2" />
              <path d="M9 11v2" />
              <path d="M15 11v2" />
              <path d="M20 12h2" />
            </svg>
          </div>
          <div className="font-mono text-sm md:text-base leading-relaxed">
            <span className="text-text-muted">Build me </span>
            <span className="text-text-primary">{displayedText}</span>
            <span className="inline-block w-[2px] h-[1.1em] bg-accent ml-0.5 align-middle animate-[blink_1s_steps(2)_infinite]" />
          </div>
        </div>
      </div>
    </div>
  );
}
