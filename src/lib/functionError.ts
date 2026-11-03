// supabase.functions.invoke returns data=null for non-2xx replies; the function's JSON body
// (with the real reason) lives on error.context, a Response.
export async function readFunctionError(error: unknown): Promise<{ error?: string; field?: string; [k: string]: unknown } | null> {
  const ctx = (error as { context?: unknown })?.context;
  if (ctx && typeof (ctx as Response).json === "function") {
    try {
      const body = await (ctx as Response).clone().json();
      if (body && typeof body === "object") return body;
    } catch { /* not JSON */ }
  }
  return null;
}
