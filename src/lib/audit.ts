import { db } from "@/lib/db";

/** Zapíše citlivou akci do záznamu. Nikdy neshodí akci, ke které patří. */
export async function audit(actor: { id: string; name?: string | null }, action: string, target?: string, detail?: string) {
  try {
    await db.auditLog.create({
      data: { actorId: actor.id, actorName: actor.name ?? actor.id, action, target: target ?? null, detail: detail?.slice(0, 300) ?? null },
    });
  } catch {
    /* záznam je doplněk, akce má proběhnout i bez něj */
  }
}
