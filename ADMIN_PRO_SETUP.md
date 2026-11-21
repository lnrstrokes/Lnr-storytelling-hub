# Admin & Pro key setup

Everything the owner needs: the two secrets, where the admin panel is, and how to
create a licence key for a customer.

**The short version**

1. Tap the brand logo **7 times** → **Studio Operator Tools** opens.
2. The first time on a new phone, tap **Register this device** and type your
   `ADMIN_PASSWORD` once. That phone becomes the owner device.
3. From then on that panel opens by itself on that phone — and stays locked on
   everyone else's.
4. Fill in the brand and tap **Create licence key**, copy the key, send it to the
   customer.

The badge next to *Owner & Pro Licence Keys* tells you whether the server is
ready before you type anything.

| System | What it protects | Where it lives |
| --- | --- | --- |
| Operator Tools | Break folders, layout, and licence key minting | Hidden panel, and only on the registered owner device |
| Owner device | Who may open the operator panel at all | A signed `LNROWN.…` token issued after the admin password is entered once |
| `ADMIN_PASSWORD` | Who may register a device or create a key | Vercel environment variable |
| `LICENSE_SECRET` | Makes keys impossible to forge | Vercel environment variable |
| Pro licence | The customer's paid features | `LNRPRO.…` key signed with `LICENSE_SECRET` |

Customers never see either secret, and neither one is ever stored in the repo.

---

## Part 1 — One-time setup

### 1.1 Create the two secrets

Make them long, random and **different from each other**:

```bash
openssl rand -base64 32   # LICENSE_SECRET
openssl rand -base64 24   # ADMIN_PASSWORD
```

Keep both in a password manager.

### 1.2 Add them in Vercel

Vercel project → **Settings** → **Environment Variables**, add for **Production**
(and **Preview** if you test on preview URLs):

| Name | Value | Required? |
| --- | --- | --- |
| `ADMIN_PASSWORD` | your admin password | **Yes** — without it the panel cannot unlock |
| `LICENSE_SECRET` | your signing secret | **Yes** — without it keys cannot be minted or verified |
| `GOOGLE_FORM_URL` | your contact/order form link | Optional |

Use `ADMIN_PASSWORD`. The code also accepts `LNR_ADMIN_PASSWORD`, `ADMIN_PASS`,
`LNR_PASSWORD` and `PASSWORD` as fallbacks, only so an older deployment keeps
working — do not set more than one.

### 1.3 Redeploy — and check which branch Vercel builds

Environment variables only apply to builds made **after** they were saved, so
redeploy: **Deployments → ⋯ → Redeploy**.

Also confirm **Settings → Git → Production Branch**. It must be the branch that
contains this guide and `public/admin-issue.html` (normally `main`). If production
is built from an older branch, the app will not have the licence panel or the
`/api/admin` route, no matter what you set in the environment.

### 1.4 Confirm the setup

```bash
curl -s https://YOUR-SITE/api/admin
# → {"ok":true,"configured":true,"googleFormUrl":""}
# "configured":false  = ADMIN_PASSWORD missing on this deployment, or not redeployed
# 404 / HTML          = this deployment is an old build (see 1.3)

curl -s -X POST -H 'content-type: application/json' \
  -d '{"key":"LNRPRO.abc.def"}' https://YOUR-SITE/api/verify-license
# → {"ok":false,"error":"Invalid license key signature. …"}
# That rejection is the proof LICENSE_SECRET is set and verification is live.
# "Licensing service is not configured on the server." = LICENSE_SECRET missing.
```

### 1.5 Local development only

```bash
# .env.local — never commit
ADMIN_PASSWORD=dev-admin-pass
LICENSE_SECRET=dev-signing-secret
```

Local keys will not verify in production, because the secrets differ. That is
correct.

---

## Part 2 — Open the admin panel

1. Open the app.
2. Tap the **brand wordmark in the top-left 7 times** within about 3 seconds.
   (The footer brand works too. On the home page the first taps just scroll you
   back home — they still count.)
3. **Studio Operator Tools** opens. The top half is the local break-folder and
   layout controls; that is what you saw the first time.
4. **Scroll to the bottom of the panel** to **Pro Licence Keys**.

The status badge on that section is a live server check:

