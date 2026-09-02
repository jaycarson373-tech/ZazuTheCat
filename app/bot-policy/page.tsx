import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Shiesty PFP Bot Policy | Dog Wif Shiesty",
  description: "Privacy, retention, and use terms for the opt-in Dog Wif Shiesty X profile-picture bot.",
};

export default function BotPolicyPage() {
  return (
    <main className="policy-page">
      <header className="policy-header">
        <Link className="brand" href="/" aria-label="Back to Dog Wif Shiesty">
          <span className="brand-avatar"><Image src="/shiesty-logo.jpg" alt="" fill priority sizes="49px" /></span>
          <span className="brand-copy"><strong>DOG WIF SHIESTY</strong><small>BOT POLICY</small></span>
        </Link>
        <Link className="header-chip header-chip-neon" href="/">BACK TO SITE ↑</Link>
      </header>

      <article className="policy-shell">
        <p className="eyebrow"><i /> OPT-IN PFP EDITOR</p>
        <h1>MASK ON.<br />DATA LIGHT.</h1>
        <p className="policy-intro">This policy explains what happens when you directly ask the Shiesty X bot to edit your public profile picture.</p>

        <div className="policy-grid">
          <section>
            <span>01</span>
            <h2>WHAT IT USES</h2>
            <p>The bot reads the public post that summoned it, your public X account ID and username, and the public profile-picture URL returned by the X API.</p>
          </section>
          <section>
            <span>02</span>
            <h2>IMAGE HANDLING</h2>
            <p>Your public PFP is downloaded only to moderate and complete the requested AI edit through OpenAI. The finished image is uploaded to X for the reply. Temporary source and output files are deleted after the request finishes.</p>
          </section>
          <section>
            <span>03</span>
            <h2>WHAT STAYS</h2>
            <p>The source post ID, X user ID, username, processing status, reply ID, and limited error details may be retained to prevent duplicate replies, enforce limits, and honor opt-outs. Generated images are not stored in the bot database.</p>
          </section>
          <section>
            <span>04</span>
            <h2>YOUR CONTROL</h2>
            <p>Use the exact phrase “shiesty me” to request one edit. Mention the bot with “STOP” to opt out. An opted-out account will not receive another automated image reply.</p>
          </section>
        </div>

        <div className="policy-terms">
          <h2>USE TERMS</h2>
          <p>Only submit images you are allowed to use. The output is AI-edited and may contain mistakes. Do not use the bot to impersonate, harass, deceive, or target another person. Requests may be declined for safety, technical, rate-limit, or platform-policy reasons. Processing uses OpenAI and the official X API, subject to those services&apos; terms and privacy practices.</p>
        </div>

        <footer className="policy-footer"><span>UPDATED SEPTEMBER 2, 2026</span><Link href="/">DOG WIF SHIESTY ↗</Link></footer>
      </article>
    </main>
  );
}
