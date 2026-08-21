import { prisma } from "@/lib/prisma";
import { requireStaff, isAdmin, ROLE_LABELS } from "@/lib/rbac";
import RoleSelect from "@/components/admin/RoleSelect";
import AccessControl from "@/components/admin/AccessControl";

export default async function AdminUsers() {
  const session = await requireStaff();
  const canEdit = isAdmin(session.user.role);

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      plan: true,
      subscriptionStatus: true,
      manualAccess: true,
      stripeSubscriptionId: true,
      createdAt: true,
    },
  });

  return (
    <>
      <h1 className="admin-h">Utilisateurs</h1>
      <p className="admin-sub">
        {users.length} compte{users.length > 1 ? "s" : ""} au total.
      </p>

      {!canEdit && (
        <div className="readonly-note">
          👁️ Accès Support : lecture seule. Seul un admin peut changer les
          rôles.
        </div>
      )}

      <div className="table-card">
        <div className="table-scroll">
          <table className="data">
            <thead>
              <tr>
                <th>Membre</th>
                <th>Email</th>
                <th>Abonnement</th>
                <th>Accès offert</th>
                <th>Inscrit le</th>
                <th>Rôle</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <b>{u.name ?? "—"}</b>
                  </td>
                  <td>{u.email}</td>
                  <td>
                    {u.plan ? (
                      <span className="pill-status active">{u.plan}</span>
                    ) : (
                      <span className="pill-status">aucun</span>
                    )}
                  </td>
                  <td>
                    {canEdit ? (
                      <AccessControl
                        userId={u.id}
                        manualAccess={u.manualAccess}
                        hasStripe={!!u.stripeSubscriptionId}
                      />
                    ) : u.manualAccess ? (
                      <span className="gift-tag">🎁 Offert</span>
                    ) : u.stripeSubscriptionId ? (
                      <span className="pill-status active">Stripe</span>
                    ) : (
                      <span className="pill-status">—</span>
                    )}
                  </td>
                  <td className="num">
                    {new Date(u.createdAt).toLocaleDateString("fr-FR")}
                  </td>
                  <td>
                    {canEdit ? (
                      <RoleSelect
                        userId={u.id}
                        role={u.role}
                        disabled={u.id === session.user.id}
                      />
                    ) : (
                      <span className={`role-tag ${u.role}`}>
                        {ROLE_LABELS[u.role] ?? u.role}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
