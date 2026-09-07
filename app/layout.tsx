import type { Metadata } from "next";
import "./globals.css";
import "./foid.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://zazu-still-staring.vercel.app",
  ),
  title: "FOID | Booked. Busy. Foid.",
  description: "A pink, satirical day in the life of Foid. Starbucks, Pilates, astrology and planned LULU airdrops on Stonk.",
  icons: {
    icon: "/foid-icon.svg",
    shortcut: "/foid-icon.svg",
    apple: "/foid-pink-portrait.jpg",
  },
  openGraph: {
    title: "FOID | Booked. Busy. Foid.",
    description: "Pilates booked. Mercury blamed. A satirical meme character with a LULU airdrop plan.",
    type: "website",
    siteName: "FOID",
    images: [{ url: "/og.png", width: 1731, height: 909, alt: "$ZAZU, the internet's most locked-in cat" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "FOID | Booked. Busy. Foid.",
    description: "Pilates booked. Mercury blamed. A satirical meme character with a LULU airdrop plan.",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" data-scroll-behavior="smooth"><body>{children}</body></html>;
}
