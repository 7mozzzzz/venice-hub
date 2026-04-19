import { supabase } from "@/integrations/supabase/client";

type Badge = {
  id: string;
  name_en: string;
  name_ar: string;
  icon: string;
  color: string;
  type: "badge" | "rank";
};

export async function fetchUserBadges(userIds: string[]): Promise<Record<string, Badge[]>> {
  if (userIds.length === 0) return {};
  const { data } = await supabase
    .from("user_badges")
    .select("user_id, badges(id, name_en, name_ar, icon, color, type)")
    .in("user_id", userIds);

  const map: Record<string, Badge[]> = {};
  (data ?? []).forEach((row: { user_id: string; badges: Badge | null }) => {
    if (!row.badges) return;
    map[row.user_id] = map[row.user_id] ?? [];
    map[row.user_id].push(row.badges);
  });
  return map;
}
