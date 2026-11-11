# Setup (about 15 minutes, once)

The front end is already on GitHub. The backend is a Google Apps Script web app that you own; your API keys stay in its Script properties and never go into this repository.

## 1. Switch on GitHub Pages
Repository **Settings > Pages > Deploy from a branch > main / (root) > Save**. The app appears at `https://pegasus028.github.io/lexicalization/` in demo mode.

## 2. Get a search key (choose one)
- **Serper** (recommended; Google results, best coverage of TikTok and Instagram pages): sign up at serper.dev and copy the API key. 2,500 free queries.
- **Brave Search API**: sign up at brave.com/search/api and create a key for the Search plan.

## 3. Create the backend
1. Go to script.google.com with a **personal Gmail account** (a school Workspace account may block "Anyone" access) and create a **New project** named "Lexicalization".
2. Delete the sample code, paste the whole of [`Code.gs`](Code.gs), and save.
3. **Project Settings > Script properties > Add script property**:

   | Property | Value |
   |---|---|
   | `TEACHER_PIN` | a PIN of your choice (needed to search and edit) |
   | `SERPER_API_KEY` *or* `BRAVE_API_KEY` | the key from step 2 |
   | `ANTHROPIC_API_KEY` | optional: lets Claude code "unclear" hits for existing-word terms |

4. In the editor choose the function **`setup`** and press **Run**. Approve the permissions (Sheets, external requests, triggers). This creates the data Sheet "Lexicalization tracker data" in your Drive and the Monday and Thursday 06:00 schedule. The log shows the Sheet link.
5. **Deploy > New deployment > Web app**: Execute as **Me**, Who has access **Anyone**. Copy the web app URL (it ends in `/exec`).

## 4. Connect the app
Either paste the `/exec` URL into `config.js` in this repository (for everyone), or open the app's **Settings** tab and paste it there (this browser only). Reload: the demo banner disappears.

## 5. First use
1. Open **Search**, enter the teacher PIN, and try a known word such as `aura farming` to confirm live results arrive.
2. In **Terms**, add each term (up to 10). Suggested: 8 student terms, one real slang word with role **Control**, one invented word with role **Foil**.
3. Press **Run all active terms now** once. That first run is every term's baseline.
4. Leave the schedule to do the rest. Check **Review** after each run for "unclear" hits, and log spoken or private sightings there.

## Changing things later
- Schedule, results per query and the monthly cap are in the app's **Settings** tab.
- After editing code: `node tools/build.js`, paste the new `Code.gs`, then **Deploy > Manage deployments > edit > New version > Deploy**.
- To start again, delete the rows (not the header row) in the Sheet's tabs.

## Not yet tested against live services
The backend logic is tested against stand-ins for Google's services and for the search APIs. The first live search (step 5.1) is the real test of the Serper or Brave key, and the first scheduled run is the real test of the trigger.
