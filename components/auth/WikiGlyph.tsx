// A small, decorative "W" mark for the Wikipedia login affordance (design §1a / §8).
// Purely decorative — `aria-hidden`; the WORD "Log in with Wikipedia" carries the label
// (never color/glyph alone — design §7). Uses currentColor so it inherits the button text.
export function WikiGlyph({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      focusable="false"
      className={className}
    >
      {/* Stylized "W" — evokes the Wikipedia wordmark without reproducing the logo. */}
      <path d="M2 5h4.2l2.4 9.1L11.1 5h1.8l2.5 9.1L17.8 5H22l-4 14h-2l-2.6-9.4L10.8 19h-2L4 5z" />
    </svg>
  );
}
