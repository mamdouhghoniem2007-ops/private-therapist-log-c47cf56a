import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

type Role = "admin" | "specialist" | "supervisor";

function getAdmin() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin only");
}

export const createEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        email: z.string().email(),
        password: z.string().min(6).max(72),
        full_name: z.string().min(1).max(120),
        whatsapp_number: z.string().max(40).optional().nullable(),
        role: z.enum(["admin", "specialist", "supervisor"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const admin = getAdmin();
    const { data: created, error } = await admin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        full_name: data.full_name,
        whatsapp_number: data.whatsapp_number ?? "",
      },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Failed to create user");

    const newId = created.user.id;
    // handle_new_user trigger inserts profile + default role. Ensure desired values.
    await admin
      .from("profiles")
      .upsert({ id: newId, full_name: data.full_name, whatsapp_number: data.whatsapp_number ?? null });

    if (data.role !== "specialist") {
      await admin.from("user_roles").delete().eq("user_id", newId);
      const { error: rErr } = await admin
        .from("user_roles")
        .insert({ user_id: newId, role: data.role as Role });
      if (rErr) throw new Error(rErr.message);
    }
    return { id: newId };
  });

export const deleteEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ user_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.user_id === context.userId) throw new Error("Cannot delete yourself");
    const admin = getAdmin();
    const { error } = await admin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
