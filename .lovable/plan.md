

## Fix: Soft Launch Tab Not Displaying

### The Problem
The Tabs component uses `defaultValue={defaultTab}` which is **uncontrolled** -- it only sets the initial tab on first mount. If you navigate to the page without the `?tab=soft-launch` parameter first (e.g., from a different sidebar link), and then click the "Soft Launch Classes" link, React may not remount the component, so `defaultValue` is ignored and the tab stays on whatever it was before.

### The Fix
Change the `Tabs` component from **uncontrolled** (`defaultValue`) to **controlled** (`value` + `onValueChange`) so it always stays in sync with the URL parameter.

### Technical Details

**File: `src/pages/admin/Classes.tsx`**

1. Add state: `const [activeTab, setActiveTab] = useState(defaultTab)`
2. Add a `useEffect` that watches `searchParams` and updates `activeTab` when the URL changes
3. Replace `<Tabs defaultValue={defaultTab}>` with `<Tabs value={activeTab} onValueChange={setActiveTab}>`

This ensures that clicking the sidebar link with `?tab=soft-launch` always switches to the correct tab, even if the component is already mounted.

