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
6. Go to **Clients → Create client**:
   - Application type: **Web application**. Name: `Sell Sheet Studio`.
   - **Authorized JavaScript origins**: click **Add URI** and enter `https://lumiflooshed-alt.github.io`. Add your Cloudflare address too if you have one, e.g. `https://YOUR-NAME.pages.dev`.
   - Enter origins only, with no `/sellsheet/` at the end. Leave **Authorized redirect URIs** empty.
   - Click **Create**.
7. Copy the **Client ID**. It looks like `1234567890-abc123.apps.googleusercontent.com`.

## 1b. Optional: a Google API key, to pick any Drive folder

**Save to Drive** works without this. Files go to a **Sell Sheets** folder created for you, or to the top of **My Drive**.
To choose any folder (including shared drives) in Google's own folder picker, add a free API key:

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
- **Sign-ins last about an hour**, and only in that browser tab. After that the site asks you to sign in again. Your customers are kept either way.
- **Sending limits:**
  - Gmail: about 500 emails a day, or 2,000 on Google Workspace.
  - Outlook: about 30 a minute. The site paces large sends automatically.
  - Outlook emails must be under about 4 MB in total. If you hit that, untick an attachment.
- **To remove access at any time:**
  - Google: <https://myaccount.google.com/permissions>
  - Microsoft: <https://account.live.com/consent/Manage> (personal) or <https://myapps.microsoft.com> (work)
