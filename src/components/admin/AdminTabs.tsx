"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin", label: "Vue d'ensemble" },
  { href: "/admin/users", label: "Utilisateurs" },
  { href: "/admin/subscriptions", label: "Abonnements" },
  { href: "/admin/games", label: "Jeux" },
];

export default function AdminTabs() {
  const path = usePathname();
  return (
    <nav className="admin-tabs">
      {TABS.map((t) => {
        const active =
          t.href === "/admin" ? path === "/admin" : path.startsWith(t.href);
        return (
          <Link key={t.href} href={t.href} className={active ? "active" : ""}>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
