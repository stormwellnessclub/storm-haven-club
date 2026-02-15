

## Fix AI Approval Letter: Location, Name, and Readability

### Issues

1. The system prompt tells the AI the club is "in Los Angeles" -- it should say "in Livonia, Michigan."
2. The prompt says "writing on behalf of Storm (the founder)" which causes the AI to treat "Storm" as a person's name and say things like "Storm - Its Storm Wellness Club." The sign-off should use a proper name or title.
3. The letter preview textarea and dialog are too small for comfortable reading.

### Changes

**1. Edge function prompt fix (`supabase/functions/generate-approval-letter/index.ts`)**

- Change "a luxury wellness facility in Los Angeles" to "a luxury wellness facility located at 18340 Middlebelt Rd, Livonia, Michigan"
- Change "writing on behalf of Storm (the founder)" to "writing on behalf of the Storm Wellness Club team"
- Update the sign-off instruction from "Close warmly signed by Storm" to "Close warmly signed by 'The Storm Wellness Club Team'"
- Add explicit constraint: "The club name is 'Storm Wellness Club' -- never abbreviate it to just 'Storm' or refer to it as a person"

**2. Modal readability (`src/components/admin/PersonalizedLetterModal.tsx`)**

- Widen the dialog from `max-w-2xl` to `max-w-4xl`
- Increase textarea height from `min-h-[300px]` to `min-h-[400px]`
- Change font from `font-serif` to a more readable style with larger text (`text-base leading-relaxed`)
- Increase the max viewport height from `max-h-[90vh]` to `max-h-[95vh]`

### Technical Details

| File | Line(s) | Change |
|------|---------|--------|
| `supabase/functions/generate-approval-letter/index.ts` | 48 | Fix location from "Los Angeles" to "Livonia, Michigan" |
| `supabase/functions/generate-approval-letter/index.ts` | 50 | Change "on behalf of Storm (the founder)" to "on behalf of the Storm Wellness Club team" |
| `supabase/functions/generate-approval-letter/index.ts` | 58 | Change sign-off from "Storm" to "The Storm Wellness Club Team" |
| `supabase/functions/generate-approval-letter/index.ts` | 48-63 | Add constraint: never abbreviate club name to just "Storm" |
| `src/components/admin/PersonalizedLetterModal.tsx` | 201 | Widen dialog: `max-w-4xl max-h-[95vh]` |
| `src/components/admin/PersonalizedLetterModal.tsx` | 308-313 | Increase textarea: `min-h-[400px] text-base leading-relaxed` |

