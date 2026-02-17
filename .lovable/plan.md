

# WiFi Info Banner for Member Portal

## Overview
Add a dismissible banner to the member layout showing WiFi connection instructions and the shared password for all areas.

## Design
A banner similar to the existing `SoftLaunchHoursBanner` -- gold-tinted, dismissible via session storage, placed at the top of the member layout. It will display:
- A WiFi icon
- Title: "WiFi Access"
- Explanation that there are different WiFi zones throughout the space
- The password **WelcomeTribe** displayed prominently (copyable)
- A note that members only need to connect once per area

## Changes

### New File: `src/components/member/WifiBanner.tsx`
- Dismissible banner using `sessionStorage` (reappears each new session)
- WiFi icon from lucide-react
- Password displayed in a monospace/bold style with a copy-to-clipboard button
- Gold-themed styling matching the soft launch banner

### Modified File: `src/components/member/MemberLayout.tsx`
- Import and render `WifiBanner` alongside the other banners (after `SoftLaunchHoursBanner`)

## Technical Details

The banner content:
- **Title**: "WiFi Access"
- **Body**: "There are different WiFi areas throughout the space. Connect to the local network when you enter each area -- you only need to do this once per zone."
- **Password display**: "Password for all areas: **WelcomeTribe**" with a small copy button
- Dismiss button stores `wifi-banner-dismissed` in `sessionStorage`

No database changes needed. No new routes or hooks required.

