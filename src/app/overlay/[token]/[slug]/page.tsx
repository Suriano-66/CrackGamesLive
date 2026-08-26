import type { Metadata } from "next";

// Les overlays « source navigateur » sont retirés : le streaming se fait
// désormais via l'application de bureau CrackGames Stream. On garde cette page
// pour afficher un message propre aux anciens liens OBS (pas de plantage).
export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

const STYLE = `
  html,body{background:#0b0f17;margin:0;height:100%;
    font-family:"Bricolage Grotesque",system-ui,sans-serif;color:#fff}
  .ov{position:fixed;inset:0;display:grid;place-items:center;text-align:center;padding:24px}
  .card{max-width:440px;padding:34px 40px;border-radius:22px;
    background:rgba(10,13,19,.66);border:1px solid rgba(255,255,255,.14);
    box-shadow:0 20px 60px -20px rgba(0,0,0,.6)}
  .em{font-size:56px}
  .t{font-size:24px;font-weight:800;margin:10px 0 6px}
  .p{font-size:14px;color:rgba(255,255,255,.7);line-height:1.6}
  .p b{color:#fff}
`;

export default function OverlayRetired() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: STYLE }} />
      <div className="ov">
        <div className="card">
          <div className="em">🎮</div>
          <div className="t">Overlay navigateur retiré</div>
          <p className="p">
            Le streaming des jeux CrackGamesLive se fait maintenant via
            l&apos;application de bureau <b>CrackGames Stream</b> (fenêtre à
            capturer dans OBS + panneau de contrôle). Récupère-la depuis ton{" "}
            <b>espace membre</b>.
          </p>
        </div>
      </div>
    </>
  );
}
