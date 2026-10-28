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
2. At the top, click the project picker, then **New project**. Name it `Rakaposhica Dashboard` and click **Create**. Make sure it's selected.
3. Open **APIs & Services → Library**. Search for and **Enable** each of:
   - **Gmail API**
   - **Google Drive API**
   - **Google Picker API** (only needed to choose any Drive folder when saving; see 1b)
4. Open **Google Auth Platform** (or **APIs & Services → OAuth consent screen**) and click **Get started**:
   - App name: `Rakaposhica Dashboard`. User support email: your email.
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
   - To let Inventory make folders, add files and move sheets between your Active and Inactive folders, also add **`https://www.googleapis.com/auth/drive`**. It's only asked for the first time you do one of those.
   - Google calls these *restricted* scopes. That's fine while the app is **Internal**, or **External** in Testing with yourself as a test user. Opening it to the public would need Google's paid security review.
6. Go to **Clients → Create client**:
   - Application type: **Web application**. Name: `Rakaposhica Dashboard`.
   - **Authorized JavaScript origins**: click **Add URI** and enter `https://lumiflooshed-alt.github.io`. Add your Cloudflare address too if you have one, e.g. `https://YOUR-NAME.pages.dev`.
   - Enter origins only, with no `/sellsheet/` at the end. Leave **Authorized redirect URIs** empty.
   - Click **Create**.
7. Copy the **Client ID**. It looks like `1234567890-abc123.apps.googleusercontent.com`.

## 1b. Browsing your Drive (no API key needed)

**Browse Drive…** (when saving), **open from Google Drive**, and **Inventory → choose folder** use a Drive browser built into the site. It lists My Drive, Shared drives and Shared with me, and you can search.

- The first time, Google asks for permission to see your Drive. When saving, it asks to see and save in your folders.
- Google's own picker isn't used any more. It ran inside an embedded Google page, which Firefox and other privacy-focused browsers block from seeing your Google sign-in, so it failed with "401".
- A Google API key isn't needed. You can leave the field in Sign-in setup empty.
- On the **Data Access** page in Google Cloud, the scopes `.../auth/drive.readonly` and `.../auth/drive` must be listed (step 5b above). They're the same ones Inventory uses.

## 2. Microsoft (Outlook.com, Hotmail and Microsoft 365)

1. Go to <https://entra.microsoft.com> (or <https://portal.azure.com>) and sign in with your Microsoft account.
2. Open **App registrations** (under **Applications**) and click **New registration**:
   - Name: `Rakaposhica Dashboard`.
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

## 4. Optional, recommended: stay signed in to Google

Without this, Google signs you out of the site about an hour after you sign in. Reply checking and inventory syncing then pause until you click something. This step keeps you signed in until you click **Sign out**, so replies and your inventory keep updating in the background.

Google only gives a lasting sign-in to a small server that keeps your **Client secret**. The repository includes one: [`worker/google-token.js`](worker/google-token.js). It runs free on Cloudflare (Workers free plan). It never sees your emails or files. It only swaps Google's sign-in codes for short passes.

Keep the Client secret out of chats, email and the site's code. It only goes into Cloudflare's encrypted secrets.

1. **Google:**
   - Open <https://console.cloud.google.com> → **Google Auth Platform → Clients** → your Web application client.
   - Under **Authorized redirect URIs**, click **Add URI** and enter the site's address exactly as **Sign in → Sign-in setup** shows it, e.g. `https://lumiflooshed-alt.github.io/sellsheet/`. Add your Cloudflare Pages address too if you use one. Click **Save**.
   - On the same page, under **Client secrets**, copy the secret, or click **Add secret** to make one.
2. **Cloudflare:**
   - Go to <https://dash.cloudflare.com> → **Workers & Pages → Create → Create Worker**.
   - Name it `sellsheet-token`, then click **Deploy**.
   - Click **Edit code**, replace everything with the contents of `worker/google-token.js`, then click **Deploy**.
