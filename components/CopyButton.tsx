"use client";

import { useEffect, useRef, useState } from "react";

type CopyButtonProps = {
  value: string;
  compact?: boolean;
};

export function CopyButton({ value, compact = false }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    [],
  );

  async function copyValue() {
    if (!value) return;

    try {
      setFailed(false);
      await navigator.clipboard.writeText(value);
      setCopied(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
      setFailed(true);
    }
  }

  return (
    <>
    <button
      className={`copy-button${compact ? " copy-button-compact" : ""}`}
      type="button"
      onClick={copyValue}
      aria-label="Copy contract address"
    >
      <span aria-live="polite">{copied ? "Copied" : "Copy"}</span>
    </button>
    {failed ? <span className="copy-feedback" role="status">Select the address to copy.</span> : null}
    </>
  );
}
