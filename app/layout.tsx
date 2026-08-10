import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://zazu-still-staring.vercel.app",
  ),
  title: "$ZAZU | The Internet's Most Locked-In Cat",
  description: "ZAZU's creator-fee share fuels transparent buybacks and permanent burns on Robinhood Chain. Powered by Pons.",
  icons: {
    icon: "/zazu-favicon.png?v=2",
    shortcut: "/zazu-favicon.png?v=2",
    apple: "/zazu-apple-touch-icon.png?v=2",
  },
  openGraph: {
    title: "$ZAZU | The Internet's Most Locked-In Cat",
    description: "Built on Robinhood Chain. Powered by Pons. Creator fees fuel transparent ZAZU buybacks and permanent burns.",
    type: "website",
    siteName: "Zazu",
    images: [{ url: "/og.png", width: 1731, height: 909, alt: "$ZAZU, the internet's most locked-in cat" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "$ZAZU | The Internet's Most Locked-In Cat",
    description: "Built on Robinhood Chain. Powered by Pons. Creator fees fuel transparent ZAZU buybacks and permanent burns.",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
