# Git Push Troubleshooting

## Current Status
✅ **Commit successful locally** (commit: `bd099b0 - Implement annual fee recurring subscriptions`)  
❌ **Push to remote failed**

## Common Push Failure Reasons & Solutions

### 1. Authentication Required (Most Common)

Since you're using HTTPS (`https://github.com/stormwellnessclub/storm-haven-club.git`), GitHub requires authentication.

**Solution A: Use Personal Access Token**
```bash
# When prompted for password, use a GitHub Personal Access Token (not your password)
git push origin main

# Or set up token in URL:
git remote set-url origin https://YOUR_TOKEN@github.com/stormwellnessclub/storm-haven-club.git
git push origin main
```

**To create a Personal Access Token:**
1. Go to GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Generate new token
3. Select scopes: `repo` (full control)
4. Copy token and use as password when pushing

**Solution B: Switch to SSH**
```bash
# Generate SSH key if you don't have one
ssh-keygen -t ed25519 -C "your_email@example.com"

# Add to GitHub: Settings → SSH and GPG keys → New SSH key

# Change remote to SSH
git remote set-url origin git@github.com:stormwellnessclub/storm-haven-club.git
git push origin main
```

### 2. Remote Has New Changes (Need to Pull First)

If someone else pushed changes, you need to pull first:

```bash
# Check for remote changes
git fetch origin

# If there are remote changes, pull and merge
git pull origin main

# Resolve any conflicts, then push
git push origin main
```

### 3. Network/Firewall Issues

```bash
# Test GitHub connection
ping github.com

# If blocked, try using SSH instead of HTTPS
```

### 4. Permission Issues

Make sure you have write access to the repository:
- Check GitHub repository settings
- Verify you're a collaborator with write access

## Quick Fix Commands

**Try pushing with verbose output to see the exact error:**
```bash
git push -v origin main
```

**If authentication fails, try:**
```bash
# Clear cached credentials
git credential-cache exit

# Then push again (will prompt for credentials)
git push origin main
```

**If you get "Updates were rejected":**
```bash
# Pull first, then push
git pull origin main --rebase
git push origin main
```

## Recommended: Set Up SSH (Most Reliable)

1. **Generate SSH key:**
   ```bash
   ssh-keygen -t ed25519 -C "your_email@example.com"
   # Press Enter for default location
   # Optionally set a passphrase
   ```

2. **Copy public key:**
   ```bash
   cat ~/.ssh/id_ed25519.pub
   # Copy the entire output
   ```

3. **Add to GitHub:**
   - Go to GitHub → Settings → SSH and GPG keys
   - Click "New SSH key"
   - Paste the public key
   - Save

4. **Test connection:**
   ```bash
   ssh -T git@github.com
   # Should say: "Hi username! You've successfully authenticated..."
   ```

5. **Change remote to SSH:**
   ```bash
   git remote set-url origin git@github.com:stormwellnessclub/storm-haven-club.git
   git push origin main
   ```

## What Error Message Did You Get?

Please share the exact error message you saw when trying to push. Common errors:

- `Authentication failed` → Use Personal Access Token or SSH
- `Permission denied` → Check repository access
- `Updates were rejected` → Pull first, then push
- `Could not resolve host` → Network/firewall issue
- `Repository not found` → Wrong repository URL or access denied

## After Successful Push

Once the push succeeds:
1. ✅ Verify commit appears on GitHub
2. ✅ Follow testing instructions in `POST_PUSH_INSTRUCTIONS_ANNUAL_FEE.md`
3. ✅ Test new member activation
4. ✅ Monitor webhook logs
