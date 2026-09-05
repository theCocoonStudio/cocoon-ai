# explorations

Sheets made to decide something, kept as the record of what was looked at. Made with `npm run export:logo`; see `docs/export-logo.md`.

- `spread-vapour.png`, `spread-dense.png` — the camera offset from 1.0 to 2.8 in steps of 0.3 and the plane spacing at 0.5, 1 and 1.5, in the 1.00x lockup at 120 to 600 px, the gap re-derived for each row by the tier rule at air2x. The shipped scene is the row marked chosen. The offset moved from 1.30 to 1.90 on 2026-09-05 on the strength of an earlier pair centred on 1.30; these are the same sweep centred on the new value.

  ```
  npm run export:logo -- --off 1.9:0.3:3 --spacing 1:0.5:1 --cut vapour --out /tmp/sheets --name spread-vapour
  npm run export:logo -- --off 1.9:0.3:3 --spacing 1:0.5:1 --cut dense  --out /tmp/sheets --name spread-dense
  ```

  These replace a pair made on 2026-09-05 by a one-off script that took the cut from the command line for the file name only and drew the vapour cut both times, so the dense sheet it produced was the vapour sheet under another name.

Output of the tool goes to `export/` here, which is not committed.
