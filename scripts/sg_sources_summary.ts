import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const [{ count: total }, { count: enabled }, { count: quarantined }, { data: byTier }] =
  await Promise.all([
    supabase.from("sg_sources").select("id", { count: "exact", head: true }),
    supabase
      .from("sg_sources")
      .select("id", { count: "exact", head: true })
      .eq("enabled", true)
      .eq("quarantined", false),
    supabase
      .from("sg_sources")
      .select("id", { count: "exact", head: true })
      .eq("quarantined", true),
    supabase.from("sg_sources").select("tier").neq("tier", null),
  ]);

const tierCounts = (byTier || []).reduce((acc: Record<string, number>, row: any) => {
  acc[row.tier] = (acc[row.tier] || 0) + 1;
  return acc;
}, {} as Record<string, number>);

console.log({ total, enabled, quarantined, tierCounts });
