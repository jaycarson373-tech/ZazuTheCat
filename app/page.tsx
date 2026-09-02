import Image from "next/image";
import { CopyButton } from "@/components/CopyButton";
import { MotionController } from "@/components/MotionController";
import { SHIESTY } from "@/lib/shiesty";

const distributionCards = [
  {
    number: "01",
    label: "COMMUNITY DROPS",
    copy: "Rewards for the people wearing the mask and moving the meme.",
  },
  {
    number: "02",
    label: "MEME BOUNTIES",
    copy: "Community creators, editors, artists, and reply guys get their flowers.",
  },
  {
    number: "03",
    label: "PACK CONTESTS",
    copy: "Onchain prizes for the funniest, loudest, most locked-in dogs in the hood.",
  },
  {
    number: "04",
    label: "PUBLIC RECEIPTS",
    copy: "When community rewards move, the transaction links go up for everyone to see.",
  },
] as const;

const flowSteps = [
  {
    number: "01",
    title: "THE PACK TRADES",
    copy: "$SHIESTY moves through Pons on Robinhood Chain.",
  },
  {
    number: "02",
    title: "THE CREATOR SHARE LANDS",
    copy: "The creator share received from the 1% pool fee is reserved for the community.",
  },
  {
    number: "03",
    title: "THE HOOD GETS IT",
    copy: "Drops, bounties, contests, and contributor rewards flow back to the pack.",
  },
] as const;

