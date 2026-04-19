import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Code, MessageSquare, Server, LifeBuoy, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "VENICEHUB — Home" },
      { name: "description", content: "The Ultimate FiveM Community — share scripts, mods, builds and discover servers." },
      { property: "og:title", content: "VENICEHUB — Home" },
      { property: "og:description", content: "Where FiveM lives." },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const { t } = useTranslation();
  const features = [
    { icon: Code, title: t("home.f1Title"), desc: t("home.f1Desc"), color: "var(--neon-purple)" },
    { icon: MessageSquare, title: t("home.f2Title"), desc: t("home.f2Desc"), color: "var(--neon-cyan)" },
    { icon: Server, title: t("home.f3Title"), desc: t("home.f3Desc"), color: "var(--neon-pink)" },
    { icon: LifeBuoy, title: t("home.f4Title"), desc: t("home.f4Desc"), color: "var(--neon-purple)" },
  ];

  return (
    <div>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="container mx-auto px-4 pt-20 pb-24 md:pt-28 md:pb-36 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full neon-border bg-card/50 text-xs font-medium mb-6"
          >
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span>{t("tagline")}</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="font-display font-black text-5xl md:text-7xl lg:text-8xl leading-tight"
          >
            <span className="text-gradient">{t("home.heroTitle")}</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-6 max-w-2xl mx-auto text-lg text-muted-foreground"
          >
            {t("home.heroSub")}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.45 }}
            className="mt-10 flex flex-wrap items-center justify-center gap-3"
          >
            <Button asChild size="lg" className="gap-2 glow-purple">
              <Link to="/auth">
                {t("home.ctaJoin")} <ArrowRight className="w-4 h-4 rtl:rotate-180" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/forum">{t("home.ctaExplore")}</Link>
            </Button>
          </motion.div>
        </div>

        {/* glow blobs */}
        <div className="pointer-events-none absolute -top-32 left-1/4 w-96 h-96 rounded-full opacity-30 blur-3xl" style={{ background: "var(--neon-purple)" }} />
        <div className="pointer-events-none absolute top-1/3 right-1/4 w-80 h-80 rounded-full opacity-20 blur-3xl" style={{ background: "var(--neon-cyan)" }} />
      </section>

      {/* FEATURES */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="font-display text-3xl md:text-4xl font-bold text-center mb-12">
          {t("home.featuresTitle")}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              className="group p-6 rounded-xl bg-card border border-border hover:border-primary/50 transition-all hover:-translate-y-1"
            >
              <div
                className="w-12 h-12 rounded-lg grid place-items-center mb-4"
                style={{ backgroundColor: `color-mix(in oklab, ${f.color} 18%, transparent)`, color: f.color }}
              >
                <f.icon className="w-6 h-6" />
              </div>
              <h3 className="font-display font-bold text-lg mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}
