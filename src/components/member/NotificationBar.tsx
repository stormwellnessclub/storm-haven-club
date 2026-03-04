import { useState, useMemo } from "react";
import { X, ChevronDown, ChevronUp } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface NotificationItem {
  id: string;
  priority: number; // lower = higher priority
  content: React.ReactNode;
  icon?: React.ReactNode;
}

interface NotificationBarProps {
  items: NotificationItem[];
}

export function NotificationBar({ items }: NotificationBarProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(() => {
    const stored = sessionStorage.getItem("dismissed_notifications");
    return stored ? new Set(JSON.parse(stored)) : new Set();
  });
  const [expanded, setExpanded] = useState(false);

  const visible = useMemo(
    () => items.filter((i) => !dismissed.has(i.id)).sort((a, b) => a.priority - b.priority),
    [items, dismissed]
  );

  if (visible.length === 0) return null;

  const dismiss = (id: string) => {
    setDismissed((prev) => {
      const next = new Set(prev).add(id);
      sessionStorage.setItem("dismissed_notifications", JSON.stringify([...next]));
      return next;
    });
  };

  const primary = visible[0];
  const rest = visible.slice(1);

  return (
    <div className="border-b border-border bg-muted/50">
      <div className="px-4 py-2 flex items-center gap-2">
        {primary.icon}
        <div className="flex-1 text-sm">{primary.content}</div>
        {rest.length > 0 && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setExpanded(!expanded)}
            className="shrink-0"
          >
            <Badge variant="secondary" className="mr-1 text-[10px] px-1.5 py-0">
              +{rest.length}
            </Badge>
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => dismiss(primary.id)}
          className="shrink-0 text-muted-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      {expanded && rest.length > 0 && (
        <div className="border-t border-border/50">
          {rest.map((item) => (
            <div key={item.id} className="px-4 py-2 flex items-center gap-2 text-sm">
              {item.icon}
              <div className="flex-1">{item.content}</div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => dismiss(item.id)}
                className="shrink-0 text-muted-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
