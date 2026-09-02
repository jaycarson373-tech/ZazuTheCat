import Image from "next/image";
import { CopyButton } from "@/components/CopyButton";
import { HeroMiniDashboard } from "@/components/HeroMiniDashboard";
import { MotionController } from "@/components/MotionController";
import { NftMintSection } from "@/components/NftMintSection";
import { OnchainActivity } from "@/components/OnchainActivity";
import { ZAZU } from "@/lib/zazu";

const mechanicSteps = [
  {
    number: "01",
    title: "PONS FEES FLOW",
    copy: "ZAZU creator fees from Pons move directly into the public BuybackVault.",
    tone: "green",
  },
  {
    number: "02",
    title: "AUTOMATION CHECKS IN",
    copy: "A lightweight keeper reads the vault and initiates the next buyback cycle.",
    tone: "gray",
  },
  {
    number: "03",
    title: "BUYBACK EXECUTES",
    copy: "Creator fees are used to buy ZAZU through the protocol's onchain flow.",
    tone: "blue",
  },
  {
    number: "04",
    title: "ZAZU BURNS",
    copy: "Bought ZAZU is sent directly to the burn destination.",
    tone: "red",
  },
] as const;

function ExternalLink({
  href,
  children,
  className = "",
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <a className={className} href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  );
}

