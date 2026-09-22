import Link from "next/link";
import "./globals.css";

export const metadata = {
  title: "404 — Page Not Found | CreatorOS",
  robots: { index: false, follow: false },
};

export default function RootNotFound() {
  return (
    <html lang="id">
      <body>
        <div className="not-found-screen">
          <div className="shell not-found-screen__inner">
            <span className="not-found-screen__code">404</span>
            <h1 className="not-found-screen__title">Page Not Found</h1>
            <p className="not-found-screen__desc">
              The page you are looking for might have been moved, removed, or is
              temporarily unavailable.
            </p>
            <div className="not-found-screen__actions">
              <Link href="/" className="btn btn--primary">
                Back to Homepage
              </Link>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
