

# Add Storm Shop Navigation Links

The shop page already handles empty state gracefully — it shows "Check back for new product drops" when no products exist. So adding the links now is fine; once you add products in the Storm Shop Manager, they'll automatically appear.

## Changes

### 1. Public Navigation (`src/components/Navigation.tsx`)
Add `{ href: "/shop", label: "Storm Shop" }` to the `navLinks` array (line ~17, after Guest Pass or wherever fits best).

### 2. Member Sidebar (`src/components/member/MemberSidebar.tsx`)
Add `{ title: "Storm Shop", url: "/shop", icon: ShoppingBag }` to `mainItems` array. Import `ShoppingBag` from lucide-react.

### 3. Non-Member Portal Sidebar (`src/components/portal/PortalSidebar.tsx`)
Add `{ title: "Storm Shop", url: "/shop", icon: ShoppingBag }` to `portalMenuItems`. Import `ShoppingBag` from lucide-react.

Three files, one line each. No database changes.

