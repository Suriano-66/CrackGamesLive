import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/rbac";
import { getPlan } from "@/lib/plans";

const ACTIVE = ["active", "trialing"];

export default async function AdminSubscriptions() {
  await requireStaff();

  const subs = await prisma.user.findMany({
    where: { OR: [{ plan: { not: null } }, { subscriptionStatus: { not: null } }] },
    orderBy: { currentPeriodEnd: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
      plan: true,
      subscriptionStatus: true,
      currentPeriodEnd: true,
      stripeCustomerId: true,
    },
  });

  const activeCount = subs.filter(
    (s) => s.subscriptionStatus && ACTIVE.includes(s.subscriptionStatus),
  ).length;

  return (
    <>
      <h1 className="admin-h">Abonnements</h1>
      <p className="admin-sub">
        {activeCount} abonnement{activeCount > 1 ? "s" : ""} actif
        {activeCount > 1 ? "s" : ""} · {subs.length} au total (historique inclus).
      </p>

      {subs.length === 0 ? (
        <div className="readonly-note">
          Aucun abonnement pour l&apos;instant. Ils apparaîtront ici dès le
          premier paiement Stripe.
        </div>
      ) : (
        <div className="table-card">
          <div className="table-scroll">
            <table className="data">
              <thead>
                <tr>
                  <th>Membre</th>
                  <th>Email</th>
                  <th>Formule</th>
                  <th>Statut</th>
                  <th>Renouvellement</th>
                  <th>Client Stripe</th>
                </tr>
              </thead>
              <tbody>
                {subs.map((s) => {
                  const active =
                    !!s.subscriptionStatus &&
                    ACTIVE.includes(s.subscriptionStatus);
                  return (
                    <tr key={s.id}>
                      <td>
                        <b>{s.name ?? "—"}</b>
                      </td>
                      <td>{s.email}</td>
                      <td>{s.plan ? getPlan(s.plan)?.name ?? s.plan : "—"}</td>
                      <td>
                        <span
                          className={`pill-status ${active ? "active" : ""}`}
                        >
                          {s.subscriptionStatus ?? "—"}
                        </span>
                      </td>
                      <td className="num">
                        {s.currentPeriodEnd
                          ? new Date(s.currentPeriodEnd).toLocaleDateString(
                              "fr-FR",
                            )
                          : "—"}
                      </td>
                      <td className="num">{s.stripeCustomerId ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
