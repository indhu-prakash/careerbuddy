import { z } from "zod";
import { isUuid, parseBody, withUser } from "@/lib/api";
import { listInventory, updateInventory } from "@/lib/intake/skills";

// F1 skills inventory: list, and the review step's confirm / correct / add / remove.
export const GET = withUser(async (user) => Response.json({ skills: await listInventory(user.id) }));

const PatchSchema = z
  .object({
    set: z
      .array(
        z
          .object({
            skillId: z.string().refine(isUuid).optional(),
            name: z.string().trim().min(1).max(80).optional(),
            level: z.number().int().min(0).max(4),
          })
          .refine((s) => s.skillId || s.name, "skillId or name is required"),
      )
      .max(200)
      .optional(),
    remove: z.array(z.string().refine(isUuid)).max(200).optional(),
    confirmAll: z.boolean().optional(),
  })
  .strict();

export const PATCH = withUser(async (user, request) => {
  const body = await parseBody(request, PatchSchema);
  if ("response" in body) return body.response;
  return Response.json({ skills: await updateInventory(user.id, body.data) });
});
