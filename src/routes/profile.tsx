import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { BadgeIcon } from "@/components/UserBadges";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "My Profile — VENICEHUB" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, profile, loading, refresh } = useAuth();
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [myBadges, setMyBadges] = useState<any[]>([]);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (profile) {
      setUsername(profile.username);
      setBio(profile.bio ?? "");
      setAvatarUrl(profile.avatar_url);
    }
  }, [profile]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("user_badges")
        .select("badges(id, name_en, name_ar, icon, color, type)")
        .eq("user_id", user.id);
      setMyBadges((data ?? []).map((r: any) => r.badges).filter(Boolean));
    })();
  }, [user]);

  const onAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      const path = `${user.id}/avatar-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
      const { error } = await supabase.storage.from("post-images").upload(path, file);
      if (error) throw error;
      const { data } = supabase.storage.from("post-images").getPublicUrl(path);
      setAvatarUrl(data.publicUrl);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ username: username.trim(), bio: bio.trim() || null, avatar_url: avatarUrl })
        .eq("id", user.id);
      if (error) throw error;
      toast.success(t("profile.saved"));
      await refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading || !user) return <div className="container mx-auto px-4 py-16 text-center">{t("common.loading")}</div>;

  return (
    <div className="container mx-auto px-4 py-10 max-w-2xl space-y-6">
      <h1 className="font-display text-3xl font-bold text-gradient">{t("profile.title")}</h1>

      <form onSubmit={onSave} className="bg-card border border-border rounded-xl p-6 space-y-5">
        <div className="flex items-center gap-4">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="w-20 h-20 rounded-full object-cover" />
          ) : (
            <div className="w-20 h-20 rounded-full bg-primary/20 grid place-items-center text-2xl font-bold">{username[0]?.toUpperCase()}</div>
          )}
          <label className="inline-flex items-center gap-2 cursor-pointer px-3 py-2 rounded-md border border-border hover:bg-secondary text-sm">
            <Upload className="w-4 h-4" />
            {uploading ? "..." : t("profile.uploadAvatar")}
            <input type="file" accept="image/*" className="hidden" onChange={onAvatar} disabled={uploading} />
          </label>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="u">{t("profile.username")}</Label>
          <Input id="u" value={username} onChange={(e) => setUsername(e.target.value)} required minLength={3} maxLength={20} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="b">{t("profile.bio")}</Label>
          <Textarea id="b" value={bio} onChange={(e) => setBio(e.target.value)} rows={3} maxLength={200} />
        </div>
        <Button type="submit" disabled={saving}>{saving ? "..." : t("profile.save")}</Button>
      </form>

      <div className="bg-card border border-border rounded-xl p-6">
        <h2 className="font-display font-bold text-lg mb-4">{t("profile.myBadges")}</h2>
        {myBadges.length === 0 ? (
          <p className="text-sm text-muted-foreground">—</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {myBadges.map((b) => (
              <div key={b.id} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary">
                <BadgeIcon badge={b} size={16} />
                <span className="text-sm">{b.name_en}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
