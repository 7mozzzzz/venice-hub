import * as Icons from "lucide-react";
import type { LucideProps } from "lucide-react";

type Badge = {
  id: string;
  name_en: string;
  name_ar: string;
  icon: string;
  color: string;
  type: "badge" | "rank";
};

export function BadgeIcon({ badge, size = 14 }: { badge: Badge; size?: number }) {
  const Icon = (Icons as unknown as Record<string, React.ComponentType<LucideProps>>)[
    badge.icon.charAt(0).toUpperCase() + badge.icon.slice(1)
  ] ?? Icons.Star;
  return (
    <span
      title={badge.name_en}
      className="inline-flex items-center justify-center rounded-full p-1"
      style={{ backgroundColor: `${badge.color}22`, color: badge.color }}
    >
      <Icon size={size} />
    </span>
  );
}

export function UserNameDisplay({
  username,
  badges,
  className = "",
}: {
  username: string;
  badges?: Badge[];
  className?: string;
}) {
  const rank = badges?.find((b) => b.type === "rank");
  const onlyBadges = badges?.filter((b) => b.type === "badge") ?? [];
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span style={rank ? { color: rank.color, textShadow: `0 0 8px ${rank.color}66` } : undefined} className="font-semibold">
        {username}
      </span>
      {onlyBadges.slice(0, 3).map((b) => (
        <BadgeIcon key={b.id} badge={b} />
      ))}
    </span>
  );
}
