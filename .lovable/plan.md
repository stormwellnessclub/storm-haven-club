
## Plan: Update `phase_one_setup` Email Template with Detailed Waiver Instructions

### Current State
The `phase_one_setup` email template (lines 1270-1357) currently has a simple 3-item setup list:
1. Sign in or create your account
2. Add your payment method for monthly dues
3. Sign your membership agreement and liability waiver

The waiver signing instruction is vague—it doesn't explicitly tell users WHERE to go to sign them.

### Comparison with `member_activation_setup`
The `member_activation_setup` template (lines 1083-1173) includes a much more detailed 5-step guide with explicit directions:
- Step 2: "Go to the **Waivers** tab and sign any required waivers"
- Step 3: "Sign your **Membership Agreement** (also in the Waivers tab)"
- Includes direct links to `/member/payment-methods` and `/member/waivers`

### Proposed Changes
Update the `phase_one_setup` template to match the clarity and specificity of `member_activation_setup`:

1. **Expand the 3-step list to 4-5 steps**, breaking out waivers and membership agreement into separate items
2. **Add explicit "Go to the Waivers tab" instructions** for each agreement
3. **Add the direct links** to `/member/waivers` and `/member/payment-methods` (similar to lines 1156-1157 in `member_activation_setup`)
4. **Keep the founding member benefits and other unique elements** from the current `phase_one_setup`

### Implementation Details
- Line 1298-1305: Replace the simple 3-item list with an expanded 4-5 item list that explicitly directs users to the Waivers tab
- Add a new paragraph after the CTA button (around line 1337) with direct links to key pages
- Maintain the brand styling (green checkboxes, amber founding member boxes, etc.) consistent with the existing `phase_one_setup` design

### Expected Outcome
Users receiving the `phase_one_setup` email will now have crystal-clear instructions: "Go to the Waivers tab in your member dashboard and sign the liability waiver and membership agreement." This eliminates confusion and matches the clarity level of the `member_activation_setup` template.
