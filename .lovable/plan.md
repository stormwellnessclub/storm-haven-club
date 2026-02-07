
# Password Reset Workflow Implementation

## The Problem
Members who receive Phase 1 activation emails and try to sign in but forgot their password (or never set one properly) have **no way to recover their account**. This will cause:
- Support burden (members emailing you to reset passwords manually)
- Frustration and potential member loss
- Blocked onboarding flow

---

## Solution Overview
Implement a complete password reset workflow using the authentication system's built-in `resetPasswordForEmail` function:

1. **"Forgot Password?" link** on the Auth page sign-in form
2. **Password Reset Request page** (`/reset-password`) where users enter their email
3. **Password Update page** (`/update-password`) where users set a new password after clicking the email link
4. **Password reset email template** in the send-email edge function (branded)

---

## Part 1: Add resetPassword to AuthContext

**File**: `src/contexts/AuthContext.tsx`

**Changes**:
1. Add `resetPassword` function to the context interface
2. Implement using `supabase.auth.resetPasswordForEmail()`
3. Set redirect URL to `/update-password`

```typescript
// Add to AuthContextType interface
resetPassword: (email: string) => Promise<{ error: Error | null }>;

// Add function implementation
const resetPassword = async (email: string) => {
  const redirectUrl = `${window.location.origin}/update-password`;
  
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: redirectUrl,
  });
  return { error };
};
```

---

## Part 2: Add "Forgot Password?" Link to Auth.tsx

**File**: `src/pages/Auth.tsx`

**Changes**:
1. Import `Link` from react-router-dom (already imported)
2. Add "Forgot your password?" link below the password field (only in sign-in mode)
3. Style consistently with existing UI

```typescript
// Add below the password field, before the submit button (around line 395)
{!isSignUp && (
  <div className="text-right">
    <Link 
      to="/reset-password" 
      className="text-accent text-sm hover:underline"
    >
      Forgot your password?
    </Link>
  </div>
)}
```

---

## Part 3: Create Reset Password Request Page

**File**: `src/pages/ResetPassword.tsx` (new file)

**Purpose**: User enters their email to receive a password reset link

**Features**:
- Email input with validation
- Submit button that calls `resetPassword()`
- Success message after submission
- Link back to sign in
- Same visual styling as Auth page

**Key Code Pattern**:
```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setIsLoading(true);
  
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/update-password`,
  });
  
  if (error) {
    toast.error("Failed to send reset email. Please try again.");
  } else {
    setEmailSent(true);
    toast.success("Password reset email sent! Check your inbox.");
  }
  
  setIsLoading(false);
};
```

---

## Part 4: Create Update Password Page

**File**: `src/pages/UpdatePassword.tsx` (new file)

**Purpose**: User sets their new password after clicking the email link

**Features**:
- Password input with confirmation field
- Show/hide password toggle
- Password strength validation (min 6 chars)
- Calls `supabase.auth.updateUser({ password })`
- Redirects to /auth on success

**Key Code Pattern**:
```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  
  if (password !== confirmPassword) {
    toast.error("Passwords do not match");
    return;
  }
  
  if (password.length < 6) {
    toast.error("Password must be at least 6 characters");
    return;
  }
  
  setIsLoading(true);
  
  const { error } = await supabase.auth.updateUser({ password });
  
  if (error) {
    toast.error("Failed to update password: " + error.message);
  } else {
    toast.success("Password updated successfully!");
    navigate("/auth");
  }
  
  setIsLoading(false);
};
```

---

## Part 5: Add Routes

**File**: `src/App.tsx`

**Changes**:
1. Import the new pages
2. Add routes for `/reset-password` and `/update-password`

```typescript
import ResetPassword from "@/pages/ResetPassword";
import UpdatePassword from "@/pages/UpdatePassword";

// Add to routes
<Route path="/reset-password" element={<ResetPassword />} />
<Route path="/update-password" element={<UpdatePassword />} />
```

---

## Part 6: Add Password Reset Email Template (Optional Enhancement)

**File**: `supabase/functions/send-email/index.ts`

The authentication system handles password reset emails automatically through the backend's email settings. However, we can optionally add a branded template if you want control over the email appearance.

**Note**: The built-in password reset email from the authentication system will be used by default. If you want a custom branded email, we can configure that separately in the backend email templates.

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/contexts/AuthContext.tsx` | Modify | Add `resetPassword` function |
| `src/pages/Auth.tsx` | Modify | Add "Forgot password?" link |
| `src/pages/ResetPassword.tsx` | Create | Password reset request page |
| `src/pages/UpdatePassword.tsx` | Create | New password entry page |
| `src/App.tsx` | Modify | Add routes |

---

## User Flow

```text
User clicks "Sign In" → Enters email → Forgot password?
                                            ↓
                               /reset-password page
                                            ↓
                           Enter email → Submit
                                            ↓
                        Email sent with reset link
                                            ↓
                     User clicks link in email
                                            ↓
                        /update-password page
                                            ↓
                     Enter new password → Submit
                                            ↓
                    Password updated → /auth page
```

---

## Security Considerations

1. **Rate limiting**: The authentication system has built-in rate limiting for password reset requests
2. **Token expiration**: Reset tokens expire after 1 hour by default
3. **No email enumeration**: We always show "email sent" even if email doesn't exist (prevents attackers from discovering valid emails)
4. **HTTPS only**: Reset links only work over HTTPS

---

## Testing Checklist

- [ ] "Forgot password?" link appears only on sign-in form (not sign-up)
- [ ] Reset password page accepts email and shows success message
- [ ] Email is received with valid reset link
- [ ] Clicking reset link opens /update-password page
- [ ] Password confirmation must match
- [ ] Password must be at least 6 characters
- [ ] After successful reset, user is redirected to sign in
- [ ] User can sign in with new password
