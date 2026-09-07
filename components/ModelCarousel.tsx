"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

const models = [
  { name: "TESLLAMA S", type: "Executive", color: "Pearl White", swatch: "#ede6dd", image: "/tesllama-s.jpg" },
  { name: "TESLLAMA X", type: "Utility", color: "Obsidian", swatch: "#292929", image: "/tesllama-x.jpg" },
  { name: "TESLLAMA CT", type: "All-Terrain", color: "Lunar Silver", swatch: "#aeb2b7", image: "/tesllama-ct.jpg" },
] as const;

export function ModelCarousel() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setActive((current) => (current + 1) % models.length), 6500);
    return () => window.clearInterval(timer);
  }, []);

  const model = models[active];

  return (
    <div className="model-carousel">
      <div className="model-images" aria-live="polite">
        {models.map((item, index) => (
          <Image key={item.name} className={index === active ? "is-active" : ""} src={item.image} alt={`${item.name} community vehicle concept in ${item.color}`} aria-hidden={index !== active} fill priority={index === 0} sizes="100vw" />
        ))}
        <div className="model-shade" />
      </div>

      <div className="model-copy">
        <p>{model.type} concept</p>
        <h1>{model.name}</h1>
        <span>{model.color}</span>
        <div className="model-actions">
          <Link className="primary-action" href="/shop">Order now</Link>
          <a className="secondary-action" href="#lore">Discover the lore</a>
        </div>
      </div>

      <div className="model-picker" role="group" aria-label="Select a Tesllama model">
        {models.map((item, index) => (
          <button key={item.name} className={index === active ? "is-active" : ""} onClick={() => setActive(index)} type="button" aria-pressed={index === active}>
            <span className="color-swatch" style={{ background: item.swatch }} />
            <span><strong>{item.name.replace("TESLLAMA ", "")}</strong><small>{item.color}</small></span>
          </button>
        ))}
      </div>

      <div className="slide-controls">
        <button type="button" onClick={() => setActive((active - 1 + models.length) % models.length)} aria-label="Previous model">Previous</button>
        <span>{String(active + 1).padStart(2, "0")} / {String(models.length).padStart(2, "0")}</span>
        <button type="button" onClick={() => setActive((active + 1) % models.length)} aria-label="Next model">Next</button>
      </div>
    </div>
  );
}
