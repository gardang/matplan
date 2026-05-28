import { ExternalLink } from "lucide-react";
import { fallbackSearchUrl } from "@/lib/normalize";

interface RecipeLinkProps {
  url: string | null | undefined;
  mealName: string;
  className?: string;
}

export function RecipeLink({ url, mealName, className = "" }: RecipeLinkProps) {
  const href =
    url && url.startsWith("http") ? url : fallbackSearchUrl(mealName);

  let domain = "matprat.no";
  try {
    domain = new URL(href).hostname.replace("www.", "");
  } catch {}

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      <ExternalLink className="w-3 h-3" />
      {domain}
    </a>
  );
}
