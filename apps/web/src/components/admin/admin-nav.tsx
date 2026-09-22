"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface AdminNavProps {
  locale: string;
  labels: {
    dashboard: string;
    verifications: string;
    users: string;
    orders: string;
    campaigns: string;
    disputes: string;
    finance: string;
    categories: string;
    audit: string;
    announcements: string;
  };
}

export function AdminNav({ locale, labels }: AdminNavProps) {
  const pathname = usePathname();

  const navItems = [
    { href: `/${locale}/admin`, label: labels.dashboard, exact: true },
    {
      href: `/${locale}/admin/creator-verifications`,
      label: labels.verifications,
    },
    { href: `/${locale}/admin/users`, label: labels.users },
    { href: `/${locale}/admin/orders`, label: labels.orders },
    { href: `/${locale}/admin/campaigns`, label: labels.campaigns },
    { href: `/${locale}/admin/disputes`, label: labels.disputes },
    { href: `/${locale}/admin/finance`, label: labels.finance },
    { href: `/${locale}/admin/categories`, label: labels.categories },
    { href: `/${locale}/admin/audit`, label: labels.audit },
    { href: `/${locale}/admin/announcements`, label: labels.announcements },
  ];

  return (
    <nav className="admin-nav" aria-label="Admin Navigation">
      <ul className="admin-nav__list">
        {navItems.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          return (
            <li key={item.href} className="admin-nav__item">
              <Link
                href={item.href}
                className={`admin-nav__link ${isActive ? "admin-nav__link--active" : ""}`}
                aria-current={isActive ? "page" : undefined}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