| Badge | Meaning | Fix |
| --- | --- | --- |
| `server ready` | `/api/admin` answered and `ADMIN_PASSWORD` is set | Nothing — create the key |
| `admin password missing` | The deployment has no `ADMIN_PASSWORD` | Add it in Vercel, then redeploy |
| `server unreachable` | Old build with no `/api/admin`, or no connection | Deploy the latest `main` |
| `checking server…` | Still asking the server | Wait a second |

On an unregistered device the same panel opens but every operator control is
hidden, replaced by a locked notice. That is deliberate: the 7-tap gesture is not
a secret worth protecting, so the panel itself is bound to your phone.

---

## Part 3 — Make a phone the owner device

The owner device is how the app knows "this is the studio, not a customer". It is
what unlocks the operator panel, and it is what gives you a Free/Pro switch for
testing.

1. Tap the brand logo **7 times**.
2. Under **Owner & Pro Licence Keys**, type `ADMIN_PASSWORD`.
3. Tap **Register this device**. The device line changes to
   `Owner device 1A2B3C4D · Pro mode.`
4. Reload the app: it stays the owner device without asking again.

What happens under the hood:

- This browser generates a random device id once and keeps it.
- The server checks the password and returns a signed `LNROWN.…` token bound to
  that id, valid for a year.
- On every start the app silently calls `/api/admin` with the token and receives
  a fresh admin session, so key minting works without typing the password again.
- The password itself is never stored.

The token lives in this browser's storage. Anyone who knows the URL and the
7-tap gesture but does not have the token sees the locked notice; a different
browser with the password can register itself, so keep `ADMIN_PASSWORD` private.
A full device backup that includes browser storage would carry the token along.

### Switching your own device between Free and Pro

The owner device does not need a minted key — a key is for customers, and a key
locked to a domain will not fit a different one.

- Tap the **Free / Pro** pill (or use the panel's **Switch this device to …**
  button). The tier changes immediately and survives reloads.
- Owner Pro is a local mode: it unlocks Pro limits but **never** locks or
  overwrites your own brand text, and it does not create a customer key.
- **Forget this device** removes the registration and the mode; the phone returns
  to the locked panel until the password is entered again. Do this before handing
  the phone to someone else.

---

## Part 4 — Create a licence key

Do this **only after the payment has cleared**.

| Field | Meaning | Notes |
| --- | --- | --- |
| Admin password | `ADMIN_PASSWORD` | Only needed on a device that is not yet registered. 6 wrong tries per IP per 10 minutes, then a 10-minute lockout |
| Brand strap | Text burned into their broadcast | Max 28 chars, **locked** for the customer afterwards. Blank → `CREATOR STUDIO` |
| Watermark | Stage watermark | Max 14 chars. Blank → `CHANNEL` |
| Customer email | Your records only | Never checked by the app |
| Lock to domain | Anti-sharing hostname | Blank = works on any site. `their-channel.vercel.app` = only there and its subdomains |
| Plan | monthly / yearly / custom | Label only — the real limit is *Days valid* |
| Days valid | Licence lifetime | 1–3650, default 365 |

1. On the owner device the form is already unlocked. Otherwise register the
   device first (Part 3).
2. Fill in the brand (and anything else you want).
3. Tap **Create licence key**.
4. Tap **Copy key**. The key starts with `LNRPRO.` and is about 265 characters —
   send it whole, over email or WhatsApp.
5. Optional: tap **Activate on this device** to put the key on your own phone and
   check Pro immediately.

The key is shown once and is not saved anywhere in the app, so copy it before you
close the panel.

**Fallback:** `https://YOUR-SITE/admin-issue.html` is the same form as a standalone
page and calls the same `/api/admin` route. If it returns 404, that deployment is
an old build — the in-app panel is the reliable path.

### What the key contains

`LNRPRO.<base64url payload>.<signature>` — the payload holds tier, plan,
watermark, brand, site, email, issue date and expiry, signed with HMAC-SHA256
keyed from `LICENSE_SECRET`. The browser never holds the secret, so editing the
key or `localStorage` cannot create Pro; only the server can issue one.

---

## Part 5 — Customer activates it

1. Open the app and tap the **Free / Pro** pill in the corner.
2. Paste the whole key into **Pro key** and tap **Activate Pro**.
3. The pill turns **Pro**; the panel shows brand, watermark, locked domain and
   expiry.

After that:

- Pro survives reloads and app restarts (cached on the device).
- It re-checks with the server at most every 12 hours and keeps working offline
  for up to 7 days.
