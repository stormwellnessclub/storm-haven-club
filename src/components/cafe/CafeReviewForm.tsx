import { useState } from "react";
import { Star, Camera, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  CAFE_REVIEW_TAGS,
  useSubmitCafeReview,
} from "@/hooks/useCafeReviews";

interface Props {
  menuItemId: string;
  itemName: string;
  orderId?: string | null;
  defaultDisplayName?: string;
  defaultEmail?: string;
  onSubmitted?: () => void;
  onCancel?: () => void;
  compact?: boolean;
}

export function CafeReviewForm({
  menuItemId,
  itemName,
  orderId,
  defaultDisplayName = "",
  defaultEmail = "",
  onSubmitted,
  onCancel,
  compact = false,
}: Props) {
  const { user } = useAuth();
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [tags, setTags] = useState<Set<string>>(new Set());
  const [comment, setComment] = useState("");
  const [displayName, setDisplayName] = useState(defaultDisplayName);
  const [email, setEmail] = useState(defaultEmail);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const submit = useSubmitCafeReview();

  const toggleTag = (t: string) => {
    setTags((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else if (next.size < 6) next.add(t);
      return next;
    });
  };

  const onPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    if (!f) return;
    if (f.size > 8 * 1024 * 1024) {
      toast.error("Photo must be under 8 MB");
      return;
    }
    setPhotoFile(f);
    setPhotoPreview(URL.createObjectURL(f));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating < 1) {
      toast.error("Pick a star rating");
      return;
    }
    const name = displayName.trim();
    if (!name) {
      toast.error("Add a name — even a first name works");
      return;
    }
    try {
      await submit.mutateAsync({
        menuItemId,
        orderId: orderId ?? null,
        rating,
        tags: Array.from(tags),
        comment,
        displayName: name,
        email: email || null,
        photoFile: user ? photoFile : null,
      });
      toast.success("Thanks — your review is up ✨");
      onSubmitted?.();
    } catch (err: any) {
      console.error("Review submit failed:", err);
      toast.error(err?.message || "Could not submit review");
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={`space-y-4 ${compact ? "" : "border border-cafe-line/60 bg-cafe-cream/40 p-4 rounded"}`}
    >
      {!compact && (
        <div>
          <p className="font-cafe-serif text-base uppercase tracking-tight text-cafe-burgundy">
            Rate your {itemName}
          </p>
          <p className="font-cafe-mono text-[10px] tracking-widest uppercase text-cafe-burgundy/50 mt-1">
            Anonymous or with your name — up to you
          </p>
        </div>
      )}

      {/* Stars */}
      <div
        className="flex gap-1"
        onMouseLeave={() => setHoverRating(0)}
        role="radiogroup"
        aria-label="Star rating"
      >
        {[1, 2, 3, 4, 5].map((n) => {
          const filled = (hoverRating || rating) >= n;
          return (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              onMouseEnter={() => setHoverRating(n)}
              aria-label={`${n} star${n === 1 ? "" : "s"}`}
              className="p-1"
            >
              <Star
                className={`h-7 w-7 transition ${
                  filled
                    ? "fill-cafe-terracotta text-cafe-terracotta"
                    : "text-cafe-burgundy/30"
                }`}
                strokeWidth={1.5}
              />
            </button>
          );
        })}
      </div>

      {/* Tags */}
      <div>
        <p className="font-cafe-mono text-[9px] tracking-[0.25em] uppercase text-cafe-burgundy/60 mb-2">
          Quick picks (optional)
        </p>
        <div className="flex flex-wrap gap-1.5">
          {CAFE_REVIEW_TAGS.map((t) => {
            const active = tags.has(t);
            return (
              <button
                key={t}
                type="button"
                onClick={() => toggleTag(t)}
                className={`font-cafe-mono text-[10px] tracking-widest uppercase rounded-full px-3 py-1 border transition ${
                  active
                    ? "bg-cafe-burgundy text-cafe-cream border-cafe-burgundy"
                    : "text-cafe-burgundy/70 border-cafe-line hover:border-cafe-burgundy/50"
                }`}
              >
                {t}
              </button>
            );
          })}
        </div>
      </div>

      {/* Comment */}
      <Textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Anything else? (optional)"
        rows={3}
        maxLength={1000}
        className="bg-white/60 border-cafe-line"
      />

      {/* Photo (signed-in only) */}
      {user && (
        <div>
          {photoPreview ? (
            <div className="relative inline-block">
              <img
                src={photoPreview}
                alt="Review preview"
                className="h-24 w-24 object-cover border border-cafe-line rounded"
              />
              <button
                type="button"
                onClick={() => {
                  setPhotoFile(null);
                  setPhotoPreview(null);
                }}
                className="absolute -top-2 -right-2 bg-cafe-burgundy text-cafe-cream rounded-full p-1"
                aria-label="Remove photo"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <label className="inline-flex items-center gap-2 font-cafe-mono text-[10px] tracking-[0.2em] uppercase text-cafe-burgundy/70 border border-dashed border-cafe-line rounded px-3 py-2 cursor-pointer hover:border-cafe-burgundy/60">
              <Camera className="h-3.5 w-3.5" />
              Add a photo
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={onPhotoChange}
                className="hidden"
              />
            </label>
          )}
        </div>
      )}

      {/* Guest fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Your name"
          maxLength={60}
          className="bg-white/60 border-cafe-line"
        />
        {!user && (
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email (optional)"
            maxLength={254}
            className="bg-white/60 border-cafe-line"
          />
        )}
      </div>

      <div className="flex gap-2 justify-end pt-1">
        {onCancel && (
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          size="sm"
          disabled={submit.isPending}
          className="bg-[hsl(var(--cafe-terracotta))] hover:bg-[hsl(var(--cafe-terracotta-deep))] text-white"
        >
          {submit.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Posting…
            </>
          ) : (
            "Post review"
          )}
        </Button>
      </div>
    </form>
  );
}
