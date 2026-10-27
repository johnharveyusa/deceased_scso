# SCSO End of Watch

A memorial roster honoring deceased officers of the Shelby County Sheriff's Office, organized by rank.

**Live page:** https://johnharveyusa.github.io/deceased_scso/

Maintained by John Harvey for the Shelby County Sheriff's Office - Retirees group.

## How to add an officer

1. Open `index.html` on GitHub and click the pencil (Edit) icon.
2. Find the list that starts with `const EMBEDDED = [`.
3. Copy an existing line under the correct rank and change the details, for example:

   `{n:"First Last",r:"Sergeant",u:8,y:2026,lod:false,notes:""},`

   - `n` is the officer's name
   - `r` is the rank (Sheriff, Chief Deputy, CAO, Chief Inspector, Asst Chief, Inspector, Captain, Lieutenant, Sergeant, Patrolman, Reserve)
   - `u` is the rank order number (copy it from another officer of the same rank)
   - `y` is the year of death, or `null` if unknown
   - `lod` is `true` for line of duty, otherwise `false`
   - `notes` is optional
4. Click **Commit changes**. The live page updates within a minute or two.

## Keeping the page online

The page is hosted free by GitHub Pages from this repository. To keep it online long term, add one or two trusted people as collaborators under **Settings → Collaborators**, so the page can be maintained if the owner is unavailable.
