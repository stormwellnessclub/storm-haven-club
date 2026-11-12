import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { addDays, format, parse } from "date-fns";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AELLA_SCULPT } from "@/lib/aellaSculpt";
import { useSpaTreatmentPackages } from "@/hooks/useSpaTreatmentPackages";
import { expiryLabel, formatDollars, packageLabel, packagePriceFor, splitPackages } from "@/lib/spaPackages";
import { useSpaTreatmentZones } from "@/hooks/useSpaTreatmentZones";
import { activeZones, canPickTimes, chooseZone, zoneTakesRequests, ZONE_PROMPT, ZONE_PROMPT_NOTE } from "@/lib/spaZones";
import { useSpaServices, useSpaServiceAvailability } from "@/hooks/useSpaManagement";
import { useSpaBookedSlots, sendSpaNotifications, type SpaAppointment } from "@/hooks/useSpaBooking";
import { generateAvailableStartTimes, hasCoverageOnDate } from "@/lib/spaAvailability";
import { useMySpaPackages, MY_SPA_PACKAGES_KEY } from "@/hooks/useSpaClientPackages";
import { detroitToday, seriesCoversDate } from "@/lib/spaClientPackages";
import { calculateProcessingFee } from "@/lib/processingFee";
import { useUserMembership } from "@/hooks/useUserMembership";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useNonMemberProfile } from "@/hooks/useNonMemberProfile";
import { usePhoneOnFile } from "@/hooks/usePhoneOnFile";
import { useAllAgreements } from "@/hooks/useAllAgreements";
import { resolvePdfUrl } from "@/lib/pdfAssets";
import { PhoneRequiredGate } from "@/components/booking/PhoneRequiredGate";
import { formatTime12h } from "@/lib/timeFormat";
import { readFunctionError } from "@/lib/functionError";
import { spaServiceLabel } from "@/lib/spaZones";

const SERVICE_KEY = "aella-sculpt";
const SAVED = "aella-sculpt-booking";
const RETURN_PATH = "/spa/preview/aella-sculpt#book";
const LOCATION = "Spa Aella at Storm Wellness Club, 18340 Middlebelt Rd, Livonia, MI 48152";
/** The late-cancel amount comes from the service record; null falls back to the general spa wording. */
const cancelPolicy = (lateFeeCents: number | null | undefined) =>
  lateFeeCents
    ? `Please give at least 24 hours' notice to cancel or reschedule. Cancelling within 24 hours carries a late cancellation charge of ${formatDollars(lateFeeCents)}. A missed appointment is charged in full; with a series, the treatment is used.`
    : "Please give at least 24 hours' notice to cancel or reschedule. Later cancellations and missed appointments are charged in full.";

const Step = ({ n, title, children, locked = false }: { n: number; title: string; children: React.ReactNode; locked?: boolean }) => (
  <div className={`border-t border-foreground/15 py-10 transition-opacity ${locked ? "pointer-events-none opacity-35" : ""}`} aria-disabled={locked || undefined}>
    <p className="text-[11px] tracking-[0.35em] uppercase text-muted-foreground">Step {n}</p>
    <h3 className="mt-3 font-serif text-2xl md:text-3xl">{title}</h3>
    <div className="mt-6">{children}</div>
  </div>
);

const choice = (on: boolean) =>
  `border px-5 py-3 text-left text-sm transition-colors ${
    on ? "border-foreground bg-foreground text-background" : "border-foreground/30 text-foreground hover:border-foreground/70"
  }`;
const sub = (on: boolean) => `mt-1 block text-xs leading-relaxed ${on ? "text-background/70" : "text-muted-foreground"}`;
const field = "w-full border border-foreground/30 bg-transparent px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-foreground focus:outline-none";
const primary = "inline-flex items-center justify-center gap-2 border border-foreground bg-foreground px-8 py-4 text-xs tracking-[0.25em] uppercase text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40";
const quiet = "border-b border-foreground/40 pb-1 text-xs tracking-[0.25em] uppercase text-foreground hover:border-foreground";

