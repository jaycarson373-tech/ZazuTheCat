"use client";

import Link from "next/link";
import { useState } from "react";

export function FoidHeader() {
  const [open, setOpen] = useState(false);
  return <header className="foid-header">
    <Link href="/" className="foid-wordmark" aria-label="FOID home">FOID.</Link>
    <button className="foid-menu-toggle" aria-expanded={open} aria-controls="foid-nav" onClick={() => setOpen(value => !value)}>{open ? "Close" : "Menu"}</button>
    <nav id="foid-nav" className={open ? "is-open" : ""} aria-label="Main navigation" onClick={() => setOpen(false)}>
      <Link href="/#lore">The lore</Link><Link href="/#pair">The pair</Link><Link href="/airdrops">Airdrops</Link>
      <a className="foid-nav-cta" href="https://www.stonkfun.xyz" target="_blank" rel="noopener noreferrer">Explore Stonk</a>
    </nav>
  </header>;
}
