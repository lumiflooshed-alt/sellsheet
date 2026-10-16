# Switching on sign-in and email (Gmail and Outlook)

The site works fully without this. Do it once to switch on:

- **Email** – send the sell sheet from your own Gmail or Outlook address (with Cc/Bcc and attachments).
- **Customer sync** – your saved customers follow you to any device when you sign in.

Nothing is stored on a server of ours. Email is sent from your own account, and customers are saved in a hidden
app folder in **your own** Google Drive or OneDrive that only this site can read.

You need two free "Client IDs": one from Google, one from Microsoft. Each takes about 10 minutes.
You can do just one of them; the other button stays switched off.

Your site addresses (add every one you use):

- GitHub Pages: `https://lumiflooshed-alt.github.io/sellsheet/`
- Cloudflare Pages, if you set it up: `https://YOUR-NAME.pages.dev/`

---

## 1. Google (Gmail and Google Workspace)

1. Go to <https://console.cloud.google.com> and sign in.
2. At the top, click the project picker, then **New project**. Name it `Sell Sheet Studio` and click **Create**. Make sure it's selected.
3. Open **APIs & Services → Library**. Search for and **Enable** each of:
   - **Gmail API**
   - **Google Drive API**
   - **Google Picker API** (only needed to choose any Drive folder when saving; see 1b)
4. Open **Google Auth Platform** (or **APIs & Services → OAuth consent screen**) and click **Get started**:
   - App name: `Sell Sheet Studio`. User support email: your email.
   - **Audience**:
     - Choose **Internal** if everyone using it is in your own Google Workspace organisation. No review is needed.
     - Otherwise choose **External**.
   - Contact email: your email. Accept the policy and click **Create**.
5. If you chose **External**, go to **Audience → Test users → Add users** and add every Google address that will sign in (up to 100).
   - They'll see a "Google hasn't verified this app" screen the first time. Click **Continue**.
   - To remove that screen for everyone you'd have to submit the app for Google's verification. That's only needed if you open it to the public.
