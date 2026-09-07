"use client";

import { useRef, useState } from "react";
import Link from "next/link";

export function SiteMenu({ stonkUrl }: { stonkUrl: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  function closeMenu() { dialog.current?.close(); }

  return <>
    <button ref={trigger} className="menu-button" type="button" aria-expanded={open} aria-controls="site-menu"
      onClick={() => { dialog.current?.showModal(); setOpen(true); }}>Menu</button>
    <dialog ref={dialog} className="site-menu-dialog" id="site-menu" aria-label="Site menu"
      onClose={() => { setOpen(false); trigger.current?.focus(); }}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = event.currentTarget.querySelectorAll<HTMLElement>("button, a[href]");
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }}
      onClick={(event) => { if (event.target === event.currentTarget) closeMenu(); }}>
      <div className="menu-inner">
        <div className="menu-top"><span>TESLLAMA</span><button type="button" onClick={closeMenu} autoFocus>Close</button></div>
        <p className="section-label">EXPLORE</p>
        <nav aria-label="Expanded navigation">
          <Link href="/#models" onClick={closeMenu}><span>01</span>Models</Link>
          <Link href="/shop" onClick={closeMenu}><span>02</span>Shop Tesllamas</Link>
          <Link href="/#lore" onClick={closeMenu}><span>03</span>The story</Link>
        </nav>
        <div className="menu-bottom">
          <div className="tesllama-social-links">
            <a href={stonkUrl} target="_blank" rel="noopener noreferrer">TESLLAMA on Stonk</a>
            <a href="https://x.com/Tesllama" target="_blank" rel="noopener noreferrer">Follow on X</a>
          </div>
          <p>Paired with Tesla (TSLA).</p>
        </div>
      </div>
    </dialog>
  </>;
}
