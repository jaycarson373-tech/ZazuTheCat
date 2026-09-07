"use client";

import { useState } from "react";

const excuses = ["Mercury is in retrograde.", "My Pilates class ran over.", "The Starbucks queue was a spiritual test.", "My birth chart said no.", "I needed to recover from my rest day."];

export function FoidButton() {
  const [index, setIndex] = useState(0);
  return <div className="foid-excuse-generator"><span>OFFICIAL EXCUSE GENERATOR</span><p role="status" aria-live="polite">“{excuses[index]}”</p><button className="foid-button foid-button-dark" onClick={() => setIndex(value => (value + 1) % excuses.length)}>Get another excuse</button><small>For entertainment. Obviously.</small></div>;
}
