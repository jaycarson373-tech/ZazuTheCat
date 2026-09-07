import Image from "next/image";
const stonkUrl = process.env.NEXT_PUBLIC_STONK_URL || "https://www.stonkfun.xyz";
export default function Home() {
  return (
    <main className="tesla-site" id="top">
      <header className="tesla-header">
        <a className="tesla-brand" href="#top" aria-label="Tesla home"><Image src="/tesla-logo.jpg" alt="" width={48} height={48} priority /><span>TESLA</span></a>
        <a className="tesla-nav-link" href={stonkUrl} target="_blank" rel="noopener noreferrer">Stonk</a>
      </header>
      <section className="tesla-hero" aria-labelledby="tesla-title">
        <div className="tesla-banner"><Image src="/tesla-banner.jpg" alt="Tesllama banner featuring a llama Tesla in red lighting" width={1280} height={426} priority sizes="100vw" /></div>
        <div className="tesla-intro">
          <div className="tesla-heading">
            <p className="tesla-status">MARKET LAUNCH</p>
            <h1 id="tesla-title">TESLA</h1>
          </div>
          <dl className="tesla-details">
            <div><dt>Launch platform</dt><dd>Stonk</dd></div>
            <div><dt>Trading pair</dt><dd>Tesla <span>(TSLA)</span></dd></div>
          </dl>
          <a className="tesla-cta" href={stonkUrl} target="_blank" rel="noopener noreferrer">View on Stonk</a>
        </div>
      </section>
      <section className="tesla-lore" aria-labelledby="lore-title">
        <div>
          <p className="tesla-status">COMMUNITY LORE</p>
          <h2 id="lore-title">The Tesllama origin</h2>
        </div>
        <div className="tesla-lore-copy">
          <p>In the community&apos;s fictional origin story, Elon Musk meets the leader of the llamas. The discussion ends with one agreement: unite Tesla engineering with llama identity.</p>
          <p>The result is Tesllama. A merger in the lore, brought to life in the artwork.</p>
        </div>
      </section>
      <footer className="tesla-footer"><span>TESLA</span><p>A community meme coin. Not affiliated with Tesla, Inc.</p><a href="#top">Back to top</a></footer>
    </main>
  );
}
