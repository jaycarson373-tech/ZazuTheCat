"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

type AppId = "welcome" | "merger" | "updates" | "token";
const apps: { id: AppId; name: string; file: string }[] = [
  { id: "welcome", name: "My Sloth", file: "Welcome.exe" },
  { id: "merger", name: "The merger", file: "Merger_agreement.txt" },
  { id: "updates", name: "Sloth Update", file: "Sloth_update.exe" },
  { id: "token", name: "MSLOTH", file: "Token_information.txt" },
];

function AppIcon({ kind }: { kind: AppId }) {
  return <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
    {kind === "welcome" ? <><rect x="4" y="5" width="24" height="17" rx="2"/><path d="M11 28h10M16 22v6M9 11h14M9 15h9"/></> : null}
    {kind === "merger" ? <><path d="M8 3h11l6 6v20H8zM19 3v7h6M12 15h9M12 19h9M12 23h6"/></> : null}
    {kind === "updates" ? <><path d="M26 12a11 11 0 0 0-19-4L4 12m0-8v8h8M6 20a11 11 0 0 0 19 4l3-4m0 8v-8h-8"/></> : null}
    {kind === "token" ? <><circle cx="16" cy="16" r="12"/><path d="M20 11h-6a3 3 0 0 0 0 6h4a3 3 0 0 1 0 6h-6M16 7v4m0 12v3"/></> : null}
  </svg>;
}

