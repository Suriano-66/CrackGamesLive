import { getAllGames } from "@/lib/games";
import { requireStaff, isAdmin } from "@/lib/rbac";
import { GameToggle, AddGameForm } from "@/components/admin/GameControls";

export default async function AdminGames() {
  const session = await requireStaff();
  const canEdit = isAdmin(session.user.role);
  const games = await getAllGames();

  return (
    <>
      <h1 className="admin-h">Catalogue de jeux</h1>
      <p className="admin-sub">
        Active ou désactive les jeux proposés aux membres, et ajoute-en de
        nouveaux.
      </p>

      {!canEdit && (
        <div className="readonly-note">
          👁️ Accès Support : lecture seule. Seul un admin peut modifier le
          catalogue.
        </div>
      )}

      {canEdit && <AddGameForm />}

      {games.length === 0 ? (
        <div className="readonly-note">
          Catalogue vide. Lance <code>npm run seed</code> pour ajouter les jeux
          de base, ou ajoute-les ci-dessus.
        </div>
      ) : (
        <div className="table-card">
          <div className="table-scroll">
            <table className="data">
              <thead>
                <tr>
                  <th>Jeu</th>
                  <th>Description</th>
                  <th>Ordre</th>
                  <th>État</th>
                </tr>
              </thead>
              <tbody>
                {games.map((g) => (
                  <tr key={g.id}>
                    <td>
                      <b>
                        {g.emoji} {g.title}
                      </b>
                    </td>
                    <td style={{ color: "var(--muted)" }}>{g.description}</td>
                    <td className="num">{g.order}</td>
                    <td>
                      {canEdit ? (
                        <GameToggle id={g.id} enabled={g.enabled} />
                      ) : (
                        <span
                          className={`pill-status ${g.enabled ? "active" : ""}`}
                        >
                          {g.enabled ? "activé" : "désactivé"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
