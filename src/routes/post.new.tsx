import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Upload, X } from "lucide-react";

export const Route = createFileRoute("/post/new")({
  head: () => ({ meta: [{ title: "New Post — VENICEHUB" }] }),
  component: NewPostPage,
});

function NewPostPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, isBanned, loading } = useAuth();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<"scripts" | "discussions" | "servers" | "help">("discussions");
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      toast.error(t("post.mustLogin"));
      navigate({ to: "/auth" });
    }
  }, [user, loading, navigate, t]);

  if (isBanned) {
    return <div className="container mx-auto px-4 py-16 text-center text-destructive">{t("post.bannedNotice")}</div>;
  }

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length || !user) return;
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const file of files) {
        const path = `${user.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
        const { error } = await supabase.storage.from("post-images").upload(path, file);
        if (error) throw error;
        const { data } = supabase.storage.from("post-images").getPublicUrl(path);
        urls.push(data.publicUrl);
      }
      setImages((prev) => [...prev, ...urls]);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from("posts")
        .insert({ title, content, category, images, author_id: user.id })
        .select("id")
        .single();
      if (error) throw error;
      toast.success(t("auth.success"));
      navigate({ to: "/post/$id", params: { id: data.id } });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-10 max-w-2xl">
      <h1 className="font-display text-3xl font-bold text-gradient mb-6">{t("post.newTitle")}</h1>
      <form onSubmit={onSubmit} className="space-y-5 bg-card border border-border rounded-xl p-6">
        <div className="space-y-1.5">
          <Label htmlFor="title">{t("post.titleLabel")}</Label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={140} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cat">{t("post.categoryLabel")}</Label>
          <Select value={category} onValueChange={(v) => setCategory(v as typeof category)}>
            <SelectTrigger id="cat"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="scripts">{t("forum.scripts")}</SelectItem>
              <SelectItem value="discussions">{t("forum.discussions")}</SelectItem>
              <SelectItem value="servers">{t("forum.servers")}</SelectItem>
              <SelectItem value="help">{t("forum.help")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="content">{t("post.contentLabel")}</Label>
          <Textarea id="content" value={content} onChange={(e) => setContent(e.target.value)} required rows={8} />
        </div>
        <div className="space-y-2">
          <Label>{t("post.images")}</Label>
          <label className="inline-flex items-center gap-2 cursor-pointer px-3 py-2 rounded-md border border-border hover:bg-secondary text-sm">
            <Upload className="w-4 h-4" />
            {uploading ? "..." : "Upload"}
            <input type="file" accept="image/*" multiple className="hidden" onChange={onUpload} disabled={uploading} />
          </label>
          {images.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mt-2">
              {images.map((u) => (
                <div key={u} className="relative group">
                  <img src={u} alt="" className="w-full h-24 object-cover rounded-md" />
                  <button type="button" onClick={() => setImages((p) => p.filter((x) => x !== u))} className="absolute top-1 end-1 p-1 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? t("post.submitting") : t("post.submit")}
        </Button>
      </form>
    </div>
  );
}
