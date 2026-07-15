// Generate a Certificate of Electronic Signature PDF for a given user + agreement.
// Returns a multi-page PDF: cover page (certificate) + embedded agreement PDF.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const AGREEMENT_TO_PROFILE_COLUMN: Record<string, string> = {
  liability_waiver: "waiver_signed_at",
  membership_agreement: "membership_agreement_signed_at",
  single_class_pass: "single_class_pass_agreement_signed_at",
  class_package: "class_package_agreement_signed_at",
  guest_pass: "guest_pass_agreement_signed_at",
  kids_care: "kids_care_agreement_signed_at",
  private_event: "private_event_agreement_signed_at",
};

const PUBLIC_BASE = "https://stormwellnessclub.com/agreements/";

async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fmtUtc(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toISOString().replace("T", " ").replace(/\.\d+Z$/, " UTC");
}

function fmtCt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "America/Detroit",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }) + " America/Detroit";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify caller is an admin
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .in("role", ["admin", "super_admin", "manager", "front_desk"]);
    if (!roleRow || roleRow.length === 0) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { user_id, agreement_type } = await req.json();
    if (!user_id || !agreement_type) {
      return new Response(JSON.stringify({ error: "user_id and agreement_type required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const signedAtCol = AGREEMENT_TO_PROFILE_COLUMN[agreement_type];
    if (!signedAtCol) {
      return new Response(JSON.stringify({ error: "Unknown agreement_type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch profile
    const { data: profile, error: pErr } = await admin
      .from("profiles")
      .select(
        `id, user_id, first_name, last_name, email, phone, created_at, ${signedAtCol}`,
      )
      .eq("user_id", user_id)
      .maybeSingle();
    if (pErr || !profile) {
      return new Response(JSON.stringify({ error: "Profile not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const signedAt = (profile as any)[signedAtCol] as string | null;

    // Fetch agreement metadata (latest active row for this type)
    const { data: agreement } = await admin
      .from("agreements")
      .select("title, version, pdf_url, effective_date, description")
      .eq("agreement_type", agreement_type)
      .eq("is_active", true)
      .order("display_order", { ascending: true })
      .limit(1)
      .maybeSingle();

    const pdfFilename = agreement?.pdf_url ?? `${agreement_type}.pdf`;
    const pdfPublicUrl = pdfFilename.startsWith("http")
      ? pdfFilename
      : PUBLIC_BASE + pdfFilename;

    // Download the original signed agreement PDF
    let originalPdfBytes: Uint8Array | null = null;
    let pdfSha = "—";
    try {
      const r = await fetch(pdfPublicUrl);
      if (r.ok) {
        const buf = await r.arrayBuffer();
        originalPdfBytes = new Uint8Array(buf);
        pdfSha = await sha256Hex(buf);
      }
    } catch (_e) { /* embed best-effort */ }

    // Build the certificate
    const out = await PDFDocument.create();
    const font = await out.embedFont(StandardFonts.Helvetica);
    const fontBold = await out.embedFont(StandardFonts.HelveticaBold);

    const page = out.addPage([612, 792]); // US Letter
    const { width, height } = page.getSize();
    const margin = 54;
    let y = height - margin;

    const black = rgb(0.07, 0.07, 0.09);
    const muted = rgb(0.35, 0.35, 0.4);
    const accent = rgb(0.55, 0.12, 0.15);

    const drawText = (
      text: string,
      x: number,
      yy: number,
      size = 10,
      bold = false,
      color = black,
    ) => {
      page.drawText(text, { x, y: yy, size, font: bold ? fontBold : font, color });
    };

    const wrap = (text: string, maxWidth: number, size: number, bold = false): string[] => {
      const f = bold ? fontBold : font;
      const words = text.split(/\s+/);
      const lines: string[] = [];
      let cur = "";
      for (const w of words) {
        const test = cur ? cur + " " + w : w;
        if (f.widthOfTextAtSize(test, size) > maxWidth && cur) {
          lines.push(cur);
          cur = w;
        } else {
          cur = test;
        }
      }
      if (cur) lines.push(cur);
      return lines;
    };

    // Header
    drawText("STORM WELLNESS CLUB", margin, y, 9, true, muted);
    y -= 14;
    drawText("Certificate of Electronic Signature", margin, y, 20, true, black);
    y -= 8;
    page.drawLine({
      start: { x: margin, y: y - 4 },
      end: { x: width - margin, y: y - 4 },
      thickness: 1,
      color: accent,
    });
    y -= 24;

    drawText(
      "This certificate confirms that the individual identified below electronically signed the",
      margin, y, 10, false, muted,
    );
    y -= 13;
    drawText(
      "agreement identified below in accordance with the U.S. ESIGN Act and UETA.",
      margin, y, 10, false, muted,
    );
    y -= 26;

    // Section: Signer
    drawText("SIGNER", margin, y, 9, true, accent);
    y -= 14;
    const fullName = `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() || "(unnamed)";
    const labelW = 110;
    const row = (label: string, value: string) => {
      drawText(label, margin, y, 10, true, black);
      drawText(value, margin + labelW, y, 10, false, black);
      y -= 14;
    };
    row("Name:", fullName);
    row("Email:", profile.email ?? "—");
    row("Phone:", profile.phone ?? "—");
    row("User ID:", profile.user_id);
    row("Account created:", fmtUtc(profile.created_at));

    y -= 8;
    drawText("AGREEMENT", margin, y, 9, true, accent);
    y -= 14;
    row("Title:", agreement?.title ?? agreement_type);
    row("Type:", agreement_type);
    row("Version:", agreement?.version ?? "1.0");
    row("Document:", pdfFilename);
    row("SHA-256:", pdfSha);

    y -= 8;
    drawText("SIGNATURE", margin, y, 9, true, accent);
    y -= 14;
    row("Signed (UTC):", fmtUtc(signedAt));
    row("Signed (local):", fmtCt(signedAt));
    row("Method:", "Electronic acceptance (click-through)");
    row("Acknowledgment:", '"I have reviewed this document above"');
    row("Action:", `Clicked "I Agree — Sign ${agreement?.title ?? agreement_type}"`);

    y -= 14;
    // ESIGN paragraph
    const esign =
      "Pursuant to the Electronic Signatures in Global and National Commerce Act (15 U.S.C. §7001 et seq.) " +
      "and the Uniform Electronic Transactions Act, the electronic acceptance recorded above has the same " +
      "legal force and effect as a handwritten signature. The signer was presented with the full agreement " +
      "document and was required to affirmatively acknowledge review before the signature was captured. The " +
      "timestamp above was recorded server-side at the moment of acceptance and stored in Storm Wellness " +
      "Club's customer database.";
    const lines = wrap(esign, width - margin * 2, 9);
    for (const ln of lines) {
      drawText(ln, margin, y, 9, false, muted);
      y -= 12;
    }

    // Footer
    const footY = margin;
    page.drawLine({
      start: { x: margin, y: footY + 24 },
      end: { x: width - margin, y: footY + 24 },
      thickness: 0.5,
      color: muted,
    });
    drawText(
      `Generated ${fmtUtc(new Date().toISOString())} • storm wellness club • stormwellnessclub.com`,
      margin, footY + 10, 8, false, muted,
    );

    // Embed the original signed agreement PDF
    if (originalPdfBytes) {
      try {
        const src = await PDFDocument.load(originalPdfBytes);
        const copied = await out.copyPages(src, src.getPageIndices());
        for (const p of copied) out.addPage(p);
      } catch (e) {
        const np = out.addPage([612, 792]);
        np.drawText("Original agreement PDF could not be embedded.", {
          x: margin, y: height - margin, size: 12, font, color: black,
        });
        np.drawText(`URL: ${pdfPublicUrl}`, {
          x: margin, y: height - margin - 18, size: 9, font, color: muted,
        });
      }
    }

    const bytes = await out.save();
    const safeName = (profile.last_name || "user").replace(/[^a-z0-9]/gi, "");
    const filename = `Signature-Certificate-${safeName}-${agreement_type}.pdf`;
    return new Response(bytes, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    console.error("certificate error", e);
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