- Only a definite server refusal (expired / tampered / wrong site) removes it.
- **Remove key from this device** drops it locally; the key can be pasted again.

---

## Part 6 — Confirm Pro is actually working

Do this in a **private/incognito tab** so no old key is cached.

1. Tap the **Free/Pro** pill → it reads **Free plan**.
2. Upload one video — allowed. A second is blocked with the upgrade message.
   *(Free tier works.)*
3. Create a test key in the 7-tap panel with **Lock to domain** blank.
4. Paste it into the pill → **Activate Pro**. The pill shows **Pro** and the panel
   lists brand, watermark and expiry.
5. Upload a second and third video — both allowed; a fourth is blocked.
   *(Pro limit works.)*
6. Open the quiz/anecdote break panel on an uploaded clip — it is unlocked for
   Pro and locked behind the Pro message on Free.
7. Reload the page → still **Pro**.
8. **Remove key from this device** → back to Free, and the second upload is
   blocked again.

All eight behaving means licensing works end to end.

### What each tier gets

| Feature | Free | Pro |
| --- | --- | --- |
| Video clips in the library | 1 | 3 |
| Promo break clips | 0 (Pro feature) | 3, max 5:00 each |
| Promo order / display layout | locked | unlocked |
| Brand strap | editable | issued with the key, locked |
| Quiz + anecdote breaks | locked | unlocked |

Existing uploads are never deleted when a key is removed — only **new** uploads
beyond the Free limit are blocked.

---

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| 7 taps opens a panel with only "This browser is not registered as the owner device" | Expected on any device that is not yours. On your own phone, enter `ADMIN_PASSWORD` and tap **Register this device**. |
| The whole operator panel is empty on my phone | The device registration is missing or was forgotten. Register it again (Part 3). |
| 7 taps opens Operator Tools but there is no **Owner & Pro Licence Keys** section | That deployment is an old build. Deploy the latest `main`, then hard-refresh (or reinstall the PWA). |
| `/admin-issue.html` returns 404 | Same cause: old build. Use the in-app panel, or deploy again. |
| Badge says `admin password missing` | `ADMIN_PASSWORD` is not set on this deployment, or you did not redeploy after adding it. |
| Badge says `server unreachable` | Old build without `/api/admin`, or the device is offline. |
| `{"configured":false}` from `/api/admin` | `ADMIN_PASSWORD` missing on this deployment. |
| "Licensing service is not configured on the server." | `LICENSE_SECRET` missing, or the deploy predates it. |
| "Incorrect admin password." | Typo, or a trailing space in the Vercel value. Re-paste it. |
| "Too many incorrect attempts…" | 6 failures per IP per 10 minutes. Wait 10 minutes. |
| "This build has no /api/admin route." | Old build. Deploy the latest `main`. |
| "This Pro key has expired." | Past the expiry date. Create a new key. |
| "This Pro key belongs to X, not this site." | The key is locked to another hostname. Create one with the right domain, or leave the field blank. |
| "Invalid license key signature." | Truncated copy (~265 chars), a changed character, or `LICENSE_SECRET` was rotated after issue. |
| "Could not confirm this Pro key — go online once…" | More than 7 days offline. Connect once and reopen the app. |
| Everything still says Free after activating | Activate on the same hostname the key is locked to. `localhost` is exempt; production domains are not. |
| A key I minted will not activate on my own phone | Your phone is the owner device: use the Free/Pro switch instead of a customer key, or mint the key with **Lock to domain** blank. |
| "This device is not registered." on a phone that was registered | The owner token expired (1 year) or `LICENSE_SECRET` was rotated. Enter `ADMIN_PASSWORD` and register the device again. |
| Operator panel still works after **Forget this device** | That phone still has a valid cached recognition; reload the app. The server token is gone immediately. |

### Two rules to remember

1. **Rotating `LICENSE_SECRET` invalidates every key already issued.** Everyone
   must be re-issued. Rotate only for a real leak.
2. **Never set `ADMIN_PASSWORD` to the same value as `LICENSE_SECRET`, and never
   commit either one.**

### Revoking access for one customer

There is no per-key blacklist. In order of preference:

1. Issue short licences (e.g. 30 days) and do not renew.
2. Lock keys to a domain so a shared key is useless elsewhere.
3. Last resort: rotate `LICENSE_SECRET` and re-issue for everyone still paying.
