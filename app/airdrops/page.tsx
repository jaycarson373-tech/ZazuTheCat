import type { Metadata } from "next";
import Link from "next/link";
import { FoidHeader } from "@/components/FoidHeader";
import { FoidFooter } from "@/components/FoidFooter";

export const metadata: Metadata = { title: "FOID | LULU Airdrops", description: "The FOID LULU airdrop hub. Reward asset: LULU. Dates and eligibility coming soon." };

export default function Airdrops() {
  return <main className="foid-site"><FoidHeader/><section className="foid-airdrop-page"><Link className="foid-back" href="/">Back to FOID</Link><div className="foid-section-label"><span>THE LULU AIRDROP HUB</span><span className="foid-status-pill">COMING SOON</span></div><h1>Good things.<br/><em>In pink.</em></h1><p className="foid-airdrop-intro">The reward is LULU.<br/>The group chat will want to hear about this.</p><div className="foid-drop-grid"><article className="foid-drop-card"><div><span>DROP 001</span><span>NOT LIVE YET</span></div><h2>LULU<br/><em>airdrop.</em></h2><dl><div><dt>Reward asset</dt><dd>LULU</dd></div><div><dt>Eligibility</dt><dd>To be announced</dd></div><div><dt>Snapshot</dt><dd>Not scheduled</dd></div><div><dt>Claim window</dt><dd>Not open</dd></div></dl><button disabled>Claims not open</button></article><div className="foid-drop-notes"><h2>First the details.<br/><em>Then the drop.</em></h2><p>FOID’s airdrop plan rewards the community with LULU. Reward amounts, eligibility, snapshot dates and the claim process will be announced here.</p><p>There is no active claim or wallet connection on this page yet.</p><Link className="foid-button" href="/#pair">See the pairing</Link></div></div></section><FoidFooter/></main>;
}
