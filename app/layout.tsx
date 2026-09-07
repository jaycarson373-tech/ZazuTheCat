import type { Metadata } from "next";
import "./globals.css";
import "./microsloth.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://zazu-still-staring.vercel.app",
  ),
  title: "MicroSloth | Almost ready.",
  description: "Welcome to SlothOS. Explore a fictional Microsoft–sloth merger, meet the Chief Executive Sloth, and install an update. Eventually.",
  icons: {
    icon: "/microsloth-icon.svg",
    shortcut: "/microsloth-icon.svg",
    apple: "/microsloth-ceo.jpg",
  },
  openGraph: {
    title: "MicroSloth | Almost ready.",
    description: "The next era of productivity. We’ll get to it.",
    type: "website",
    siteName: "MicroSloth",
    images: [{ url: "/og.png", width: 1731, height: 909, alt: "$ZAZU, the internet's most locked-in cat" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "MicroSloth | Almost ready.",
    description: "The next era of productivity. We’ll get to it.",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" data-scroll-behavior="smooth"><body>{children}</body></html>;
}
