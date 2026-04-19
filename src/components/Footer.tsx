import { useTranslation } from "react-i18next";

export function Footer() {
  const { t } = useTranslation();
  return (
    <footer className="border-t border-border mt-20 py-8 text-center text-sm text-muted-foreground">
      <div className="container mx-auto px-4 space-y-2">
        <p className="font-display text-gradient text-lg">VENICEHUB</p>
        <p>© {new Date().getFullYear()} VENICEHUB. {t("footer.rights")}</p>
        <p className="text-xs">{t("footer.built")}</p>
      </div>
    </footer>
  );
}
