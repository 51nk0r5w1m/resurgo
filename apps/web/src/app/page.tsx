import { BrandMark } from "@resurgo/ui/brand-mark";
import { Button } from "@resurgo/ui/button";
import {
  ArrowRight,
  CheckCircle2,
  Compass,
  FileCheck2,
  LockKeyhole,
  Route,
  Scale,
} from "lucide-react";
import Link from "next/link";

const steps = [
  {
    description:
      "Capture your situation through a guided, resumable conversation.",
    icon: Compass,
    number: "01",
    title: "Understand where you are",
  },
  {
    description:
      "See clear next steps and why each one belongs on your roadmap.",
    icon: Route,
    number: "02",
    title: "Build a practical plan",
  },
  {
    description:
      "Keep important records organized in a private, permissioned workspace.",
    icon: FileCheck2,
    number: "03",
    title: "Move forward securely",
  },
] as const;

const principles = [
  "Your case stays private by default.",
  "Recommendations explain their reasoning.",
  "You decide when information is shared.",
] as const;

export default function HomePage() {
  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Resurgo home">
          <BrandMark className="brand-mark" />
          <span>resurgo</span>
        </a>
        <nav aria-label="Primary navigation" className="primary-nav">
          <a href="#how-it-works">How it works</a>
          <a href="#our-approach">Our approach</a>
          <a href="#privacy">Privacy</a>
        </nav>
        <div className="header-actions">
          <Link href="/login">Sign in</Link>
          <Button asChild size="sm">
            <Link href="/register">
              Start privately <ArrowRight aria-hidden="true" size={16} />
            </Link>
          </Button>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">A calmer path through complex change</p>
          <h1>Navigate today. Build tomorrow.</h1>
          <p className="hero-lede">
            Resurgo brings your next steps, important records, and trusted
            support into one secure, guided workspace—so you can move forward
            with clarity.
          </p>
          <div className="hero-actions">
            <Button asChild size="lg">
              <Link href="/register">
                Start privately <ArrowRight aria-hidden="true" size={18} />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href="#how-it-works">See how it works</a>
            </Button>
          </div>
          <p className="scope-note">
            <Scale aria-hidden="true" size={17} />
            Practical coordination—not legal, financial, or clinical advice.
          </p>
        </div>
        <div className="horizon-art" aria-hidden="true">
          <div className="sun" />
          <div className="ridge ridge-back" />
          <div className="ridge ridge-mid" />
          <div className="ridge ridge-front" />
          <div className="path" />
        </div>
      </section>

      <section className="section section-steps" id="how-it-works">
        <div className="section-heading">
          <p className="eyebrow">How it works</p>
          <h2>A plan that starts with your situation.</h2>
          <p>
            Divorce is not one task. Resurgo helps turn many connected decisions
            into an understandable sequence.
          </p>
        </div>
        <div className="step-grid">
          {steps.map(({ description, icon: Icon, number, title }) => (
            <article className="step-card" key={number}>
              <div className="step-card-top">
                <span>{number}</span>
                <Icon aria-hidden="true" size={24} strokeWidth={1.6} />
              </div>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section approach" id="our-approach">
        <div>
          <p className="eyebrow">Our approach</p>
          <h2>Clear coordination. Careful boundaries.</h2>
        </div>
        <div className="approach-copy">
          <p>
            Legal, financial, housing, and personal decisions often overlap.
            Their confidential information should not. Resurgo is being built to
            coordinate the work while keeping each information domain separate.
          </p>
          <ul>
            {principles.map((principle) => (
              <li key={principle}>
                <CheckCircle2 aria-hidden="true" size={19} /> {principle}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="privacy-band" id="privacy">
        <LockKeyhole aria-hidden="true" size={30} strokeWidth={1.5} />
        <div>
          <p className="eyebrow">Privacy by design</p>
          <h2>Your information should travel only with purpose.</h2>
        </div>
        <p>
          Resurgo uses private-by-default access, explicit permissions, and an
          auditable record of sensitive actions as foundational design
          requirements.
        </p>
      </section>

      <footer>
        <a className="brand brand-footer" href="#top" aria-label="Back to top">
          <BrandMark className="brand-mark" />
          <span>resurgo</span>
        </a>
        <p>Navigate today. Build tomorrow.</p>
        <p>Open-source-first · Built for careful coordination</p>
      </footer>
    </main>
  );
}
