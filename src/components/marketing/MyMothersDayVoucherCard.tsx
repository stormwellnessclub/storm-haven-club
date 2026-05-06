import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Heart, Copy, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useMyMothersDayVouchers } from "@/hooks/useMyMothersDayVouchers";

interface Props {
  className?: string;
  /** Where the user lands when they tap "Book your massage" */
  bookHref?: string;
}

/**
 * Surfaces an active Mother's Day voucher belonging to the logged-in user
 * (either bought-for-self or gifted to them by email).
 * Shown on dashboards and the spa page so members never re-pay.
 */
export function MyMothersDayVoucherCard({ className, bookHref = "/spa?category=Massage&voucher=" }: Props) {
  const { data: vouchers = [], isLoading } = useMyMothersDayVouchers();
  const navigate = useNavigate();

  if (isLoading || !vouchers.length) return null;

  return (
    <div className={className}>
      {vouchers.map((v) => (
        <Card
          key={v.id}
          className="overflow-hidden border-2 mb-3"
          style={{ borderColor: "#c9a86a", background: "linear-gradient(135deg, #ece2d2 0%, #f5ecd9 100%)" }}
        >
          <CardContent className="p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ background: "#fff", border: "1.5px solid #c9a86a" }}
                >
                  <Heart className="w-5 h-5" style={{ color: "#a17e3a" }} />
                </div>
                <div>
                  <div className="text-xs tracking-[3px] font-medium" style={{ color: "#a17e3a" }}>
                    MOTHER'S DAY VOUCHER
                  </div>
                  <div className="font-serif text-lg sm:text-xl mt-0.5" style={{ color: "#1c170f" }}>
                    {v.massage_choice} · {v.massage_duration} min
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: "#6b5a3b" }}>
                    + Wet Spa Access · Sauna · Steam · Salt Room
                  </div>
                </div>
              </div>
              {v.is_gift_to_me && (
                <Badge variant="outline" style={{ borderColor: "#a17e3a", color: "#a17e3a" }}>
                  Gift from {v.buyer_name}
                </Badge>
              )}
            </div>

            <div
              className="mt-4 p-3 rounded flex items-center justify-between gap-3"
              style={{ background: "#fff", border: "1px dashed #c9a86a" }}
            >
              <div className="min-w-0">
                <div className="text-[10px] tracking-[3px]" style={{ color: "#a17e3a" }}>
                  CODE
                </div>
                <div className="font-mono text-lg sm:text-xl tracking-widest truncate" style={{ color: "#1c170f" }}>
                  {v.code}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(v.code);
                  toast.success("Code copied");
                }}
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
              <div className="text-xs" style={{ color: "#6b5a3b" }}>
                Redeem by <strong>{format(new Date(v.expires_at), "MMM d, yyyy")}</strong> · No charge at booking
              </div>
              <Button
                size="sm"
                onClick={() => navigate(`${bookHref}${encodeURIComponent(v.code)}`)}
                style={{ background: "#a17e3a", color: "#fff" }}
              >
                <Sparkles className="w-4 h-4 mr-1" /> Book your massage
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
