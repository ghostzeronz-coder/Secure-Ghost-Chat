# GHOSTFACE — GitHub Actions CI/CD Setup Checklist

This guide explains how to configure the automated iOS build and App Store submission pipeline defined in `.github/workflows/eas-ios.yml`.

---

## How the Pipeline Works

| Trigger | What happens |
|---------|-------------|
| Push to `main` | Installs dependencies, logs in to EAS, runs `eas build --platform ios --profile production` on Expo's cloud infrastructure (no Mac required) |
| Push of a `v*` tag (e.g. `v1.0.0`) | Everything above, **plus** `eas submit --platform ios` to upload the finished `.ipa` to App Store Connect |

---

## Step 1 — Add Secrets to the GitHub Repository

Go to your GitHub repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**, and add the following:

### Required Secrets

| Secret name | What it is | Where to find it |
|-------------|-----------|-----------------|
| `EXPO_TOKEN` | Your personal Expo access token — lets EAS CLI authenticate without a browser | [expo.dev](https://expo.dev) → Account (top-right avatar) → **Access tokens** → **Create token** |
| `APPLE_ID` | The Apple ID (email address) of your Apple Developer account | Your Apple Developer account email, e.g. `you@example.com` |
| `APPLE_TEAM_ID` | Your 10-character Apple Developer Team ID | [developer.apple.com/account](https://developer.apple.com/account) → scroll to **Membership details** → **Team ID** |
| `APPLE_ASC_APP_ID` | The numeric App Store Connect App ID for GHOSTFACE | [appstoreconnect.apple.com](https://appstoreconnect.apple.com) → Your App → **App Information** → **Apple ID** field (a 9–10 digit number) |

> **Note:** `APPLE_ASC_APP_ID` is only used during the `eas submit` step (tagged releases). You can add it after the App Store Connect listing is created, before you push your first release tag.

---

## Step 2 — Link the EAS Project (One-Time Setup)

If you haven't already, run this once from your local machine so EAS knows which project to build:

```bash
cd artifacts/ghostface
npx eas-cli init
```

This writes a `projectId` UUID into `app.json` under `extra.eas`. Commit that change.

---

## Step 3 — Trigger Your First Build

Push any commit to `main`:

```bash
git push origin main
```

Monitor progress at:
- **GitHub**: Repo → **Actions** tab → `EAS iOS Build & Submit` workflow run
- **Expo**: [expo.dev/builds](https://expo.dev/builds) → your project

iOS builds run on Expo's cloud servers and typically complete in 15–25 minutes.

---

## Step 4 — Trigger an App Store Submission

Push a version tag after the build has succeeded and your App Store Connect listing is ready:

```bash
git tag v1.0.0
git push origin v1.0.0
```

This triggers the same build **plus** an automatic `eas submit` that uploads the `.ipa` to App Store Connect. You can then go to App Store Connect to complete the review submission.

---

## Environment Variable Reference in eas.json

`eas.json` now references `$APPLE_ASC_APP_ID` instead of a hardcoded value:

```json
"submit": {
  "production": {
    "ios": {
      "ascAppId": "$APPLE_ASC_APP_ID"
    }
  }
}
```

EAS will read this from the `APPLE_ASC_APP_ID` environment variable that is injected by GitHub Actions from the `APPLE_ASC_APP_ID` repository secret.

---

## No Mac Required

All iOS builds run on **Expo's managed cloud infrastructure** using `eas build`. The GitHub Actions runner is a standard Ubuntu instance — no self-hosted Mac runner is needed.

---

## Useful Links

- [EAS Build docs](https://docs.expo.dev/build/introduction/)
- [EAS Submit docs](https://docs.expo.dev/submit/introduction/)
- [Expo access tokens](https://expo.dev/accounts/%5Baccount%5D/settings/access-tokens)
- [App Store Connect](https://appstoreconnect.apple.com)
- [Apple Developer — Membership](https://developer.apple.com/account)
