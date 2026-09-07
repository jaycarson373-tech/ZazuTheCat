import type { Metadata } from "next";
import "./globals.css";
import "./foid.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://zazu-still-staring.vercel.app",
  ),
  title: "FOID | Four letters. A whole lot of brainrot.",
  description: "Meet FOID, a fictional internet meme character. Explore the proposed LULU pairing on Stonk and the upcoming airdrop concept.",
  icons: {
    icon: "/foid-icon.svg",
    shortcut: "/foid-icon.svg",
    apple: "/foid-character.jpg",
  },
  openGraph: {
    title: "FOID | Four letters. A whole lot of brainrot.",
    description: "Internet culture meets stock culture. A fictional meme character and a proposed LULU pairing.",
    type: "website",
    siteName: "FOID",
    images: [{ url: "/og.png", width: 1731, height: 909, alt: "$ZAZU, the internet's most locked-in cat" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "FOID | Four letters. A whole lot of brainrot.",
    description: "Internet culture meets stock culture. A fictional meme character and a proposed LULU pairing.",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" data-scroll-behavior="smooth"><body>{children}</body></html>;
}
