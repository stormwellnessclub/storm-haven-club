

## Remove Reformer Class Banner from Home Page

The `ClassScheduleBanner` is currently shown on two layouts:

1. **Public pages** (`src/components/Layout.tsx`) -- includes the home page
2. **Member dashboard** (`src/components/member/MemberLayout.tsx`)

### Change

Remove the `<ClassScheduleBanner />` component and its import from `src/components/Layout.tsx` so it no longer appears on the home page and other public pages. It will still show in the member dashboard.

### Technical Details

| File | Change |
|------|--------|
| `src/components/Layout.tsx` | Remove `ClassScheduleBanner` import and `<ClassScheduleBanner />` usage |

