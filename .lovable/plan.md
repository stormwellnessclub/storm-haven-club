# Class Pass Sales & Promo Codes

Today there is no place to run a sale. Admin → Class Pass Pricing only sets the permanent price for each of the 8 tiers (single / 10-pack × member / non-member × pilates_cycling / other), and checkout always charges that price. Marketing can send blasts but knows nothing about sales.

This adds a real promotions engine for class passes, plus sale emails with automatic reminders.

## Where it lives

A new **Sales & Promos** tab inside Admin → Class Pass Pricing, next to the existing price tiers.

## Creating a sale

Each sale has:
- Name (e.g. "Labor Day 20% Off")
- Which tiers it applies to (pick any of the 8 tiers, or "all class passes")
- Discount: % off or $ off
- Start and end date/time (Eastern)
- Type:
  - **Automatic sale** — discount applies to everyone at checkout while live, and the sale price shows on the public class pass page with the old price struck through and a "Sale ends Sep 2" note.
  - **Promo code** — customer types a code (e.g. `SUMMER20`) at checkout. Optional max total redemptions and one-per-customer limit.
  - A sale can be both (auto discount + a code for a bigger insider discount).
- Status: draft / scheduled / live / ended, shown as a badge with a live countdown.

Sales outside their date window never apply, even if someone has the code.

## Checkout behavior

- Class pass checkout looks up any live automatic sale for that tier and applies it.
- A promo code field appears on the class pass checkout; invalid, expired, wrong-tier, or used-up codes show a clear reason.
- The discount is applied through Stripe so the receipt itself shows "Discount −$X".
- Every purchase records which sale/code was used, so the tab shows redemptions and discounted revenue per sale.

## Sale emails and reminders

From the sale, a **Send sale email** button opens the existing email composer pre-filled with the sale details (tiers, discounted prices, promo code, end date) and a "Buy passes" button.

Reminders are set up on the sale itself with checkboxes:
- On launch day
- 3 days before it ends
- Last day

Each reminder is queued and sent automatically at 9:00 AM Eastern on its date; a scheduled job handles delivery, and you can edit the copy or cancel any pending reminder. Sending is skipped automatically if the sale is cancelled or ends early. Each reminder logs sent/failed counts.

**Audience** (you didn't specify — this is the proposed default, easy to change per send): active members + non-member accounts with class activity, excluding anyone unsubscribed or suppressed. Selectable per email: active members only, non-members only, past guests, or all.

## Notes

- This covers class passes only, as you chose. Spa/massage, PT packs and shop items can reuse the same engine later — the tables are being built generic enough for that.
- Gift card purchases are not discounted by class pass sales.

## Technical details

- New tables: `promotions` (scope, discount, window, code, limits, stripe coupon id, status) and `promotion_redemptions`; plus `promotion_email_jobs` for the scheduled reminders. RLS: admin/super_admin manage; public read limited to live, non-code sale rows for price display.
- A Stripe coupon + promotion code is created/updated via an edge function when a sale is saved, so discounts appear on Stripe receipts and reporting.
- `stripe-payment` class pass branches (both existing lookups) gain discount resolution and validation server-side; client-supplied prices are never trusted.
- New edge function `process-promotion-emails` run by pg_cron (America/Detroit) for reminder delivery, reusing the existing email blast infrastructure and suppression checks.
- Public pricing components read sale-adjusted prices from a single shared hook so the storefront and checkout can't disagree.