const botSteps = [
  {
    number: "01",
    title: "TAG THE BOT",
    copy: "Mention or reply to the bot with the exact words \u201cshiesty me.\u201d",
  },
  {
    number: "02",
    title: "PFP LOADED",
    copy: "It reads the public profile picture attached to your X account.",
  },
  {
    number: "03",
    title: "MASK FITTED",
    copy: "The built-in edit adds one clean black shiesty and preserves the original identity and background.",
  },
  {
    number: "04",
    title: "REPLY DROPPED",
    copy: "One request gets one AI-labeled image reply, ready to save as your new PFP.",
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
  const botCommand = SHIESTY.botUsername
    ? `@${SHIESTY.botUsername} shiesty me`
    : 'TAG THE BOT + \u201cSHIESTY ME\u201d';

  return (
    <main>
      <MotionController />
      <div className="scroll-progress" aria-hidden="true" />
      <div className="cursor-glow" aria-hidden="true" />

      <header className="site-header">
        <a className="brand" href="#top" aria-label="Dog Wif Shiesty home">
          <span className="brand-avatar">
            <Image src="/shiesty-logo.jpg" alt="" fill priority sizes="48px" />
          </span>
          <span className="brand-copy">
            <strong>DOG WIF SHIESTY</strong>
            <small>$SHIESTY</small>
          </span>
        </a>

        <nav className="header-nav" aria-label="Main navigation">
          <a href="#hood">The hood</a>
          <a href="#community">1% back</a>
          <a href="#how">How it works</a>
          <a href="#bot">Mask bot</a>
        </nav>

        <div className="header-actions">
          <ExternalLink className="header-chip header-chip-neon" href={SHIESTY.ponsUrl}>PONS ↗</ExternalLink>
          {SHIESTY.tokenAddress ? (
            <div className="header-ca">
              <span>CA</span>
              <code>{`${SHIESTY.tokenAddress.slice(0, 5)}...${SHIESTY.tokenAddress.slice(-4)}`}</code>
              <CopyButton value={SHIESTY.tokenAddress} compact />
            </div>
          ) : (
            <button className="header-chip header-chip-placeholder" type="button" disabled>CA</button>
          )}
          {SHIESTY.xUrl ? (
            <ExternalLink className="header-chip" href={SHIESTY.xUrl}>X ↗</ExternalLink>
          ) : (
            <button className="header-chip header-chip-placeholder" type="button" disabled>X</button>
          )}
        </div>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow"><i /> ROBINHOOD CHAIN&apos;S MASKED DOG</p>
          <p className="hero-overline">DOG WIF</p>
          <h1><span>$</span>SHIESTY</h1>
          <p className="hero-title">IN THE HOOD,<br />WE WEAR SHIESTYS.</p>
          <p className="hero-dek">One dog. One mask. One percent pool fee. Our creator share goes back to the community.</p>

          <div className="hero-actions">
            <ExternalLink className="button button-dark" href={SHIESTY.ponsUrl}>POWERED BY PONS ↗</ExternalLink>
            <a className="button button-light" href="#community">SEE THE 1% ↓</a>
            {SHIESTY.dexUrl ? (
              <ExternalLink className="button button-acid" href={SHIESTY.dexUrl}>BUY $SHIESTY ↗</ExternalLink>
            ) : null}
          </div>

          {SHIESTY.tokenAddress ? (
            <div className="contract-bar">
              <span>CA</span>
              <code>{SHIESTY.tokenAddress}</code>
              <CopyButton value={SHIESTY.tokenAddress} />
            </div>
          ) : null}
        </div>

        <div className="hero-art" aria-label="Forty colorful animals wearing different shiesty masks and accessories">
          <div className="hero-window">
            <div className="window-title">
              <span>THE_SHIESTY_PACK_001-040.JPG</span>
              <span>40 MASKS LOADED</span>
            </div>
            <div className="hero-photo">
              <Image
                src="/shiesty-dog-wall.png"
                alt="A colorful wall of forty masked characters, mainly dogs, wearing different shiestys and accessories"
                fill
                priority
                sizes="(max-width: 820px) 94vw, 58vw"
              />
            </div>
            <div className="hero-sticker"><strong>1%</strong><span>POOL<br />FEE</span></div>
          </div>

          <aside className="hero-mini-board" aria-label="Dog Wif Shiesty protocol facts">
            <div><span>POOL FEE</span><strong>1%</strong></div>
            <div><span>OUR SHARE</span><strong>THE COMMUNITY</strong></div>
            <div><span>CHAIN</span><strong>ROBINHOOD</strong></div>
            <div><span>LAUNCHPAD</span><strong>PONS</strong></div>
          </aside>
        </div>
      </section>

      <div className="ticker" aria-hidden="true">
        <div>
          <span>DOG WIF SHIESTY</span><b>✦</b><span>$SHIESTY</span><b>✦</b><span>1% POOL FEE</span><b>✦</b><span>CREATOR SHARE BACK TO THE COMMUNITY</span><b>✦</b><span>BUILT ON ROBINHOOD CHAIN</span><b>✦</b><span>POWERED BY PONS</span><b>✦</b>
          <span>DOG WIF SHIESTY</span><b>✦</b><span>$SHIESTY</span><b>✦</b><span>1% POOL FEE</span><b>✦</b><span>CREATOR SHARE BACK TO THE COMMUNITY</span><b>✦</b><span>BUILT ON ROBINHOOD CHAIN</span><b>✦</b><span>POWERED BY PONS</span><b>✦</b>
        </div>
      </div>

      <section className="hood-section" id="hood" data-reveal>
        <div className="section-shell">
          <div className="section-kicker section-kicker-light"><span>01</span><p>WELCOME TO THE HOOD</p></div>
          <div className="hood-layout">
            <div className="hood-logo-card">
              <Image src="/shiesty-logo.jpg" alt="Dog Wif Shiesty wearing a black mask and gold chain on a neon background" fill sizes="(max-width: 760px) 88vw, 42vw" />
              <span>MASK ON</span>
            </div>
            <div className="hood-copy">
              <p className="eyebrow eyebrow-light"><i /> THE FIT IS PERMANENT</p>
              <h2>NO HAT.<br />ALL SHIESTY.</h2>
              <p>Some dogs wear hats. This one came from the hood. $SHIESTY is a masked meme running on Robinhood Chain, powered by Pons and backed by a pack that gets the joke.</p>
              <div className="hood-callout">IN THE HOOD, WE WEAR SHIESTYS.</div>
            </div>
          </div>
        </div>
      </section>

      <section className="community-section" id="community" data-reveal>
        <div className="section-shell">
          <div className="section-kicker"><span>02</span><p>THE ONE PERCENT</p></div>
          <div className="community-heading">
            <div className="fee-mark"><strong>1%</strong><span>POOL<br />FEE</span></div>
            <div>
              <p className="eyebrow"><i /> THE PACK EATS TOGETHER</p>
              <h2>IT GOES<br />BACK TO<br />THE HOOD.</h2>
              <p>The project&apos;s creator share from the 1% pool fee is reserved for community rewards. Drops, meme bounties, contests, and contributor support. When it moves, the receipts go public.</p>
            </div>
          </div>

          <div className="distribution-grid">
            {distributionCards.map((card) => (
              <article key={card.number}>
                <span>{card.number}</span>
                <h3>{card.label}</h3>
                <p>{card.copy}</p>
              </article>
            ))}
          </div>
          <p className="reward-note">Community rewards are promotional distributions, not yield, dividends, or guaranteed returns.</p>
        </div>
      </section>

      <section className="flow-section" id="how" data-reveal>
        <div className="section-shell">
          <div className="section-kicker section-kicker-light"><span>03</span><p>HOW IT MOVES</p></div>
          <div className="flow-heading">
            <p className="eyebrow eyebrow-light"><i /> THREE STEPS. ZERO MYSTERY.</p>
            <h2>TRADE.<br />COLLECT.<br />REDISTRIBUTE.</h2>
          </div>
          <div className="flow-grid">
            {flowSteps.map((step) => (
              <article key={step.number}>
                <span>{step.number}</span>
                <h3>{step.title}</h3>
                <p>{step.copy}</p>
              </article>
            ))}
          </div>
          <div className="flow-line"><span>PONS TRADES</span><b>→</b><span>1% POOL FEE</span><b>→</b><span>PROJECT CREATOR SHARE</span><b>→</b><span>THE PACK</span></div>
        </div>
      </section>

      <section className="bot-section" id="bot" data-reveal>
        <div className="section-shell">
          <div className="section-kicker section-kicker-light"><span>04</span><p>THE SHIESTY MACHINE</p></div>
          <div className="bot-layout">
            <div className="bot-copy">
              <p className="eyebrow eyebrow-light"><i /> YOUR PFP. MASK ON.</p>
              <h2>TAG IT.<br />GET<br />SHIESTY.</h2>
              <p>Ask once and the bot fits a signature black shiesty to your public X profile picture, then replies with the finished image.</p>
              <div className="bot-command"><span>TYPE THIS</span><code>{botCommand}</code></div>
              {SHIESTY.botUrl ? (
                <ExternalLink className="button button-bot" href={SHIESTY.botUrl}>TRY THE BOT ON X ↗</ExternalLink>
              ) : (
                <span className="bot-optin-badge">DIRECT REQUESTS ONLY</span>
              )}
            </div>

            <div className="bot-demo" aria-label="Profile picture transformation preview">
              <div className="bot-demo-title"><span>SHIESTY_PFP_MACHINE</span><b>AI EDIT</b></div>
              <div className="bot-transform">
                <article className="bot-avatar-card">
                  <span className="bot-card-label">YOUR PFP</span>
                  <div className="bot-avatar-placeholder" aria-hidden="true"><i /><b /></div>
                  <small>PUBLIC IMAGE IN</small>
                </article>
                <div className="bot-arrow" aria-hidden="true"><span>→</span><small>MASK ON</small></div>
                <article className="bot-avatar-card bot-avatar-card-result">
                  <span className="bot-card-label">SHIESTY PFP</span>
                  <div className="bot-avatar-image">
                    <Image src="/shiesty-logo.jpg" alt="Dog wearing a fitted black shiesty on a neon yellow background" fill sizes="(max-width: 620px) 42vw, 260px" />
                  </div>
                  <small>IMAGE REPLY OUT</small>
                </article>
              </div>
              <div className="bot-terminal" aria-hidden="true">
                <div><span>01</span><p>PFP LOADED</p><b>✓</b></div>
                <div><span>02</span><p>SHIESTY FITTED</p><b>✓</b></div>
                <div><span>03</span><p>REPLY READY</p><b className="bot-terminal-pulse">●</b></div>
              </div>
            </div>
          </div>

          <div className="bot-steps">
            {botSteps.map((step) => (
              <article key={step.number}>
                <span>{step.number}</span>
                <h3>{step.title}</h3>
                <p>{step.copy}</p>
              </article>
            ))}
          </div>
          <p className="bot-safety">OPT-IN ONLY. ONE IMAGE REPLY PER REQUEST. REPLY <strong>STOP</strong> TO OPT OUT. <a href="/bot-policy">PRIVACY + TERMS ↗</a></p>
        </div>
      </section>

      <section className="code-section" data-reveal>
        <div className="section-shell">
          <div className="section-kicker"><span>05</span><p>THE SHIESTY CODE</p></div>
          <div className="code-grid">
            <article><span>01</span><h2>MASK<br />ON.</h2><p>Stay locked in. Protect the pack.</p></article>
            <article><span>02</span><h2>MEMES<br />UP.</h2><p>Make it funny. Make it travel.</p></article>
            <article><span>03</span><h2>RECEIPTS<br />OUT.</h2><p>If the community share moves, everyone sees it.</p></article>
          </div>
        </div>
      </section>

      {SHIESTY.tokenAddress ? (
        <section className="registry-section" id="registry" data-reveal>
          <div className="section-shell registry-layout">
            <div><p className="eyebrow"><i /> VERIFY THE DOG</p><h2>ONE MASK.<br />ONE CA.</h2></div>
            <div className="registry-table">
              <div><span>$SHIESTY TOKEN</span><code>{SHIESTY.tokenAddress}</code><CopyButton value={SHIESTY.tokenAddress} compact /></div>
              <div><span>CHAIN ID</span><code>{SHIESTY.chainId}</code><ExternalLink href={SHIESTY.tokenExplorerUrl}>EXPLORER ↗</ExternalLink></div>
            </div>
          </div>
        </section>
      ) : null}

      <section className="official-banner-section" aria-label="Official Dog Wif Shiesty banner" data-reveal>
        <div className="official-banner-frame">
          <Image
            src="/shiesty-banner.jpg"
            alt="Dog Wif Shiesty banner featuring a crew of masked dogs"
            fill
            sizes="100vw"
          />
        </div>
      </section>

      <footer className="site-footer">
        <div className="footer-main">
          <div className="footer-brand">
            <span><Image src="/shiesty-logo.jpg" alt="" fill sizes="58px" /></span>
            <div><strong>$SHIESTY</strong><small>CREATOR SHARE BACK TO THE HOOD.</small></div>
          </div>
          <div className="footer-links">
            {SHIESTY.xUrl ? <ExternalLink href={SHIESTY.xUrl}>X ↗</ExternalLink> : null}
            <ExternalLink href={SHIESTY.ponsUrl}>Pons ↗</ExternalLink>
            {SHIESTY.dexUrl ? <ExternalLink href={SHIESTY.dexUrl}>Trade ↗</ExternalLink> : null}
            <ExternalLink href={SHIESTY.explorerBase}>Explorer ↗</ExternalLink>
            <a href="/bot-policy">Bot policy ↗</a>
          </div>
        </div>
        <div className="footer-legal">
          <p>$SHIESTY is a community meme token and can lose all value. Nothing here is financial advice.</p>
          <p>Community distributions are discretionary promotional rewards. Buying does not guarantee eligibility. Not dividends, yield, or guaranteed returns. Not affiliated with or endorsed by Robinhood or Pons.</p>
          <a href="#top">TOP ↑</a>
        </div>
      </footer>
    </main>
  );
}
