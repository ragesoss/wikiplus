// Decorative sun / moon glyphs for the skin toggle (design §6.1). `aria-hidden`; the WORD carries the
// meaning (AC13) — the glyph is never the sole signal. `currentColor` = `--color-ink-plus`, so it is
// AA on both bands for free (ink, not an accent, never gold — VI §7.3). Sized to match the WikiGlyph
// in the login chip (`h-4 w-4`) so the two chrome chips align.

export function MoonGlyph({ className = "" }: { className?: string }) {
  // Shown when LIGHT is active (the destination is dark).
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      focusable="false"
      className={className}
    >
      <path d="M12.5 3a9 9 0 1 0 8.5 11.9 7 7 0 0 1-8.5-9.8c0-.7.1-1.4.3-2.1a9 9 0 0 0-.3 0z" />
    </svg>
  );
}

export function SunGlyph({ className = "" }: { className?: string }) {
  // Shown when DARK is active (the destination is light).
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
      focusable="false"
      className={className}
    >
      <circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}
