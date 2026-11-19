# PT portal: show what they bought, and fix phone scrolling

## 1. Clients see the full package they bought
Black Friday plan buyers already get every session now, but the client screens still have wording built around sessions being added as they pay. Clean that up so clients only see what they bought:

- Remove the "Added with future payments" lines from the PT Overview, the Package Summary, the Packages & payment history list, and the packages list on the portal home.
- "Sessions used" will be worked out from sessions bought and sessions left only.
- The payment plan section keeps showing each payment, its amount and due date, and whether it's paid or upcoming. No session counts next to payments.
- The "sessions used compared to what they've paid for" check stays on the staff side only (client billing → AutoPay schedule). Clients never see it.

## 2. Phone: can't reach the bottom of the PT page
The bottom menu bar on phones sits over the page. On the non-member portal (and the member portal), the space that should keep the last part of the page clear of that bar is being overridden by the phone's "safe area" setting. So "Packages & payment history" ends up hidden under the bar.

- Keep the extra bottom space and add the phone's safe-area space on top of it, so the last section always scrolls fully above the bottom menu.
- Applies to every portal page, not only PT.
- I'll first confirm on a phone-size screen that this is what hides the bottom of the page, then check after the fix that "Packages & payment history" opens and scrolls fully into view.

## Technical details
- `src/components/portal/MyPersonalTraining.tsx` and `src/components/portal/MyPTPassesSection.tsx`: drop `sessions_on_hold` rows. Change "Sessions used" to `sessions_total - sessions_remaining`.
- `src/components/portal/PortalLayout.tsx` and `src/components/member/MemberLayout.tsx`: `<main>` uses `pb-20`/`pb-32` together with `.safe-area-bottom` (`padding-bottom: env(...)`, in `@layer utilities`), which overrides the padding. Replace it with `pb-[calc(5rem+env(safe-area-inset-bottom))]` (and the member equivalent) with `md:pb-6`.
- Verify with Playwright at 390x844, signed in, on `/portal/personal-training`: scroll to the bottom and open the collapsible.
- No database or payment changes.
