import { supabase } from "@/integrations/supabase/client";
import { parseTimeToDb } from "@/lib/softLaunchSchedule";

interface EnsureTempClassSessionInput {
  className: string;
  sessionDate: string;
  startTimeLabel: string;
  maxCapacity?: number;
}

const TEMP_CLASS_DURATION_MINUTES = 50;
const FUNCTION_NOT_FOUND_PATTERNS = [
  "does not exist",
  "Could not find the function",
  "schema cache",
  "PGRST",
];

const formatEndTime = (dbStartTime: string) => {
  const [h, m] = dbStartTime.split(":").map(Number);
  const totalMin = h * 60 + m + TEMP_CLASS_DURATION_MINUTES;
  return `${Math.floor(totalMin / 60).toString().padStart(2, "0")}:${(totalMin % 60)
    .toString()
    .padStart(2, "0")}:00`;
};

const isFunctionMissingError = (message?: string) => {
  if (!message) return false;
  return FUNCTION_NOT_FOUND_PATTERNS.some((pattern) => message.includes(pattern));
};

export async function ensureTempClassSession({
  className,
  sessionDate,
  startTimeLabel,
  maxCapacity = 8,
}: EnsureTempClassSessionInput): Promise<string> {
  const startTime = parseTimeToDb(startTimeLabel);
  const endTime = formatEndTime(startTime);

  const { data: sessionId, error: rpcError } = await (supabase.rpc as any)(
    "find_or_create_temp_class_session",
    {
      _class_name: className,
      _session_date: sessionDate,
      _start_time: startTime,
      _end_time: endTime,
      _max_capacity: maxCapacity,
    }
  );

  if (!rpcError && sessionId) return sessionId;
  if (rpcError && !isFunctionMissingError(rpcError.message)) throw rpcError;

  // Fallback path if RPC is unavailable in the current environment.
  const { data: existingClassType, error: classTypeError } = await supabase
    .from("class_types")
    .select("id")
    .eq("name", className)
    .eq("is_active", true)
    .maybeSingle();
  if (classTypeError) throw classTypeError;

  let classTypeId = existingClassType?.id;

  if (!classTypeId) {
    const { data: createdClassType, error: createClassTypeError } = await supabase
      .from("class_types")
      .insert({
        name: className,
        category: "pilates_cycling" as any,
        duration_minutes: TEMP_CLASS_DURATION_MINUTES,
        max_capacity: maxCapacity,
        is_active: true,
      })
      .select("id")
      .single();

    if (createClassTypeError) throw createClassTypeError;
    classTypeId = createdClassType.id;
  }

  const { data: existingSession, error: existingSessionError } = await supabase
    .from("class_sessions")
    .select("id")
    .eq("class_type_id", classTypeId)
    .eq("session_date", sessionDate)
    .eq("start_time", startTime)
    .eq("is_cancelled", false)
    .maybeSingle();
  if (existingSessionError) throw existingSessionError;
  if (existingSession?.id) return existingSession.id;

  const { data: createdSession, error: createSessionError } = await supabase
    .from("class_sessions")
    .insert({
      class_type_id: classTypeId,
      session_date: sessionDate,
      start_time: startTime,
      end_time: endTime,
      max_capacity: maxCapacity,
      current_enrollment: 0,
      is_cancelled: false,
    })
    .select("id")
    .single();
  if (createSessionError) throw createSessionError;

  return createdSession.id;
}
