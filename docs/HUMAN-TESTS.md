# Manual acceptance tests

What a person has to check by hand, because no automated test can. 498 unit tests cover the logic;
none of them has ever seen a screen. **Nothing in this app has been looked at in a browser** — every
claim about how it looks is inferred from code. Treat the tests marked ⚠ as the ones most likely to
fail, and do those first.

Work through a section at a time. Each test says what to do and what should happen. If something
differs, note the test number — that is enough for me to find it.

```bash
cd ~/Documents/RetroPlaningStudio
npm install
npm run dev          # http://localhost:3000
```

---

## A. First impression and theme ⚠

These are the highest-risk tests: the theme was converted across nineteen components without anyone
seeing the result.

**A1.** Open the app. It should load a sample media-installation project on the timeline tab, with no
error overlay and no flash of the wrong colour on load.

**A2.** Find the theme control in the navbar menu. It has three states: Dark, Light, System. Switch to
**Light**.

**A3.** ⚠ **In light mode, walk every tab**: Immediate, Rétroplanning, Hardware, Tasks, Markdown,
Collaboration, History. Look for white text on white, invisible borders, or unreadable badges. The
Gantt tab is the one most likely to have a problem — it carried the most dark-tuned colours.

**A4.** ⚠ In light mode, open each of these and check the same: Settings, the cloud panel, the AI
assistant, the task editor, the invite dialog. **The AI assistant modal is the second most likely
to have a problem.**

**A5.** Set the theme to **System**, then change your OS appearance. The app should follow without a
reload.

**A6.** Reload the page. The theme you chose should still be active, and should not flash the other
theme first.

---

## B. The interactive tutorial ⚠

The sandbox is the critical part: the old version wrote into your real data.

**B1.** Start the tutorial from the navbar menu.

**B2.** ⚠ A banner should appear saying this is a practice project. **Check the project switcher: a new
tutorial project should exist, and your own projects should be untouched.**

**B3.** Work through the steps. Each one should highlight a real element on screen, dim the rest, and
advance when you actually do the thing it asks — not when you click Next.

**B4.** Scroll the page mid-step. The highlight should stay attached to its element.

**B5.** Press **Escape**. It should offer to leave, with removing the practice project as the default.
Confirm.

**B6.** ⚠ **Check your own projects again.** They must be exactly as they were: same tasks, same dates,
same history. Nothing the tutorial did may have touched them.

**B7.** Start the tutorial again, get a few steps in, and reload the browser. It should resume where
you were.

**B8.** On the AI step, skip it without configuring anything. It must let you through.

---

## C. Planning and the timeline

**C1.** Change the target delivery date. You should be offered two choices, explained: move only the
anchor, or shift the whole plan. Pick **shift the whole plan**.

**C2.** Every phase, task and milestone should move by the same number of days. Check one task's dates
before and after.

**C3.** Undo. The plan should return to where it was.

**C4.** Change the zoom between day, week and month. The bars should actually change width — this used
to do nothing but change the axis labels.

**C5.** Find a phase with several overlapping tasks. They should sit in separate lanes, not on top of
one another.

**C6.** Tasks that depend on each other should have arrows between them. If a predecessor ends after
its dependent starts, that arrow should be marked as a problem.

**C7.** Drag a task bar sideways. A date tooltip should follow it, it should snap to whole days, and
the new dates should stick after you release.

**C8.** Start dragging and press **Escape** mid-drag. The bar should go back.

**C9.** Drag the edge of a bar to make the task longer.

**C10.** Drag a phase band. Its tasks should keep their own dates; only the phase window moves.

**C11.** Tab to a task bar with the keyboard, then use arrow keys. It should move by one day per press.

**C12.** The header metrics (days remaining, overdue, slack) should be real. Make a task overdue by
setting its due date to last week and check the overdue count reacts.

---

## D. Tasks