5b. Go to **Data Access → Add or remove scopes** and tick **Gmail API · `.../auth/gmail.readonly`** (paste `https://www.googleapis.com/auth/gmail.readonly` into **Manually add scopes** if it isn't listed). Click **Update**, then **Save**.
   - This lets the Sent list spot replies from customers (see "Reply checking" below). The site only looks at emails from people you've sent sell sheets to.
   - Also add **Google Drive API · `.../auth/drive.readonly`** (`https://www.googleapis.com/auth/drive.readonly`). It's for the **Inventory** page, which reads the sell sheets in a folder you choose. It's only asked for the first time you open Inventory. Nothing in your Drive is changed.
   - Google calls these *restricted* scopes. That's fine while the app is **Internal**, or **External** in Testing with yourself as a test user. Opening it to the public would need Google's paid security review.
6. Go to **Clients → Create client**:
   - Application type: **Web application**. Name: `Sell Sheet Studio`.
   - **Authorized JavaScript origins**: click **Add URI** and enter `https://lumiflooshed-alt.github.io`. Add your Cloudflare address too if you have one, e.g. `https://YOUR-NAME.pages.dev`.
   - Enter origins only, with no `/sellsheet/` at the end. Leave **Authorized redirect URIs** empty.
   - Click **Create**.
7. Copy the **Client ID**. It looks like `1234567890-abc123.apps.googleusercontent.com`.

## 1b. Optional: a Google API key, to browse your Drive

**Save to Drive** works without this. Files go to a **Sell Sheets** folder created for you, or to the top of **My Drive**.
Add a free API key to use Google's own Drive picker. With it you can:

- choose any folder (including shared drives) when saving
- **open** a sell sheet from Drive (PDF, Word or Google Docs)
- **import customers** from Drive (Excel, CSV or Google Sheets)

To add the key:

1. In the same Google Cloud project, make sure **Google Picker API** is enabled (step 3 above).
2. Open **APIs & Services → Credentials → Create credentials → API key**. Copy the key (it starts with `AIza`).
3. Click the new key to edit it:
   - **Application restrictions:** choose **Websites**. Add `https://lumiflooshed-alt.github.io/*`, and your Cloudflare address too, e.g. `https://YOUR-NAME.pages.dev/*`.
   - **API restrictions:** choose **Restrict key** and tick only **Google Picker API**.
   - Click **Save**.
4. Paste the key into the site under **Sign in → Sign-in setup → Google API key**, or send it to Claude.

The key only lets your site addresses open Google's picker. Your files are still protected by your sign-in.
Saving to Drive asks for one more Google permission, "files you use with this app". With it, the site can only see
files it saves and folders you pick, never the rest of your Drive.

In the picker (**Save → Google Drive → Browse Drive…**) you see your folders and files:

- **Pick a folder** to save into it.
- **Pick an existing PDF, Word or JPG file** to replace it with the current sheet. Drive keeps the old one in its version history.

## 2. Microsoft (Outlook.com, Hotmail and Microsoft 365)

1. Go to <https://entra.microsoft.com> (or <https://portal.azure.com>) and sign in with your Microsoft account.
2. Open **App registrations** (under **Applications**) and click **New registration**:
   - Name: `Sell Sheet Studio`.
   - Supported account types: **Accounts in any organizational directory and personal Microsoft accounts**.
   - Redirect URI: choose **Single-page application (SPA)** and enter `https://lumiflooshed-alt.github.io/sellsheet/` (with the slash at the end).
   - Click **Register**.
3. If you use Cloudflare too, open **Authentication**, and under **Single-page application** click **Add URI** and add `https://YOUR-NAME.pages.dev/`. Save.
4. Open **API permissions → Add a permission → Microsoft Graph → Delegated permissions**. Tick these and click **Add permissions**:
   - `Mail.Send`
   - `Files.ReadWrite.AppFolder`
   - `User.Read`, `offline_access`, `openid` and `profile` (User.Read is usually already there)
5. On **Overview**, copy the **Application (client) ID**. It looks like `11111111-2222-3333-4444-555555555555`.

Work or school Microsoft 365 accounts: some organisations require an admin to approve new apps. If you see "Need admin approval", ask your IT admin. They can click **Grant admin consent** on the API permissions page.

## 3. Put the IDs into the site

**Quickest – paste them in the site (this browser only):**

1. Open the site, click **Sign in** (top right), then **Set up sign-in**.
2. Paste the Google Client ID and/or Microsoft Application ID, then click **Save**.
3. Click **Sign in** again and pick Google or Microsoft.

The **Set up sign-in** window also shows the exact site address to paste into Google and Microsoft. Use its **Copy** buttons.

**For every device and everyone using the site:** send the IDs to Claude, or edit the code yourself:

1. On GitHub, open `index.html` in this repository and click the pencil (**Edit**) icon.
2. Search for this line:

   ```js
   const EMAIL_SETUP={google:'',microsoft:''};
   ```

3. Paste your IDs between the quotes:

   ```js
   const EMAIL_SETUP={google:'1234567890-abc123.apps.googleusercontent.com',microsoft:'11111111-2222-3333-4444-555555555555'};
   ```

4. Click **Commit changes**. The site updates within a minute or two.

Client IDs are not passwords. They're meant to be public and only work from the site addresses you listed above.

## If sign-in doesn't work

| What you see | What to do |
|---|---|
| **Error 400: origin_mismatch** or **redirect_uri_mismatch** (Google) | In Google Cloud → **Clients** → your client → **Authorized JavaScript origins**, add the address shown in **Set up sign-in** (for example `https://lumiflooshed-alt.github.io`, without `/sellsheet/`). Save, then wait 5 minutes. |
| **Error 401: invalid_client** (Google) | The Client ID was pasted wrongly. Copy it again from **Clients**. It ends in `.apps.googleusercontent.com`. |
| **Access blocked / access_denied** (Google) | The app is in Testing and this Google address isn't a test user. Add it under **Audience → Test users**. |
| **"Google hasn't verified this app"** | Normal while testing. Click **Continue**. |
| **Gmail API has not been used in project…** | Enable the **Gmail API** (and **Google Drive API**) in **APIs & Services → Library**. |
| **The folder picker shows an error or "API key not valid"** | Enable **Google Picker API**, and check the API key's website restrictions include your site address with `/*` at the end. |
| **AADSTS50011 redirect URI mismatch** (Microsoft) | In Entra → your app → **Authentication** → **Single-page application**, add the redirect URI shown in **Set up sign-in** exactly, including the final `/`. |
| **AADSTS9002326 / "cross-origin token redemption"** (Microsoft) | The redirect URI was added under **Web** instead of **Single-page application**. Move it to Single-page application. |
| **Need admin approval** (Microsoft work account) | Ask your IT admin to click **Grant admin consent** under **API permissions**. |
| **Nothing happens when clicking Sign in** | Allow pop-ups for the site in your browser and try again. |

## Good to know

- **Signing in is optional.** Without it, customers are saved in that browser, and **Share instead…** in the Email window still hands the files to your device's own email app.
- **You stay signed in on this browser until you click Sign out**, in every tab.
  - Google only hands out one-hour passes. After an hour, the next email or Drive save briefly opens a Google window that closes by itself; you don't need to click anything.
  - Microsoft passes renew silently in the background (for up to about a day of not using the site).
- **Signed in with Outlook but saving to Google Drive?** The site asks for your Google account once, just for Drive. You stay signed in with Outlook, and your customers stay on that account.
- **Sending limits:**
  - Gmail: about 500 emails a day, or 2,000 on Google Workspace.
  - Outlook: about 30 a minute. The site paces large sends automatically.
  - Outlook emails must be under about 4 MB in total. If you hit that, untick an attachment.
- **To remove access at any time:**
  - Google: <https://myaccount.google.com/permissions>
  - Microsoft: <https://account.live.com/consent/Manage> (personal) or <https://myapps.microsoft.com> (work)

## Reply checking and notifications (Gmail)

- While the site is open, Gmail is checked every 5 minutes for emails from customers you've sent sell sheets to.
  - A reply marks the entry **Replied** in **Sent**, with the subject, the first line and an **Open in Gmail** link.
  - New replies show a green badge on the **Sent** button.
  - Out-of-office and other automatic answers are ignored.
  - Replies in a new conversation count too: any email from that customer after you sent the sheet.
- **Follow-up date:** set one on an entry in **Sent**. If there's no reply by that day, the entry is flagged **No reply by …** and you get a reminder. Without a date, the reminder comes after 7 days.
- **Desktop notifications:** open **Sent → Turn on desktop notifications** and allow them when the browser asks. You're told about new replies and missed follow-up dates. This is set per browser.
- **The first time:** signing in after this update asks Google for the extra read-only permission. If you were already signed in, click **Sent → Turn on**.
- **Limits:**
  - Checks only run while the site is open in a tab.
  - Google's sign-in lasts an hour and can only be renewed with a click. After that, checking pauses until you send an email, sign in, or click **Sent → Check now**.
  - Follow-up date reminders don't need Gmail, so they keep working.

## Inventory (Google Drive folder)

- Open the logo menu → **Inventory**, then choose the Drive folder where you keep your sell sheets. You can also paste the folder's link.
- Every sell sheet in that folder and its subfolders becomes a product card: picture, item code, price, pieces, boxes and colours.
  - Subfolders become categories, e.g. *Mens* and *Ladies*.
  - Files with the same name in different formats (PDF, Word, JPG) are shown as one product.
- Sell sheets made with this site are read exactly. Other PDF and Word sheets are read as well as their layout allows. Pictures (JPG/PNG) are shown as they are.
- What's read is kept in this browser, so the page opens instantly and works offline. **Refresh** reads only files that changed.
- Click a product to see its colours and sizes table and details. From there, **Open in editor** or **Email this sell sheet**.
- **Active / Inactive:** mark products inactive to hide them from the active list (nothing is deleted). Do it in the product panel, or tick several cards and use the bar that appears.
- **★ Star** products to keep them first. Add a private **note** to each product.
- **Sent to:** each product shows who it was emailed to, who replied, and when. **Email it to customers who haven't had it** ticks everyone else in the Email window, so you can review the list before sending.
- **Export** downloads the inventory as a spreadsheet (CSV).
- Active/inactive, stars and notes sync between your devices when you're signed in.

## Home

The logo menu → **Home** shows today at a glance:
- sheets sent, customers reached, replies, reply rate and follow-ups due (last 30 days compared with the 30 before)
- what needs your attention
- sends per week
- top products, recent activity, and inventory and customer counts
- a setup checklist

Tick **Show Home when the site opens** to start there.
