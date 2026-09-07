import Image from "next/image";
import Link from "next/link";
import { FoidHeader } from "@/components/FoidHeader";
import { FoidFooter } from "@/components/FoidFooter";
import { FoidButton } from "@/components/FoidButton";

const diary = [
  { time: "08:30 AM", category: "THE MORNING RITUAL", title: "Starbucks is a meeting.", text: "Iced drink. Twelve selfies. One posted. A productive morning by any reasonable definition.", image: "/foid-morning.jpg", alt: "Foid in pink taking a selfie beside a drink and her skincare collection", width: 1254, height: 1254 },
  { time: "11:00 AM", category: "PROFESSIONAL STRETCHING", title: "Pilates is the personality.", text: "The matching set was essential. The workout was a bonus. Recovery requires another iced drink.", image: "/foid-pilates.jpg", alt: "Foid in a pink Pilates studio using a reformer", width: 1254, height: 1254 },
  { time: "04:44 PM", category: "COSMIC CUSTOMER SUPPORT", title: "Mercury will handle this.", text: "Late reply? Retrograde. Missed class? Retrograde. Somehow the shopping cart still works perfectly.", image: "/foid-astrology.jpg", alt: "A satirical cartoon of Foid blaming Mercury retrograde during a conversation", width: 1280, height: 1024 },
];

export default function Home() {
  return <main className="foid-site" id="top">
    <FoidHeader />
    <section className="foid-hero" aria-labelledby="foid-title">
      <div className="foid-hero-top"><span>A LITTLE SATIRE. A LOT OF PINK.</span><span>FOID × LULU</span></div>
      <div className="foid-hero-grid">
        <div className="foid-hero-copy"><p className="foid-kicker">PILATES BOOKED. MERCURY BLAMED.</p><h1 id="foid-title">Booked.<br/>Busy.<br/><em>Foid.</em></h1><p className="foid-hero-sub">An iced coffee in one hand.<br/>The group chat in the other.</p><div className="foid-hero-actions"><Link className="foid-button foid-button-dark" href="#lore">A day in her life</Link><Link className="foid-hero-link" href="/airdrops">LULU airdrops</Link></div><div className="foid-hero-meta"><span>ON THE MOODBOARD: STONK</span><span>ON THE WISHLIST: LULU</span></div></div>
        <div className="foid-art"><Image src="/foid-pink-portrait.jpg" alt="Foid, the pink-haired fictional meme character in a pink Foid shirt" width={1254} height={1254} priority sizes="(max-width: 760px) 100vw, 50vw"/><div className="foid-art-bottom"><span>MAIN CHARACTER ENERGY</span><span>DO NOT DISTURB</span></div><span className="foid-art-sticker">romanticising<br/>absolutely everything.</span></div>
      </div>
      <div className="foid-strip" aria-hidden="true"><span>ICED COFFEE</span><i>/</i><span>PILATES</span><i>/</i><span>LULU</span><i>/</i><span>ASTROLOGY</span><i>/</i><span>FOID</span></div>
    </section>
    <section className="foid-diary foid-section" id="lore"><div className="foid-section-label"><span>01 / THE DAILY LORE</span><span>A FICTIONAL CHARACTER’S VERY REAL SCHEDULE</span></div><div className="foid-diary-heading"><h2>A day in the life<br/><em>of Foid.</em></h2><p>Somehow, this counts<br/>as a busy schedule.</p></div><div className="foid-diary-grid">{diary.map(entry => <article className="foid-diary-card" key={entry.time}><div className="foid-diary-time"><span>{entry.time}</span><span>{entry.category}</span></div><div className="foid-diary-image"><Image src={entry.image} alt={entry.alt} width={entry.width} height={entry.height} sizes="(max-width: 760px) 90vw, 30vw"/></div><div className="foid-diary-copy"><h3>{entry.title}</h3><p>{entry.text}</p></div></article>)}</div></section>
    <section className="foid-excuse"><div><span className="foid-kicker">CURRENTLY UNAVAILABLE</span><h2>Not my fault.<br/><em>Probably my rising sign.</em></h2></div><FoidButton/></section>
    <section className="foid-pair foid-section" id="pair"><div className="foid-section-label"><span>02 / THE PAIRING</span><span>THE OUTFIT HAS A TICKER.</span></div><div className="foid-pair-grid"><div><h2>She likes the fit.<br/><em>We like the pair.</em></h2><p>The plan: FOID paired with LULU on Stonk.<br/>Athleisure meets the extremely online.</p><a href="https://www.stonkfun.xyz" target="_blank" rel="noopener noreferrer" className="foid-button">Explore Stonk</a></div><div className="foid-pair-ticket"><div><span>HER FAVOURITE MATCHING SET</span><span>001</span></div><strong>FOID<span> / </span>LULU</strong><dl><div><dt>Meme character</dt><dd>FOID</dd></div><div><dt>Planned stock pair</dt><dd>Lululemon · LULU</dd></div><div><dt>Airdrop reward</dt><dd>LULU</dd></div><div><dt>Platform</dt><dd>Stonk</dd></div></dl><p>Launch and contract details to be announced.</p></div></div></section>
    <section className="foid-airdrop-banner"><div><span className="foid-kicker">03 / LULU AIRDROPS</span><h2>A little something<br/><em>for the group chat.</em></h2><p>LULU is the airdrop reward.<br/>Dates and eligibility are coming soon.</p></div><Link className="foid-button foid-button-dark" href="/airdrops">The airdrop details</Link></section>
    <FoidFooter />
  </main>;
}
