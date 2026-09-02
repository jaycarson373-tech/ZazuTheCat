import type { Metadata } from "next";
import "./globals.css";

const productionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || productionUrl,
  ),
  title: "$SHIESTY | Dog Wif Shiesty",
  description: "In the hood, we wear shiestys. A masked community meme on Robinhood Chain, powered by Pons.",
  icons: {
    icon: "/shiesty-favicon.png?v=2",
    shortcut: "/shiesty-favicon.png?v=2",
    apple: "/shiesty-apple-touch-icon.png?v=2",
  },
  openGraph: {
    title: "$SHIESTY | Dog Wif Shiesty",
    description: "In the hood, we wear shiestys. The creator share goes back to the community.",
    type: "website",
    siteName: "Dog Wif Shiesty",
    images: [{ url: "/shiesty-banner.jpg", width: 1280, height: 426, alt: "Dog Wif Shiesty, the masked dog crew of Robinhood Chain" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "$SHIESTY | Dog Wif Shiesty",
    description: "In the hood, we wear shiestys. The creator share goes back to the community.",
    images: ["/shiesty-banner.jpg"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
