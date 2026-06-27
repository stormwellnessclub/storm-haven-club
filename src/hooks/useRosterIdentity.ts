import { supabase } from "@/integrations/supabase/client";

export interface RosterAttendee {
  bookingId: string;
  userId: string | null;
  memberId: string | null;
  name: string;
  email: string;
  phone: string;
  type: "member" | "pass_holder" | "account" | "walk_in" | "hold";
  isCheckedIn: boolean;
  isNoShow: boolean;
  checkedInAt: string | null;
  paymentMethod: string | null;
  walkInName: string | null;
  isAdminHold: boolean;
}

interface RawBooking {
  id: string;
  user_id: string | null;
  member_id: string | null;
  status: string;
  checked_in_at: string | null;
  walk_in_name: string | null;
  walk_in_email: string | null;
  walk_in_phone: string | null;
  payment_method: string | null;
  is_admin_hold: boolean | null;
  members: {
    id: string;
    first_name: string;
    last_name: string;
    phone: string | null;
    photo_url: string | null;
  } | null;
}

/**
 * Resolves full attendee identity for a list of bookings.
 * Falls back through: members -> non_member_profiles -> profiles -> walk_in fields -> walk_in_name
 */
export async function resolveRosterIdentities(
  sessionId: string
): Promise<RosterAttendee[]> {
  const { data: rawBookings, error } = await supabase
    .from("class_bookings")
    .select(
      "id, user_id, member_id, status, checked_in_at, walk_in_name, walk_in_email, walk_in_phone, payment_method, is_admin_hold, members (id, first_name, last_name, phone, photo_url)"
    )
    .eq("session_id", sessionId)
    .in("status", ["confirmed", "completed"]);

  if (error) throw error;
  const bookings = (rawBookings || []) as unknown as RawBooking[];

  // Collect user_ids that need profile resolution
  const missingUserIds = bookings
    .filter((b) => !b.members && b.user_id)
    .map((b) => b.user_id!);

  // Fetch non_member_profiles and profiles in parallel
  const [nmRes, profRes] = await Promise.all([
    missingUserIds.length > 0
      ? supabase
          .from("non_member_profiles")
          .select("user_id, first_name, last_name, phone, email")
          .in("user_id", missingUserIds)
      : { data: [] },
    missingUserIds.length > 0
      ? supabase
          .from("profiles")
          .select("user_id, first_name, last_name, phone, email")
          .in("user_id", missingUserIds)
      : { data: [] },
  ]);

  const nmMap = new Map(
    (nmRes.data || []).map((p: any) => [p.user_id, p])
  );
  const profMap = new Map(
    (profRes.data || []).map((p: any) => [p.user_id, p])
  );

  return bookings.map((b): RosterAttendee => {
    const isCheckedIn = b.status === "completed" || !!b.checked_in_at;
    const isAdminHold = !!b.is_admin_hold;

    // 0. Admin hold — placeholder seat
    if (isAdminHold) {
      return {
        bookingId: b.id,
        userId: b.user_id,
        memberId: b.member_id,
        name: b.walk_in_name || "Held seat",
        email: b.walk_in_email || "",
        phone: b.walk_in_phone || "",
        type: "hold",
        isCheckedIn,
        checkedInAt: b.checked_in_at,
        paymentMethod: b.payment_method,
        walkInName: b.walk_in_name,
        isAdminHold: true,
      };
    }

    // 1. Member record
    if (b.members) {
      return {
        bookingId: b.id,
        userId: b.user_id,
        memberId: b.member_id,
        name: `${b.members.first_name} ${b.members.last_name}`,
        email: "",
        phone: b.members.phone || "",
        type: "member",
        isCheckedIn,
        checkedInAt: b.checked_in_at,
        paymentMethod: b.payment_method,
        walkInName: b.walk_in_name,
        isAdminHold: false,
      };
    }

    // 2. Non-member profile
    if (b.user_id && nmMap.has(b.user_id)) {
      const nm: any = nmMap.get(b.user_id);
      return {
        bookingId: b.id,
        userId: b.user_id,
        memberId: null,
        name: [nm.first_name, nm.last_name].filter(Boolean).join(" ") || nm.email || "Unknown",
        email: nm.email || "",
        phone: nm.phone || "",
        type: "pass_holder",
        isCheckedIn,
        checkedInAt: b.checked_in_at,
        paymentMethod: b.payment_method,
        walkInName: b.walk_in_name,
        isAdminHold: false,
      };
    }

    // 3. Account profile
    if (b.user_id && profMap.has(b.user_id)) {
      const p: any = profMap.get(b.user_id);
      return {
        bookingId: b.id,
        userId: b.user_id,
        memberId: null,
        name: [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email || "Unknown",
        email: p.email || "",
        phone: p.phone || "",
        type: "account",
        isCheckedIn,
        checkedInAt: b.checked_in_at,
        paymentMethod: b.payment_method,
        walkInName: b.walk_in_name,
        isAdminHold: false,
      };
    }

    // 4. Walk-in with stored contact fields
    if (b.walk_in_name || b.walk_in_email || b.walk_in_phone) {
      return {
        bookingId: b.id,
        userId: null,
        memberId: null,
        name: b.walk_in_name || "Unknown",
        email: b.walk_in_email || "",
        phone: b.walk_in_phone || "",
        type: "walk_in",
        isCheckedIn,
        checkedInAt: b.checked_in_at,
        paymentMethod: b.payment_method,
        walkInName: b.walk_in_name,
        isAdminHold: false,
      };
    }

    // 5. Fallback
    return {
      bookingId: b.id,
      userId: b.user_id,
      memberId: b.member_id,
      name: "Unknown",
      email: "",
      phone: "",
      type: "walk_in",
      isCheckedIn,
      checkedInAt: b.checked_in_at,
      paymentMethod: b.payment_method,
      walkInName: b.walk_in_name,
      isAdminHold: false,
    };
  });
}

/**
 * Lightweight attendee preview resolution for Classes.tsx day view.
 * Returns name + phone for each booking in the given sessions.
 */
export async function resolveAttendeePreviewsForSessions(
  sessionIds: string[]
): Promise<Record<string, { name: string; phone: string }[]>> {
  if (sessionIds.length === 0) return {};

  const { data: bookings, error } = await supabase
    .from("class_bookings")
    .select(
      "session_id, user_id, member_id, walk_in_name, walk_in_phone, members (first_name, last_name, phone)"
    )
    .in("session_id", sessionIds)
    .in("status", ["confirmed", "completed"]);

  if (error || !bookings) return {};

  // Collect user_ids needing resolution
  const missingUserIds = bookings
    .filter((b: any) => !b.members && b.user_id)
    .map((b: any) => b.user_id);

  const [nmRes, profRes] = await Promise.all([
    missingUserIds.length > 0
      ? supabase
          .from("non_member_profiles")
          .select("user_id, first_name, last_name, phone")
          .in("user_id", missingUserIds)
      : { data: [] },
    missingUserIds.length > 0
      ? supabase
          .from("profiles")
          .select("user_id, first_name, last_name, phone")
          .in("user_id", missingUserIds)
      : { data: [] },
  ]);

  const nmMap = new Map((nmRes.data || []).map((p: any) => [p.user_id, p]));
  const profMap = new Map((profRes.data || []).map((p: any) => [p.user_id, p]));

  const result: Record<string, { name: string; phone: string }[]> = {};
  for (const b of bookings as any[]) {
    if (!result[b.session_id]) result[b.session_id] = [];
    let name = "Unknown";
    let phone = "";

    if (b.members) {
      name = `${b.members.first_name} ${b.members.last_name}`;
      phone = b.members.phone || "";
    } else if (b.user_id && nmMap.has(b.user_id)) {
      const nm: any = nmMap.get(b.user_id);
      name = [nm.first_name, nm.last_name].filter(Boolean).join(" ") || "Unknown";
      phone = nm.phone || "";
    } else if (b.user_id && profMap.has(b.user_id)) {
      const p: any = profMap.get(b.user_id);
      name = [p.first_name, p.last_name].filter(Boolean).join(" ") || "Unknown";
      phone = p.phone || "";
    } else if (b.walk_in_name) {
      name = b.walk_in_name;
      phone = b.walk_in_phone || "";
    }

    result[b.session_id].push({ name, phone });
  }
  return result;
}
