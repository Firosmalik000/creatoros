import { ArrowLeft, BadgeCheck, ShieldCheck, Sparkles, WalletCards } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { MotionAuthBadge, MotionAuthPanel, MotionAuthVisual } from "./motion-auth";

export function AuthShell({
  locale,
  title,
  description,
  backLabel,
  proofLabel,
  children,
}: {
  locale: string;
  title: string;
  description: string;
  backLabel: string;
  proofLabel: string;
  children: ReactNode;
}) {
  return (
    <main className="auth-surface">
      {/* Left Form Panel with Glassmorphism Card */}
      <section className="auth-panel" aria-labelledby="auth-title">
        <MotionAuthPanel className="auth-panel__inner">
          <div className="auth-card">
            <div className="auth-topline">
              <Link className="wordmark wordmark--auth" href={`/${locale}`} aria-label="CreatorOS home">
                Creator<span>OS</span>
              </Link>
              <Link className="auth-back" href={`/${locale}`}>
                <ArrowLeft aria-hidden="true" size={17} />
                <span>{backLabel}</span>
              </Link>
            </div>
            <header className="auth-heading">
              <h1 id="auth-title">{title}</h1>
              <p>{description}</p>
            </header>
            <div className="auth-form-wrapper">
              {children}
            </div>
          </div>
        </MotionAuthPanel>
      </section>

      {/* Right Editorial Showcase Panel */}
      <MotionAuthVisual className="auth-visual">
        <Image
          src="/images/creator-contact-sheet-v2.png"
          alt=""
          fill
          loading="lazy"
          sizes="50vw"
          className="auth-visual__img"
        />
        <div className="auth-visual__wash" />
        <div className="auth-visual__aurora" />

        <div className="auth-visual__content">
          <MotionAuthBadge className="auth-proof-badge">
            <div className="auth-proof-badge__icon">
              <BadgeCheck aria-hidden="true" size={24} />
            </div>
            <div>
              <p className="auth-proof-badge__title">{proofLabel}</p>
              <p className="auth-proof-badge__sub">Managed Talent & Escrow Protection</p>
            </div>
          </MotionAuthBadge>

          <div className="auth-perks-list">
            <div className="auth-perk-item">
              <ShieldCheck size={16} className="auth-perk-icon" />
              <span>100% Curated & Vetted Creators</span>
            </div>
            <div className="auth-perk-item">
              <WalletCards size={16} className="auth-perk-icon" />
              <span>Milestone-Based Secure Escrow</span>
            </div>
            <div className="auth-perk-item">
              <Sparkles size={16} className="auth-perk-icon" />
              <span>End-to-End Campaign Delivery</span>
            </div>
          </div>
        </div>
      </MotionAuthVisual>
    </main>
  );
}
