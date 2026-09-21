# Cloud setup — done once, by one person

Everyone else just clicks **Connect Google Drive** or **Connect OneDrive** and signs in. This page
is for the one person who registers the app with Google and Microsoft so that button exists.

You do not need to have used these consoles before. Follow the steps literally; anything not
mentioned here can be left at its default, and most of what you will see on those pages does not
apply to this app.

It takes about twenty minutes for Google and five for Microsoft. You do it once.

---

## 1. Google Drive

You will create **one project**, **one consent screen** and **two OAuth clients** — one for the
packaged desktop app, one for the browser build. Both hand their ids to the same `.env` file.

### 1.1 Create the project

1. Go to <https://console.cloud.google.com/projectcreate>.
2. **Project name**: `RetroPlaningStudio`. Leave Location as it is.
3. Create, then make sure the project picker at the top of the page shows your new project. Every
   step below happens inside it.

### 1.2 Turn on the Drive API

1. Go to <https://console.cloud.google.com/apis/library/drive.googleapis.com>.
2. Press **Enable**.

That is the only API this app uses. Ignore the rest of the library.

### 1.3 Configure the consent screen

1. Go to <https://console.cloud.google.com/auth/overview>.
2. **App name**: `RetroPlaningStudio`. **User support email**: your address.
3. **Audience / User type**: **External**. (Internal exists only for Google Workspace
   organisations and would lock the app to your own domain.)
4. **Developer contact information**: your address again. Save.

Now the scopes:

1. Go to <https://console.cloud.google.com/auth/scopes> and press **Add or remove scopes**.
2. The list is long and the search box is the only sane way in. Add exactly these three:
   - `https://www.googleapis.com/auth/drive`
   - `https://www.googleapis.com/auth/userinfo.email`
   - `https://www.googleapis.com/auth/userinfo.profile`
3. Update, then Save.

`drive` — not the narrower `drive.file` — is required on purpose. With `drive.file` the app can
only see files it created itself, so a Markdown file or a Google Doc someone drops into the project
folder from the Drive web UI would be invisible to the sync. Section 1.6 explains what that choice
costs.

### 1.4 Create the Desktop app client (for the packaged app)

1. Go to <https://console.cloud.google.com/apis/credentials>.
2. **Create credentials → OAuth client ID**.
3. **Application type: Desktop app**. This exact type matters: it is the only one that accepts the
   `http://127.0.0.1:<random port>` redirect the packaged app uses, and a Web application client
   will refuse it. There is no redirect URI field to fill in for this type — that is correct.
4. **Name**: `RetroPlaningStudio desktop`. Create.
5. Copy both the **Client ID** and the **Client secret** from the dialog.

That secret is not confidential, and Google says so: for installed applications the client secret
"is not treated as a secret", because it is compiled into every copy of the program. Security for
this flow comes from PKCE and the loopback redirect. It is safe to put in `.env`.

### 1.5 Create the Web application client (for the Pages build)

1. Same page: **Create credentials → OAuth client ID**.
2. **Application type: Web application**. **Name**: `RetroPlaningStudio web`.
3. Two fields matter, and both values come from the running app — do not type them from memory:
   open the web build, go to **Settings → Cloud sync → Google Drive → Advanced**, and read the
   **Redirect URI to register** box. It shows the exact string, with a Copy button.
   - **Authorized redirect URIs** → add that exact string
     (e.g. `https://b2renger.github.io/Retro-planing-/oauth/callback.html`).
   - **Authorized JavaScript origins** → add its origin only, with no path
     (e.g. `https://b2renger.github.io`).
4. Create, and copy the **Client ID**. The web client's secret is never used — the browser build
   uses the implicit flow precisely because a secret cannot be kept in a bundle.

### 1.6 Stay in Testing, and add your users

Because the app asks for the full `drive` scope, Google classifies it as **restricted**. Publishing
such an app requires an annual third-party security assessment that costs thousands of dollars per
year. For a studio tool used by a class, that is not worth it. So:

1. Go to <https://console.cloud.google.com/auth/audience>.
2. Leave **Publishing status** on **Testing**. Do not press "Publish app".
3. Under **Test users**, press **Add users** and add each person's Google address. The cap is 100.
   Anyone not on this list cannot sign in at all.

Tell your users two things, because both look like bugs otherwise:

- **The "Google hasn't verified this app" screen.** It appears once per person. They must click
  **Advanced**, then **Go to RetroPlaningStudio (unsafe)**. It is your own app; the warning is
  Google saying it has not audited it, which is true and is the deal above.
- **They will reconnect about once a week.** In Testing mode a refresh token expires after seven
  days. The app expects this: the cloud chip turns amber and says **Reconnect**, one click re-runs
  the sign-in, and nothing is lost or re-entered. It is never shown as a sync failure.

The alternative, if this ever outgrows a studio: publish the app and pay for Google's annual CASA
security assessment. Nothing else removes the seven-day limit while the `drive` scope is in use.

---

## 2. Microsoft OneDrive

Shorter, and with no verification, no tester list and no weekly expiry.

1. Go to <https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade> and
   press **New registration**.
2. **Name**: `RetroPlaningStudio`.
3. **Supported account types**: **Accounts in any organizational directory (Any Microsoft Entra ID
   tenant - Multitenant) and personal Microsoft accounts (e.g. Skype, Xbox)**. Anything narrower
   shuts out personal OneDrive accounts.
4. Skip the Redirect URI on this first page — the platforms are added next. Press **Register**.
5. Copy the **Application (client) ID** from the Overview page. That is the only id you need.

Now add the two platforms, under **Manage → Authentication → Add a platform**:

- **Single-page application** — for the browser build. Its redirect URI is the same string the app
  shows in **Settings → Cloud sync → Microsoft OneDrive → Advanced**
  (e.g. `https://b2renger.github.io/Retro-planing-/oauth/callback.html`). Paste it exactly.
- **Mobile and desktop applications** — for the packaged app. Tick or add `http://localhost`.
  Entra then accepts any loopback port, which is what the desktop sign-in needs. Do **not** use the
  "Web" platform for this; it would reject the loopback redirect.

Then, under **Manage → API permissions → Add a permission → Microsoft Graph → Delegated
permissions**, add:

- `Files.ReadWrite`
- `User.Read`
- `offline_access`

Do **not** create a client secret. This is a public client; the app never sends one, and an unused
secret is only something to leak later.

---

## 3. Put the ids in the build

### The desktop app and local builds

Copy `.env.example` to `.env` and fill in:

```dotenv
VITE_GOOGLE_CLIENT_ID=<the Desktop app client ID from 1.4>
VITE_GOOGLE_CLIENT_SECRET=<the Desktop app client secret from 1.4>
VITE_MS_CLIENT_ID=<the Application (client) ID from 2.5>
```

`.env` is git-ignored. Rebuild (`npm run build:all`, or `npm run package:mac` / `package:win`) and
the Connect buttons work for everyone who runs that build.

### The GitHub Pages build

The web build needs the **Web application** client id from 1.5, not the desktop one, and no Google
secret at all. Put both ids in the repository:

1. Repo → **Settings → Secrets and variables → Actions → New repository secret**.
2. Add `VITE_GOOGLE_CLIENT_ID` = the Web application client ID from 1.5.
3. Add `VITE_MS_CLIENT_ID` = the Application (client) ID from 2.5.

`.github/workflows/pages.yml` already passes both into the build step. Push to `main` and the
published site has working Connect buttons. If the secrets are missing the build still succeeds —
the app simply says it has no cloud credentials and points back here.

---

That is the whole job. Nobody else ever opens a console: they open the app, press one button, and
sign in.
