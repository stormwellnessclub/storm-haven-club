# Body Roller presale: ready-made text blasts

## What's there today
Admin → Marketing → Targeted Texts has only two ready-made texts: "Text subscription confirmation" and "Save our number". A Body Roller text was never added, which is why you can't find it.

## What I'll add
Two new buttons in the same row. Tapping one fills in the message and picks who gets it.

**1. Body Roller presale (members)**: goes to active and frozen members.
> Storm Wellness Club: Hi {{first_name}}, the Lymphatic Body Roller presale is open. Member pricing: 30 min $35, 60 min $70, with 5- and 10-packs available. Grab yours: stormwellnessclub.com/body-roller-presale Reply STOP to opt out.

**2. Body Roller presale (non-members)**: goes to non-members and imported contacts who agreed to texts.
> Storm Wellness Club: Hi {{first_name}}, the Lymphatic Body Roller presale is open. 30 min from $40, 60 min from $70, with 5- and 10-packs available. Grab yours: stormwellnessclub.com/body-roller-presale Reply STOP to opt out.

- People who already bought Body Roller sessions are left out.
- You can edit the wording, see the count, and send yourself a test before anything goes out. Nothing is sent until you press Send.
- The usual rules still apply: anyone who replied STOP or never agreed to texts is skipped.

## After building
Click Publish → Update so the buttons show on stormwellnessclub.com.

## Technical details
- Extend `SMS_PRESETS` in `TargetedSmsTab.tsx` with an optional `filters` override (audience + exclude `body_roller` activity); the preset button applies it instead of `DEFAULT_FILTERS`.
- Sends still go through `send-sms-campaign` → `send-sms` with consent enforced.