**D1.** Create a task. The form should start **empty** — no invented checklist items, no deliverables
you did not type.

**D2.** ⚠ Switch to a different project, then create a task. **It must appear in that project's board
and timeline.** This was broken before: the phase was chosen once at app start, so tasks landed in a
phase that did not exist in the current project and showed up nowhere.

**D3.** Open an existing task and edit it. Change title, assignee, dates, priority, status.

**D4.** Add a checklist item, tick it, and check the progress indicator on the board reflects it.

**D5.** Add a dependency. The picker must not offer the task itself, or anything that would make a
loop.

**D6.** Set a due date before the start date. It should tell you inline.

**D7.** Delete a task. It should ask first. Then undo, and the task should come back.

**D8.** The board should have a **Blocked** column. Move a task into it.

**D9.** Remove a team member who has tasks assigned. Their tasks should read **Unassigned**, not show
someone else's name.

---

## E. Notes and AI fallback

**E1.** Create a markdown document, type, save. Switch documents and come back — the text should be there.

**E2.** Drag a `.md` file from your desktop onto the notes area. It should import.

**E3.** ⚠ With **no AI provider configured**, use "Crunch with AI" on a document. It must produce a plan
**and clearly tell you it was generated locally without AI**. The old version presented this as an AI
result, which is the single most misleading thing the original did.

**E4.** Applying a generated structure should ask for confirmation first, since it replaces the plan.
Then undo should restore it.

---

## F. AI providers

Have at least one API key ready. Any provider works.

**F1.** Settings, AI providers. With none configured, the empty state should say AI features fall back
to a local planner.

**F2.** Add a provider. Paste your key. Press **Load models** — a real list should come back from the
provider.

**F3.** Press **Test connection**. It should report a latency, which model answered, and a sample reply.

**F4.** Deliberately break the key (change a character) and test again. It must show the provider's own
error message, not a generic failure, and must **not** show a connected state.

**F5.** Check what it says about where your key is stored: the desktop app should say the OS keychain,
the browser should say local storage in clear text. It must not claim more safety than it has.

**F6.** Set the provider as default, then use the AI assistant. The header should name the provider and
model that answered.

**F7.** Run the timeline's AI analysis. It should show real bottlenecks and a summary — not a
notification claiming success with nothing to show.

---

## G. LlmOnLan, a model on your own network ⚠

Needs a farm running on your LAN. **Desktop app only** — see J4 for why.

**G1.** Start your farm (`node bin/lol.js up`). Note the address.

**G2.** In the desktop app: Settings, AI providers, find a LlmOnLan farm, **Scan network**.

**G3.** ⚠ Your farm should appear within a few seconds, with its name, address and model. This is the
test most likely to fail for environmental reasons — if nothing appears, go to G5 before concluding it
is broken.

**G4.** Use the farm. The address and model should fill in. Load models, test connection, set as default.

