import { ArrowLeft, BadgeCheck } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

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
      <section className="auth-panel" aria-labelledby="auth-title">
        <div className="auth-panel__inner">
          <div className="auth-topline">
            <Link className="wordmark" href={`/${locale}`}>
              Creator<span>OS</span>
            </Link>
            <Link className="auth-back" href={`/${locale}`}>
              <ArrowLeft aria-hidden="true" size={17} />
              {backLabel}
            </Link>
          </div>
          <header className="auth-heading">
            <h1 id="auth-title">{title}</h1>
            <p>{description}</p>
          </header>
          {children}
        </div>
      </section>
      <aside className="auth-visual" aria-label={proofLabel}>
        <Image
          src="/images/creator-contact-sheet-v2.png"
          alt=""
          fill
          loading="lazy"
          sizes="46vw"
        />
        <div className="auth-visual__wash" />
        <p className="auth-proof">
          <BadgeCheck aria-hidden="true" size={21} />
          {proofLabel}
        </p>
      </aside>
    </main>
  );
}
