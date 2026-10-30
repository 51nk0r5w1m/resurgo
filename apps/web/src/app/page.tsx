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
          <svg
            className="horizon-scene"
            data-testid="horizon-scene"
            preserveAspectRatio="xMidYMax slice"
            viewBox="0 0 900 720"
          >
            <defs>
              <radialGradient id="resurgo-sun" cx="42%" cy="38%" r="62%">
                <stop offset="0" stopColor="#fffaf0" />
                <stop offset="0.72" stopColor="#ead9bc" />
                <stop offset="1" stopColor="#e2ceb0" stopOpacity="0.42" />
              </radialGradient>
              <linearGradient id="ridge-back" x1="0" x2="1" y1="0" y2="1">
                <stop offset="0" stopColor="#d6d4c8" />
                <stop offset="1" stopColor="#a8ada1" />
              </linearGradient>
              <linearGradient id="ridge-mid" x1="0" x2="1" y1="0" y2="1">
                <stop offset="0" stopColor="#89988c" />
                <stop offset="1" stopColor="#536d64" />
              </linearGradient>
              <linearGradient id="ridge-front" x1="0" x2="0.9" y1="0" y2="1">
                <stop offset="0" stopColor="#405f55" />
                <stop offset="1" stopColor="#173b34" />
              </linearGradient>
            </defs>
            <circle cx="430" cy="220" fill="url(#resurgo-sun)" r="176" />
            <path
              d="M0 370 C108 344 160 350 244 326 C328 302 384 344 458 326 C548 304 610 260 688 284 C766 308 828 283 900 266 L900 720 L0 720 Z"
              fill="url(#ridge-back)"
              data-landscape-layer="ridge"
            />
            <path
              d="M0 418 C100 392 158 414 240 382 C318 352 382 374 454 354 C548 328 592 292 668 320 C760 352 820 326 900 312 L900 720 L0 720 Z"
              fill="url(#ridge-mid)"
              data-landscape-layer="ridge"
            />
            <path
              d="M0 520 C98 470 180 486 258 452 C340 416 410 438 482 420 C588 392 646 414 724 384 C802 354 850 364 900 350 L900 720 L0 720 Z"
              fill="url(#ridge-front)"
              data-landscape-layer="ridge"
            />
            <path
              d="M650 335 C720 359 710 385 622 402 C523 421 505 446 594 469 C716 500 694 544 570 580 C494 602 429 652 376 720 L548 720 C588 668 646 636 730 608 C876 559 850 487 714 457 C646 442 660 424 760 403 C868 379 822 346 716 324 Z"
              fill="#fbf8ef"
              data-landscape-layer="path"
            />
            <g fill="#0d2925" transform="translate(744 526)">
              <circle cx="12" cy="9" r="8" />
              <path d="M6 20 C7 15 17 15 19 20 L23 58 L17 58 L15 80 L10 80 L8 58 L2 58 Z" />
              <path d="M5 26 L-2 53 L3 55 L10 34 M19 26 L27 50 L22 53 L14 34" />
            </g>
          </svg>
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
