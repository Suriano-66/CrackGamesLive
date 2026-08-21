import { prisma } from "@/lib/prisma";
import { PLANS, getPlan } from "@/lib/plans";

const ACTIVE = ["active", "trialing"];

export default async function AdminOverview() {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);

  const [totalUsers, newUsers, activeUsers, staffCount, allActive] =
    await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
      prisma.user.count({ where: { subscriptionStatus: { in: ACTIVE } } }),
      prisma.user.count({ where: { role: { in: ["admin", "support"] } } }),
      prisma.user.findMany({
        where: { subscriptionStatus: { in: ACTIVE } },
        select: { plan: true },
      }),
    ]);

  // MRR estimé à partir des prix mensuels de référence.
  const perPlan: Record<string, number> = {};
  let mrr = 0;
  for (const u of allActive) {
    const id = u.plan ?? "—";
    perPlan[id] = (perPlan[id] ?? 0) + 1;
    const p = u.plan ? getPlan(u.plan) : undefined;
    if (p) mrr += p.monthlyPrice;
  }

  return (
    <>
      <h1 className="admin-h">Vue d&apos;ensemble</h1>
      <p className="admin-sub">Activité de la plateforme en un coup d&apos;œil.</p>

      <div className="stat-grid">
        <div className="stat">
          <div className="label">Utilisateurs</div>
          <div className="value">{totalUsers}</div>
          <div className="foot">+{newUsers} cette semaine</div>
        </div>
        <div className="stat">
          <div className="label">Abonnements actifs</div>
          <div className="value green">{activeUsers}</div>
          <div className="foot">
            {totalUsers > 0
              ? Math.round((activeUsers / totalUsers) * 100)
              : 0}
            % des comptes
          </div>
        </div>
        <div className="stat">
          <div className="label">MRR estimé</div>
          <div className="value accent">{mrr} €</div>
          <div className="foot">revenu mensuel récurrent</div>
        </div>
        <div className="stat">
          <div className="label">Équipe (staff)</div>
          <div className="value">{staffCount}</div>
          <div className="foot">admins + support</div>
        </div>
      </div>

      <div className="table-card">
        <div className="table-scroll">
          <table className="data">
            <thead>
              <tr>
                <th>Formule</th>
                <th>Abonnés actifs</th>
                <th>Prix de référence</th>
                <th>Contribution MRR</th>
              </tr>
            </thead>
            <tbody>
              {PLANS.map((p) => {
                const count = perPlan[p.id] ?? 0;
                return (
                  <tr key={p.id}>
                    <td>
                      <b>{p.name}</b>
                    </td>
                    <td className="num">{count}</td>
                    <td className="num">{p.monthlyPrice} € / mois</td>
                    <td className="num">{count * p.monthlyPrice} €</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
