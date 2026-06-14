import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "wiki+",
  description: "A curation and contextualization layer over Wikipedia.",
};

// Thin shell: each route owns its own chrome. The Topic page is a full-bleed
// two-world surface with its own sticky split-wordmark header (design §5.1);
// home/contribute render inside their own constrained container.
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
