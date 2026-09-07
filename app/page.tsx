import Image from "next/image";
import Link from "next/link";
import { FoidHeader } from "@/components/FoidHeader";
import { FoidFooter } from "@/components/FoidFooter";
import { FoidButton } from "@/components/FoidButton";

export default function Home() {
  return <main className="foid-site" id="top">
    <FoidHeader />
    <section className="foid-hero" aria-labelledby="foid-title">
      <div className="foid-hero-top"><span>INTERNET CULTURE. MEET STOCK CULTURE.</span><span>EST. ONLINE</span></div>
      <div className="foid-hero-grid">
        <div className="foid-hero-copy"><p className="foid-kicker">A CHARACTER FROM YOUR SCREEN TIME.</p><h1 id="foid-title">FOID<span>.</span></h1><p className="foid-hero-sub">Four letters.<br/>A whole lot of brainrot.</p><FoidButton /><div className="foid-hero-meta"><span>MEME: FOID</span><span>PROPOSED PAIR: LULU</span></div></div>
        <div className="foid-art"><span className="foid-art-label">NO THOUGHTS. JUST THE FIT.</span><Image src="/foid-character.jpg" alt="FOID, a bald Wojak-style fictional character with a blank expression and a green takeaway cup" width={1024} height={1024} priority sizes="(max-width: 760px) 100vw, 50vw"/><div className="foid-art-bottom"><span>SUBJECT 001</span><span>EXTREMELY ONLINE</span></div></div>
      </div>
      <div className="foid-strip" aria-hidden="true"><span>FOID</span><i>×</i><span>LULU</span><i>×</i><span>FOID</span><i>×</i><span>LULU</span><i>×</i><span>FOID</span><i>×</i><span>LULU</span><i>×</i><span>FOID</span></div>
    </section>
    <section className="foid-lore foid-section" id="lore"><div className="foid-section-label"><span>01 / THE LORE</span><span>LOW ATTENTION REQUIRED</span></div><div className="foid-lore-grid"><h2>Terminally online.<br/><span>Technically outside.</span></h2><div><p>FOID left the group chat, put on the fit, and discovered the stock market.</p><p>He opened a chart. Bought the outfit. Forgot the workout.</p><p className="foid-lore-end">The timeline met the ticker.<br/>Now we’re here.</p></div></div></section>
    <section className="foid-pair foid-section" id="pair"><div className="foid-section-label"><span>02 / THE PAIR</span><span>PROPOSED CONCEPT</span></div><div className="foid-pair-grid"><div><h2>Meme energy.<br/>Athleisure energy.</h2><p>The idea: FOID paired with LULU on Stonk.<br/>One lives in the feed. One lives in the fit.</p><a href="https://www.stonkfun.xyz" target="_blank" rel="noopener noreferrer" className="foid-button">Explore Stonk</a></div><div className="foid-pair-ticket"><div><span>THE PROPOSED PAIR</span><span>001</span></div><strong>FOID<span> / </span>LULU</strong><dl><div><dt>Meme</dt><dd>FOID</dd></div><div><dt>Stock concept</dt><dd>Lululemon · LULU</dd></div><div><dt>Platform</dt><dd>Stonk</dd></div><div><dt>Launch</dt><dd>Not announced</dd></div></dl><p>No FOID contract address has been announced.</p></div></div></section>
    <section className="foid-airdrop-banner"><div><span className="foid-kicker">03 / AIRDROPS</span><h2>Something for<br/>the group chat.</h2><p>A home for the proposed LULU airdrops.<br/>Dates, rewards and eligibility are still to come.</p></div><Link className="foid-button foid-button-dark" href="/airdrops">Airdrop details</Link></section>
    <FoidFooter />
  </main>;
}
