import { useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Archive, Plus, Pencil, RotateCcw } from "lucide-react";
import { EventsPortalShell } from "@/components/eventsportal/EventsPortalShell";
import { useEventsPortalManager } from "@/components/eventsportal/ProtectedEventsPortalRoute";
import { EventImageUploader } from "@/components/eventsportal/EventImageUploader";
import { useAllCollections, useSaveCollection, slugify } from "@/hooks/useEventsPortal";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Editing = {
  id?: string;
  name: string;
  slug: string;
  tagline: string;
  description: string;
  expectation: string;
  eligibility_note: string;
  image_url: string | null;
};

const blank = (): Editing => ({
  name: "",
  slug: "",
  tagline: "",
  description: "",
  expectation: "",
  eligibility_note: "",
  image_url: null,
});

export default function EventsPortalCollections() {
  const { data: collections = [], isLoading } = useAllCollections();
  const save = useSaveCollection();
  const isManager = useEventsPortalManager();
  const [editing, setEditing] = useState<Editing | null>(null);

  const move = async (index: number, direction: -1 | 1) => {
    const a: any = collections[index];
    const b: any = collections[index + direction];
    if (!a || !b) return;
    await save.mutateAsync({ id: a.id, values: { sort_order: b.sort_order } });
    await save.mutateAsync({ id: b.id, values: { sort_order: a.sort_order } });
  };

  const toggleArchive = async (c: any) => {
    await save.mutateAsync({
      id: c.id,
      values: {
        is_active: !c.is_active,
        archived_at: c.is_active ? new Date().toISOString() : null,
      },
    });
    toast.success(c.is_active ? "Collection archived." : "Collection restored.");
  };

  const submit = async () => {
    if (!editing) return;
    if (!editing.name.trim()) return toast.error("Give the collection a name.");
    const values: Record<string, any> = {
      name: editing.name.trim(),
      slug: editing.slug ? slugify(editing.slug) : slugify(editing.name),
      tagline: editing.tagline.trim() || null,
      description: editing.description.trim() || null,
      expectation: editing.expectation.trim() || null,
      eligibility_note: editing.eligibility_note.trim() || null,
      image_url: editing.image_url,
    };
    if (!editing.id) {
      values.sort_order =
        Math.max(0, ...collections.map((c: any) => c.sort_order ?? 0)) + 1;
      values.is_active = true;
    }
    try {
      await save.mutateAsync({ id: editing.id, values });
      toast.success(editing.id ? "Collection saved." : "Collection added.");
      setEditing(null);
    } catch (e: any) {
      toast.error(e?.message ?? "That could not be saved.");
    }
  };

  return (
    <EventsPortalShell
      title="Collections"
      description="The recurring families of Member Rituals."
      actions={
        isManager && (
          <Button onClick={() => setEditing(blank())}>
            <Plus className="h-4 w-4 mr-2" />
            Add a collection
          </Button>
        )
      }
    >
      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      <div className="grid gap-3">
        {collections.map((c: any, i: number) => (
          <Card key={c.id} className={c.is_active ? "" : "opacity-60"}>
            <CardContent className="p-3 flex flex-wrap items-center gap-4">
              <div className="h-16 w-24 rounded-md overflow-hidden bg-muted shrink-0">
                {c.image_url && (
                  <img src={c.image_url} alt="" className="h-full w-full object-cover" />
                )}
              </div>
              <div className="flex-1 min-w-[200px]">
                <div className="font-medium">{c.name}</div>
                <div className="text-xs text-muted-foreground line-clamp-2">{c.tagline}</div>
                {!c.is_active && (
                  <Badge variant="secondary" className="mt-1 text-[10px]">
                    Archived
                  </Badge>
                )}
              </div>
              {isManager && (
                <div className="flex flex-wrap gap-1.5">
                  <Button variant="ghost" size="icon" aria-label="Move up" onClick={() => move(i, -1)}>
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" aria-label="Move down" onClick={() => move(i, 1)}>
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setEditing({
                        id: c.id,
                        name: c.name ?? "",
                        slug: c.slug ?? "",
                        tagline: c.tagline ?? "",
                        description: c.description ?? "",
                        expectation: c.expectation ?? "",
                        eligibility_note: c.eligibility_note ?? "",
                        image_url: c.image_url ?? null,
                      })
                    }
                  >
                    <Pencil className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => toggleArchive(c)}>
                    {c.is_active ? (
                      <>
                        <Archive className="h-4 w-4 mr-1" />
                        Archive
                      </>
                    ) : (
                      <>
                        <RotateCcw className="h-4 w-4 mr-1" />
                        Restore
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">
              {editing?.id ? "Edit collection" : "Add a collection"}
            </DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Tagline</Label>
                <Input
                  value={editing.tagline}
                  onChange={(e) => setEditing({ ...editing, tagline: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Textarea
                  rows={4}
                  value={editing.description}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>What members can expect</Label>
                <Textarea
                  rows={3}
                  value={editing.expectation}
                  onChange={(e) => setEditing({ ...editing, expectation: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Eligibility note</Label>
                <Input
                  value={editing.eligibility_note}
                  onChange={(e) => setEditing({ ...editing, eligibility_note: e.target.value })}
                />
              </div>
              <EventImageUploader
                label="Editorial image"
                value={editing.image_url}
                onChange={(v) => setEditing({ ...editing, image_url: v })}
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={save.isPending}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </EventsPortalShell>
  );
}
