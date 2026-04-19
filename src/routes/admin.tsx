import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Ban, ShieldCheck, Trash2, Plus, Users, FileText,
  MessageSquare, DollarSign, Search, ChevronLeft, ChevronRight,
} from "lucide-react";
import { BadgeIcon } from "@/components/UserBadges";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — VENICEHUB" }] }),
  component: AdminPage,
});

function AdminPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAdmin, loading, user } = useAuth();

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      toast.error(t("admin.notAdmin"));
      navigate({ to: "/" });
    }
  }, [loading, isAdmin, user, navigate, t]);

  if (loading || !isAdmin)
    return <div className="container mx-auto px-4 py-16 text-center">{t("common.loading")}</div>;

  return (
    <div className="container mx-auto px-4 py-10">
      <h1 className="font-display text-3xl md:text-4xl font-bold text-gradient mb-6">{t("admin.title")}</h1>
      <Stats />
      <Tabs defaultValue="users" className="mt-8">
        <TabsList className="grid grid-cols-3 w-full max-w-md">
          <TabsTrigger value="users">{t("admin.manageUsers")}</TabsTrigger>
          <TabsTrigger value="badges">{t("admin.manageBadges")}</TabsTrigger>
          <TabsTrigger value="content">{t("admin.manageContent")}</TabsTrigger>
        </TabsList>
        <TabsContent value="users" className="mt-6"><UsersAdmin /></TabsContent>
        <TabsContent value="badges" className="mt-6"><BadgesAdmin /></TabsContent>
        <TabsContent value="content" className="mt-6"><ContentAdmin /></TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Stats ────────────────────────────────────────────────────────────────────
// Revenue counts only paid badge grants (price_cents > 0) — free admin grants
// no longer inflate the metric.
function Stats() {
  const { t } = useTranslation();
  const [stats, setStats] = useState({ users: 0, posts: 0, comments: 0, revenue: 0 });

  useEffect(() => {
    (async () => {
      const [u, p, c, ub] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("posts").select("*", { count: "exact", head: true }),
        supabase.from("comments").select("*", { count: "exact", head: true }),
        supabase.from("user_badges").select("badges(price_cents)").gt("badges.price_cents", 0),
      ]);
      const revenue = (ub.data ?? []).reduce(
        (s: number, x: any) => s + (x.badges?.price_cents ?? 0),
        0,
      );
      setStats({ users: u.count ?? 0, posts: p.count ?? 0, comments: c.count ?? 0, revenue });
    })();
  }, []);

  const cards = [
    { icon: Users,         label: t("admin.users"),    value: stats.users,                          color: "var(--neon-purple)" },
    { icon: FileText,      label: t("admin.posts"),    value: stats.posts,                          color: "var(--neon-cyan)"   },
    { icon: MessageSquare, label: t("admin.comments"), value: stats.comments,                       color: "var(--neon-pink)"   },
    { icon: DollarSign,    label: t("admin.revenue"),  value: `$${(stats.revenue / 100).toFixed(2)}`, color: "var(--neon-purple)" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((c) => (
        <div key={c.label} className="bg-card border border-border rounded-xl p-4">
          <div
            className="w-9 h-9 rounded-lg grid place-items-center mb-2"
            style={{ backgroundColor: `color-mix(in oklab, ${c.color} 20%, transparent)`, color: c.color }}
          >
            <c.icon className="w-4 h-4" />
          </div>
          <div className="text-2xl font-display font-bold">{c.value}</div>
          <div className="text-xs text-muted-foreground">{c.label}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Reusable Confirm Dialog ──────────────────────────────────────────────────
function ConfirmDialog({
  open, title, description, onConfirm, onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Confirm
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ─── Users Admin ──────────────────────────────────────────────────────────────
const USERS_PAGE = 20;

function UsersAdmin() {
  const { t } = useTranslation();
  const { user: me } = useAuth();
  const [users, setUsers]           = useState<any[]>([]);
  const [total, setTotal]           = useState(0);
  const [page, setPage]             = useState(0);
  const [search, setSearch]         = useState("");
  const [bans, setBans]             = useState<Set<string>>(new Set());
  const [reasons, setReasons]       = useState<Record<string, string>>({});
  const [allBadges, setAllBadges]   = useState<any[]>([]);
  const [userBadges, setUserBadges] = useState<Record<string, any[]>>({});
  const [confirm, setConfirm]       = useState<{ uid: string; action: "ban" | "unban" } | null>(null);

  const load = async () => {
    const from = page * USERS_PAGE;
    const to   = from + USERS_PAGE - 1;

    let q = supabase
      .from("profiles")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (search.trim()) q = q.ilike("username", `%${search.trim()}%`);

    const [{ data: u, count }, { data: b }, { data: bg }, { data: ub }] = await Promise.all([
      q,
      supabase.from("banned_users").select("user_id"),
      supabase.from("badges").select("*"),
      supabase.from("user_badges").select("user_id, badge_id, badges(*)"),
    ]);

    setUsers(u ?? []);
    setTotal(count ?? 0);
    setBans(new Set((b ?? []).map((x: any) => x.user_id)));
    setAllBadges(bg ?? []);
    const map: Record<string, any[]> = {};
    (ub ?? []).forEach((row: any) => {
      map[row.user_id] = map[row.user_id] ?? [];
      if (row.badges) map[row.user_id].push({ ...row.badges, badge_id: row.badge_id });
    });
    setUserBadges(map);
  };

  useEffect(() => { load(); }, [page, search]);

  const doBan = async (uid: string) => {
    const { error } = await supabase
      .from("banned_users")
      .insert({ user_id: uid, reason: reasons[uid] || "—", banned_by: me?.id });
    if (error) return toast.error(error.message);
    toast.success("Banned");
    setConfirm(null);
    load();
  };

  const doUnban = async (uid: string) => {
    await supabase.from("banned_users").delete().eq("user_id", uid);
    toast.success("Unbanned");
    setConfirm(null);
    load();
  };

  const grant = async (uid: string, badgeId: string) => {
    if (!badgeId) return;
    const { error } = await supabase
      .from("user_badges")
      .insert({ user_id: uid, badge_id: badgeId, granted_by: me?.id });
    if (error) return toast.error(error.message);
    toast.success("Granted");
    load();
  };

  const revoke = async (uid: string, badgeId: string) => {
    await supabase.from("user_badges").delete().eq("user_id", uid).eq("badge_id", badgeId);
    load();
  };

  const totalPages = Math.ceil(total / USERS_PAGE);

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          placeholder={t("admin.searchUsers") ?? "Search users..."}
          className="ps-9"
        />
      </div>

      {/* List */}
      <div className="space-y-3">
        {users.map((u) => {
          const isBanned = bans.has(u.id);
          return (
            <div key={u.id} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-3 mb-3">
                {u.avatar_url ? (
                  <img src={u.avatar_url} className="w-10 h-10 rounded-full object-cover" alt="" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-primary/20 grid place-items-center font-bold">
                    {u.username[0]?.toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold">{u.username}</div>
                  <div className="text-xs text-muted-foreground truncate">{u.id}</div>
                </div>
                {isBanned ? (
                  <Button size="sm" variant="outline" onClick={() => setConfirm({ uid: u.id, action: "unban" })} className="gap-1">
                    <ShieldCheck className="w-4 h-4" /> {t("admin.unban")}
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      placeholder={t("admin.banReason")}
                      value={reasons[u.id] ?? ""}
                      onChange={(e) => setReasons((r) => ({ ...r, [u.id]: e.target.value }))}
                      className="w-40 h-9"
                    />
                    <Button size="sm" variant="destructive" onClick={() => setConfirm({ uid: u.id, action: "ban" })} className="gap-1">
                      <Ban className="w-4 h-4" /> {t("admin.ban")}
                    </Button>
                  </div>
                )}
              </div>

              {/* Badges row */}
              <div className="flex items-center gap-2 flex-wrap">
                {(userBadges[u.id] ?? []).map((b: any) => (
                  <div key={b.badge_id} className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-secondary text-xs">
                    <BadgeIcon badge={b} size={12} />
                    <span>{b.name_en}</span>
                    <button onClick={() => revoke(u.id, b.badge_id)} className="text-destructive">×</button>
                  </div>
                ))}
                <Select onValueChange={(v) => grant(u.id, v)}>
                  <SelectTrigger className="w-44 h-8 text-xs">
                    <SelectValue placeholder={t("admin.grantBadge")} />
                  </SelectTrigger>
                  <SelectContent>
                    {allBadges.map((b) => <SelectItem key={b.id} value={b.id}>{b.name_en}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-muted-foreground">
            {page * USERS_PAGE + 1}–{Math.min((page + 1) * USERS_PAGE, total)} / {total}
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button size="sm" variant="outline" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Ban / Unban confirm */}
      {confirm && (
        <ConfirmDialog
          open
          title={confirm.action === "ban" ? t("admin.ban") : t("admin.unban")}
          description={
            confirm.action === "ban"
              ? `Ban this user? Reason: "${reasons[confirm.uid] || "—"}"`
              : "Remove the ban from this user?"
          }
          onConfirm={() => (confirm.action === "ban" ? doBan(confirm.uid) : doUnban(confirm.uid))}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}

// ─── Badges Admin ─────────────────────────────────────────────────────────────
function BadgesAdmin() {
  const { t } = useTranslation();
  const [badges, setBadges]           = useState<any[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [form, setForm] = useState<{
    name_en: string; name_ar: string; icon: string;
    color: string; price_cents: number; type: "badge" | "rank"; description: string;
  }>({ name_en: "", name_ar: "", icon: "star", color: "#a855f7", price_cents: 0, type: "badge", description: "" });

  const load = async () => {
    const { data } = await supabase.from("badges").select("*").order("created_at", { ascending: false });
    setBadges(data ?? []);
  };

  useEffect(() => { load(); }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("badges").insert({ ...form, price_cents: Number(form.price_cents) });
    if (error) return toast.error(error.message);
    toast.success("Created");
    setForm({ name_en: "", name_ar: "", icon: "star", color: "#a855f7", price_cents: 0, type: "badge", description: "" });
    load();
  };

  const remove = async (id: string) => {
    await supabase.from("badges").delete().eq("id", id);
    setDeleteTarget(null);
    load();
  };

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {/* Create form */}
      <form onSubmit={create} className="bg-card border border-border rounded-xl p-5 space-y-3">
        <h3 className="font-display font-bold">{t("admin.newBadge")}</h3>
        <div className="space-y-1.5"><Label>{t("admin.nameEn")}</Label><Input value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} required /></div>
        <div className="space-y-1.5"><Label>{t("admin.nameAr")}</Label><Input value={form.name_ar} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} required /></div>
        <div className="space-y-1.5"><Label>{t("admin.icon")}</Label><Input value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} placeholder="star, crown, code..." /></div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5"><Label>{t("admin.color")}</Label><Input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>{t("admin.price")}</Label><Input type="number" min="0" value={form.price_cents} onChange={(e) => setForm({ ...form, price_cents: Number(e.target.value) })} /></div>
        </div>
        <div className="space-y-1.5">
          <Label>{t("admin.type")}</Label>
          <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as "badge" | "rank" })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="badge">Badge</SelectItem>
              <SelectItem value="rank">Rank</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Textarea placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
        <Button type="submit" className="w-full gap-1"><Plus className="w-4 h-4" /> {t("admin.create")}</Button>
      </form>

      {/* Badge list */}
      <div className="space-y-2">
        {badges.map((b) => (
          <div key={b.id} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
            <BadgeIcon badge={b} size={20} />
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm" style={{ color: b.color }}>{b.name_en} / {b.name_ar}</div>
              <div className="text-xs text-muted-foreground">{b.type} · ${(b.price_cents / 100).toFixed(2)}</div>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(b.id)} className="text-destructive">
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Badge"
        description="This removes the badge from all users permanently. Are you sure?"
        onConfirm={() => deleteTarget && remove(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

// ─── Content Admin ────────────────────────────────────────────────────────────
const CONTENT_PAGE = 20;

function ContentAdmin() {
  const [posts, setPosts]           = useState<any[]>([]);
  const [total, setTotal]           = useState(0);
  const [page, setPage]             = useState(0);
  const [search, setSearch]         = useState("");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const load = async () => {
    const from = page * CONTENT_PAGE;
    const to   = from + CONTENT_PAGE - 1;

    let q = supabase
      .from("posts")
      .select("id, title, category, created_at, profiles(username)", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (search.trim()) q = q.ilike("title", `%${search.trim()}%`);

    const { data, count } = await q;
    setPosts(data ?? []);
    setTotal(count ?? 0);
  };

  useEffect(() => { load(); }, [page, search]);

  const del = async (id: string) => {
    await supabase.from("posts").delete().eq("id", id);
    setDeleteTarget(null);
    load();
  };

  const totalPages = Math.ceil(total / CONTENT_PAGE);

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          placeholder="Search posts..."
          className="ps-9"
        />
      </div>

      {/* List */}
      <div className="space-y-2">
        {posts.map((p) => (
          <div key={p.id} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/15 text-primary shrink-0">{p.category}</span>
            <span className="flex-1 truncate text-sm">{p.title}</span>
            <span className="text-xs text-muted-foreground shrink-0">{p.profiles?.username}</span>
            <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(p.id)} className="text-destructive shrink-0">
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-muted-foreground">
            {page * CONTENT_PAGE + 1}–{Math.min((page + 1) * CONTENT_PAGE, total)} / {total}
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button size="sm" variant="outline" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Post"
        description="This permanently deletes the post and all its comments. Are you sure?"
        onConfirm={() => deleteTarget && del(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