export default function Home() {
  const hasRegistry = Boolean(ZAZU.tokenAddress || ZAZU.vaultAddress || ZAZU.nftContractAddress);
  const dashboardConfigured = Boolean(ZAZU.tokenAddress && ZAZU.vaultAddress);

  return (
    <main>
      <MotionController />
      <div className="scroll-progress" aria-hidden="true" />
      <div className="cursor-glow" aria-hidden="true" />

      <header className="site-header">
        <a className="brand" href="#top" aria-label="Zazu home">
          <span className="brand-avatar">
            <Image src="/zazu-logo.jpg" alt="" width={44} height={44} priority />
          </span>
          <span className="brand-copy">
            <strong>ZAZU</strong>
          </span>
        </a>

        <nav className="header-nav" aria-label="Main navigation">
          <a href="#mint">NFTs</a>
          <a href="#activity">Dashboard</a>
          <a href="#mechanism">How it works</a>
        </nav>

        <div className="header-actions">
          <ExternalLink className="header-chip header-chip-neon header-chip-secondary" href={ZAZU.ponsUrl}>PONS ↗</ExternalLink>
          {ZAZU.tokenAddress ? (
            <div className="header-ca">
              <span>CA</span>
              <code>{`${ZAZU.tokenAddress.slice(0, 5)}...${ZAZU.tokenAddress.slice(-4)}`}</code>
              <CopyButton value={ZAZU.tokenAddress} compact />
            </div>
          ) : (
            <button className="header-chip header-chip-placeholder" type="button" disabled>CA</button>
          )}
          {ZAZU.xUrl ? (
            <ExternalLink className="header-chip" href={ZAZU.xUrl}>X ↗</ExternalLink>
          ) : (
            <button className="header-chip header-chip-placeholder" type="button" disabled>X</button>
          )}
        </div>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow"><i /> BUILT ON ROBINHOOD CHAIN</p>
          <h1><span>$</span>ZAZU</h1>
          <p className="hero-title">THE INTERNET&apos;S MOST LOCKED-IN CAT.</p>
          <p className="hero-dek">Creator fees buy ZAZU. ZAZU gets burned.</p>

          <div className="hero-actions">
            <a className="button button-dark" href="#mint">MINT THE ZAZU 1212 ↓</a>
            <ExternalLink className="button button-neon" href={ZAZU.ponsUrl}>POWERED BY PONS ↗</ExternalLink>
            <a className="button button-outline" href="#mechanism">HOW IT WORKS ↓</a>
            {ZAZU.dexUrl ? (
              <ExternalLink className="button button-dark" href={ZAZU.dexUrl}>BUY $ZAZU ↗</ExternalLink>
            ) : null}
          </div>

          {ZAZU.tokenAddress ? (
            <div className="contract-bar">
              <span>CA</span>
              <code>{ZAZU.tokenAddress}</code>
              <CopyButton value={ZAZU.tokenAddress} />
            </div>
          ) : null}
        </div>

        <div className="hero-art" aria-label="Forty elemental Zazu cat variations">
          <div className="hero-window">
            <div className="window-title">
              <span>ZAZU_VARIANTS_001-040.PNG</span>
              <span>_ □ ×</span>
            </div>
            <div className="hero-photo">
              <Image
                src="/zazu-40-grid.png"
                alt="Forty lo-fi Zazu cat portraits in green, gray, underwater blue, fire red, and other elemental styles"
                width={1586}
                height={992}
                priority
                sizes="(max-width: 820px) 94vw, 70vw"
              />
            </div>
            <div className="hero-file-count"><strong>40</strong><span>CATS<br />LOADED</span></div>
          </div>
          <HeroMiniDashboard />
        </div>
      </section>

      <div className="element-strip" aria-hidden="true">
        <span>EARTH</span><span>VOID</span><span>WATER</span><span>FIRE</span>
      </div>

      <div className="ticker" aria-hidden="true">
        <div>
          <span>1,212 ZAZUS</span><b>✦</b><span>0.003 ETH</span><b>✦</b><span>POWERED BY PONS</span><b>✦</b><span>CREATOR FEES IN</span><b>✦</b><span>BUYBACK LOOP</span><b>✦</b><span>ZAZU BOUGHT</span><b>✦</b><span>ZAZU BURNED</span><b>✦</b>
          <span>1,212 ZAZUS</span><b>✦</b><span>0.003 ETH</span><b>✦</b><span>POWERED BY PONS</span><b>✦</b><span>CREATOR FEES IN</span><b>✦</b><span>BUYBACK LOOP</span><b>✦</b><span>ZAZU BOUGHT</span><b>✦</b><span>ZAZU BURNED</span><b>✦</b>
        </div>
      </div>

      <NftMintSection
        contractAddress={ZAZU.nftContractAddress}
        explorerBase={ZAZU.explorerBase}
        mintPriceEth={ZAZU.nftMintPriceEth}
        rpcUrl={ZAZU.nftRpcUrl}
        supply={ZAZU.nftSupply}
        maxPerTransaction={ZAZU.nftMaxPerTransaction}
      />

      <section className="dashboard-section" id="activity" data-reveal>
        <div className="section-shell">
          <div className="section-kicker section-kicker-light"><span>02</span><p>THE ONCHAIN RECEIPTS</p></div>
          <div className="section-heading dashboard-heading">
            <div><p className="eyebrow eyebrow-light"><i /> EVERY STEP, ONE FEED</p><h2>FOLLOW THE<br />FULL LOOP.</h2></div>
            <p>See creator fees move from Pons into the vault, token-side fees burn directly, and WETH-side fees buy and burn ZAZU.</p>
          </div>
          <OnchainActivity siteConfigured={dashboardConfigured} />
        </div>
      </section>

      <section className="mechanism-section" id="mechanism" data-reveal>
        <div className="section-shell">
          <div className="section-kicker"><span>03</span><p>HOW THE LOOP WORKS</p></div>
          <div className="section-heading mechanism-heading">
            <div><p className="eyebrow"><i /> AUTOMATED ONCHAIN LOOP</p><h2>FEES IN.<br />ZAZU OUT.</h2></div>
            <p>Pons creator fees enter the vault, the buyback runs, and purchased ZAZU goes straight to the burn destination.</p>
          </div>
          <div className="mechanic-grid">
            {mechanicSteps.map((step) => (
              <article className={`mechanic-card ${step.tone}`} key={step.number}>
                <span>{step.number}</span><h3>{step.title}</h3><p>{step.copy}</p>
              </article>
            ))}
          </div>
          <div className="flow-line"><span>PONS FEES</span><b>→</b><span>PUBLIC VAULT</span><b>→</b><span>DEX ADAPTER</span><b>→</b><span>ZAZU</span><b>→</b><span>BURN</span></div>
        </div>
      </section>

      <section className="wall-section" id="elements" data-reveal>
        <div className="section-shell">
          <div className="section-kicker"><span>04</span><p>THE ZAZU FILES</p></div>
          <div className="original-files original-files-feature">
            <div className="original-image">
              <Image src="/zazu-elements.jpg" alt="Four early internet Zazu edits representing earth, void, water, and fire" fill sizes="(max-width: 720px) 94vw, 44vw" />
            </div>
            <div className="original-copy">
              <span>ZAZU ELEMENTS</span>
              <h2>EARTH.<br />VOID.<br />WATER. FIRE.</h2>
              <p>One locked-in cat. Every possible condition.</p>
            </div>
          </div>
          <div className="lore-heading">
            <p className="eyebrow"><i /> INTERNET ARTIFACT 001</p>
            <h2>DATE OF BIRTH:<br />CLASSIFIED.</h2>
            <p>Zazu&apos;s exact birthday was never published. He arrived online fully formed: gray tabby, black-glass eyes, and one impossible expression that looked like it already knew everything.</p>
          </div>
          <div className="lore-grid">
            <article>
              <span>ORIGIN FILE</span>
              <strong>THE LOCKED-IN STARE</strong>
              <p>A close-up of Zazu became the perfect reaction to disbelief, exhaustion, and witnessing something no cat should have to process.</p>
            </article>
            <article>
              <span>2023</span>
              <strong>THE PHOTO ESCAPES</strong>
              <p>The image broke containment and spread across feeds, replies, edits, and reaction posts. The internet had found a new face for having seen too much.</p>
            </article>
            <article>
              <span>THE ELEMENTAL ERA</span>
              <strong>ONE CAT. EVERY UNIVERSE.</strong>
              <p>Earth. Void. Water. Fire. Then forty files and counting. Every remix changes the world around him. Zazu never breaks eye contact.</p>
            </article>
          </div>
        </div>
      </section>

      {hasRegistry ? (
        <section className="registry-section" id="registry" data-reveal>
          <div className="section-shell">
            <div className="section-kicker"><span>05</span><p>VERIFY ONCHAIN</p></div>
            <div className="registry-layout">
              <div><p className="eyebrow"><i /> CHECK EVERY ADDRESS</p><h2>FOLLOW THE<br />MONEY.</h2></div>
              <div className="registry-table">
                {ZAZU.tokenAddress ? (
                  <div><span>ZAZU TOKEN</span><code>{ZAZU.tokenAddress}</code><CopyButton value={ZAZU.tokenAddress} compact /></div>
                ) : null}
                {ZAZU.vaultAddress ? (
                  <div><span>BUYBACK VAULT</span><code>{ZAZU.vaultAddress}</code><CopyButton value={ZAZU.vaultAddress} compact /></div>
                ) : null}
                {ZAZU.nftContractAddress ? (
                  <div><span>ZAZU 1212 NFT</span><code>{ZAZU.nftContractAddress}</code><ExternalLink href={ZAZU.nftContractExplorerUrl}>VIEW ↗</ExternalLink></div>
                ) : null}
                <div><span>CHAIN ID</span><code>{ZAZU.chainId}</code><ExternalLink href={ZAZU.explorerBase}>EXPLORER ↗</ExternalLink></div>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <footer className="site-footer">
        <div className="footer-main">
          <div className="footer-brand">
            <Image src="/zazu-logo.jpg" alt="" width={56} height={56} />
            <div><strong>$ZAZU</strong><span>BUYBACK. BURN. REPEAT.</span></div>
          </div>
          <div className="footer-links">
            <a href="#mint">Mint Zazu ↑</a>
            {ZAZU.xUrl ? <ExternalLink href={ZAZU.xUrl}>Project X ↗</ExternalLink> : null}
            <ExternalLink href={ZAZU.instagramUrl}>Zazu Instagram ↗</ExternalLink>
            <ExternalLink href={ZAZU.tiktokUrl}>Zazu TikTok ↗</ExternalLink>
            <ExternalLink href={ZAZU.ponsUrl}>Pons ↗</ExternalLink>
            <ExternalLink href={ZAZU.explorerBase}>Explorer ↗</ExternalLink>
          </div>
        </div>
        <div className="footer-legal">
          <p>$ZAZU is a community meme token and can lose all value. Nothing here is financial advice.</p>
          <p>Built on Robinhood Chain. Powered by Pons. Not affiliated with or endorsed by Robinhood, Pons, a DEX, or Zazu&apos;s owner.</p>
          <a href="#top">TOP ↑</a>
        </div>
      </footer>
    </main>
  );
}