3. **Worker settings:** open the Worker's **Settings → Variables and Secrets** and add these four:
   - `GOOGLE_CLIENT_ID` (type **Text**): your Client ID.
   - `GOOGLE_CLIENT_SECRET` (type **Secret**): the Client secret from step 1.
   - `SEAL_KEY` (type **Secret**): any long random text, at least 40 letters and numbers. It locks the sign-in copy kept in your browser.
   - `ALLOWED_ORIGINS` (type **Text**): `https://lumiflooshed-alt.github.io`. To add your Cloudflare Pages address, separate them with a comma.
   - Click **Deploy** again.
4. **Connect the site:**
   - Copy the Worker's address from its overview, e.g. `https://sellsheet-token.YOUR-NAME.workers.dev`.
   - On the site, open **Sign in → Sign-in setup** and paste it into **Stay-signed-in helper**.
   - Click **Save**. The site checks the helper is reachable and set up.
   - Sign in once more on each device.
   - **Settings → Email → Stay signed in** then says **On**.
5. **If your Google app's audience is External and its status is Testing,** Google ends lasting sign-ins after 7 days. To stop that:
   - Open **Google Auth Platform → Audience** and click **Publish app**.
   - You'll still see the "Google hasn't verified this app" screen when signing in. Click **Continue**. That's fine for your own use.
   - **Internal** (Workspace) apps don't have this limit.

To turn it off, clear the helper address in **Sign-in setup**. To cut off access completely, also remove the app at <https://myaccount.google.com/permissions>.

## Choosing the address you send from

- In the **Email** window, the **Send from** list next to Gmail shows:
  - Your Gmail address.
  - Every address set up in Gmail under **Settings → See all settings → Accounts → Send mail as**, such as a business address or a team alias. Only addresses Gmail has verified are listed.
  - **＋ Add another Gmail account…** signs in to a second Gmail account, for sending only.
    - Your customers and the Sent list stay with the account you signed in to the site with.
    - Replies to that account are checked too.
- Your choice is remembered. You can also change it in **Settings → Email → Send from**. To refresh the list after adding an address in Gmail, click **Refresh** there.

## Sync between devices

When you sign in with the same Google account on several devices, these sync between them:
- customers and groups
- the Sent list
- email wording
- inventory status, stars and notes
- all Settings, including the Inventory folder
- your saved sell sheets (with photos)

How it works:
- **Changes made here** are sent within a couple of seconds. Edits to a sheet go after about 12 seconds of quiet.
- **Changes from other devices** are fetched every 90 seconds while the site is open, and whenever you come back to the tab.
- **Conflicts:** when the same item was changed on two devices, the newest change wins.
- **Deleting a sheet** on one device deletes it on the others.
- **Saved sheets:** they sync with Google sign-in only. With Outlook, everything else syncs.

## Company: working as a team

Several people can share one company: customers and groups, leads, the Pipeline and Sent history, logged calls and notes, and (if you choose) to-dos and email templates. Everyone signs in with their own Google or Microsoft account and sends from their own mailbox.

It runs on the same Cloudflare Worker as step 4, with a free Cloudflare database (D1) added. Set it up once, as the person who'll be the admin:

1. **Do step 4 first**, so the Worker is deployed and the site knows its address.
2. **Make the database:** in <https://dash.cloudflare.com> go to **Storage & Databases → D1 SQL Database → Create**. Name it `sellsheet-team` and click **Create**. You don't need to make any tables; the Worker makes them.
3. **Connect it to the Worker:** open the `sellsheet-token` Worker → **Settings → Bindings → Add → D1 database**. Set **Variable name** to `TEAM_DB` (exactly) and pick `sellsheet-team`. Click **Deploy**.
4. **Update the Worker's code:** if you deployed it before this feature, click **Edit code**, replace everything with the latest `worker/google-token.js`, and click **Deploy**.
5. **Start the company:** on the site, open **Settings → Company**, type the company name and your name, and click **Create company**. You're its admin.
6. **Invite people:** under **People**, type each coworker's sign-in email (the Google or Microsoft address they sign in to the site with) and click **Invite**. Then click **Copy invite link** and send them the link: it points their browser at your Worker.
7. **Each coworker:** opens the link, signs in with the invited address, and clicks **Join** in **Settings → Company**.

