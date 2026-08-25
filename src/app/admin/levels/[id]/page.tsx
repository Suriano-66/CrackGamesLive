import { redirect } from "next/navigation";
import { requireStaff, isAdmin } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { parseLevelData } from "@/lib/levels";
import LevelEditor from "@/components/admin/LevelEditor";

export default async function LevelEditorPage(ctx: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireStaff();
  const { id } = await ctx.params;
  const level = await prisma.level.findUnique({ where: { id } });
  if (!level) redirect("/admin/levels");
  const { platforms, settings } = parseLevelData(level.data);

  return (
    <LevelEditor
      canEdit={isAdmin(session.user.role)}
      id={level.id}
      gameType={level.gameType}
      initialName={level.name}
      active={level.active}
      initialPlatforms={platforms}
      initialSettings={settings}
    />
  );
}
