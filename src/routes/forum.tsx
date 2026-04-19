import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Heart, MessageCircle, Search } from "lucide-react";
import { motion } from "framer-motion";
import { fetchUserBadges } from "@/lib/badges";
import { UserNameDisplay } from "@/components/UserBadges";

export const Route = createFileRoute("/forum")({
  head: () => ({
    meta: [
      { title: "Forum — VENICEHUB" },
      { name: "description", content: "Browse the latest scripts, discussions, servers and help requests from the FiveM community." },
    ],
  }),
  component: ForumPage,
});

type Post = {
  id: string;
  title: string;
  content: string;
  category: "scripts" | "discussions" | "servers" | "help";
  created_at: string;
  author_id: string;
  images: string[] | null;
  profiles: { username: string; avatar_url: string | null } | null;
  likes: { count: number }[];
  comments: { count: number }[];
};

const CATS = ["all", "scripts", "discussions", "servers", "help"] as const;

function ForumPage() {
  const { t, i18n } = useTranslation();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [cat, setCat] = useState<(typeof CATS)[number]>("all");
  const [q, setQ] = useState("");
  const [badgesByUser, setBadgesByUser] = useState<Record<string, any[]>>({});

  useEffect(() => {
    (async () => {
      setLoading(true);
      let query = supabase
        .from("posts")
        .select("id, title, content, category, created_at, author_id, images, profiles(username, avatar_url), likes(count), comments(count)")
        .order("created_at", { ascending: false });
      if (cat !== "all") query = query.eq("category", cat);
      const { data } = await query;
      const list = (data ?? []) as unknown as Post[];
      setPosts(list);
      const ids = [...new Set(list.map((p) => p.author_id))];
      setBadgesByUser(await fetchUserBadges(ids));
      setLoading(false);
    })();
  }, [cat]);

  const filtered = useMemo(
    () => posts.filter((p) => p.title.toLowerCase().includes(q.toLowerCase()) || p.content.toLowerCase().includes(q.toLowerCase())),
    [posts, q],
  );

  return (
    <div className="container mx-auto px-4 py-10">
      <div className="text-center mb-8">
        <h1 className="font-display text-4xl md:text-5xl font-bold text-gradient">{t("forum.title")}</h1>
        <p className="text-muted-foreground mt-2">{t("forum.subtitle")}</p>
      </div>

      <div className="flex flex-col md:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("forum.search")} className="ps-9" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {CATS.map((c) => (
            <Button key={c} size="sm" variant={cat === c ? "default" : "outline"} onClick={() => setCat(c)}>
              {t(`forum.${c}`)}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-center text-muted-foreground py-12">{t("common.loading")}</p>
      ) : filtered.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">{t("forum.empty")}</p>
      ) : (
        <div className="grid gap-4">
          {filtered.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.04 }}
            >
              <Link
                to="/post/$id"
                params={{ id: p.id }}
                className="block p-5 rounded-xl bg-card border border-border hover:border-primary/50 transition-all hover:-translate-y-0.5"
              >
                <div className="flex items-start gap-4">
                  {p.profiles?.avatar_url ? (
                    <img src={p.profiles.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-primary/20 grid place-items-center font-bold">
                      {p.profiles?.username?.[0]?.toUpperCase() ?? "U"}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-primary/15 text-primary font-medium">
                        {t(`forum.${p.category}`)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(p.created_at).toLocaleDateString(i18n.language === "ar" ? "ar" : "en")}
                      </span>
                    </div>
                    <h3 className="font-display font-bold text-lg mb-1 truncate">{p.title}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{p.content}</p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>{t("forum.by")} <UserNameDisplay username={p.profiles?.username ?? "user"} badges={badgesByUser[p.author_id]} /></span>
                      <span className="flex items-center gap-1"><Heart className="w-3.5 h-3.5" /> {p.likes?.[0]?.count ?? 0}</span>
                      <span className="flex items-center gap-1"><MessageCircle className="w-3.5 h-3.5" /> {p.comments?.[0]?.count ?? 0}</span>
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
