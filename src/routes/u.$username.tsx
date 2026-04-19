import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { fetchUserBadges } from "@/lib/badges";
import { UserNameDisplay, BadgeIcon } from "@/components/UserBadges";

export const Route = createFileRoute("/u/$username")({
  head: () => ({ meta: [{ title: "User — VENICEHUB" }] }),
  component: UserPage,
});

function UserPage() {
  const { username } = Route.useParams();
  const { t } = useTranslation();
  const [profile, setProfile] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [badges, setBadges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: p } = await supabase.from("profiles").select("*").eq("username", username).maybeSingle();
      setProfile(p);
      if (p) {
        const { data: ps } = await supabase.from("posts").select("id, title, category, created_at").eq("author_id", p.id).order("created_at", { ascending: false });
        setPosts(ps ?? []);
        const map = await fetchUserBadges([p.id]);
        setBadges(map[p.id] ?? []);
      }
      setLoading(false);
    })();
  }, [username]);

  if (loading) return <div className="container mx-auto px-4 py-16 text-center">{t("common.loading")}</div>;
  if (!profile) return <div className="container mx-auto px-4 py-16 text-center">User not found</div>;

  return (
    <div className="container mx-auto px-4 py-10 max-w-3xl space-y-6">
      <div className="bg-card border border-border rounded-xl p-6 flex items-center gap-5">
        {profile.avatar_url ? (
          <img src={profile.avatar_url} alt="" className="w-24 h-24 rounded-full object-cover" />
        ) : (
          <div className="w-24 h-24 rounded-full bg-primary/20 grid place-items-center text-3xl font-bold">{profile.username[0]?.toUpperCase()}</div>
        )}
        <div className="flex-1 min-w-0">
          <UserNameDisplay username={profile.username} badges={badges} className="text-2xl" />
          {profile.bio && <p className="text-sm text-muted-foreground mt-2">{profile.bio}</p>}
          {badges.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {badges.map((b) => (
                <div key={b.id} className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-secondary text-xs">
                  <BadgeIcon badge={b} size={12} />
                  <span>{b.name_en}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-6">
        <h2 className="font-display font-bold text-lg mb-4">{t("profile.myPosts")}</h2>
        {posts.length === 0 ? (
          <p className="text-sm text-muted-foreground">—</p>
        ) : (
          <div className="space-y-2">
            {posts.map((p) => (
              <Link key={p.id} to="/post/$id" params={{ id: p.id }} className="block p-3 rounded-md hover:bg-secondary transition-colors">
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-primary/15 text-primary">{t(`forum.${p.category}`)}</span>
                  <span className="font-medium truncate">{p.title}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
