import Image from "next/image";

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  );
}

export function NftMintSection({
  mintUrl,
  supply,
}: {
  mintUrl: string;
  supply: number;
}) {
  return (
    <section className="mint-section" id="mint" data-reveal>
      <div className="section-shell">
        <div className="section-kicker"><span>01</span><p>THE ZAZU 1000</p></div>

        <div className="mint-layout">
          <div className="mint-window">
            <div className="window-title">
              <span>ZAZU_HANDMADE_COLLECTION.PNG</span>
              <span>_ □ ×</span>
            </div>
            <div className="mint-contact-sheet">
              <Image
                src="/zazu-40-grid.png"
                alt="A preview sheet of handmade Zazu NFT artwork"
                width={1586}
                height={992}
                loading="lazy"
                sizes="(max-width: 820px) 94vw, 56vw"
              />
              <span className="mint-preview-label">40 PREVIEW FILES</span>
            </div>
          </div>

          <div className="mint-panel">
            <p className="eyebrow"><i /> CUSTOM. HANDMADE. LOCKED IN.</p>
            <h2>{supply.toLocaleString("en-US")} ZAZUS.<br />MADE BY HAND.</h2>
            <p className="mint-copy">
              A finite collection of {supply.toLocaleString("en-US")} custom handmade ZAZU NFTs. Every file remixes the original stare into its own strange little universe.
            </p>

            <div className="mint-facts" aria-label="Collection facts">
              <div><span>SUPPLY</span><strong>{supply.toLocaleString("en-US")}</strong></div>
              <div><span>PROCESS</span><strong>HANDMADE</strong></div>
              <div><span>CHAIN</span><strong>ROBINHOOD</strong></div>
            </div>

            {mintUrl ? (
              <ExternalLink href={mintUrl}>MINT A ZAZU ↗</ExternalLink>
            ) : (
              <a href="#elements">EXPLORE THE ZAZU FILES ↓</a>
            )}
          </div>
        </div>

        <div className="mint-edition-strip" aria-hidden="true">
          <span>001</span><span>250</span><span>500</span><span>750</span><span>1000</span>
        </div>
      </div>
    </section>
  );
}
