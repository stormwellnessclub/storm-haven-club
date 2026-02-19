
## Add Account-Required Notice on Class Passes Page

### What's changing

A single informational banner will be added to the hero section of `/class-passes`, visible only to **logged-out visitors**. It explains:
- A free account is required to purchase
- Members should sign in with their existing credentials to automatically receive member pricing

Once the user is logged in, the existing gold badge ("Member pricing applied" / "Non-member pricing") already confirms their status, so the banner should disappear on login.

### Where it goes

In the hero section of `src/pages/ClassPasses.tsx`, directly below the existing description paragraph — replacing the current empty gap between the description and the conditional gold badge. The banner shows when `!user`.

### Banner content

```
To purchase class passes, you'll need a free account.
Already a member? Sign in with your member credentials to automatically receive member pricing.

[Create Free Account]  [Sign In]
```

### Technical details

| File | Lines | Change |
|------|-------|--------|
| `src/pages/ClassPasses.tsx` | ~463–468 | Add `!user` banner block with two CTA buttons — "Create Free Account" linking to `/auth?mode=signup&redirect=/class-passes` and "Sign In" linking to `/auth?redirect=/class-passes` |

No database changes. No new dependencies. The existing `Link` and `Button` components are already imported.
