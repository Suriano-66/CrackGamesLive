import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getPlan } from "@/lib/plans";
import { getEnabledGames } from "@/lib/games";
import { getOrCreateOverlayToken } from "@/lib/overlay";
import { isStaff } from "@/lib/rbac";
import StreamLinks from "@/components/StreamLinks";
import TikTokSettings from "@/components/TikTokSettings";
import ThemeToggle from "@/components/ThemeToggle";
import {
  ManageBillingButton,
  LogoutButton,
} from "@/components/DashboardActions";

const ACTIVE_STATUSES = ["active", "trialing"];

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });
  if (!user) redirect("/login");

  const isActive =
    !!user.subscriptionStatus &&
    ACTIVE_STATUSES.includes(user.subscriptionStatus);
  const plan = user.plan ? getPlan(user.plan) : undefined;
  const staff = isStaff(user.role);
  const games = isActive ? await getEnabledGames() : [];
  const overlayToken = isActive
    ? await getOrCreateOverlayToken(user.id, user.overlayToken)
    : null;

  return (
    <>
      <header className="nav dash-nav">
        <div className="nav-in">
          <Link className="brand" href="/">
            <span className="logo-dot" />
            CrackGames<span style={{ color: "var(--accent)" }}>Live</span>
          </Link>
          <div className="nav-cta">
            {staff && (
              <Link className="btn btn-link hide-sm" href="/admin">
                Administration
              </Link>
            )}
            <ThemeToggle />
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="dash-main">
        <div className="dash-head">
          <div>
            <h1>Bonjour {user.name ?? "créateur"} 👋</h1>
            <p>Voici ton espace membre CrackGamesLive.</p>
          </div>
          <span className={`status-pill ${isActive ? "active" : "none"}`}>
            <span className="d" />
            {isActive
              ? `Abonnement ${plan?.name ?? ""} actif`
              : "Aucun abonnement actif"}
          </span>
        </div>

        <div className="dash-grid">
          <div className="card">
            <h2>Tes jeux</h2>
            {isActive ? (
              <>
                <p>
                  Voici tes liens privés à coller dans OBS (source navigateur) —
                  un lien par jeu.
                </p>
                <StreamLinks token={overlayToken!} games={games} />
              </>
            ) : (
              <div className="locked">
                <div className="lock-ic">
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <rect x="3" y="11" width="18" height="11" rx="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
                <p style={{ maxWidth: 320, marginBottom: 18 }}>
                  Choisis un abonnement pour débloquer la bibliothèque de jeux et
                  tes liens OBS.
                </p>
                <Link className="btn btn-primary" href="/#pricing">
                  Voir les abonnements
                </Link>
              </div>
            )}
          </div>

          <div className="card">
            <h2>Mon abonnement</h2>
            <p>Détails et gestion de ta formule.</p>
            <div style={{ marginBottom: 18 }}>
              <div className="meta-row">
                <span>Formule</span>
                <span>{plan?.name ?? "—"}</span>
              </div>
              <div className="meta-row">
                <span>Statut</span>
                <span>{user.subscriptionStatus ?? "aucun"}</span>
              </div>
              <div className="meta-row">
                <span>Renouvellement</span>
                <span>
                  {user.currentPeriodEnd
                    ? new Date(user.currentPeriodEnd).toLocaleDateString(
                        "fr-FR",
                      )
                    : "—"}
                </span>
              </div>
            </div>
            {user.stripeSubscriptionId ? (
              <ManageBillingButton />
            ) : user.manualAccess ? (
              <div className="readonly-note" style={{ marginBottom: 0 }}>
                🎁 Accès offert par l&apos;équipe CrackGamesLive
              </div>
            ) : (
              <Link className="btn btn-ghost" href="/#pricing">
                S&apos;abonner
              </Link>
            )}
          </div>
        </div>

        {isActive && (
          <div className="card" style={{ marginBottom: 18 }}>
            <h2>Connexion TikTok</h2>
            <p>
              Renseigne ton pseudo TikTok pour relier tes cadeaux en direct au
              jeu « La grande course ».
            </p>
            <TikTokSettings initial={user.tiktokUsername} />
          </div>
        )}

        <div className="card">
          <h2>Compte</h2>
          <div className="meta-row">
            <span>Nom</span>
            <span>{user.name ?? "—"}</span>
          </div>
          <div className="meta-row">
            <span>Email</span>
            <span>{user.email}</span>
          </div>
          <div className="meta-row">
            <span>Membre depuis</span>
            <span>{new Date(user.createdAt).toLocaleDateString("fr-FR")}</span>
          </div>
        </div>
      </main>
    </>
  );
}