type Option = { kind: "series" | "buy"; id: string } | null;
type Card = { id: string; brand: string; last4: string };
type Done = { appointment: SpaAppointment; purchase: { packageName: string; sessionsTotal: number; expiresOn: string | null; chargedCents: number; brand: string; last4: string | null } | null; remaining: number | null };

const toDate = (iso: string) => parse(iso, "yyyy-MM-dd", new Date());
const longDate = (iso: string) => format(toDate(iso), "EEEE, MMMM d, yyyy");
function detroitMinStart(): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Detroit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0), m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  const t = h * 60 + m + 120;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

/** Aella Sculpt booking: area → visit → single/series → time → checkout → confirmation. Areas staff set to "request" collect a request instead. */
export function SculptBooking() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: services = [] } = useSpaServices();
  const sculpt = services.find((s) => (s as { service_key?: string | null }).service_key === SERVICE_KEY && s.is_active) ?? null;
  const lateFeeCents = (sculpt as { late_cancel_fee_cents?: number | null } | null)?.late_cancel_fee_cents ?? null;
  const { data: availability } = useSpaServiceAvailability();
  const { data: zoneRows = [] } = useSpaTreatmentZones();
  const zones = activeZones(zoneRows, SERVICE_KEY);
  const { data: pkgRows = [] } = useSpaTreatmentPackages();
  const { single, series } = splitPackages(pkgRows, SERVICE_KEY);
  const buyOptions = [single, ...series].filter(Boolean) as NonNullable<typeof single>[];
  const { data: mine = [] } = useMySpaPackages(SERVICE_KEY);
  const usable = mine.filter((s) => s.usable);
  const { data: membership } = useUserMembership();
  const { profile, signWaiver, isSigningWaiver } = useUserProfile();
  const { profile: nmProfile, signWaiver: signNmWaiver, isSigningWaiver: nmSigning } = useNonMemberProfile();
  const { hasPhone, isLoading: phoneLoading } = usePhoneOnFile();
  const { data: agreements } = useAllAgreements();
  const waiverPdf = agreements?.liability_waiver?.[0]?.pdf_url ? resolvePdfUrl(agreements.liability_waiver[0].pdf_url) : null;
  const hasWaiver = profile?.waiver_signed === true || nmProfile?.waiver_signed === true;

  const [zoneId, setZoneId] = useState<string | null>(null);
  const [visit, setVisit] = useState<string | null>(null);
  const [option, setOption] = useState<Option>(null);
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [cardId, setCardId] = useState<string | null>(null);
  const [waiverOk, setWaiverOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Done | null>(null);
  const attempt = useRef<string>(crypto.randomUUID());

  // Bring back what the client picked before signing in.
  useEffect(() => {
    const raw = sessionStorage.getItem(SAVED);
    if (!raw) return;
    try {
      const s = JSON.parse(raw);
      setZoneId(s.zoneId ?? null); setVisit(s.visit ?? null); setOption(s.option ?? null); setDate(s.date ?? null); setTime(s.time ?? null); setNotes(s.notes ?? "");
    } catch { /* ignore */ }
    sessionStorage.removeItem(SAVED);
  }, []);

  const zone = zones.find((z) => z.id === zoneId) ?? null;
  const requestOnly = zoneTakesRequests(zone);
  const chosenBuy = option?.kind === "buy" ? buyOptions.find((o) => o.id === option.id) ?? null : null;
  const chosenSeries = option?.kind === "series" ? usable.find((s) => s.pkg.id === option.id) ?? null : null;
  const visitType = AELLA_SCULPT.visitTypes.find((v) => v.id === visit);
  const tier = membership ? (membership.membership_type ?? "") : null;
  const priceOf = (o: { price_cents: number; member_price_cents: number | null }) => packagePriceFor(o, tier);
  const baseCents = chosenBuy ? priceOf(chosenBuy) : 0;
  const feeCents = calculateProcessingFee(baseCents);

  const { data: therapists = [] } = useQuery({
    queryKey: ["public-spa-therapists"],
    queryFn: async () => ((await (supabase.rpc as any)("get_public_spa_therapists")).data ?? []) as { id: string; full_name: string }[],
  });
  const providerIds = useMemo(() => new Set((availability ?? []).filter((a) => a.service_id === sculpt?.id && a.is_active && a.therapist_id).map((a) => a.therapist_id as string)), [availability, sculpt?.id]);
  const providerNames = therapists.filter((t) => providerIds.has(t.id)).map((t) => t.full_name);

  const today = detroitToday();
  const days = useMemo(() => {
    if (!sculpt) return [] as string[];
    const out: string[] = [];
    for (let i = 0; i < 90 && out.length < 21; i++) {
      const iso = format(addDays(toDate(today), i), "yyyy-MM-dd");
      if (chosenSeries && !seriesCoversDate(chosenSeries.pkg, iso)) break;
      if (hasCoverageOnDate(availability, sculpt.id, toDate(iso))) out.push(iso);
    }
    return out;
  }, [availability, sculpt, today, chosenSeries]);
  useEffect(() => { if (date && days.length && !days.includes(date)) { setDate(null); setTime(null); } }, [days, date]);

  const { data: booked } = useSpaBookedSlots(date ? toDate(date) : null);
  const times = useMemo(() => {
    // Wait for other bookings to load so a time that's already taken is never offered.
    if (!sculpt || !date || !booked) return [];
    return generateAvailableStartTimes(availability, sculpt.id, toDate(date), sculpt.duration_minutes, sculpt.cleanup_minutes ?? 15, booked, undefined, date === today ? detroitMinStart() : undefined);
  }, [availability, sculpt, date, booked, today]);
  useEffect(() => { if (time && booked && sculpt && !times.includes(time)) setTime(null); }, [times, time, booked, sculpt]);

  const { data: cards = [], isFetched: cardsFetched } = useQuery({
    queryKey: ["my-saved-cards", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Card[]> => {
      const { data } = await supabase.functions.invoke("stripe-payment", { body: { action: "list_payment_methods" } });
      return ((data?.paymentMethods ?? []) as any[]).map((m) => ({ id: m.id, brand: m.card?.brand ?? m.brand ?? "card", last4: m.card?.last4 ?? m.last4 ?? "" }));
    },
  });
  useEffect(() => { if (!cardId && cards.length) setCardId(cards[0].id); }, [cards, cardId]);

  const locked = !canPickTimes(zoneId);
  const ready = !!(sculpt && zone && !requestOnly && visit && option && date && time);
  const needsCard = option?.kind === "buy";
  const canConfirm = ready && !!user && hasWaiver && hasPhone && (!needsCard || !!cardId) && !busy;

  const rememberAndSignIn = () => {
    sessionStorage.setItem(SAVED, JSON.stringify({ zoneId, visit, option, date, time, notes }));
  };

  const confirm = async () => {
    if (!canConfirm || !sculpt || !zone) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("aella-sculpt-checkout", {
        body: {
          zoneId, visitType: visit, date, time, notes: notes.trim() || null,
          clientPackageId: option?.kind === "series" ? option.id : null,
          packageId: option?.kind === "buy" ? option.id : null,
          paymentMethodId: needsCard ? cardId : null,
          idempotencyKey: attempt.current,
        },
      });
      let res = data as any;
      if (error && !res) res = await readFunctionError(error);
      qc.invalidateQueries({ queryKey: MY_SPA_PACKAGES_KEY });
      qc.invalidateQueries({ queryKey: ["spa-booked-slots"] });
      if (res?.booked && res.appointment) {
        attempt.current = crypto.randomUUID();
        const appt = res.appointment as SpaAppointment;
        const total = res.purchase?.sessionsTotal ?? chosenSeries?.pkg.sessions_total ?? null;
        const remaining = res.purchase ? total - 1 : chosenSeries ? chosenSeries.remaining - 1 : null;
        setDone({ appointment: appt, purchase: res.purchase ?? null, remaining });
        sendSpaNotifications({ appointment: { ...appt, service_name: spaServiceLabel({ ...appt, visit_type: null }) }, kind: "confirmation" }).catch(() => {});
        return;
      }
      if (res?.purchase) {
        // Paid, but the time was taken: the series is saved on the account.
        attempt.current = crypto.randomUUID();
        setOption({ kind: "series", id: res.purchase.id });
        setTime(null);
        toast.error(`${res.error ?? "That time was just taken."} Your ${res.purchase.packageName} is saved — pick another time to book from it.`, { duration: 12000 });
        return;
      }
      if (res?.code === "slot_taken") setTime(null);
      toast.error(res?.error ?? "We could not complete the booking. Please try again or call the club.", { duration: 10000 });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "We could not complete the booking.");
    } finally {
      setBusy(false);
    }
  };

  if (done) return <Confirmation done={done} lateFeeCents={lateFeeCents} providerNames={therapists} onAnother={() => { setDone(null); setTime(null); setOption(null); }} />;

  return (
    <section id="book" className="scroll-mt-20 px-6 py-28 md:px-16 md:py-40">
      <div className="mx-auto max-w-3xl">
        <h2 className="font-serif text-5xl md:text-6xl">Let's find your time.</h2>
        {usable.length > 0 && <MySeries list={mine} />}
        <div className="mt-14">
          <Step n={1} title={ZONE_PROMPT}>
            <p className="-mt-3 mb-6 max-w-xl text-sm leading-relaxed text-muted-foreground">{ZONE_PROMPT_NOTE}</p>
            <div className="grid gap-2 md:grid-cols-2" role="radiogroup" aria-label="Treatment zone">
              {zones.map((z) => (
                <button key={z.id} type="button" role="radio" aria-checked={zoneId === z.id} onClick={() => setZoneId(chooseZone(zoneId, z.id))} className={choice(zoneId === z.id)}>
                  <span className="block">{z.name}</span>
                  {z.description && <span className={sub(zoneId === z.id)}>{z.description}</span>}
                  {zoneTakesRequests(z) && <span className={`${sub(zoneId === z.id)} tracking-[0.2em] uppercase text-[10px]`}>By request</span>}
                </button>
              ))}
            </div>
            <p className="mt-4 text-xs text-muted-foreground">One zone per appointment.</p>
          </Step>

          {zone && requestOnly ? (
            <RequestStep zone={zone} />
          ) : (
            <>
              <Step n={2} title="Is this your first Aella Sculpt treatment?" locked={locked}>
                <div className="grid gap-2 md:grid-cols-2">
                  {AELLA_SCULPT.visitTypes.map((v) => (
                    <button key={v.id} type="button" aria-pressed={visit === v.id} onClick={() => setVisit(v.id)} className={choice(visit === v.id)}>
                      <span className="block">{v.label}</span>
                      <span className={sub(visit === v.id)}>{v.note}</span>
                    </button>
                  ))}
                </div>
              </Step>

              <Step n={3} title="A single treatment, or a series?" locked={locked || !visit}>
                {usable.length > 0 && (
                  <div className="mb-6 grid gap-2">
                    <p className="text-[11px] tracking-[0.3em] uppercase text-muted-foreground">Your series</p>
                    {usable.map((s) => {
                      const on = option?.kind === "series" && option.id === s.pkg.id;
                      return (
                        <button key={s.pkg.id} type="button" aria-pressed={on} onClick={() => setOption({ kind: "series", id: s.pkg.id })} className={`${choice(on)} flex items-baseline justify-between gap-6`}>
                          <span>{s.pkg.package_name}<span className={sub(on)}>{s.remaining} of {s.pkg.sessions_total} left{s.pkg.expires_on ? ` · use by ${format(toDate(s.pkg.expires_on), "MMM d, yyyy")}` : ""}</span></span>
                          <span className="font-serif text-lg">Prepaid</span>
                        </button>
                      );
                    })}
                    <p className="mt-4 text-[11px] tracking-[0.3em] uppercase text-muted-foreground">Or purchase</p>
                  </div>
                )}
                <div className="grid gap-2">
                  {buyOptions.map((o) => {
                    const on = option?.kind === "buy" && option.id === o.id;
                    const exp = expiryLabel(o);
                    return (
                      <button key={o.id} type="button" aria-pressed={on} onClick={() => setOption({ kind: "buy", id: o.id })} className={`${choice(on)} flex items-baseline justify-between gap-6`}>
                        <span>
                          {packageLabel(o)}
                          {o.is_recommended && <span className={`ml-3 text-[10px] tracking-[0.3em] uppercase ${on ? "text-background/70" : "text-muted-foreground"}`}>Recommended</span>}
                          <span className={sub(on)}>{o.session_count > 1 ? `${formatDollars(Math.round(priceOf(o) / o.session_count))} per treatment` : `${AELLA_SCULPT.minutes} minutes`}{exp ? ` · ${exp}` : ""}</span>
                        </span>
                        <span className="text-right">
                          <span className="block font-serif text-lg">{formatDollars(priceOf(o))}</span>
                          {tier != null && <span className={`block text-[10px] tracking-[0.3em] uppercase ${on ? "text-background/70" : "text-muted-foreground"}`}>Member price</span>}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {option?.kind === "buy" && chosenBuy && chosenBuy.session_count > 1 && (
                  <p className="mt-4 text-xs text-muted-foreground">Your first treatment is booked now. The rest stay on your account to schedule anytime before they expire.</p>
                )}
              </Step>

              <Step n={4} title="Choose a day and time" locked={locked || !visit || !option}>
                {!sculpt ? (
                  <p className="text-sm text-muted-foreground">Online booking for Aella Sculpt isn't open yet.</p>
                ) : days.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No openings in the coming weeks. Please call the club and we'll find you a time.</p>
                ) : (
                  <>
                    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2" role="radiogroup" aria-label="Day">
                      {days.map((d) => (
                        <button key={d} type="button" role="radio" aria-checked={date === d} onClick={() => { setDate(d); setTime(null); }} className={`${choice(date === d)} shrink-0 text-center`}>
                          <span className="block text-[10px] tracking-[0.3em] uppercase">{format(toDate(d), "EEE")}</span>
                          <span className="mt-1 block font-serif text-xl">{format(toDate(d), "MMM d")}</span>
                        </button>
                      ))}
                    </div>
                    {date && (
                      <div className="mt-6">
                        {times.length === 0 ? (
                          <p className="text-sm text-muted-foreground">{booked ? "This day is full. Please choose another day." : "Loading times…"}</p>
                        ) : (
                          <div className="grid grid-cols-3 gap-2 md:grid-cols-5" role="radiogroup" aria-label="Time">
                            {times.map((t) => (
                              <button key={t} type="button" role="radio" aria-checked={time === t} onClick={() => setTime(t)} className={`${choice(time === t)} text-center`}>{formatTime12h(t)}</button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </Step>

              <Step n={5} title="You're booking" locked={!ready}>
                <dl className="grid grid-cols-[auto_1fr] gap-x-8 gap-y-3 text-sm">
                  <dt className="text-muted-foreground">Treatment</dt><dd>{AELLA_SCULPT.name} · {AELLA_SCULPT.minutes} minutes</dd>
                  <dt className="text-muted-foreground">Area</dt><dd>{zone?.name ?? "—"}</dd>
                  <dt className="text-muted-foreground">Visit</dt><dd>{visitType?.label ?? "—"}</dd>
                  <dt className="text-muted-foreground">Provider</dt><dd>{providerNames.join(", ") || "—"}</dd>
                  <dt className="text-muted-foreground">When</dt><dd>{date && time ? `${longDate(date)} · ${formatTime12h(time)}` : "—"}</dd>
                  <dt className="text-muted-foreground">Option</dt>
                  <dd>{chosenSeries ? `${chosenSeries.pkg.package_name} · uses 1 of ${chosenSeries.remaining} left` : chosenBuy ? packageLabel(chosenBuy) : "—"}</dd>
                  {chosenBuy && (<>
                    <dt className="text-muted-foreground">{tier != null ? "Member price" : "Price"}</dt><dd>{formatDollars(baseCents)}</dd>
                    <dt className="text-muted-foreground">Card fee</dt><dd>{formatDollars(feeCents)}</dd>
                    <dt className="text-muted-foreground">Total today</dt><dd className="font-serif text-lg">{formatDollars(baseCents + feeCents)}</dd>
                  </>)}
                </dl>
                <label className="mt-8 block text-xs tracking-[0.2em] uppercase text-muted-foreground" htmlFor="sculpt-notes">Anything we should know? (optional)</label>
                <textarea id="sculpt-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={1000} className={`${field} mt-2`} />

                <div className="mt-8 space-y-6">
                  {!user ? (
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">Sign in or create your account to finish. Your choices are kept.</p>
                      <div className="flex flex-wrap gap-6">
                        <Link to={`/auth?redirect=${encodeURIComponent(RETURN_PATH)}`} onClick={rememberAndSignIn} className={primary}>Sign in</Link>
                        <Link to={`/auth?mode=signup&redirect=${encodeURIComponent(RETURN_PATH)}`} onClick={rememberAndSignIn} className={`${quiet} self-center`}>Create account</Link>
                      </div>
                    </div>
                  ) : (
                    <>
                      {!phoneLoading && !hasPhone && <PhoneRequiredGate reason="We use it for appointment reminders and schedule changes. Required to book." />}
                      {!hasWaiver && (
                        <div className="space-y-3 border border-foreground/20 p-5">
                          <p className="text-sm">Please sign our liability waiver once before your first visit.</p>
                          {waiverPdf && <a href={waiverPdf} target="_blank" rel="noopener noreferrer" className={quiet}>Read the waiver</a>}
                          <label className="flex items-start gap-3 text-sm">
                            <input type="checkbox" checked={waiverOk} onChange={(e) => setWaiverOk(e.target.checked)} className="mt-1" />
                            I have reviewed the Liability Waiver and agree to its terms
                          </label>
                          <button type="button" disabled={!waiverOk || isSigningWaiver || nmSigning} onClick={() => (profile ? signWaiver() : signNmWaiver())} className={primary}>
                            {(isSigningWaiver || nmSigning) && <Loader2 className="h-4 w-4 animate-spin" />}Sign waiver
                          </button>
                        </div>
                      )}
                      {needsCard && (
                        cardsFetched && cards.length === 0 ? (
                          <div className="space-y-3 border border-foreground/20 p-5">
                            <p className="text-sm">Add a card to your account to purchase.</p>
                            <Link to={membership ? "/member/billing" : "/portal/billing"} onClick={rememberAndSignIn} className={quiet}>Add a card</Link>
                          </div>
                        ) : (
                          <div className="grid gap-2" role="radiogroup" aria-label="Card">
                            {cards.map((c) => (
                              <button key={c.id} type="button" role="radio" aria-checked={cardId === c.id} onClick={() => setCardId(c.id)} className={choice(cardId === c.id)}>
                                <span className="capitalize">{c.brand}</span> •••• {c.last4}
                              </button>
                            ))}
                          </div>
                        )
                      )}
                      <p className="text-xs leading-relaxed text-muted-foreground">{cancelPolicy(lateFeeCents)}</p>
                      <button type="button" disabled={!canConfirm} onClick={confirm} className={primary}>
                        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                        {busy ? "Booking…" : chosenBuy ? `Pay ${formatDollars(baseCents + feeCents)} & book` : "Book treatment"}
                      </button>
                    </>
                  )}
                </div>
              </Step>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function MySeries({ list }: { list: ReturnType<typeof useMySpaPackages>["data"] & {} }) {
  return (
    <div className="mt-12 border border-foreground/20 p-6">
      <p className="text-[11px] tracking-[0.35em] uppercase text-muted-foreground">Your Aella Sculpt</p>
      <div className="mt-4 divide-y divide-foreground/10">
        {list.filter((s) => s.pkg.status === "active").map((s) => (
          <div key={s.pkg.id} className="grid gap-2 py-4 text-sm md:grid-cols-[1fr_auto]">
            <div>
              <p className="font-serif text-xl">{s.pkg.package_name}</p>
              <p className="mt-1 text-muted-foreground">
                {s.pkg.sessions_total} purchased · {s.used} used · {s.remaining} remaining
                {s.pkg.expires_on ? ` · ${s.expired ? "expired" : "expires"} ${format(toDate(s.pkg.expires_on), "MMM d, yyyy")}` : ""}
              </p>
              {s.next && <p className="mt-1">Next: {format(toDate(s.next.appointment_date), "EEE, MMM d")} · {formatTime12h(s.next.appointment_time.slice(0, 5))}{s.next.treatment_zone_name ? ` · ${s.next.treatment_zone_name}` : ""}</p>}
              {s.previous.length > 0 && <p className="mt-1 text-muted-foreground">Previous: {s.previous.slice(0, 3).map((p) => format(toDate(p.appointment_date), "MMM d")).join(", ")}{s.previous.length > 3 ? "…" : ""}</p>}
            </div>
            {s.usable && <a href="#book" className={`${quiet} self-start`}>Schedule next treatment</a>}
          </div>
        ))}
      </div>
    </div>
  );
}

function RequestStep({ zone }: { zone: { id: string; name: string } }) {
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const { profile: nm } = useNonMemberProfile();
  const p = profile ?? nm;
  const [name, setName] = useState(""), [email, setEmail] = useState(""), [phone, setPhone] = useState("");
  const [day, setDay] = useState(""), [when, setWhen] = useState(""), [message, setMessage] = useState("");
  const [sending, setSending] = useState(false), [sent, setSent] = useState(false);
  useEffect(() => {
    if (!p) return;
    setName((v) => v || `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim());
    setEmail((v) => v || p.email || user?.email || "");
    setPhone((v) => v || p.phone || "");
  }, [p, user?.email]);
  useEffect(() => setSent(false), [zone.id]);

  const send = async () => {
    if (name.trim().length < 2 || !/^\S+@\S+\.\S+$/.test(email.trim()) || phone.replace(/\D/g, "").length < 10) {
      toast.error("Please add your name, email and phone number.");
      return;
    }
    setSending(true);
    const { error } = await supabase.from("spa_service_requests").insert({
      name: name.trim(), email: email.trim(), phone: phone.trim(),
      service_name: `${AELLA_SCULPT.name} · ${zone.name}`, service_category: "Aella Body Lab",
      treatment_zone_id: zone.id, requested_date: day || null, requested_time: when.trim() || null,
      message: message.trim() || null,
    });
    setSending(false);
    if (error) { toast.error("We couldn't send your request. Please try again or call the club."); return; }
    setSent(true);
  };

  if (sent) {
    return (
      <div className="border-t border-foreground/15 py-10">
        <h3 className="font-serif text-3xl">Request received.</h3>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
          Thank you. We have your request for {AELLA_SCULPT.name} · {zone.name}. Our spa team will contact you to schedule.
        </p>
      </div>
    );
  }
  return (
    <div className="border-t border-foreground/15 py-10">
      <p className="text-[11px] tracking-[0.35em] uppercase text-muted-foreground">Step 2</p>
      <h3 className="mt-3 font-serif text-2xl md:text-3xl">Request {zone.name}</h3>
      <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
        {zone.name} appointments are scheduled by our spa team for now. Leave your details and we'll reach out to find your time.
      </p>
      <div className="mt-8 grid gap-3 md:grid-cols-2">
        <input className={field} placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        <input className={field} placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" />
        <input className={`${field} md:col-span-2`} placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} inputMode="email" autoComplete="email" />
        <label className="text-xs text-muted-foreground md:col-span-1">Preferred day (optional)
          <input type="date" className={`${field} mt-1`} value={day} min={detroitToday()} onChange={(e) => setDay(e.target.value)} />
        </label>
        <label className="text-xs text-muted-foreground md:col-span-1">Preferred time (optional)
          <input className={`${field} mt-1`} placeholder="e.g. weekday mornings" value={when} onChange={(e) => setWhen(e.target.value)} maxLength={60} />
        </label>
        <textarea className={`${field} md:col-span-2`} rows={3} placeholder="Anything we should know? (optional)" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={2000} />
      </div>
      <button type="button" onClick={send} disabled={sending} className={`${primary} mt-8`}>
        {sending && <Loader2 className="h-4 w-4 animate-spin" />}Send request
      </button>
    </div>
  );
}

function Confirmation({ done, lateFeeCents, providerNames, onAnother }: { done: Done; lateFeeCents: number | null; providerNames: { id: string; full_name: string }[]; onAnother: () => void }) {
  const a = done.appointment;
  const provider = providerNames.find((t) => t.id === a.staff_id)?.full_name ?? "Spa Aella";
  return (
    <section id="book" className="scroll-mt-20 px-6 py-28 md:px-16 md:py-40">
      <div className="mx-auto max-w-3xl">
        <p className="text-[11px] tracking-[0.35em] uppercase text-muted-foreground">Confirmed</p>
        <h2 className="mt-4 font-serif text-5xl md:text-6xl">Your time is held.</h2>
        <dl className="mt-12 grid grid-cols-[auto_1fr] gap-x-8 gap-y-3 border-t border-foreground/15 pt-10 text-sm">
          <dt className="text-muted-foreground">Treatment</dt><dd>{a.service_name} · {a.duration_minutes} minutes</dd>
          <dt className="text-muted-foreground">Area</dt><dd>{a.treatment_zone_name}</dd>
          <dt className="text-muted-foreground">Provider</dt><dd>{provider}</dd>
          <dt className="text-muted-foreground">Date</dt><dd>{longDate(a.appointment_date)}</dd>
          <dt className="text-muted-foreground">Time</dt><dd>{formatTime12h(a.appointment_time.slice(0, 5))}</dd>
          <dt className="text-muted-foreground">Location</dt><dd>{LOCATION}</dd>
          {done.purchase && (<>
            <dt className="text-muted-foreground">Paid</dt>
            <dd>{formatDollars(done.purchase.chargedCents)} · {done.purchase.brand}{done.purchase.last4 ? ` •••• ${done.purchase.last4}` : ""} · {done.purchase.packageName}</dd>
          </>)}
          {done.remaining != null && (<>
            <dt className="text-muted-foreground">Series</dt>
            <dd>{done.remaining} treatment{done.remaining === 1 ? "" : "s"} left{done.purchase?.expiresOn ? ` · use by ${format(toDate(done.purchase.expiresOn), "MMM d, yyyy")}` : ""}</dd>
          </>)}
        </dl>
        <p className="mt-10 max-w-xl text-xs leading-relaxed text-muted-foreground">{cancelPolicy(lateFeeCents)}</p>
        <p className="mt-3 max-w-xl text-xs leading-relaxed text-muted-foreground">A confirmation is on its way by email{a.user_id ? " and text, if you've agreed to texts" : ""}.</p>
        {done.remaining != null && done.remaining > 0 && (
          <button type="button" onClick={onAnother} className={`${quiet} mt-10`}>Schedule another treatment</button>
        )}
      </div>
    </section>
  );
}
