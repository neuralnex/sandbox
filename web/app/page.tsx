"use client";

import { useState, type FormEvent } from "react";
import {
  ArrowDown, ArrowRight, ArrowUpRight, Check, Compass, FlaskConical,
  Layers3, LockKeyhole, Mail, ArrowDownToLine, ShieldCheck, Sparkles, Waypoints,
} from "lucide-react";
import { API_URL } from "@/lib/api";

const capabilities = [
  {
    icon: Compass,
    number: "01",
    title: "Start with the idea",
    text: "Talk through the problem, the people you want to serve, and the place you want to begin. No spreadsheets required.",
  },
  {
    icon: Sparkles,
    number: "02",
    title: "Build the case",
    text: "Turn your answers into a clear brief, research trail, and assumptions you can inspect and challenge.",
  },
  {
    icon: FlaskConical,
    number: "03",
    title: "Explore what could happen",
    text: "Run a model when there is enough evidence. Change a premise, compare outcomes, and see the upside and the risk.",
  },
];

const outputs = [
  "A sharper product and audience brief",
  "Research with sources and visible caveats",
  "Scenarios that make assumptions explicit",
  "A balanced readout: potential, risk, and next evidence to gather",
];

export default function LandingPage() {
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [error, setError] = useState("");

  async function joinWaitlist(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setError("");
    try {
      const response = await fetch(`${API_URL}/waitlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, website, source: "landing_page" }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(typeof body?.detail === "string" ? body.detail : "We could not save your email. Please try again.");
      }
      setStatus("success");
      setEmail("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We could not save your email. Please try again.");
      setStatus("error");
    }
  }

  return <main className="landing-page">
    <header className="landing-nav">
      <a href="#top" className="landing-brand" aria-label="Sandbox home">
        <span className="landing-mark">SD</span>
        <span>sandbox<span className="landing-brand-dot">.</span></span>
      </a>
      <nav className="landing-nav-links" aria-label="Main navigation">
        <a href="#how-it-works">How it works</a>
        <a href="#what-you-get">What you get</a>
      </nav>
      <div className="landing-nav-actions">
        <a className="landing-nav-waitlist" href="#waitlist">Join the waitlist <ArrowUpRight size={15} aria-hidden="true" /></a>
        <button className="landing-start-disabled" type="button" disabled aria-describedby="launch-note">Start now</button>
      </div>
      <a className="landing-mobile-cta" href="#waitlist" aria-label="Join the waitlist"><ArrowDownToLine size={18} aria-hidden="true" /></a>
    </header>

    <section className="landing-hero" id="top">
      <div className="landing-hero-copy">
        <div className="landing-eyebrow"><span className="landing-live-dot" /> A clearer way to explore what’s next</div>
        <h1>Your next big idea,<br /><span>put to the test.</span></h1>
        <p className="landing-lede">A thoughtful space to shape a business idea, explore the market around it, and see what your assumptions could mean before you build.</p>
        <div className="landing-hero-actions">
          <a href="#waitlist" className="landing-button-primary">Get early access <ArrowRight size={17} aria-hidden="true" /></a>
          <a href="#how-it-works" className="landing-button-text">See how it works <ArrowDown size={15} aria-hidden="true" /></a>
        </div>
        <p className="landing-launch-note" id="launch-note"><LockKeyhole size={13} aria-hidden="true" /> Start now is opening soon. Join the waitlist for launch updates.</p>
        <div className="landing-proofline"><span><Check size={14} aria-hidden="true" /> No technical setup</span><span><Check size={14} aria-hidden="true" /> Your assumptions stay visible</span></div>
      </div>

      <div className="landing-visual" aria-label="A preview of the Sandbox idea exploration workflow">
        <div className="landing-orbit landing-orbit-one" />
        <div className="landing-orbit landing-orbit-two" />
        <div className="landing-visual-caption"><span className="landing-caption-kicker">THE IDEA EXPLORER</span><span>From first thought to informed next step</span></div>
        <div className="landing-preview-card landing-preview-main">
          <div className="landing-preview-top"><span className="landing-preview-icon"><Waypoints size={17} aria-hidden="true" /></span><span>YOUR EXPLORATION</span><span className="landing-preview-step">01 / 03</span></div>
          <p className="landing-preview-question">What do you want<br />to build?</p>
          <div className="landing-preview-answer">“A simpler way for neighborhood shops to manage deliveries.”</div>
          <div className="landing-preview-progress"><span /></div>
          <div className="landing-preview-foot"><span>Start with the rough idea.</span><span className="landing-preview-arrow"><ArrowRight size={14} aria-hidden="true" /></span></div>
        </div>
        <div className="landing-preview-card landing-preview-research">
          <div className="landing-small-label"><span className="landing-mini-icon"><Compass size={14} aria-hidden="true" /></span> MARKET SIGNALS</div>
          <div className="landing-research-row"><span>Customer need</span><span className="landing-signal-chip">Researching</span></div>
          <div className="landing-research-row"><span>Launch market</span><strong>Founder-defined</strong></div>
          <div className="landing-research-rule" /><div className="landing-research-source"><span className="landing-source-dot" /> Sources stay attached</div>
        </div>
        <div className="landing-preview-card landing-preview-model">
          <div className="landing-small-label"><span className="landing-mini-icon landing-mini-teal"><FlaskConical size={14} aria-hidden="true" /></span> THE SANDBOX</div>
          <div className="landing-model-title">Change one thing.<br /><span>See what moves.</span></div>
          <div className="landing-model-bars" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></div>
          <div className="landing-model-foot"><span>Assumptions, risks, and ranges</span><ArrowUpRight size={14} aria-hidden="true" /></div>
        </div>
        <span className="landing-spark landing-spark-a">✳</span><span className="landing-spark landing-spark-b">✳</span>
        <p className="landing-visual-disclaimer">A glimpse of the workflow · example content</p>
      </div>
    </section>

    <div className="landing-marquee" aria-label="Describe. Research. Explore. Decide.">
      <span>DESCRIBE</span><i /> <span>RESEARCH</span><i /> <span>EXPLORE</span><i /> <span>DECIDE</span><i /> <span>DESCRIBE</span><i /> <span>RESEARCH</span>
    </div>

    <section className="landing-section landing-how" id="how-it-works">
      <div className="landing-section-heading"><p className="landing-kicker">A better first step</p><h2>Build the understanding<br />before the product.</h2><p>Big decisions deserve more than a gut feeling or a spreadsheet full of guesses.</p></div>
      <div className="landing-steps">{capabilities.map(({ icon: Icon, number, title, text }) => <article className="landing-step" key={number}><div className="landing-step-top"><span className="landing-step-number">{number}</span><Icon size={19} strokeWidth={1.7} aria-hidden="true" /></div><h3>{title}</h3><p>{text}</p><span className="landing-step-line" /></article>)}</div>
    </section>

    <section className="landing-proof-section" id="what-you-get">
      <div className="landing-proof-art" aria-hidden="true">
        <div className="landing-proof-disc"><div className="landing-proof-disc-inner"><span>SD</span><small>IDEA → EVIDENCE</small></div></div>
        <div className="landing-proof-sticker"><Layers3 size={18} /><span>THINK<br />IN SYSTEMS</span></div>
        <div className="landing-proof-note">Less guesswork.<br /><em>More signal.</em></div>
      </div>
      <div className="landing-proof-copy"><p className="landing-kicker">A useful kind of clarity</p><h2>See the whole picture.<br /><span>Especially the hard parts.</span></h2><p className="landing-proof-lede">Sandbox helps you think through the business, not just the exciting part. Explore what might work, what could break, and what you still need to learn.</p><ul>{outputs.map((output) => <li key={output}><span><Check size={14} aria-hidden="true" /></span>{output}</li>)}</ul><div className="landing-trust-note"><ShieldCheck size={17} aria-hidden="true" /><span>Models show outcomes under stated assumptions. They are tools for exploration, not promises about the future.</span></div></div>
    </section>

    <section className="landing-final-cta" id="waitlist">
      <div className="landing-final-orbit" aria-hidden="true" />
      <div className="landing-final-copy"><p className="landing-kicker">Early access is on the way</p><h2>Bring the idea.<br /><span>We’ll help you see it clearly.</span></h2><p>Join the waitlist for launch news and an invitation to explore Sandbox.</p></div>
      <div className="landing-waitlist-box">
        {status === "success" ? <div className="landing-success" role="status"><span><Check size={18} aria-hidden="true" /></span><div><strong>You’re on the list.</strong><p>We’ll be in touch when early access opens.</p></div></div> : <form onSubmit={(event) => void joinWaitlist(event)} aria-busy={status === "sending"}>
          <label htmlFor="waitlist-email">Your email</label>
          <div className="landing-email-row"><span><Mail size={17} aria-hidden="true" /></span><input id="waitlist-email" type="email" autoComplete="email" required maxLength={320} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" aria-invalid={status === "error" || undefined} aria-describedby={status === "error" ? "waitlist-error" : "waitlist-privacy"} /><button type="submit" disabled={status === "sending"}>{status === "sending" ? "Saving…" : "Join the waitlist"}<ArrowRight size={15} aria-hidden="true" /></button></div>
          <div className="landing-honeypot" aria-hidden="true"><label htmlFor="waitlist-website">Leave this field empty</label><input id="waitlist-website" tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} /></div>
          {status === "error" ? <p className="landing-form-error" id="waitlist-error" role="alert">{error}</p> : <p className="landing-privacy" id="waitlist-privacy">Just launch news and early access details. No noise.</p>}
        </form>}
        <div className="landing-disabled-cta"><button type="button" disabled>Start now <LockKeyhole size={13} aria-hidden="true" /></button><span>Opening soon</span></div>
      </div>
    </section>

    <footer className="landing-footer"><a href="#top" className="landing-brand"><span className="landing-mark">SD</span><span>sandbox<span className="landing-brand-dot">.</span></span></a><p>Good ideas deserve a place to be explored.</p><span>© {new Date().getFullYear()} Sandbox Studio</span></footer>
  </main>;
}
