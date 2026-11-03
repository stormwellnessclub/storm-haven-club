import { supabase } from "@/integrations/supabase/client";
import { checkedInPT } from "@/lib/ptAttendance";

/** Read actual PT arrivals only; never infer arrivals from booking or payment. */
export async function fetchPTAttendance(start: string, end: string) {
  const rows: any[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.from("pt_appointments")
      .select("id, user_id, checked_in_at, status, notes, format")
      .in("status", ["scheduled", "completed"])
      .gte("checked_in_at", start).lt("checked_in_at", end)
      .order("checked_in_at", { ascending: false }).order("id")
      .range(offset, offset + 999);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  const visits = checkedInPT(rows, start, end);
  const userIds = [...new Set(visits.map(row => row.user_id))];
  const identities = new Map<string, { member?: any; profile?: any }>();
  for (let offset = 0; offset < userIds.length; offset += 100) {
    const ids = userIds.slice(offset, offset + 100);
    const [members, profiles] = await Promise.all([
      supabase.from("members").select("id, user_id, first_name, last_name, member_id, membership_type, status, photo_url").in("user_id", ids).neq("status", "cancelled"),
      supabase.from("profiles").select("user_id, first_name, last_name, email").in("user_id", ids),
    ]);
    if (members.error) throw members.error;
    if (profiles.error) throw profiles.error;
    for (const member of members.data || []) identities.set(member.user_id, { member });
    for (const profile of profiles.data || []) identities.set(profile.user_id, { ...identities.get(profile.user_id), profile });
  }
  return visits.map(row => {
    const identity = identities.get(row.user_id);
    const person = identity?.member || identity?.profile;
    return {
      ...row,
      member: identity?.member,
      name: [person?.first_name, person?.last_name].filter(Boolean).join(" ") || person?.email || "PT Client",
      subtitle: `${identity?.member ? "Member" : "Non-Member"} • Personal Training`,
    };
  });
}