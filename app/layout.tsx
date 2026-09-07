import type { Metadata } from "next";
import "./globals.css";
import "./tesllama.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://zazu-still-staring.vercel.app",
  ),
  title: "TESLLAMA | Community Vehicle Concepts",
  description: "Explore the TESLLAMA model range, community lore, and the project paired with Tesla (TSLA) on Stonk.",
  icons: {
    icon: "/tesla-logo.jpg",
    shortcut: "/tesla-logo.jpg",
    apple: "/tesla-logo.jpg",
  },
  openGraph: {
    title: "TESLLAMA | Community Vehicle Concepts",
    description: "Explore the TESLLAMA model range and community lore.",
    type: "website",
    siteName: "TESLLAMA",
    images: [{ url: "/og.png", width: 1731, height: 909, alt: "$ZAZU, the internet's most locked-in cat" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "TESLLAMA | Community Vehicle Concepts",
    description: "Explore the TESLLAMA model range and community lore.",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
