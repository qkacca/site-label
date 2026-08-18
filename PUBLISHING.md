# Publishing Site Label

Everything needed for the Edge Add-ons submission, in the order Partner Center asks for it.

---

## Step 1 — Host the privacy policy (blocks submission)

Partner Center will not accept a submission without a working privacy policy URL. The pages
are already written and sit in `docs/`, ready for GitHub Pages.

Create an empty repository on GitHub named `site-label` (public), then:

```bash
git remote add origin https://github.com/qkacca/site-label.git
git branch -M main
git push -u origin main
```

Then turn on Pages: **Settings → Pages → Source: Deploy from a branch → Branch: `main`,
folder: `/docs` → Save.** It goes live in a minute or two at:

```
https://qkacca.github.io/site-label/privacy.html
```

Open that URL and check it loads before using it. That is the value for the
**Privacy policy URL** field.

A support URL is useful too, and the repo gives you one for free:
`https://github.com/qkacca/site-label/issues`

---

## Step 2 — Capture the screenshots (blocks submission)

Serve the folder and open the studio:

```bash
python -m http.server 8765
```

Then open `http://localhost:8765/store/screenshot-studio.html` and press **Download all
five**. Each is drawn on a canvas at exactly 1280x800, so the PNGs are pixel-exact whatever
your display scaling is, and every hostname is `contoso.com` — no customer environment
appears in the listing.

You need at least one. Upload them in this order; the first is the store tile:

1. `hero` — red PRODUCTION ribbon over an ERP screen
2. `side-by-side` — the same app as UAT and as Production
3. `styles` — hazard tape, stamp, terminal and badge together
4. `meme` — Impact caption and corner brackets
5. `discreet` — corner brackets and a side tab

---

## Step 3 — Register as a developer

<https://partner.microsoft.com/dashboard/microsoftedge/overview>

Registration for the Edge program is free. You will be asked to sign in with a Microsoft
account, accept the developer agreement, and give publisher details. Do this part yourself —
it is a legal agreement and it needs your identity, not an assistant's.

---

## Step 4 — Create the submission

**Extensions → New extension → upload the package:**

```
dist/site-label-1.9.0.zip
```

Then fill in the listing from `store/LISTING.md`, which has the exact text for:

- name and short description
- the full store description
- category (`Developer tools`) and language
- a justification for every permission — reviewers ask for these individually

Answer **No** to "Does this extension collect user data". That is accurate: there is no
networking code in the package at all, and a test enforces it.

---

## Step 5 — Submit

Review the preview, then publish. Certification usually takes a few business days.

The permission justifications are the part most likely to draw questions, because the package
declares `*://*/*`. The key point, already written out in `store/LISTING.md`, is that it is
declared **optional** and is never held on install — access is requested one site at a time,
from a user gesture, and released when the label is deleted.

---

## Updating later

1. Bump `version` in `manifest.json`
2. `node tools/test-matcher.js`
3. `python tools/package.py`
4. Upload the new zip to a new submission

The version must be higher than the last published one or Partner Center will reject it.
