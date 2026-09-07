import Image from "next/image";
const stonkUrl = process.env.NEXT_PUBLIC_STONK_URL || "https://www.stonkfun.xyz";
export default function Home() {
  return (
    <main className="tesla-site" id="top">
      <header className="tesla-header">
        <a className="tesla-brand" href="#top" aria-label="Tesla home"><Image src="/tesla-logo.jpg" alt="" width={48} height={48} priority /><span>TESLA</span></a>
        <a className="tesla-nav-link" href={stonkUrl} target="_blank" rel="noopener noreferrer">Stonk ↗</a>
      </header>
      <section className="tesla-hero" aria-labelledby="tesla-title">
        <div className="tesla-banner"><Image src="/tesla-banner.jpg" alt="Tesllama banner featuring a fluffy llama Tesla in red neon light" width={1280} height={426} priority sizes="100vw" /></div>
        <div className="tesla-intro">
          <p className="tesla-status"><span aria-hidden="true" /> LAUNCHED ON STONK</p>
          <h1 id="tesla-title">TESLA</h1>
          <p className="tesla-tagline">Electric. Fluffy. Built different.</p>
          <p className="tesla-pair">Paired with <strong>Tesla</strong><span>TSLA</span></p>
          <a className="tesla-cta" href={stonkUrl} target="_blank" rel="noopener noreferrer">Explore on Stonk <span aria-hidden="true">↗</span></a>
        </div>
      </section>
      <footer className="tesla-footer"><span>TESLA</span><p>A community meme coin. Not affiliated with Tesla, Inc.</p><a href="#top">Back to top ↑</a></footer>
    </main>
  );
}
