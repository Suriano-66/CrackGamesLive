import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";

// Le webhook a besoin du corps BRUT pour vérifier la signature :
// on désactive donc tout parsing/cache.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

async function syncSubscription(subscriptionId: string, customerId: string) {
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  const plan =
    (sub.metadata?.plan as string | undefined) ??
    (sub.items.data[0]?.price?.metadata?.plan as string | undefined) ??
    null;

  await prisma.user.updateMany({
    where: { stripeCustomerId: customerId },
    data: {
      stripeSubscriptionId: sub.id,
      subscriptionStatus: sub.status,
      plan,
      currentPeriodEnd: new Date(sub.current_period_end * 1000),
      // Un abonnement Stripe réel n'est pas un accès offert.
      manualAccess: false,
    },
  });
}

export async function POST(req: Request) {
  if (!webhookSecret) {
    console.error("[stripe] STRIPE_WEBHOOK_SECRET manquant.");
    return NextResponse.json({ error: "Webhook non configuré." }, { status: 500 });
  }

  const body = await req.text();
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Signature manquante." }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "signature invalide";
    console.error("[stripe] Vérification du webhook échouée :", msg);
    return NextResponse.json({ error: `Webhook Error: ${msg}` }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object as Stripe.Checkout.Session;
        if (s.subscription && s.customer) {
          await syncSubscription(
            String(s.subscription),
            String(s.customer),
          );
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        await syncSubscription(sub.id, String(sub.customer));
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await prisma.user.updateMany({
          where: { stripeCustomerId: String(sub.customer) },
          data: {
            subscriptionStatus: "canceled",
            plan: null,
            stripeSubscriptionId: null,
          },
        });
        break;
      }
      default:
        // Événements non gérés : on les ignore silencieusement.
        break;
    }
  } catch (err) {
    console.error("[stripe] Erreur de traitement du webhook :", err);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
