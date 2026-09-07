import type { Metadata } from "next";
import Link from "next/link";
import { FoidHeader } from "@/components/FoidHeader";
import { FoidFooter } from "@/components/FoidFooter";

export const metadata: Metadata = { title: "FOID | Airdrops", description: "The FOID airdrop hub. Proposed LULU rewards, with dates and eligibility to be announced." };

export default function Airdrops() {
  return <main className="foid-site"><FoidHeader/><section className="foid-airdrop-page"><Link className="foid-back" href="/">Back to FOID</Link><div className="foid-section-label"><span>THE AIRDROP HUB</span><span className="foid-status-pill">NOT LIVE YET</span></div><h1>Good things.<br/><span>Pending.</span></h1><p className="foid-airdrop-intro">The proposed LULU airdrops will live here.<br/>The details need to land before the drops do.</p><div className="foid-drop-grid"><article className="foid-drop-card"><div><span>DROP 001</span><span>UPCOMING CONCEPT</span></div><h2>LULU<br/>airdrop</h2><dl><div><dt>Reward asset</dt><dd>To be confirmed</dd></div><div><dt>Eligibility</dt><dd>To be announced</dd></div><div><dt>Snapshot</dt><dd>Not scheduled</dd></div><div><dt>Claim window</dt><dd>Not open</dd></div></dl><button disabled>Claims not open</button></article><div className="foid-drop-notes"><h2>First the details.<br/>Then the drop.</h2><p>This is the planned airdrop hub. Reward amounts, the exact asset and participation rules have not been announced.</p><p>There is no active claim or wallet connection on this page.</p><Link className="foid-button" href="/#pair">See the pairing concept</Link></div></div></section><FoidFooter/></main>;
}
