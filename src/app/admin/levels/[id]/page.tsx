import { redirect } from "next/navigation";

// L'édition des niveaux se fait désormais dans le logiciel de bureau
// « CrackGames Studio ». L'éditeur web a été retiré.
export default function LevelEditorRemoved() {
  redirect("/admin");
}
