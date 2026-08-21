"use client";

import { useEffect, useRef, useState } from "react";
import type { GameEvent, GiftEvent } from "@/lib/gameEvents";

interface Options {
  wsUrl?: string | null;
  demo?: boolean;
  onEvent: (e: GameEvent) => void;
}

const DEMO_NAMES = [
  "Lucas", "Marie", "Noah", "Sofia", "Léa", "Hugo", "Emma", "Nathan",
  "Chloé", "Gabriel", "Jade", "Louis", "Camille", "Adam", "Manon", "Théo",
  "Inès", "Raph", "Zoé", "Ethan", "Lina", "Sacha", "Nina", "Malo",
];

const DEMO_GIFTS: { name: string; diamonds: number }[] = [
  { name: "Rose", diamonds: 1 },
  { name: "TikTok", diamonds: 1 },
  { name: "Doigt", diamonds: 5 },
  { name: "Glace", diamonds: 10 },
  { name: "Perfume", diamonds: 20 },
  { name: "Requin", diamonds: 50 },
  { name: "Dauphin", diamonds: 100 },
  { name: "Lion", diamonds: 500 },
  { name: "Univers", diamonds: 1000 },
];

// Feed d'événements de jeu : se connecte au WebSocket temps réel si fourni,
// sinon (ou en attendant) génère une simulation automatique.
export function useGameFeed({ wsUrl, demo, onEvent }: Options) {
  const [connected, setConnected] = useState(false);
  const cbRef = useRef(onEvent);
  cbRef.current = onEvent;

  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnect: ReturnType<typeof setTimeout> | null = null;
    let demoTimer: ReturnType<typeof setTimeout> | null = null;
    let closed = false;
    let liveConnected = false;

    // --- Simulation démo ---
    function scheduleDemo() {
      if (closed) return;
      const delay = 900 + Math.random() * 1900;
      demoTimer = setTimeout(() => {
        // N'émet des faux cadeaux que si aucune connexion réelle active.
        if (!liveConnected) {
          const n = Math.floor(Math.random() * DEMO_NAMES.length);
          const g = DEMO_GIFTS[Math.floor(Math.random() * DEMO_GIFTS.length)];
          const evt: GiftEvent = {
            type: "gift",
            userId: `demo_${n}`,
            nickname: DEMO_NAMES[n],
            avatar: "",
            giftName: g.name,
            diamonds: g.diamonds,
            count: 1 + Math.floor(Math.random() * 2),
          };
          cbRef.current(evt);
        }
        scheduleDemo();
      }, delay);
    }

    // --- Connexion WebSocket réelle ---
    function connect() {
      if (!wsUrl || closed) return;
      try {
        ws = new WebSocket(wsUrl);
      } catch {
        scheduleReconnect();
        return;
      }
      ws.onopen = () => {
        liveConnected = true;
        setConnected(true);
        cbRef.current({ type: "connected" });
      };
      ws.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data) as GameEvent;
          cbRef.current(data);
        } catch {
          /* ignore les messages malformés */
        }
      };
      ws.onclose = () => {
        liveConnected = false;
        setConnected(false);
        cbRef.current({ type: "disconnected" });
        scheduleReconnect();
      };
      ws.onerror = () => {
        try {
          ws?.close();
        } catch {
          /* noop */
        }
      };
    }

    function scheduleReconnect() {
      if (closed || !wsUrl) return;
      reconnect = setTimeout(connect, 3000);
    }

    if (wsUrl) connect();
    if (demo || !wsUrl) scheduleDemo();

    return () => {
      closed = true;
      if (reconnect) clearTimeout(reconnect);
      if (demoTimer) clearTimeout(demoTimer);
      try {
        ws?.close();
      } catch {
        /* noop */
      }
    };
  }, [wsUrl, demo]);

  return { connected };
}
