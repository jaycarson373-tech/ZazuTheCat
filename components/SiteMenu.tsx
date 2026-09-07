"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export function SiteMenu({ stonkUrl }: { stonkUrl: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [open]);

  return (
    <>
      <button className="menu-button" type="button" onClick={() => setOpen(true)} aria-expanded={open} aria-controls="site-menu">Menu</button>
      {open ? (
        <div className="menu-overlay" id="site-menu" role="dialog" aria-modal="true" aria-label="Site menu" onClick={() => setOpen(false)}>
          <nav className="menu-panel" onClick={(event) => event.stopPropagation()}>
            <button type="button" onClick={() => setOpen(false)}>Close</button>
            <Link href="/#models" onClick={() => setOpen(false)}>Vehicles</Link>
            <Link href="/#lore" onClick={() => setOpen(false)}>Community lore</Link>
            <Link href="/shop" onClick={() => setOpen(false)}>Shop Tesllamas</Link>
            <a href={stonkUrl} target="_blank" rel="noopener noreferrer">View on Stonk</a>
            <small>Community concept. Not affiliated with Tesla, Inc.</small>
          </nav>
        </div>
      ) : null}
    </>
  );
}
