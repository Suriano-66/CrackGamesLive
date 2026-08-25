import { prisma } from "@/lib/prisma";
import { requireStaff, isAdmin } from "@/lib/rbac";
import LevelsAdmin from "@/components/admin/LevelsAdmin";

export default async function AdminLevels() {
  const session = await requireStaff();
  const canEdit = isAdmin(session.user.role);
  const levels = await prisma.level.findMany({ orderBy: { updatedAt: "desc" } });

  return (
    <>
      <h1 className="admin-h">Niveaux</h1>
      <p className="admin-sub">
        Crée et règle les circuits de « La grande course ». Le niveau{" "}
        <b>actif</b> est celui joué en live.
      </p>
      {!canEdit && (
        <div className="readonly-note">
          👁️ Accès Support : lecture seule. Seul un admin peut créer/modifier les
          niveaux.
        </div>
      )}
      <LevelsAdmin
        canEdit={canEdit}
        initial={levels.map((l) => ({
          id: l.id,
          name: l.name,
          gameType: l.gameType,
          active: l.active,
        }))}
      />
    </>
  );
}
