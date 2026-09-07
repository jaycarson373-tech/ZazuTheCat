"use client";

import { useState } from "react";

export function FoidButton() {
  const [count, setCount] = useState(0);
  const captions = ["Go on. Say it out loud.", "FOID. There it is.", "FOID. Again, apparently.", "This is your vocabulary now."];
  return <div className="foid-say"><button className="foid-button foid-button-dark" onClick={() => setCount(value => value + 1)}>Say it again</button><p role="status" aria-live="polite">{captions[Math.min(count, captions.length - 1)]}{count > 0 ? <span> Your clicks: {count}</span> : null}</p></div>;
}
