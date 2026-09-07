import Image from "next/image";
import Link from "next/link";
import { ModelCarousel } from "@/components/ModelCarousel";
import { SiteMenu } from "@/components/SiteMenu";
import { ContractAddress } from "@/components/ContractAddress";
import { TESLLAMA_STONK_URL as stonkUrl } from "@/lib/tesllama-token";

export default function Home() {
  return (
    <main className="tesllama-site" id="top">
      <header className="tesllama-header">
        <a className="tesllama-brand" href="#top" aria-label="Tesllama home">
          <Image src="/tesla-logo.jpg" alt="" width={40} height={40} priority />
          <span>TESLLAMA</span>
        </a>
        <nav className="desktop-nav" aria-label="Main navigation">
          <a href="#models">Models</a>
          <a href="#lore">The story</a>
          <Link href="/shop">Shop Tesllamas</Link>
        </nav>
        <div className="header-tools">
          <a href={stonkUrl} target="_blank" rel="noopener noreferrer">Stonk</a>
          <SiteMenu stonkUrl={stonkUrl} />
        </div>
      </header>

      <div className="brand-ticker" aria-label="TESLLAMA · Paired with Tesla (TSLA) · On Stonk" tabIndex={0}>
        <div>
          <span>TESLLAMA</span><i>COMMUNITY CONCEPT</i><span>TESLLAMA</span><i>PAIRED WITH TESLA (TSLA)</i><span>TESLLAMA</span><i>ON STONK</i>
          <span aria-hidden="true">TESLLAMA</span><i aria-hidden="true">COMMUNITY CONCEPT</i><span aria-hidden="true">TESLLAMA</span><i aria-hidden="true">PAIRED WITH TESLA (TSLA)</i><span aria-hidden="true">TESLLAMA</span><i aria-hidden="true">ON STONK</i>
        </div>
      </div>

      <section id="models" aria-label="Tesllama models">
        <ModelCarousel />
      </section>

      <section className="tesllama-lore" id="lore" aria-labelledby="lore-title">
        <div className="lore-image">
          <Image src="/tesla-logo.jpg" alt="The original white Tesllama vehicle concept" width={1280} height={1280} sizes="(max-width: 800px) 92vw, 45vw" />
        </div>
        <div className="lore-copy">
          <p className="section-label">COMMUNITY LORE</p>
          <h2 id="lore-title">An unlikely merger.</h2>
          <p>According to Tesllama lore, Elon Musk met the leader of the llamas to discuss the future of movement. The negotiations were brief. Tesla brought the engineering. The llamas brought everything else.</p>
          <p>Three models. Six finishes. One vehicle category the world was not prepared to insure.</p>
          <Link href="/shop">Shop Tesllamas</Link>
        </div>
      </section>

      <footer className="tesllama-footer">
        <strong>TESLLAMA</strong>
        <p>A community meme project. Not affiliated with Tesla, Inc. or Elon Musk.</p>
        <nav className="tesllama-social-links" aria-label="Footer navigation">
          <a href="https://x.com/Tesllama" target="_blank" rel="noopener noreferrer">Follow on X</a>
          <a href="#top">Back to top</a>
        </nav>
        <div className="footer-contract"><ContractAddress /></div>
      </footer>
    </main>
  );
}