How it works:
- **What's shared:** the admin ticks what everyone shares in **Settings → Company → What's shared**. Anything not ticked stays on each person's own account.
- **Sync:** every 3 minutes while the site is open, when you come back to the tab, when you click **Sync now**, and just before you send an email.
- **Owners:** each customer and lead has an owner. Whoever adds them is the owner. When you join, you become the owner of the customers and leads you already have.
  - Owners show as a small name tag in the email list and on Pipeline cards.
  - On a customer's page, or a lead in the Pipeline, anyone can click **Take over**. An admin can pick any owner from a list.
- **No double emails:** before sending, the site warns you if someone you're emailing belongs to a teammate, or a teammate emailed or called them in the last 14 days. You can send anyway, skip those people, or not send.
- **Conflicts:** when two people change the same customer or lead, the newest change wins.
- **Admins** can rename the company, invite and remove people, make someone an admin, and choose what's shared. There's always at least one admin.
- **Leaving:** **Settings → Company → Leave** stops sharing. Your own copy stays in your browser. When the last person leaves, the company's shared data is deleted from the database.

Your data is kept in your Cloudflare account's database, never anywhere else. The Worker checks each person's sign-in with Google or Microsoft on every request, and only people in the company can read its data.

## Good to know

- **Signing in is optional.** Without it, customers are saved in that browser, and **Share instead…** in the Email window still hands the files to your device's own email app.
- **You stay signed in on this browser until you click Sign out**, in every tab.
  - Without the stay-signed-in helper (step 4), Google only hands out one-hour passes. After an hour, the next email or Drive save briefly opens a Google window that closes by itself; you don't need to click anything.
  - With the helper, Google stays signed in until you sign out, and nothing pops up.
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
  - Without the stay-signed-in helper (step 4), Google's sign-in lasts an hour and can only be renewed with a click. After that, checking pauses until you send an email, sign in, or click **Sent → Check now**. With the helper, checking never pauses.
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
- **Keep in sync automatically** (Settings → Inventory, on by default):
  - The folder is checked in the background every 15 minutes while the site is open; you can choose 5, 15, 30 or 60 minutes.
  - The site first asks Drive what changed since the last check, so it only reads folders when something actually changed.
  - The chosen folder is saved with your settings, so every device signed in to the same account uses it without choosing it again.
  - With the stay-signed-in helper this keeps going for good. Without it, it runs while the hour-long Google sign-in lasts.

### Your Drive folders decide status and type
- A folder whose name starts with **Active** (or Current) makes everything inside it active.
- A folder starting with **Inactive** (or Discontinued, Archive) makes everything inside it inactive.
- The folder just inside one of those is the **type**, e.g. *Stock* or *Inventory Item*. Inventory gets a filter for each type.
- Any deeper folders are **categories**.
- Switching a product between active and inactive **moves its files** to the matching folder on the other side, e.g. *Active / Stock / Mens* → *Inactive / Stock / Mens*. Missing folders are made.
- **＋ Add** in Inventory, all done in your Drive:
  - make a new folder
  - save the sell sheet open in the editor into a folder
  - upload PDF, Word or picture files into a folder
- **Move to another folder…** in a product's panel moves its files in Drive.

### Line sheets
- Tick products in Inventory, or filter to what you want, then click **Line sheet**.
- Set the title, subtitle, colour, contact, a note, products per page (4, 6, 9 or 12), the picture (photo or sell sheet page) and what to show. Reorder or remove products as you go.
- The preview updates as you change things.
- Then **Download PDF**, **Save to Google Drive** (a *Line Sheets* folder), or **Email it**.
- An emailed line sheet counts as "sent" for every product in it.

### Pipeline
The logo menu → **Pipeline** shows every customer and sell sheet as a card in columns:
*Sent, no reply → Replied → Interested → Quoted → Ordered → Not interested*.
- Drag cards between columns, or use the menu on a card.
- Type an order value on a card. The board shows open pipeline value, won value and win rate.
- Columns update automatically when a reply is spotted.

## Home

The logo menu → **Home** shows today at a glance:
- sheets sent, customers reached, replies, reply rate and follow-ups due (last 30 days compared with the 30 before)
- what needs your attention
- sends per week
- top products, recent activity, and inventory and customer counts
- a setup checklist

Tick **Show Home when the site opens** to start there.
