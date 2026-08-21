import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import HeroDemo from "@/components/HeroDemo";
import MiniCountdown from "@/components/MiniCountdown";
import Pricing from "@/components/Pricing";

function Check() {
  return (
    <svg
      className="check"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function Chevron() {
  return (
    <span className="chev">
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </span>
  );
}

export default function Home() {
  return (
    <>
      <header className="nav">
        <div className="nav-in">
          <Link className="brand" href="#top">
            <span className="logo-dot" />
            CrackGames<span style={{ color: "var(--accent)" }}>Live</span>
          </Link>
          <nav className="links">
            <a href="#games">Jeux</a>
            <a href="#how">Comment ça marche</a>
            <a href="#pricing">Abonnements</a>
            <a href="#security">Sécurité</a>
          </nav>
          <div className="nav-cta">
            <ThemeToggle />
            <Link className="btn btn-link hide-sm" href="/login">
              Se connecter
            </Link>
            <Link className="btn btn-primary" href="/register">
              Commencer
            </Link>
          </div>
        </div>
      </header>

      <span id="top" />
      <section className="hero">
        <div className="hero-glow" />
        <div className="wrap hero-grid">
          <div>
            <span className="pill">
              <span className="pulse" /> Overlays prêts pour OBS · aucune
              installation
            </span>
            <h1>
              Des jeux qui font <span className="hl">vivre ton live</span> —
              24h/24, sans rien faire.
            </h1>
            <p className="lead">
              CrackGamesLive te fournit une bibliothèque de mini-jeux
              interactifs à afficher en surimpression sur tes lives TikTok. Tu
              les lances, ils tournent tout seuls en boucle, et ton audience
              reste scotchée.
            </p>
            <div className="hero-actions">
              <a className="btn btn-primary" href="#pricing">
                Voir les abonnements
              </a>
              <a className="btn btn-ghost" href="#games">
                Découvrir les jeux
              </a>
            </div>
            <div className="hero-note">
              <span>
                <Check /> Sans intervention pendant le live
              </span>
              <span>
                <Check /> Paiement sécurisé Stripe
              </span>
              <span>
                <Check /> Résiliable à tout moment
              </span>
            </div>
          </div>

          <HeroDemo />
        </div>
      </section>

      <div className="trust">
        <div className="trust-in">
          <span>
            Pensé pour les <b>lives TikTok</b>
          </span>
          <span className="dot" />
          <span>
            Compatible <b>OBS</b> &amp; Streamlabs
          </span>
          <span className="dot" />
          <span>
            Paiements par <b>Stripe</b>
          </span>
          <span className="dot" />
          <span>
            <b>Zéro code</b>, une simple URL
          </span>
          <span className="dot" />
          <span>
            Nouveaux jeux <b>chaque mois</b>
          </span>
        </div>
      </div>

      {/* GAMES */}
      <section className="block" id="games">
        <div className="wrap">
          <div className="sec-head">
            <span className="eyebrow">Catalogue</span>
            <h2>Des jeux qui tournent en autonomie</h2>
            <p>
              Chaque jeu est une source navigateur à coller dans OBS. Il
              redémarre tout seul, en boucle, sans que tu aies à toucher à quoi
              que ce soit pendant ton live.
            </p>
          </div>
          <div className="games">
            <div className="game">
              <span className="tag-auto">AUTO 24/7</span>
              <div className="prev p-race">
                <div
                  className="runner"
                  style={{ top: 24, background: "#FF7A3C" }}
                >
                  🐢
                </div>
                <div
                  className="runner"
                  style={{
                    top: 52,
                    background: "#3C8CFF",
                    animationDuration: "2.9s",
                  }}
                >
                  🐌
                </div>
                <div
                  className="runner"
                  style={{
                    top: 80,
                    background: "var(--online)",
                    animationDuration: "3.9s",
                  }}
                >
                  🐇
                </div>
              </div>
              <h3>🏁 La grande course</h3>
              <p>
                Des concurrents s&apos;affrontent sur une piste, un gagnant est
                désigné, puis ça repart. Suspense garanti en boucle.
              </p>
            </div>

            <div className="game">
              <span className="tag-auto">AUTO 24/7</span>
              <div className="prev p-bars">
                <i /> <i /> <i /> <i /> <i />
              </div>
              <h3>⚔️ Battle des équipes</h3>
              <p>
                Deux (ou plus) camps s&apos;affrontent. Les barres montent, un
                vainqueur est couronné à chaque manche.
              </p>
            </div>

            <div className="game">
              <span className="tag-auto">AUTO 24/7</span>
              <div className="prev p-wheel">
                <div className="w" />
              </div>
              <h3>🎡 Roue de la fortune</h3>
              <p>
                La roue tourne toute seule à intervalle régulier et s&apos;arrête
                sur un mot, un défi ou un prix.
              </p>
            </div>

            <div className="game">
              <span className="tag-auto">AUTO 24/7</span>
              <div className="prev p-slot">
                <span>
                  <i>
                    🍒<br />🔔<br />7️⃣
                  </i>
                </span>
                <span>
                  <i>
                    💎<br />🍋<br />⭐
                  </i>
                </span>
                <span>
                  <i>
                    7️⃣<br />🍒<br />🔔
                  </i>
                </span>
              </div>
              <h3>🎰 Machine à sous</h3>
              <p>
                Les rouleaux tournent en continu. Jackpots, quasi-jackpots et
                animations qui donnent envie de rester.
              </p>
            </div>

            <div className="game">
              <span className="tag-auto">AUTO 24/7</span>
              <div className="prev p-count">
                <MiniCountdown />
              </div>
              <h3>⏱️ Compte à rebours défi</h3>
              <p>
                Un chrono lance un défi (« explosez les likes ! »), affiche
                l&apos;objectif, puis relance un nouveau round.
              </p>
            </div>

            <div className="game">
              <span className="tag-auto">AUTO 24/7</span>
              <div className="prev p-pet">🐣</div>
              <h3>🥚 Le compagnon du live</h3>
              <p>
                Une mascotte qui évolue heure après heure. Les viewers
                reviennent pour voir ce qu&apos;elle est devenue.
              </p>
            </div>
          </div>
          <p
            style={{
              textAlign: "center",
              marginTop: 26,
              color: "var(--faint)",
              fontSize: 14,
            }}
          >
            + de nouveaux jeux ajoutés chaque mois, inclus dans l&apos;abonnement.
          </p>
        </div>
      </section>

      {/* HOW */}
      <section className="block" id="how" style={{ background: "var(--surface)" }}>
        <div className="wrap">
          <div className="sec-head">
            <span className="eyebrow">3 étapes</span>
            <h2>Prêt à diffuser en 5 minutes</h2>
            <p>
              Aucune compétence technique. Si tu sais faire un copier-coller, tu
              sais utiliser CrackGamesLive.
            </p>
          </div>
          <div className="steps">
            <div className="step">
              <div className="num">01</div>
              <h3>Choisis ton jeu</h3>
              <p>
                Parcours le catalogue depuis ton espace membre et personnalise
                les couleurs, titres et réglages du jeu.
              </p>
            </div>
            <div className="step">
              <div className="num">02</div>
              <h3>Colle l&apos;URL dans OBS</h3>
              <p>
                Ajoute une « source navigateur » avec ton lien unique. Le jeu
                s&apos;affiche en surimpression sur ton live.
              </p>
            </div>
            <div className="step">
              <div className="num">03</div>
              <h3>Lance et oublie</h3>
              <p>
                Le jeu tourne en boucle tout seul, 24h/24. Tu streames, il anime
                ton audience sans que tu interviennes.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className="block" id="pricing">
        <div className="wrap">
          <div className="sec-head">
            <span className="eyebrow">Abonnements</span>
            <h2>Un seul abonnement, tous les jeux</h2>
            <p>
              Accès complet à la bibliothèque, aux mises à jour et aux nouveaux
              jeux. Choisis la formule qui te convient — plus la durée est
              longue, plus tu économises.
            </p>
          </div>
          <Pricing />
        </div>
      </section>

      {/* SECURITY */}
      <section
        className="block"
        id="security"
        style={{ background: "var(--surface)" }}
      >
        <div className="wrap">
          <div className="sec-head">
            <span className="eyebrow">Confiance &amp; sécurité</span>
            <h2>Tes données et tes paiements protégés</h2>
            <p>
              La sécurité est intégrée dès la conception : comptes chiffrés,
              paiements délégués à Stripe, aucune donnée bancaire stockée chez
              nous.
            </p>
          </div>
          <div className="sec-grid">
            <div className="sec-card">
              <div className="ic">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
              <h3>Comptes sécurisés</h3>
              <p>
                Mots de passe chiffrés (hash), double authentification et
                sessions protégées.
              </p>
            </div>
            <div className="sec-card">
              <div className="ic">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="1" y="4" width="22" height="16" rx="3" />
                  <path d="M1 10h22" />
                </svg>
              </div>
              <h3>Paiements Stripe</h3>
              <p>
                Toute la facturation passe par Stripe, leader mondial certifié
                PCI-DSS. Rien n&apos;est stocké chez nous.
              </p>
            </div>
            <div className="sec-card">
              <div className="ic">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <h3>Chiffrement HTTPS</h3>
              <p>
                Tout le trafic est chiffré de bout en bout. Tes liens de jeux
                restent privés et uniques.
              </p>
            </div>
            <div className="sec-card">
              <div className="ic">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M9 12l2 2 4-4" />
                  <circle cx="12" cy="12" r="9" />
                </svg>
              </div>
              <h3>RGPD &amp; contrôle</h3>
              <p>
                Conforme RGPD. Tu gères, exportes et supprimes tes données quand
                tu veux.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="block">
        <div className="wrap">
          <div className="sec-head">
            <span className="eyebrow">Questions fréquentes</span>
            <h2>Ce qu&apos;on nous demande souvent</h2>
          </div>
          <div className="faq">
            <details open>
              <summary>
                Comment les jeux s&apos;affichent sur mon live ?
                <Chevron />
              </summary>
              <p>
                Chaque jeu est une page web avec un lien unique. Tu l&apos;ajoutes
                dans OBS ou Streamlabs comme « source navigateur » et il
                apparaît en surimpression sur ta caméra ou ton écran. Aucun
                logiciel à installer.
              </p>
            </details>
            <details>
              <summary>
                Dois-je rester devant l&apos;écran pour gérer le jeu ?
                <Chevron />
              </summary>
              <p>
                Non. Les jeux sont conçus pour tourner en autonomie : ils
                démarrent, désignent un résultat, puis recommencent en boucle,
                24h/24. Tu peux les laisser tourner même en live automatique sans
                y toucher.
              </p>
            </details>
            <details>
              <summary>
                Les jeux réagissent-ils aux commentaires des viewers ?
                <Chevron />
              </summary>
              <p>
                Cette première version propose des overlays autonomes qui
                tournent en boucle et invitent l&apos;audience à réagir dans le
                chat. Une évolution connectée aux événements TikTok en temps réel
                (commentaires, cadeaux, likes) est prévue en option.
              </p>
            </details>
            <details>
              <summary>
                Puis-je résilier quand je veux ?
                <Chevron />
              </summary>
              <p>
                Oui, sans engagement. Tu gères ton abonnement depuis ton espace
                membre et tu peux l&apos;arrêter en un clic. L&apos;accès reste
                actif jusqu&apos;à la fin de la période payée.
              </p>
            </details>
            <details>
              <summary>
                Est-ce compatible avec TikTok Live Studio ?
                <Chevron />
              </summary>
              <p>
                Les jeux fonctionnent avec tout logiciel acceptant une source
                navigateur (OBS, Streamlabs). L&apos;intégration se fait via
                l&apos;URL de ton jeu, quel que soit ton outil de diffusion.
              </p>
            </details>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="block">
        <div className="wrap">
          <div className="cta-band">
            <h2>Transforme tes lives en spectacle permanent</h2>
            <p>
              Rejoins les streamers qui gardent leur audience active jour et
              nuit, sans lever le petit doigt.
            </p>
            <Link
              className="btn btn-primary"
              href="/register"
              style={{ fontSize: 16, padding: "14px 26px" }}
            >
              Choisir mon abonnement
            </Link>
          </div>
        </div>
      </section>

      <footer className="site">
        <div className="wrap">
          <div className="foot-grid">
            <div className="foot-col">
              <Link
                className="brand"
                href="#top"
                style={{ marginBottom: 14 }}
              >
                <span className="logo-dot" />
                CrackGames
                <span style={{ color: "var(--accent)" }}>Live</span>
              </Link>
              <p className="foot-about">
                La plateforme de mini-jeux interactifs pour animer tes lives
                TikTok en continu.
              </p>
            </div>
            <div className="foot-col">
              <h4>Produit</h4>
              <a href="#games">Catalogue de jeux</a>
              <a href="#how">Comment ça marche</a>
              <a href="#pricing">Abonnements</a>
              <a href="#security">Sécurité</a>
            </div>
            <div className="foot-col">
              <h4>Compte</h4>
              <Link href="/login">Se connecter</Link>
              <Link href="/register">Créer un compte</Link>
              <Link href="/dashboard">Espace membre</Link>
            </div>
            <div className="foot-col">
              <h4>Légal</h4>
              <a href="#">Mentions légales</a>
              <a href="#">CGV / CGU</a>
              <a href="#">Confidentialité</a>
              <a href="#">Contact</a>
            </div>
          </div>
          <div className="foot-bottom">
            <span>© 2026 CrackGamesLive</span>
            <span>
              Paiements sécurisés par Stripe · Fait avec ❤️ pour les créateurs
            </span>
          </div>
        </div>
      </footer>
    </>
  );
}
