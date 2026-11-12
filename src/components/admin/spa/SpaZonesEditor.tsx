import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useReorderSpaTreatmentZones, useSaveSpaTreatmentZone, useSpaTreatmentZones } from "@/hooks/useSpaTreatmentZones";
import { reorderZones, type SpaTreatmentZone } from "@/lib/spaZones";

function ZoneRow({ z, all, first, last }: { z: SpaTreatmentZone; all: SpaTreatmentZone[]; first: boolean; last: boolean }) {
  const save = useSaveSpaTreatmentZone();
  const reorder = useReorderSpaTreatmentZones();
  const [name, setName] = useState(z.name);
  const [desc, setDesc] = useState(z.description ?? "");
  useEffect(() => { setName(z.name); setDesc(z.description ?? ""); }, [z]);
  const dirty = name.trim() !== z.name || desc.trim() !== (z.description ?? "");
  return (
    <tr className="border-t align-middle">
      <td className="py-2 pr-1 whitespace-nowrap">
        <Button size="icon" variant="ghost" className="h-7 w-7" disabled={first || reorder.isPending} aria-label="Move up" onClick={() => reorder.mutate(reorderZones(all, z.id, -1))}><ArrowUp className="h-4 w-4" /></Button>
        <Button size="icon" variant="ghost" className="h-7 w-7" disabled={last || reorder.isPending} aria-label="Move down" onClick={() => reorder.mutate(reorderZones(all, z.id, 1))}><ArrowDown className="h-4 w-4" /></Button>
      </td>
      <td className="py-2 pr-2 w-64"><Input value={name} onChange={(e) => setName(e.target.value)} aria-label="Zone name" /></td>
      <td className="py-2 pr-2"><Input value={desc} onChange={(e) => setDesc(e.target.value)} aria-label="Zone description" /></td>
      <td className="py-2 pr-2 text-center"><Switch checked={z.is_active} onCheckedChange={(v) => save.mutate({ id: z.id, is_active: v })} aria-label="Active" /></td>
      <td className="py-2 text-right">
        <Button size="sm" disabled={!dirty || !name.trim() || save.isPending} onClick={() => save.mutate({ id: z.id, name: name.trim(), description: desc.trim() || null })}>Save</Button>
      </td>
    </tr>
  );
}

/** Managers add, rename, turn off and reorder treatment zones; booking reads them live. */
export function SpaZonesEditor({ serviceKey }: { serviceKey: string }) {
  const { data = [] } = useSpaTreatmentZones();
  const save = useSaveSpaTreatmentZone();
  const zones = data.filter((z) => z.service_key === serviceKey).sort((a, b) => a.display_order - b.display_order);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  return (
    <div className="mt-8">
      <h4 className="font-semibold">Treatment zones</h4>
      <p className="mb-2 text-xs text-muted-foreground">Clients choose exactly one zone per appointment. All zones use the prices above. Turning a zone off hides it from booking; past appointments keep the zone they booked.</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="pb-2 font-medium">Order</th><th className="pb-2 font-medium">Zone</th><th className="pb-2 font-medium">Description</th>
              <th className="pb-2 font-medium text-center">Active</th><th />
            </tr>
          </thead>
          <tbody>
            {zones.map((z, i) => <ZoneRow key={z.id} z={z} all={zones} first={i === 0} last={i === zones.length - 1} />)}
            <tr className="border-t bg-muted/30">
              <td />
              <td className="py-2 pr-2"><Input placeholder="New zone name" value={name} onChange={(e) => setName(e.target.value)} /></td>
              <td className="py-2 pr-2"><Input placeholder="Description" value={desc} onChange={(e) => setDesc(e.target.value)} /></td>
              <td />
              <td className="py-2 text-right">
                <Button size="sm" variant="outline" disabled={!name.trim() || save.isPending}
                  onClick={() => save.mutate({ service_key: serviceKey, name: name.trim(), description: desc.trim() || null, is_active: true, display_order: zones.length }, { onSuccess: () => { setName(""); setDesc(""); } })}>
                  <Plus className="mr-1 h-4 w-4" />Add
                </Button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
