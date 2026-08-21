"use client";

import { useState } from "react";
import {
  PLANS,
  BILLING_LABELS,
  BILLING_DISCOUNT,
  displayMonthlyPrice,
  type BillingInterval,
  type PlanId,
} from "@/lib/plans";

function Check() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

const INTERVALS: BillingInterval[] = ["monthly", "quarterly", "yearly"];

export default function Pricing() {
  const [interval, setInterval] = useState<BillingInterval>("monthly");
  const [loading, setLoading] = useState<PlanId | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function subscribe(plan: PlanId) {
    setError(null);
    setLoading(plan);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, interval }),
      });

      if (res.status === 401) {
        // Pas connecté : on envoie vers l'inscription.
        window.location.href = "/register?next=pricing";
        return;
      }

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Une erreur est survenue.");
        setLoading(null);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Impossible de contacter le serveur de paiement.");
      setLoading(null);
    }
  }

  const subLabel: Record<BillingInterval, string> = {
    monthly: "facturé chaque mois",
    quarterly: "facturé tous les 3 mois",
    yearly: "facturé chaque année",
  };

  return (
    <>
      <div style={{ display: "flex", justifyContent: "center" }}>
        <div className="bill-toggle">
          {INTERVALS.map((iv) => (
            <button
              key={iv}
              type="button"
              className={interval === iv ? "active" : ""}
              onClick={() => setInterval(iv)}
            >
              {BILLING_LABELS[iv]}
              {BILLING_DISCOUNT[iv] > 0 && (
                <span className="save-tag">
                  -{Math.round(BILLING_DISCOUNT[iv] * 100)}%
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p
          className="form-error"
          style={{ maxWidth: 420, margin: "0 auto 24px" }}
        >
          {error}
        </p>
      )}

      <div className="plans">
        {PLANS.map((plan) => (
          <div key={plan.id} className={`plan${plan.popular ? " pop" : ""}`}>
            {plan.popular && <span className="badge">POPULAIRE</span>}
            <h3>{plan.name}</h3>
            <p className="desc">{plan.description}</p>
            <div className="price">
              <span className="cur">€</span>
              <span className="amt">
                {displayMonthlyPrice(plan, interval)}
              </span>
              <span className="per">/ mois</span>
            </div>
            <p className="price-sub">{subLabel[interval]}</p>
            <ul className="feat">
              {plan.features.map((f) => (
                <li key={f}>
                  <Check />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className={`btn ${plan.popular ? "btn-primary" : "btn-ghost"}`}
              onClick={() => subscribe(plan.id)}
              disabled={loading !== null}
            >
              {loading === plan.id
                ? "Redirection…"
                : `Choisir ${plan.name}`}
            </button>
          </div>
        ))}
      </div>
      <p
        style={{
          textAlign: "center",
          marginTop: 24,
          color: "var(--faint)",
          fontSize: 13.5,
        }}
      >
        Tarifs indicatifs à valider ensemble · Paiement 100% sécurisé via Stripe ·
        Sans engagement, résiliable en un clic.
      </p>
    </>
  );
}
