import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { hasActiveAccess } from "@/lib/access";
import OverlayGame from "@/components/games/OverlayGame";

// Overlay servi dans OBS : jamais mis en cache, jamais indexé.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

// Fond transparent obligatoire pour la superposition dans OBS.
const TRANSPARENT_STYLE = `
  html,body{background:transparent !important;margin:0;overflow:hidden}
  .ov-root{position:fixed;inset:0;display:grid;place-items:center;
    font-family:"Bricolage Grotesque",system-ui,sans-serif;color:#fff}
  .ov-badge{display:flex;flex-direction:column;align-items:center;gap:14px;
    padding:34px 44px;border-radius:22px;
    background:rgba(10,13,19,.62);backdrop-filter:blur(8px);
    border:1px solid rgba(255,255,255,.14);
    box-shadow:0 20px 60px -20px rgba(0,0,0,.6);text-align:center}
  .ov-emoji{font-size:64px;line-height:1}
  .ov-title{font-size:26px;font-weight:800;letter-spacing:-.02em}
  .ov-live{display:inline-flex;align-items:center;gap:8px;
    font-family:"JetBrains Mono",monospace;font-size:12px;font-weight:700;
    letter-spacing:.12em;color:#35D0A0}
  .ov-dot{width:9px;height:9px;border-radius:50%;background:#35D0A0;
    box-shadow:0 0 0 0 rgba(53,208,160,.7);animation:ovp 1.8s infinite}
  .ov-note{font-size:13px;color:rgba(255,255,255,.6);max-width:260px}
  .ov-wm{position:fixed;bottom:14px;right:16px;
    font-family:"JetBrains Mono",monospace;font-size:11px;
    color:rgba(255,255,255,.45)}
  .ov-err{color:#FF7089}
  @keyframes ovp{70%{box-shadow:0 0 0 12px rgba(53,208,160,0)}
    100%{box-shadow:0 0 0 0 rgba(53,208,160,0)}}
  @media (prefers-reduced-motion:reduce){.ov-dot{animation:none}}
`;

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: TRANSPARENT_STYLE }} />
      <div className="ov-root">{children}</div>
    </>
  );
}

export default async function OverlayPage({
  params,
}: {
  params: Promise<{ token: string; slug: string }>;
}) {
  const { token, slug } = await params;

  const user = await prisma.user.findUnique({
    where: { overlayToken: token },
    select: { id: true, subscriptionStatus: true },
  });

  if (!user) {
    return (
      <Shell>
        <div className="ov-badge">
          <div className="ov-emoji">🔒</div>
          <div className="ov-title ov-err">Lien invalide</div>
          <div className="ov-note">
            Ce lien overlay n&apos;existe pas ou a été régénéré. Récupère un lien
            à jour dans ton espace membre.
          </div>
        </div>
      </Shell>
    );
  }

  if (!hasActiveAccess(user.subscriptionStatus)) {
    return (
      <Shell>
        <div className="ov-badge">
          <div className="ov-emoji">⏸️</div>
          <div className="ov-title ov-err">Abonnement inactif</div>
          <div className="ov-note">
            Réactive ton abonnement CrackGamesLive pour afficher tes jeux.
          </div>
        </div>
      </Shell>
    );
  }

  const game = await prisma.game.findUnique({ where: { slug } });
  if (!game || !game.enabled) {
    return (
      <Shell>
        <div className="ov-badge">
          <div className="ov-emoji">❓</div>
          <div className="ov-title ov-err">Jeu indisponible</div>
          <div className="ov-note">
            Ce jeu n&apos;existe pas ou a été désactivé.
          </div>
        </div>
      </Shell>
    );
  }

  // Jeu implémenté : on rend le moteur du jeu (fond transparent pour OBS).
  const IMPLEMENTED = new Set(["grande-course"]);
  if (IMPLEMENTED.has(slug)) {
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: TRANSPARENT_STYLE }} />
        <OverlayGame slug={slug} />
      </>
    );
  }

  // Jeu pas encore implémenté : placeholder "connecté".
  return (
    <Shell>
      <div className="ov-badge">
        <div className="ov-emoji">{game.emoji}</div>
        <div className="ov-title">{game.title}</div>
        <div className="ov-live">
          <span className="ov-dot" /> OVERLAY CONNECTÉ
        </div>
        <div className="ov-note">
          Ton lien fonctionne 🎉 Ce jeu arrive bientôt. Garde cette source
          navigateur active dans OBS.
        </div>
      </div>
      <div className="ov-wm">CrackGamesLive</div>
    </Shell>
  );
}
