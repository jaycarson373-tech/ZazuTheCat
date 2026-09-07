import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://zazu-still-staring.vercel.app",
  ),
  title: "Tesla | Launched on Stonk",
  description: "Electric. Fluffy. Built different. Tesla is launched on Stonk and paired with Tesla (TSLA).",
  icons: {
    icon: "/tesla-logo.jpg",
    shortcut: "/tesla-logo.jpg",
    apple: "/tesla-logo.jpg",
  },
  openGraph: {
    title: "Tesla | Launched on Stonk",
    description: "Tesla. Launched on Stonk. Paired with Tesla (TSLA).",
    type: "website",
    siteName: "Tesla",
    images: [{ url: "/og.png", width: 1731, height: 909, alt: "$ZAZU, the internet's most locked-in cat" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Tesla | Launched on Stonk",
    description: "Tesla. Launched on Stonk. Paired with Tesla (TSLA).",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
