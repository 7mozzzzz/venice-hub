import { Link, useRouter } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Moon, Sun, LogOut, Shield, User as UserIcon, PlusCircle, Menu } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import i18n from "@/lib/i18n";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

export function Header() {
  const { t } = useTranslation();
  const { theme, toggle } = useTheme();
  const { user, profile, isAdmin } = useAuth();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const switchLang = (lng: "en" | "ar") => {
    i18n.changeLanguage(lng);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    toast.success(t("auth.loggedOut"));
    router.navigate({ to: "/" });
  };

  return (
    <header className="sticky top-0 z-50 glass border-b border-border">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-accent grid place-items-center font-display font-black text-primary-foreground glow-purple">
            V
          </div>
          <span className="font-display font-black text-xl tracking-wider text-gradient hidden sm:inline">
            VENICEHUB
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          <Link to="/" className="px-3 py-2 rounded-md text-sm hover:bg-secondary transition-colors" activeProps={{ className: "text-primary font-semibold" }}>
            {t("nav.home")}
          </Link>
          <Link to="/forum" className="px-3 py-2 rounded-md text-sm hover:bg-secondary transition-colors" activeProps={{ className: "text-primary font-semibold" }}>
            {t("nav.forum")}
          </Link>
          <Link to="/shop" className="px-3 py-2 rounded-md text-sm hover:bg-secondary transition-colors" activeProps={{ className: "text-primary font-semibold" }}>
            {t("nav.shop")}
          </Link>
          {isAdmin && (
            <Link to="/admin" className="px-3 py-2 rounded-md text-sm hover:bg-secondary transition-colors flex items-center gap-1" activeProps={{ className: "text-primary font-semibold" }}>
              <Shield className="w-4 h-4" /> {t("nav.admin")}
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-2">
          {/* Language switcher */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1.5">
                <span className="text-base leading-none">{i18n.language === "ar" ? "🇸🇦" : "🇺🇸"}</span>
                <span className="hidden sm:inline text-xs">{i18n.language === "ar" ? "AR" : "EN"}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => switchLang("en")} className="gap-2">
                <span>🇺🇸</span> English
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => switchLang("ar")} className="gap-2">
                <span>🇸🇦</span> العربية
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Theme toggle */}
          <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>

          {user ? (
            <>
              <Button asChild size="sm" className="hidden sm:inline-flex gap-1">
                <Link to="/post/new">
                  <PlusCircle className="w-4 h-4" />
                  <span className="hidden lg:inline">{t("nav.newPost")}</span>
                </Link>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full">
                    {profile?.avatar_url ? (
                      <img src={profile.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-primary/20 grid place-items-center text-sm font-bold">
                        {profile?.username?.[0]?.toUpperCase() ?? "U"}
                      </div>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem asChild>
                    <Link to="/profile" className="gap-2 cursor-pointer">
                      <UserIcon className="w-4 h-4" /> {t("nav.profile")}
                    </Link>
                  </DropdownMenuItem>
                  {isAdmin && (
                    <DropdownMenuItem asChild>
                      <Link to="/admin" className="gap-2 cursor-pointer">
                        <Shield className="w-4 h-4" /> {t("nav.admin")}
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={signOut} className="gap-2 text-destructive">
                    <LogOut className="w-4 h-4" /> {t("nav.signOut")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <Button asChild size="sm" variant="default">
              <Link to="/auth">{t("nav.signIn")}</Link>
            </Button>
          )}

          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileOpen((v) => !v)}>
            <Menu className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-border bg-background/95 backdrop-blur">
          <nav className="container mx-auto px-4 py-3 flex flex-col gap-1">
            <Link to="/" onClick={() => setMobileOpen(false)} className="px-3 py-2 rounded-md hover:bg-secondary">
              {t("nav.home")}
            </Link>
            <Link to="/forum" onClick={() => setMobileOpen(false)} className="px-3 py-2 rounded-md hover:bg-secondary">
              {t("nav.forum")}
            </Link>
            <Link to="/shop" onClick={() => setMobileOpen(false)} className="px-3 py-2 rounded-md hover:bg-secondary">
              {t("nav.shop")}
            </Link>
            {user && (
              <Link to="/post/new" onClick={() => setMobileOpen(false)} className="px-3 py-2 rounded-md hover:bg-secondary">
                {t("nav.newPost")}
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
