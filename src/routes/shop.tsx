import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { BadgeIcon } from "@/components/UserBadges";
import { Check, Loader2, ShoppingBag, Sparkles } from "lucide-react";

export const Route = createFileRoute("/shop")({
  head: () => ({
    meta: [
      { title: "Shop — VENICEHUB" },
      { name: "description", content: "Buy exclusive badges and ranks." },
    ],
  }),
  component: ShopPage,
});

function ShopPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [badges, setBadges] = useState<any[]>([]);
  const [owned, setOwned] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<string | null>(null); // badge id being purchased

  // Check for ?success=1 after Stripe redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("success") === "1") {
      toast.success("Payment successful! Your badge will appear shortly.");
      // Clean URL without reload
      window.history.replaceState({}, "", "/shop");
      // Re-fetch owned badges after a short delay (webhook may take a moment)
      setTimeout(() => refreshOwned(), 2500);
    }
  }, []);

  const refreshOwned = async () => {
    if (!user) return;
    const { data: ub } = await supabase
      .from("user_badges")
      .select("badge_id")
      .eq("user_id", user.id);
    setOwned(new Set((ub ?? []).map((x: any) => x.badge_id)));
  };

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("badges").select("*").order("price_cents");
      setBadges(data ?? []);
      if (user) await refreshOwned();
      setLoading(false);
    })();
  }, [user]);

  const buy = async (badge: { id: string; name_en: string; name_ar: string; price_cents: number }) => {
    if (!user) {
      toast.error(t("shop.mustLogin"));
      return;
    }

    setBuying(badge.id);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          badgeId: badge.id,
          badgeName: i18n.language === "ar" ? badge.name_ar : badge.name_en,
          priceInCents: badge.price_cents,
          userId: user.id,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.url) {
        throw new Error(data.error ?? "Failed to create checkout session");
      }

      // Redirect to Stripe Checkout
      window.location.href = data.url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
      setBuying(null);
    }
  };

  const ranks = badges.filter((b) => b.type === "rank");
  const onlyBadges = badges.filter((b) => b.type === "badge");

  if (loading)
    return <div className="container mx-auto px-4 py-16 text-center">{t("common.loading")}</div>;

  return (
    <div className="container mx-auto px-4 py-10">
      <div className="text-center mb-10">
        <h1 className="font-display text-4xl md:text-5xl font-bold text-gradient">{t("shop.title")}</h1>
        <p className="text-muted-foreground mt-2">{t("shop.subtitle")}</p>
      </div>

      <Section
        title={t("shop.ranks")}
        items={ranks}
        owned={owned}
        onBuy={buy}
        buying={buying}
        lang={i18n.language}
        t={t}
      />
      <Section
        title={t("shop.badges")}
        items={onlyBadges}
        owned={owned}
        onBuy={buy}
        buying={buying}
        lang={i18n.language}
        t={t}
      />
    </div>
  );
}

function Section({
  title,
  items,
  owned,
  onBuy,
  buying,
  lang,
  t,
}: {
  title: string;
  items: any[];
  owned: Set<string>;
  onBuy: (badge: any) => void;
  buying: string | null;
  lang: string;
  t: any;
}) {
  if (items.length === 0) return null;

  return (
    <section className="mb-10">
      <h2 className="font-display text-2xl font-bold mb-4">{title}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((b: any) => {
          const isOwned = owned.has(b.id);
          const isLoading = buying === b.id;

          return (
            <div
              key={b.id}
              className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3 hover:border-primary/50 transition-all"
              style={{ boxShadow: `0 0 30px ${b.color}22` }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-full grid place-items-center"
                  style={{ backgroundColor: `${b.color}22`, color: b.color }}
                >
                  <BadgeIcon badge={b} size={24} />
                </div>
                <div>
                  <h3 className="font-display font-bold" style={{ color: b.color }}>
                    {lang === "ar" ? b.name_ar : b.name_en}
                  </h3>
                  {b.description && (
                    <p className="text-xs text-muted-foreground">{b.description}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between mt-auto">
                <span className="font-display text-lg font-bold">
                  ${(b.price_cents / 100).toFixed(2)}
                </span>

                {isOwned ? (
                  <Button size="sm" variant="outline" disabled className="gap-1">
                    <Check className="w-4 h-4" /> {t("shop.owned")}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => onBuy(b)}
                    disabled={!!buying}
                    className="gap-1"
                  >
                    {isLoading ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Redirecting...</>
                    ) : (
                      <><ShoppingBag className="w-4 h-4" /> {t("shop.buy")}</>
                    )}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
