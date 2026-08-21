import Link from "next/link";
import { requireStaff } from "@/lib/rbac";
import { ROLE_LABELS } from "@/lib/rbac";
import AdminTabs from "@/components/admin/AdminTabs";
import ThemeToggle from "@/components/ThemeToggle";
import { LogoutButton } from "@/components/DashboardActions";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireStaff();
  const role = session.user.role;

  return (
    <div className="admin-shell">
      <header className="nav admin-top">
        <div className="nav-in">
          <Link className="brand" href="/">
            <span className="logo-dot" />
            CrackGames<span style={{ color: "var(--accent)" }}>Live</span>
          </Link>
          <span className="admin-badge">ADMIN</span>
          <AdminTabs />
          <div className="nav-cta">
            <span className={`role-tag ${role}`}>
              {ROLE_LABELS[role] ?? role}
            </span>
            <Link className="btn btn-link hide-sm" href="/dashboard">
              Mon espace
            </Link>
            <ThemeToggle />
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="admin-main">{children}</main>
    </div>
  );
}
