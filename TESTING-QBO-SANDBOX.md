# Testing the QuickBooks connection in the sandbox (PR 23)

This guide tests the QuickBooks features from PR 23 against Intuit's free **sandbox company**, without touching the live site, the live Worker, or the real QuickBooks books.

It is written for two readers:
- **You (the person):** Part A covers setup, which needs your accounts and sign-ins.
- **A Claude Code session on your computer:** Part B is the test run it executes in the browser.

The setup:

```
your browser ──► http://localhost:8000/  (this branch's index.html, served from your computer)
                     │
                     ▼
        https://sellsheet-qbo-test.<you>.workers.dev  (a SEPARATE test Worker, this branch's worker/google-token.js)
                     │
                     ▼
        Intuit sandbox company  (fake company, sample data)
```

> **Never paste this branch's `worker/google-token.js` into the live Worker.** It is older than `main`'s Worker and would remove the Company-sharing endpoints (`/team/*`) that coworkers use. Always use the separate test Worker.

---

## Part A: Setup (the person does this)

### A1. Run this branch's site locally

```bash
git clone https://github.com/lumiflooshed-alt/sellsheet.git sellsheet-qbo-test
```

```bash
cd sellsheet-qbo-test && git checkout claude/qbo-items
```

```bash
python3 -m http.server 8000
```

Leave it running, and open `http://localhost:8000/`. Use `localhost`, not `127.0.0.1`, because Intuit only accepts the exact redirect address. This copy keeps its own data in the browser, separate from the live site.

### A2. Create the Intuit app (developer.intuit.com)

1. Sign in at <https://developer.intuit.com>. A developer account is free.
2. Go to **My Hub → App dashboard → Create an app → QuickBooks Online and Payments**, and tick only the **Accounting** scope (`com.intuit.quickbooks.accounting`).
3. If it asks for app details, fill them in as below. They can all be changed later under the app's **Settings → App URLs**, and they only matter for Production approval.

   | Field | Value |
   |---|---|
   | Host domain | `sellsheet.pages.dev` |
   | Launch URL | `https://sellsheet.pages.dev/` |
   | Disconnect URL | `https://sellsheet.pages.dev/` |
   | Connect/Reconnect URL | `https://sellsheet.pages.dev/` |
   | Privacy policy URL | `https://sellsheet.pages.dev/privacy.html` |
   | Terms of use / EULA URL | `https://sellsheet.pages.dev/terms.html` |
   | Where your app is hosted | Country **Canada**. Leave the IP address **empty**: Cloudflare Workers have no fixed outbound IP. |

4. Open **Keys and credentials** and use the **Development** tab (sandbox), not Production. Copy the **Client ID** and **Client Secret**. They belong to the *app*, not to the sandbox company. The sandbox company's own number (Realm/Company ID) is picked up automatically when you connect, so you don't copy it anywhere.
5. Under **Redirect URIs** (Development), add exactly this, with the slash at the end, and save:
   ```text
   http://localhost:8000/
   ```
6. Check **My Hub → Sandboxes**. There should be a sandbox company; if not, click **Add** and choose **Canada**.

### A3. Turn on inventory in the sandbox company

Canadian sandbox companies may start with inventory tracking off. While it's off, you can't create **Inventory** items and nothing has a quantity.

1. Open the sandbox company (**My Hub → Sandboxes →** the company).
2. Go to the **gear icon → Account and settings → Sales → Products and services**, and turn on:
   - **Show Product/Service column on sales forms**
   - **Track quantity and price/rate**
   - **Track inventory quantity on hand**