export function SlothDesktop() {
  const [active, setActive] = useState<AppId>("welcome");
  const [visible, setVisible] = useState(true);
  const [maximized, setMaximized] = useState(false);
  const [launcher, setLauncher] = useState(false);
  const [notice, setNotice] = useState(true);
  const [progress, setProgress] = useState(1);
  const [updating, setUpdating] = useState(false);
  const current = apps.find(app => app.id === active)!;

  useEffect(() => {
    if (!updating || progress >= 4) return;
    const timer = setTimeout(() => setProgress(value => value + 1), 8000);
    return () => clearTimeout(timer);
  }, [updating, progress]);

  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setLauncher(false); setMaximized(false); } };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, []);

  function open(id: AppId) { setActive(id); setVisible(true); setLauncher(false); }

  return <main className="sloth-desktop">
    <header className="os-header">
      <Link href="/" className="sloth-brand" aria-label="MicroSloth home"><span className="sloth-mark" aria-hidden="true"><i/><i/><i/><i/></span>MicroSloth<span className="brand-inc">Corporation</span></Link>
      <div className="os-edition">SLOTH OS <span>PERSONAL EDITION</span></div>
      <span className="connection"><i/>All systems taking it easy</span>
    </header>

    <div className="desktop-workspace">
      <nav className="desktop-shortcuts" aria-label="Desktop apps">
        {apps.map(app => <button key={app.id} onClick={() => open(app.id)} aria-pressed={visible && active === app.id}>
          <span className={`desktop-app-icon icon-${app.id}`}><AppIcon kind={app.id}/></span><span>{app.name}</span>
        </button>)}
      </nav>
      <div className="wallpaper-word" aria-hidden="true">Take your time.</div>

      {visible ? <section className={`os-window ${maximized ? "is-maximized" : ""}`} aria-label={current.name}>
        <div className="window-titlebar"><span><AppIcon kind={active}/>{current.file}</span><div className="window-controls">
          <button aria-label="Minimize window" title="Minimize" onClick={() => setVisible(false)}><svg viewBox="0 0 16 16"><path d="M3 11h10"/></svg></button>
          <button aria-label={maximized ? "Restore window" : "Maximize window"} title="Resize" onClick={() => setMaximized(value => !value)}><svg viewBox="0 0 16 16"><rect x="3" y="3" width="10" height="10"/></svg></button>
          <button aria-label="Close window" title="Close" onClick={() => setVisible(false)}><svg viewBox="0 0 16 16"><path d="m4 4 8 8m0-8-8 8"/></svg></button>
        </div></div>
        <div className="window-toolbar"><span>MicroSloth Corporation</span><span>Productivity is a state of mind.</span></div>

        {active === "welcome" ? <div className="welcome-app">
          <div className="welcome-copy"><p className="os-eyebrow">MICROSOFT × SLOTH · A FICTIONAL MERGER</p><h1>Almost<br/>ready<span>.</span></h1><p className="welcome-description">The next era of productivity.<br/>We’ll get to it.</p>
            <div className="welcome-actions"><button className="os-primary" onClick={() => open("merger")}>Explore the merger</button><button className="os-text-button" onClick={() => open("updates")}>Check for updates</button></div>
            <div className="system-caption"><span className="status-dot"/><div><strong>Less hustle. More branch.</strong><span>Powered by SlothOS. Running at our own pace.</span></div></div>
          </div>
          <div className="ceo-portrait"><Image src="/microsloth-ceo.jpg" alt="The fictional MicroSloth CEO, a sloth in a business suit asleep at his desk" fill priority sizes="(max-width: 760px) 100vw, 45vw"/><span className="portrait-badge"><i/>CEO STATUS: AWAY</span><div className="portrait-caption"><span>Meet the new management.</span><strong>Chief Executive Sloth</strong></div></div>
        </div> : null}

        {active === "merger" ? <article className="document-app"><p className="os-eyebrow">INTERNAL MEMO 001 · COMMUNITY FICTION</p><h1>A slower kind<br/>of takeover.</h1><p className="document-lead">Microsoft wanted to slow down AI.<br/>They hired someone qualified.</p><div className="merger-body"><p>In the MicroSloth universe, a sloth wandered into a board meeting and fell asleep in the CEO’s chair. Nobody wanted to interrupt. By the time he woke up, the paperwork was complete.</p><p>The new management replaced Windows with SlothOS, moved the cloud to a tree, and extended the lunch break indefinitely.</p></div><div className="memo-terms"><div><span>01 / OPERATIONS</span><strong>All deadlines are suggestions.</strong></div><div><span>02 / INNOVATION</span><strong>Think outside the branch.</strong></div><div><span>03 / OUTLOOK</span><strong>We’ll reply eventually.</strong></div></div><p className="memo-signature">Approved in principle.<br/><span>Chief Executive Sloth · Signature pending</span></p></article> : null}

        {active === "updates" ? <div className="utility-app"><span className="utility-icon"><AppIcon kind="updates"/></span><p className="os-eyebrow">SLOTHOS UPDATE CENTRE</p><h1>Good things<br/>take a while.</h1><p>{progress >= 4 ? "Waiting for the CEO to approve the next percentage." : updating ? "Installing ambition. Please make yourself comfortable." : "Your system is ready to become marginally more productive."}</p><div className="update-progress"><div><span>{updating ? "Installing SlothOS 0.02" : "SlothOS 0.02 available"}</span><strong>{progress}%</strong></div><progress value={progress} max={100} aria-label="Simulated SlothOS update progress"/></div><p className="update-estimate">Estimated time remaining: after lunch.</p><button className="os-primary" onClick={() => setUpdating(value => !value)}>{updating ? "Pause update" : progress > 1 ? "Resume update" : "Install update"}</button><small>This is a desktop simulation. Your device is not being updated.</small></div> : null}

        {active === "token" ? <div className="utility-app token-app"><span className="utility-icon"><AppIcon kind="token"/></span><p className="os-eyebrow">THE COMMUNITY CONCEPT</p><h1>MSLOTH<span>.</span></h1><p>Big tech meets the art of doing less.</p><dl className="token-details"><div><dt>Concept ticker</dt><dd>MSLOTH</dd></div><div><dt>Proposed stock pair</dt><dd>Microsoft · MSFT</dd></div><div><dt>Launch status</dt><dd>Not announced</dd></div><div><dt>Contract address</dt><dd>Not available</dd></div></dl><a className="os-primary" href="https://www.stonkfun.xyz" target="_blank" rel="noopener noreferrer">Explore Stonk</a><small>Pair availability and a MicroSloth launch have not been confirmed.</small></div> : null}
        <div className="window-status"><span><i/>Ready. More or less.</span><span>MSLOTH / CONCEPT BUILD 0.01</span></div>
      </section> : <div className="desktop-empty"><h1>No rush.</h1><p>Open an app from the desktop or Start.</p><button className="os-primary" onClick={() => open("welcome")}>Open My Sloth</button></div>}

      {notice && active === "welcome" && visible ? <aside className="desktop-notice"><span className="notice-icon"><AppIcon kind="updates"/></span><div><strong>An update is available.</strong><span>So is a nap. Choose wisely.</span><button onClick={() => { open("updates"); setNotice(false); }}>View update</button></div><button className="notice-close" aria-label="Dismiss update notification" onClick={() => setNotice(false)}>×</button></aside> : null}
    </div>

    <footer className="desktop-disclaimer">A community meme concept. Fictional merger. Not affiliated with Microsoft Corporation.</footer>
    <div className="os-taskbar">
      <div className="start-area"><button className={`start-button ${launcher ? "is-open" : ""}`} aria-expanded={launcher} aria-controls="start-launcher" onClick={() => setLauncher(value => !value)}><span className="sloth-mark" aria-hidden="true"><i/><i/><i/><i/></span>Start</button>
        {launcher ? <nav id="start-launcher" className="start-launcher" aria-label="Start apps"><span className="launcher-label">MICROSLOTH / YOUR DESKTOP</span>{apps.map(app => <button key={app.id} onClick={() => open(app.id)}><AppIcon kind={app.id}/>{app.name}</button>)}<p>Log off. Go outside. Find a tree.</p></nav> : null}
      </div>
      <span className="taskbar-divider"/><button className={`taskbar-app ${visible ? "is-active" : ""}`} onClick={() => { setVisible(value => !value); setLauncher(false); }} aria-label={visible ? `Minimize ${current.name}` : `Restore ${current.name}`}><AppIcon kind={active}/><span>{current.name}</span></button>
      <div className="taskbar-tray"><span className="tray-status"><i/>99% idle</span><span>Office hours: eventually</span></div>
    </div>
  </main>;
}
