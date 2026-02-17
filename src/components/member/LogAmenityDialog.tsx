import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { useCreateAmenityUsage, AMENITY_TYPES, AmenityType } from "@/hooks/useAmenityUsage";

interface LogAmenityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  checkInId?: string;
}

export function LogAmenityDialog({ open, onOpenChange, checkInId }: LogAmenityDialogProps) {
  const [selectedType, setSelectedType] = useState<AmenityType | "">("");
  const [duration, setDuration] = useState("");
  const [notes, setNotes] = useState("");
  const createAmenity = useCreateAmenityUsage();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedType) return;

    await createAmenity.mutateAsync({
      amenity_type: selectedType,
      duration_minutes: duration ? parseInt(duration) : undefined,
      notes: notes || undefined,
      check_in_id: checkInId,
    });

    setSelectedType("");
    setDuration("");
    setNotes("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Log Amenity Usage</DialogTitle>
          <DialogDescription>
            Track which recovery amenities you used today
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Amenity *</Label>
            <div className="grid grid-cols-2 gap-2">
              {AMENITY_TYPES.map((amenity) => (
                <button
                  key={amenity.value}
                  type="button"
                  onClick={() => setSelectedType(amenity.value)}
                  className={`flex items-center gap-2 p-3 rounded-md border text-left text-sm transition-colors ${
                    selectedType === amenity.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:border-muted-foreground/50"
                  }`}
                >
                  <span className="text-lg">{amenity.icon}</span>
                  <span className="font-medium">{amenity.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="duration">Duration (minutes, optional)</Label>
            <Input
              id="duration"
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="15"
              min={1}
              max={120}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="How did it feel? Temperature settings..."
              rows={2}
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!selectedType || createAmenity.isPending}>
              {createAmenity.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Logging...
                </>
              ) : (
                "Log Amenity"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
