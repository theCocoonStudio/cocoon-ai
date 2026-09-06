# explorations

Sheets made to decide something, kept as the record of what was looked at. Made with `npm run export:logo`; see `docs/export-logo.md`.

- `spread-vapour.png`, `spread-dense.png` — made under the old camera model on 2026-09-05: the camera offset from 1.0 to 2.8 in steps of 0.3 and the plane spacing at 0.5, 1 and 1.5, in the 1.00x lockup at 120 to 600 px, the gap re-derived for each row by the tier rule at air2x. The row marked chosen, offset 1.90, is the shipped scene; in today's parameters that is radius 0.6333 at perspective 1/6, and the same sweep is `--radius 0.6333:0.1:3`.

  ```
  (old model)  --off 1.9:0.3:3 --spacing 1:0.5:1 --cut vapour --out /tmp/sheets --name spread-vapour
  (old model)  --off 1.9:0.3:3 --spacing 1:0.5:1 --cut dense  --out /tmp/sheets --name spread-dense
  ```

  These replace a pair made on 2026-09-05 by a one-off script that took the cut from the command line for the file name only and drew the vapour cut both times, so the dense sheet it produced was the vapour sheet under another name.

- `favicon.png`, from `favicon.mjs` — the favicon at 16 to 128 px, light and dark, at three settings: the old offset 1.30, the shipped 1.90 where the 10% clear-air rule shrinks the black triangle to hold the longer trail, and a candidate at 1.90 where the 10% holds for the black triangle and the pale planes may come within 4% of the edge. Front triangle scale 0.535, 0.422 and 0.485 of the tile. Decided 2026-09-05 (Izzy): one rule for every plane, and more air, 15%; the candidate is not taken. The generator derives the size from the rule; no size is chosen anywhere. The sheet's middle row shows the shipped tile at whatever `FAVI_MARGIN` is when it is run.

- `sensibility-depth-apex.png`, `sensibility-haze-planes.png` — Izzy asked for my own read of the mark (2026-09-06). Depth 0.53 to 0.80, apex 40 to 56, haze 0.016 to 0.136 and 3 to 5 planes, on the icon at 32 to 400 px. My read: keep depth, apex and count; the one change I would make is the vapour haze total from 0.0756 to about 0.10, so the fourth plane reads at 32 px instead of vanishing below 64. The spec put it at the edge of visibility on purpose, so this is taste, recorded here for Izzy's call.

  ```
  npm run export:logo -- --depth 0.6667:0.0667:2 --apex 48:4:2 --view icon --widths 32,64,128,400
  npm run export:logo -- --haze 0.0756:0.03:2 --planes 4:1:1 --view icon --widths 32,64,128,400
  ```

Output of the tool goes to `export/` here, which is not committed.
