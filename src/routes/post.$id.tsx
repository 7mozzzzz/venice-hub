import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { ArrowLeft, Heart, MessageCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { fetchUserBadges } from "@/lib/badges";
import { UserNameDisplay } from "@/components/UserBadges";

export const Route = createFileRoute("/post/$id")({
  head: () => ({ meta: [{ title: "Post — VENICEHUB" }] }),
  component: PostPage,
});

function PostPage() {
  const { id } = Route.useParams();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const [post, setPost] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [likeCount, setLikeCount] = useState(0);
  const [liked, setLiked] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [badges, setBadges] = useState<Record<string, any[]>>({});

  const load = async () => {
    const { data: p } = await supabase
      .from("posts")
      .select("*, profiles(username, avatar_url)")
      .eq("id", id)
      .maybeSingle();
    setPost(p);
    const { data: c } = await supabase
      .from("comments")
      .select("*, profiles(username, avatar_url)")
      .eq("post_id", id)
      .order("created_at", { ascending: true });
    setComments(c ?? []);
    const { count } = await supabase.from("likes").select("*", { count: "exact", head: true }).eq("post_id", id);
    setLikeCount(count ?? 0);
    if (user) {
      const { data: liked } = await supabase.from("likes").select("user_id").eq("post_id", id).eq("user_id", user.id).maybeSingle();
      setLiked(!!liked);
    }
    const ids = [p?.author_id, ...(c ?? []).map((x) => x.author_id)].filter(Boolean) as string[];
    setBadges(await fetchUserBadges([...new Set(ids)]));
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id, user?.id]);

  const toggleLike = async () => {
    if (!user) { toast.error(t("post.mustLogin")); return; }
    if (liked) {
      await supabase.from("likes").delete().eq("post_id", id).eq("user_id", user.id);
      setLiked(false); setLikeCount((c) => c - 1);
    } else {
      await supabase.from("likes").insert({ post_id: id, user_id: user.id });
      setLiked(true); setLikeCount((c) => c + 1);
    }
  };

  const addComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newComment.trim()) return;
    const { error } = await supabase.from("comments").insert({ post_id: id, author_id: user.id, content: newComment.trim() });
    if (error) { toast.error(error.message); return; }
    setNewComment("");
    load();
  };

  const deletePost = async () => {
    if (!confirm(t("post.deleteConfirm"))) return;
    const { error } = await supabase.from("posts").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(t("post.deleted"));
    navigate({ to: "/forum" });
  };

  const deleteComment = async (cid: string) => {
    if (!confirm(t("post.deleteConfirm"))) return;
    await supabase.from("comments").delete().eq("id", cid);
    load();
  };

  if (loading) return <div className="container mx-auto px-4 py-16 text-center">{t("common.loading")}</div>;
  if (!post) return <div className="container mx-auto px-4 py-16 text-center">404</div>;

  const canDeletePost = user && (user.id === post.author_id || isAdmin);

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <Link to="/forum" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-4">
        <ArrowLeft className="w-4 h-4 rtl:rotate-180" /> {t("post.backToForum")}
      </Link>

      <article className="bg-card border border-border rounded-xl p-6 md:p-8">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs px-2 py-0.5 rounded-full bg-primary/15 text-primary font-medium">
            {t(`forum.${post.category}`)}
          </span>
          <span className="text-xs text-muted-foreground">
            {new Date(post.created_at).toLocaleString(i18n.language === "ar" ? "ar" : "en")}
          </span>
        </div>
        <h1 className="font-display text-3xl md:text-4xl font-bold mb-4">{post.title}</h1>
        <div className="flex items-center gap-3 mb-6 pb-6 border-b border-border">
          {post.profiles?.avatar_url ? (
            <img src={post.profiles.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-primary/20 grid place-items-center font-bold">{post.profiles?.username?.[0]?.toUpperCase()}</div>
          )}
          <UserNameDisplay username={post.profiles?.username ?? "user"} badges={badges[post.author_id]} />
        </div>

        <div className="prose prose-invert max-w-none whitespace-pre-wrap text-foreground/90 mb-6">{post.content}</div>

        {post.images && post.images.length > 0 && (
          <div className="grid grid-cols-2 gap-3 mb-6">
            {post.images.map((u: string) => <img key={u} src={u} alt="" className="rounded-lg w-full" />)}
          </div>
        )}

        <div className="flex items-center gap-2 pt-4 border-t border-border">
          <Button variant={liked ? "default" : "outline"} size="sm" onClick={toggleLike} className="gap-1.5">
            <Heart className={`w-4 h-4 ${liked ? "fill-current" : ""}`} /> {likeCount}
          </Button>
          <span className="text-sm text-muted-foreground flex items-center gap-1">
            <MessageCircle className="w-4 h-4" /> {comments.length}
          </span>
          {canDeletePost && (
            <Button variant="ghost" size="sm" onClick={deletePost} className="ms-auto text-destructive gap-1">
              <Trash2 className="w-4 h-4" /> {t("post.delete")}
            </Button>
          )}
        </div>
      </article>

      {/* Comments */}
      <section className="mt-8 space-y-4">
        <h2 className="font-display text-xl font-bold">{t("forum.comments")} ({comments.length})</h2>

        {user ? (
          <form onSubmit={addComment} className="bg-card border border-border rounded-xl p-4 space-y-2">
            <Textarea value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder={t("post.writeComment")} rows={3} />
            <Button type="submit" size="sm" disabled={!newComment.trim()}>{t("post.sendComment")}</Button>
          </form>
        ) : (
          <p className="text-sm text-muted-foreground">
            <Link to="/auth" className="text-primary hover:underline">{t("nav.signIn")}</Link> {t("post.mustLogin")}
          </p>
        )}

        {comments.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">{t("post.noComments")}</p>
        ) : (
          comments.map((c) => (
            <div key={c.id} className="bg-card border border-border rounded-xl p-4 flex gap-3">
              {c.profiles?.avatar_url ? (
                <img src={c.profiles.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-primary/20 grid place-items-center text-sm font-bold flex-shrink-0">{c.profiles?.username?.[0]?.toUpperCase()}</div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <UserNameDisplay username={c.profiles?.username ?? "user"} badges={badges[c.author_id]} className="text-sm" />
                  <span className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleString(i18n.language === "ar" ? "ar" : "en")}</span>
                  {(user?.id === c.author_id || isAdmin) && (
                    <button onClick={() => deleteComment(c.id)} className="ms-auto text-destructive hover:opacity-70">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <p className="text-sm whitespace-pre-wrap">{c.content}</p>
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
