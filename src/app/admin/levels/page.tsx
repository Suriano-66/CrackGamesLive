import { redirect } from "next/navigation";

// L'édition des niveaux se fait désormais dans le logiciel de bureau
// « CrackGames Studio ». La page d'édition web a été retirée.
export default function LevelsRemoved() {
  redirect("/admin");
}
