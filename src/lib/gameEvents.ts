// Types d'événements de jeu, partagés entre le connecteur TikTok et l'overlay.

export interface GiftEvent {
  type: "gift";
  userId: string; // identifiant unique (uniqueId TikTok)
  nickname: string;
  avatar: string; // URL de la photo de profil (ou "" si inconnue)
  giftName: string;
  diamonds: number; // valeur en diamants du cadeau
  count: number; // nombre de répétitions du cadeau
}

export interface ChatEvent {
  type: "chat";
  userId: string;
  nickname: string;
  avatar: string;
  comment: string;
}

export type GameEvent = GiftEvent | ChatEvent | { type: "connected" | "disconnected" };

// Nombre de billes offert pour une valeur de cadeau (en diamants) donnée.
// Petit cadeau → peu de billes, gros cadeau → jusqu'à 10.
export function marblesForGift(diamonds: number, count = 1): number {
  const value = Math.max(0, diamonds) * Math.max(1, count);
  let per: number;
  if (value < 5) per = 1;
  else if (value < 20) per = 2;
  else if (value < 50) per = 3;
  else if (value < 100) per = 5;
  else if (value < 300) per = 7;
  else per = 10;
  return per;
}

// Plafond de billes par joueur.
export const MAX_MARBLES_PER_PLAYER = 100;
