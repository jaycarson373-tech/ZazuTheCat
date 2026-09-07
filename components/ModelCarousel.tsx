"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { tesllamaModels as models } from "@/lib/tesllama-models";

export function ModelCarousel() {
  const [active, setActive] = useState(0);
  const [finishes, setFinishes] = useState([0, 0, 0]);
  const [playing, setPlaying] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(false);
  const gesture = useRef<{ x: number; y: number } | null>(null);
  const model = models[active];
  const finish = model.finishes[finishes[active]];

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const motionChanged = () => setPlaying(!media.matches);
    const visibilityChanged = () => setHidden(document.hidden);
    motionChanged();
    media.addEventListener("change", motionChanged);
    document.addEventListener("visibilitychange", visibilityChanged);
    return () => {
      media.removeEventListener("change", motionChanged);
      document.removeEventListener("visibilitychange", visibilityChanged);
    };
  }, []);

  useEffect(() => {
    if (!playing || hovering || focused || hidden) return;
    const timer = window.setInterval(() => setActive((value) => (value + 1) % models.length), 7000);
    return () => window.clearInterval(timer);
  }, [playing, hovering, focused, hidden]);

  function selectModel(index: number) {
    setActive((index + models.length) % models.length);
    setPlaying(false);
  }

  return (
    <div className="vehicle-showcase" role="region" aria-roledescription="carousel" aria-label="Tesllama collection"
      onMouseEnter={() => setHovering(true)} onMouseLeave={() => setHovering(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
      <div className="vehicle-heading">
        <p className="section-label">THE TESLLAMA COLLECTION</p>
        <h1>{model.name}</h1>
        <p className="vehicle-body">{model.body} <span>Community concept</span></p>
      </div>

      <div className="vehicle-stage" aria-label={`${model.name} in ${finish.name}`}
        onTouchStart={(event) => { gesture.current = { x: event.touches[0].clientX, y: event.touches[0].clientY }; }}
        onTouchEnd={(event) => {
          if (!gesture.current) return;
          const dx = event.changedTouches[0].clientX - gesture.current.x;
          const dy = event.changedTouches[0].clientY - gesture.current.y;
          if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) selectModel(active + (dx < 0 ? 1 : -1));
          gesture.current = null;
        }}>
        {models.flatMap((item, modelIndex) => item.finishes.map((color, colorIndex) => {
          const selected = active === modelIndex && finishes[active] === colorIndex;
          return <Image key={color.image} className={selected ? "vehicle-image is-active" : "vehicle-image"}
            src={color.image} alt={selected ? `${item.name} in ${color.name}` : ""} aria-hidden={!selected}
            fill priority={modelIndex === 0 && colorIndex === 0} sizes="(max-width: 700px) 100vw, 85vw" />;
        }))}
      </div>

      <div className="vehicle-config">
        <fieldset className="model-options"><legend>Model</legend>
          {models.map((item, index) => <button key={item.id} type="button" aria-pressed={active === index}
            className={active === index ? "selected" : ""} onClick={() => selectModel(index)}>{item.label}</button>)}
        </fieldset>
        <fieldset className="finish-options"><legend>Finish <span>{finish.name}</span></legend>
          {model.finishes.map((color, index) => <button key={color.id} type="button" aria-label={color.name}
            aria-pressed={finishes[active] === index} title={color.name} className={finishes[active] === index ? "selected" : ""}
            onClick={() => { setFinishes((current) => current.map((value, i) => i === active ? index : value)); setPlaying(false); }}>
            <span style={{ background: color.swatch }} />
          </button>)}
        </fieldset>
        <div className="vehicle-order"><Link className="primary-action" href={`/shop?model=${model.id}&color=${finish.id}`}>Shop this model</Link><span>Collection coming soon</span></div>
      </div>

      <div className="carousel-navigation">
        <div><button type="button" onClick={() => selectModel(active - 1)} aria-label="Previous model">Previous</button>
          <span aria-hidden="true">0{active + 1} / 03</span>
          <button type="button" onClick={() => selectModel(active + 1)} aria-label="Next model">Next</button></div>
        <button type="button" onClick={() => { if (!playing) { setFocused(false); setHovering(false); } setPlaying((value) => !value); }} aria-label={playing ? "Pause slideshow" : "Play slideshow"}>{playing ? "Pause slideshow" : "Play slideshow"}</button>
      </div>
      <span className="sr-only" role="status" aria-live={playing ? "off" : "polite"}>{model.name}, {finish.name}</span>
    </div>
  );
}