3. Click **Save**, then **Done**.
4. QuickBooks often has no separate "Inventory" tab. Inventory lives in **Sales → Products and services** (or **gear → Lists → Products and services**, or <https://app.sandbox.qbo.intuit.com/app/items>). Check that **New** now offers the **Inventory** type, and create one or two inventory items with a starting quantity, if the sample data has none.

### A4. Create the separate test Worker (Cloudflare)

1. Go to <https://dash.cloudflare.com> → **Compute (Workers) → Workers & Pages → Create → Create Worker**. Name it:
   ```text
   sellsheet-qbo-test
   ```
   Click **Deploy**.
2. Click **Edit code**, delete everything, and paste in the **entire** contents of this branch's `worker/google-token.js`. If you search the pasted text for `QBO_KV`, it should appear several times. Click **Deploy**.
3. Go to **Storage & Databases → Workers KV → Create instance**, and name it:
   ```text
   sellsheet-qbo
   ```
4. In the Worker `sellsheet-qbo-test`, go to **Bindings** (or **Settings → Bindings**) → **Add binding → KV namespace**. Set the variable name to `QBO_KV`, pick the namespace `sellsheet-qbo`, and save.
5. In **Settings → Variables and Secrets**, add these four, then click **Deploy**:

   | Type | Variable name | Value |
   |---|---|---|
   | Text | `ALLOWED_ORIGINS` | `http://localhost:8000` (no slash at the end) |
   | Text | `INTUIT_CLIENT_ID` | Client ID (Development tab) |
   | **Secret** | `INTUIT_CLIENT_SECRET` | Client Secret (Development tab) |
   | Text | `INTUIT_ENV` | `sandbox` |

6. Open the Worker's address, `https://sellsheet-qbo-test.<you>.workers.dev`. It should show:
   ```text
   {"ok":true,"app":"sellsheet-google-token","configured":false,"quickbooks":true}
   ```
   `"configured":false` is expected: it's about the Google settings, which the test Worker doesn't need.

### A5. Point the local site at the test Worker

**Known bug in this PR:** **Sign in → Sign-in setup → Save** refuses a helper Worker that has no Google settings ("The helper is running but not set up yet…"), even though QuickBooks works without them. Until that's fixed, save the address from the browser console instead:

1. On `http://localhost:8000/`, open the console: **F12 → Console**. If Chrome blocks pasting, type `allow pasting` and press Enter first.
2. Run this, using your own Worker address:
   ```js
   localStorage.setItem('ss-email-setup', JSON.stringify({googleHelper: 'https://sellsheet-qbo-test.lumiflooshed.workers.dev'}))
   ```
3. Reload the page. Don't click **Save** in Sign-in setup afterwards, and **don't use "Sign in with Google" on localhost**, because the test Worker has no Google settings.

### A6. Connect

1. Go to **Settings (gear icon) → QuickBooks → Connect QuickBooks…**.
2. In Intuit's window, sign in and pick the **sandbox company**.
3. Go to **Inventory → QuickBooks items**. It should show **● Live from QuickBooks · Sandbox**.

### A7. Hand over to Claude Code (optional)

1. Leave `python3 -m http.server 8000` running in its own terminal tab. In Konsole, open a new tab with **Ctrl+Shift+T**. Go to the project folder (`cd ~/sellsheet-qbo-test`), and get the latest guide with `git pull`.
2. Install the **Claude in Chrome** extension in Google Chrome, signed in to the same Claude account. Use Google Chrome rather than Chromium if the connection fails.
3. In that Chrome, sign in to developer.intuit.com and open the sandbox company **yourself**. Claude shouldn't type passwords. Then open `http://localhost:8000/`.
4. Run `claude` in the project folder, type `/chrome` to check the browser connection, then say:
   > Read TESTING-QBO-SANDBOX.md and carry out Part B.

---

## Part B: Test run (for Claude Code, in the browser)

### Rules
- Work **only** at `http://localhost:8000/` and in the **sandbox** company at `app.sandbox.qbo.intuit.com`. Never open or change the live site (`sellsheet.pages.dev`, `lumiflooshed-alt.github.io`), the live Cloudflare Worker, or a real QuickBooks company. If the dashboard shows **Production** instead of **Sandbox** anywhere, stop and tell the person.
- Don't type passwords or secrets. If a sign-in is needed, stop and ask the person to do it.
- Don't change Cloudflare or Intuit settings. If the setup in Part A looks incomplete, report what's missing and stop.
- Don't edit the repository's code. This is a test run only.
- Use names that start with `TEST ` for everything you create, so it's easy to spot.
- For each test, record **PASS / FAIL / BLOCKED**, what you did, what you saw, and a screenshot. On failure, also record the exact error text from the page and any errors in the browser console.

### B0. Preflight
1. Open the test Worker's address. Its address is saved in the local site's `localStorage['ss-email-setup'].googleHelper`. Confirm `"quickbooks":true`.
2. On `http://localhost:8000/#settings`, open **QuickBooks**. Confirm it shows the sandbox company and **Sandbox**. If it isn't connected, ask the person to do step A6.
3. Turn on **Allow changes to QuickBooks**.

### B1. Items match
Open **Inventory → QuickBooks items** (`http://localhost:8000/#qbo-items`). Compare the item names, prices, cost and quantity on hand with QuickBooks **Sales → Products and services** in the sandbox. Check at least five items, including any inventory items.

### B2. Edit in the dashboard → QuickBooks
Pick an inventory item. Click its row, then **Edit**. Change the **Sales price** and **SKU**, click **Review changes**, check that the review shows only those two fields as old → new, then click **Send to QuickBooks**. Reload that item in QuickBooks, and confirm both changes and that nothing else changed (description, accounts, tax).

### B3. Edit in QuickBooks → dashboard
In QuickBooks, change the price of a different item. In the dashboard, click **Refresh**, and confirm the new price shows up.

### B4. Create items
In the dashboard, click **＋ New item**:
- **Type Inventory:** name `TEST Inventory item`, starting quantity 10, today's date.
- **Type Service:** name `TEST Service`, price 50.

Confirm both appear in the dashboard and in QuickBooks, and that the inventory item has quantity 10. Then try to create another item with the **same name** as an existing one, and confirm the dashboard explains the duplicate-name problem clearly.

### B5. Adjust quantity (the most important test)
On `TEST Inventory item`, click **Adjust quantity**. Set **New quantity** to 7, pick an adjustment account, enter the reason `TEST recount`, click **Review**, then **Send to QuickBooks**.
- **PASS:** the dashboard shows 7, and QuickBooks shows quantity 7 with an inventory quantity adjustment recorded.
- **If QuickBooks refuses it**, record the exact message. This decides whether stock adjustments can work from the dashboard on this QuickBooks plan.

### B6. Categories
Click **Categories → Add category**, and create `TEST Category`. Tick two items, then use **Set category…** to choose `TEST Category`. Rename the category to `TEST Category renamed`. Confirm each step in QuickBooks.

### B7. Bulk price change
Tick two items, then click **Change prices…**. Increase the prices by 10%, review, and send. Confirm the new prices in QuickBooks.

### B8. Conflict check
Open **Edit** on an item in the dashboard, but don't send yet. In QuickBooks, change that same item's price and save. Back in the dashboard, change the description, review, and send. Expected: the save is **refused** with an explanation, and the latest version is reloaded.

### B9. Customers
On the dashboard's **Customers** page, click the **QuickBooks** button, then **Bring in customers from QuickBooks**. Confirm the sandbox customers that have an email address now appear in the list. Then add a new customer in the dashboard named `TEST Customer`, with the email `test-customer@example.com`. Open it, and in its **QuickBooks** section click **Add to QuickBooks**. Confirm it appears in QuickBooks under **Sales → Customers**. Then edit that customer in the dashboard, save, and confirm the change reaches QuickBooks.

### B10. Disconnect and reconnect
In **Settings → QuickBooks**, click **Disconnect**, and confirm the items page no longer shows live data. Then ask the person to click **Connect QuickBooks…** again and pick the sandbox company, since it needs their Intuit sign-in. Confirm the items load again.

### B11. Report
Write a summary table (test, result, notes), then the details of each FAIL or BLOCKED test with screenshots and exact error text. Save it as `qbo-sandbox-test-report.md` in the project folder, and tell the person where it is.

---

## Troubleshooting

| What you see | Fix |
|---|---|
| `origin_not_allowed` | `ALLOWED_ORIGINS` must be exactly `http://localhost:8000`, with no slash at the end. |
| Intuit: invalid redirect URI | The Development Redirect URI must be exactly `http://localhost:8000/`, and you must open the site at `localhost`, not `127.0.0.1`. |
| `qbo_not_configured` | The `QBO_KV` binding or an `INTUIT_*` variable is missing. Add it and redeploy. |
| `invalid_client` | The Client ID or Secret is wrong, or from the Production tab. Use the Development keys. |
| "QuickBooks connects through your helper Worker…" | The helper address isn't saved. Redo step A5. |
| No quantities / no Inventory type | Do step A3. |
| `"quickbooks":false` at the Worker address | Check the KV binding and the `INTUIT_*` names, then redeploy. |
| The Worker address shows "Hello World!" | The code from A4.2 wasn't deployed. Open **Edit code** and click **Deploy**. |

## Cleaning up afterwards
- In Cloudflare, delete the Worker `sellsheet-qbo-test` and the KV namespace `sellsheet-qbo`.
- Stop the local server with **Ctrl+C**.
- The live site and live Worker were never changed.