**G5.** Now test manual entry: type just `192.168.1.x` (your farm's IP, no port). It should show you the
full normalized address it will call, ending in `:4000/v1`. Press **Check** — it should report reachable
and list the models.

**G6.** Set the farm as default and run "Crunch with AI" on a document. The work should happen on your
own machine. Confirm by watching the farm's load.

**G7.** Stop the farm and test the connection again. It should say it cannot reach it, clearly.

---

## H. Cloud sync ⚠

Needs your own OAuth client id. The setup screen tells you which type to create — read it, because
picking the wrong client type is the usual failure.

**H1.** Settings, Cloud sync. Enter your Google client id.

**H2.** ⚠ Note the **redirect URI** it shows and register exactly that. On desktop it explains that the
port changes each time and you need a Desktop-app client type.

**H3.** Connect. A browser window should open, and after you approve, the app should show your account
name and email. If any step fails, it must **not** show a connected state.

**H4.** Open the cloud panel for a project and create a folder for it.

**H5.** ⚠ **In Google Drive itself**, open `RetroPlaningStudio/<your project>/`. You should see
`project.json` and a `docs/` folder with one file per document.

**H6.** ⚠ **The main promise of this feature**: create a new `.md` file inside that `docs/` folder,
directly in Drive. Within a minute it should appear as a document in the app.

**H7.** Edit a document in the app. The file in Drive should update.

**H8.** Edit the same document in both places without syncing between. On the next sync it should keep
both, name the conflict copy clearly, and tell you which document conflicted.

**H9.** Disconnect the account. Your files must stay in Drive.

**H10.** Repeat H1 to H7 with OneDrive.

---

## I. Exports

**I1.** Export menu, Excel workbook. Open it. It should have Tasks, Phases, Milestones, Gantt and
Summary sheets.

**I2.** ⚠ The **Gantt sheet** should be a readable chart: one column per day, month headers, coloured
bars for each task, weekends shaded, milestones marked. Check it in both Excel and Google Sheets.

**I3.** Export CSV and open it in Excel. Accented characters (Rétroplanning, Vernissage) must display
correctly.

**I4.** Export the timeline as SVG and PNG. Both should look like the timeline.

**I5.** With Drive connected: **Send to Google Sheets**. It should upload, convert, and give you a link
that opens a real spreadsheet.

**I6.** Export the project as JSON. Then create a fresh project and import that JSON. Everything should
come back.

---

## J. The desktop app

```bash
npm run package:mac     # or package:win
```

**J1.** ⚠ Install from `release/`. On first launch macOS will refuse it — **right-click the app and
choose Open**. It is signed ad-hoc, not notarized. If it says the app is *damaged*, that is a different
and more serious problem: report it.

**J2.** Check the build for your architecture. On Apple Silicon use the arm64 build; the Intel build
should also run under Rosetta.

**J3.** Everything from sections C, D, E, F should work identically to the browser.

**J4.** Farm discovery (section G) should work here and **not** in the browser. That difference is the
reason the desktop app exists.

**J5.** Add an API key in the desktop app, quit it fully, reopen. The key should still be there, and
should not be readable in plain text on disk.

**J6.** Export something. You should get a native save dialog, not a browser download.

**J7.** Cancel that save dialog. Nothing should break and no error should appear.

---

## K. The web build

**K1.** `npm run build:web` then serve `dist/` and open it.

**K2.** ⚠ LlmOnLan must **not** be offered as a working option. It should explain that LAN farms need
the desktop app. It must not show a scan button that does nothing.

**K3.** Cloud AI providers and cloud sync should work normally.

**K4.** Once pushed, check the GitHub Pages deploy. Register the Pages URL's callback with Google and
Microsoft first — the cloud settings screen shows you the exact string.

---

## L. Data safety

**L1.** Create a project, add tasks, reload the browser. Everything should still be there.

**L2.** Settings, Data. Export a full backup.

**L3.** Clear the app's local storage, reload — you should get an empty state, not a crash. Import the
backup. Everything should return.

**L4.** Delete a document, then undo.

**L5.** Leave the app open for a few minutes with cloud sync on, editing a document continuously. It
must not overwrite what you are typing.

---

## Known gaps

Things I know are not done, so you do not spend time finding them:

- **Not notarized.** macOS and Windows will both warn on first launch. Fixing this needs paid developer
  accounts.
- **Invitations are local only.** No email is sent. The screen says so.
- **Permissions are not enforced.** They are stored and displayed but nothing checks them.
- **Markdown preview is partial.** Headings, lists, checkboxes, bold and inline code render; tables,
  fenced code blocks, links and images do not.
- **No real-time collaboration.** Two people editing the same project sync through the drive, not live.
- **The leaked Firebase key is still in git history** at commits `949b750` and `397bcaf`. Deleting the
  file did not remove it. Rotate or restrict that key.
- **No screenshot or browser automation exists in this repo**, which is why section A and B carry the
  most risk.
