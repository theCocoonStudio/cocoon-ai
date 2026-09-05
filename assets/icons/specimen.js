/**
 * Contact-sheet template for the cocoon icon set. build.js writes HEAD, then
 * the geometry as JSON, then TAIL: one self-contained page. It exists to show
 * two things the files cannot: that currentColor follows the surrounding text
 * colour, and that every shape still reads as four planes under the haze.
 */
export const HEAD = `<title>Cocoon Icon Set</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Saira:wdth,wght@75..125,300..700&family=Newsreader:opsz,wght@6..72,300..600&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
  :root{
    --ground:#FAFAF7; --panel:#FFFFFF; --ink:#141414; --muted:#6C6C68;
    --hair:#E3E2DC; --haze:#C8C8C8;
    --sans:"Saira","Helvetica Neue",Arial,sans-serif;
    --serif:"Newsreader",Georgia,"Times New Roman",serif;
    --mono:"IBM Plex Mono",ui-monospace,SFMono-Regular,Menlo,monospace;
  }
  @media (prefers-color-scheme:dark){
    :root:not([data-theme="light"]){
      --ground:#0E0E0E; --panel:#171717; --ink:#E8E8E8; --muted:#8B8B87;
      --hair:#282828; --haze:#5A5A5A;
    }
  }
  :root[data-theme="dark"]{
    --ground:#0E0E0E; --panel:#171717; --ink:#E8E8E8; --muted:#8B8B87;
    --hair:#282828; --haze:#5A5A5A;
  }
  *{box-sizing:border-box}
  body{margin:0; background:var(--ground); color:var(--ink);
       font-family:var(--serif); font-size:17px; line-height:1.6;
       -webkit-font-smoothing:antialiased}
  .wrap{max-width:1120px; margin:0 auto; padding:56px 28px 96px}

  .eyebrow{font-family:var(--mono); font-size:11px; letter-spacing:.14em;
           text-transform:uppercase; color:var(--muted); margin:0 0 18px}
  h1{font-family:var(--sans); font-variation-settings:"wdth" 107,"wght" 350;
     font-size:clamp(38px,6vw,64px); line-height:1.02; letter-spacing:-.01em;
     margin:0 0 22px; text-wrap:balance; font-weight:400}
  .lede{font-size:20px; line-height:1.55; max-width:62ch; margin:0 0 40px}
  .lede em{font-style:italic; color:var(--muted)}
  h2{font-family:var(--sans); font-variation-settings:"wdth" 107,"wght" 500;
     font-weight:400; font-size:13px; letter-spacing:.16em; text-transform:uppercase;
     color:var(--muted); margin:0 0 20px; padding-bottom:10px;
     border-bottom:1px solid var(--hair)}
  section{margin:0 0 64px}
  p.note{max-width:64ch; color:var(--muted); font-size:15.5px}
  code{font-family:var(--mono); font-size:.86em}

  .rule{display:grid; grid-template-columns:repeat(auto-fit,minmax(210px,1fr));
        gap:1px; background:var(--hair); border:1px solid var(--hair)}
  .rule > div{background:var(--panel); padding:22px 24px}
  .rule dt{font-family:var(--mono); font-size:10.5px; letter-spacing:.13em;
           text-transform:uppercase; color:var(--muted); margin:0 0 10px}
  .rule dd{margin:0; font-family:var(--mono); font-size:15px; line-height:1.5;
           font-variant-numeric:tabular-nums}
  .rule dd small{display:block; font-family:var(--serif); font-size:14px;
                 color:var(--muted); margin-top:8px; line-height:1.45}

  /* ---- colour: currentColor demo ---- */
  .inherit{display:grid; grid-template-columns:repeat(auto-fit,minmax(168px,1fr));
           gap:1px; background:var(--hair); border:1px solid var(--hair)}
  .inherit > div{background:var(--panel); padding:20px; text-align:center}
  .inherit .sw{font-family:var(--mono); font-size:10.5px; letter-spacing:.1em;
               color:var(--muted); margin-top:12px; text-transform:uppercase}
  .inherit svg{height:34px; width:auto}

  /* ---- alignment row ---- */
  .rows{display:grid; gap:1px; background:var(--hair); border:1px solid var(--hair)}
  .rowline{display:flex; align-items:center; padding:24px 26px; overflow-x:auto}
  .rowline[data-bg="w"]{background:#FFFFFF; color:#141414}
  .rowline[data-bg="k"]{background:#141414; color:#E8E8E8}
  .rowline svg{display:block; flex:none}
  .rowcap{font-family:var(--mono); font-size:10.5px; letter-spacing:.1em;
          text-transform:uppercase; color:var(--muted); padding:0 26px 0;
          background:var(--panel); line-height:2.6}

  /* ---- the set ---- */
  .icon{display:grid; grid-template-columns:184px 1fr; gap:28px;
        padding:26px 0; border-top:1px solid var(--hair); align-items:start}
  .icon:last-child{border-bottom:1px solid var(--hair)}
  .meta h3{font-family:var(--mono); font-weight:500; font-size:14px;
           letter-spacing:.02em; margin:0 0 10px}
  .meta p{margin:0; font-size:14.5px; line-height:1.5; color:var(--muted)}
  .meta .files{font-family:var(--mono); font-size:11.5px; margin-top:10px;
               line-height:1.8; color:var(--muted)}

  .strips{display:grid; grid-template-columns:1fr 1fr; gap:1px;
          background:var(--hair); border:1px solid var(--hair)}
  .strip{display:flex; align-items:center; gap:22px; padding:20px 22px;
         overflow-x:auto; min-height:96px}
  .strip[data-bg="w"]{background:#FFFFFF; color:#141414}
  .strip[data-bg="k"]{background:#141414; color:#E8E8E8}
  .strip svg{display:block; flex:none}

  /* ---- viewBox comparison ---- */
  .boxes{display:flex; gap:26px; flex-wrap:wrap; align-items:flex-end;
         padding:22px; background:var(--panel);
         border:1px solid var(--hair); border-top:0}
  .box{text-align:center}
  .box .frame{display:inline-block; outline:1px dashed var(--haze); color:var(--ink)}
  .box svg{display:block; height:64px; width:auto}
  .box b{display:block; font-family:var(--mono); font-weight:400; font-size:10.5px;
         letter-spacing:.1em; text-transform:uppercase; color:var(--muted);
         margin-top:10px}

  /* ---- haze constraint ---- */
  .haze{display:grid; grid-template-columns:184px 1fr; gap:28px;
        padding:20px 0; border-top:1px solid var(--hair); align-items:center}
  .haze h3{font-family:var(--mono); font-weight:500; font-size:13px; margin:0}
  .grounds{display:grid; grid-template-columns:repeat(3,1fr); gap:1px;
           background:var(--hair); border:1px solid var(--hair)}
  .g{padding:18px; min-height:120px; display:flex; align-items:center;
     justify-content:center}
  .g svg{height:76px; width:auto; max-width:100%; display:block}
  .g[data-bg="w"]{background:#FFFFFF}
  .g[data-bg="o"]{background:#E8E8E8}
  .g[data-bg="k"]{background:#141414}

  .flag{font-family:var(--mono); font-size:10.5px; letter-spacing:.12em;
        text-transform:uppercase; color:var(--muted); border:1px solid var(--hair);
        padding:5px 9px; display:inline-block; margin-bottom:16px}

  footer{margin-top:12px; color:var(--muted); font-size:15px; max-width:66ch}
  ul.files{font-family:var(--mono); font-size:12.5px; line-height:2; margin:18px 0 0;
           list-style:none; padding:0; color:var(--muted)}
  ul.files b{color:var(--ink); font-weight:500}

  @media (max-width:720px){
    .icon,.haze{grid-template-columns:1fr; gap:14px}
    .strips{grid-template-columns:1fr}
  }
</style>

<div class="wrap">
  <p class="eyebrow">cocoon &middot; icon system</p>
  <h1>One face, borrowed colour</h1>
  <p class="lede">
    Every file here is a single front face with <code>fill="currentColor"</code>
    and no margin it did not earn. The four-plane haze is not in the artwork any
    more &mdash; it is a <em>constraint on which shapes are allowed in</em>, and it
    gets applied downstream in CSS.
  </p>

  <section>
    <h2>The rule the shapes are still chosen against</h2>
    <div class="rule">
      <div><dt>Projected scale</dt>
        <dd>1 : 6/7 : 3/4 : 2/3
          <small>Plane <i>k</i> is the front shape scaled about the camera's
          principal point. Never redrawn.</small></dd></div>
      <div><dt>Placement</dt>
        <dd>centroid &rarr; (&minus;1.30 W, 0)
          <small>Area centroid, holes subtracting. <i>W</i> is the shape's own
          width, so every icon spreads the same 43% of itself.</small></dd></div>
      <div><dt>Design box</dt>
        <dd>1000 on the long side
          <small>Normalised on <code>max(w,h)</code> before filleting. The square
          viewBoxes come out 983&ndash;1000, because a fillet at a pointed tip
          cuts the corner inward and the box is measured on the drawn outline,
          not the polygon.</small></dd></div>
      <div><dt>Stroke &amp; corners</dt>
        <dd>0.15 &middot; box / r 0.02
          <small>One shared stroke weight; fillets convex, tangent to both
          edges.</small></dd></div>
    </div>
  </section>

  <section>
    <h2>Colour is inherited, not baked</h2>
    <p class="note">
      Each of these is the same file. Nothing about them differs except the
      <code>color</code> of the element they sit in.
    </p>
    <div class="inherit" id="inherit"></div>
  </section>

  <section>
    <h2>Tight box vs square box</h2>
    <p class="note">
      The dashed line is the viewBox, not artwork. The tight file has a different
      aspect ratio for every icon, so one CSS size rule cannot serve the set:
      <code>width:24px</code> renders the up arrow 54&nbsp;px tall and the gear 24.
      The square file has equal sides, so one rule sizes everything and the marks
      align without nudging. Both boxes touch the ink on every flush edge &mdash;
      verified by rendering the shipped files and measuring the pixels, not by
      asking the geometry that drew them.
    </p>
    <div id="boxes"></div>
  </section>

  <section>
    <h2>Aligned in a row</h2>
    <p class="note">
      Every square file at one size, gap set to <b>half the icon</b>. This is the
      arrangement the square viewBox exists for, and the only honest test of it:
      whether thirteen different shapes read as one set when they sit side by
      side, at the size they will actually be used at. Look for a mark that
      reads heavier, lighter, larger or higher than its neighbours &mdash;
      nothing in the geometry will tell you that.
    </p>
    <div class="rows" id="rows"></div>
  </section>

  <section>
    <h2>The set</h2>
    <div id="set"></div>
  </section>

  <section>
    <h2>Constraint check &mdash; the haze, not shipped</h2>
    <span class="flag">generated for inspection only &middot; no file carries this</span>
    <p class="note">
      A shape earns its place by still reading as four planes. Watch the small
      end: hollow shapes fill with their own echoes, and that is the failure the
      spec's aperture ceiling exists to catch.
    </p>
    <div id="haze"></div>
  </section>

  <section>
    <h2>Rebuilding it</h2>
    <footer>
      The engine is shape-agnostic: hand it a polygon, a circle, or either
      marked as a hole, and it does the rest. Its regression test feeds the
      logo's own isosceles triangle through it and reproduces all four shipped
      logo files <b>character for character</b>. The build additionally checks
      that each shipped front face is <b>the identical geometry</b> the haze
      system draws as its plane&nbsp;0.
      <ul class="files">
        <li><b>lib/haze.js</b> &mdash; scene, tone, fillets, fill groups, serialiser</li>
        <li><b>shapes.js</b> &mdash; the front shapes, and the set that gets built</li>
        <li><b>build.js</b> &mdash; renders the two files per icon; <b>guards.js</b> holds the checks</li>
        <li><b>icons.test.js</b> &mdash; the guards proven able to fail, and the rebuild regression</li>
        <li><b>cocoon-icon-set-spec.md</b> &mdash; the written spec</li>
      </ul>
    </footer>
  </section>
</div>
`

export const TAIL = `<script>
  const SIZES = [16, 22, 30, 44];
  const SWATCH = [["#141414","house black"],["#6C6C68","muted"],
                  ["#B4442E","accent"],["#FFFFFF","reversed"]];

  const box = vb => vb.split(" ").slice(2)
                      .map(n => Math.round(parseFloat(n))).join("&times;");

  const paths = (ps, extra) => ps.map(([d, eo]) =>
    \`<path d="\${d}" fill="currentColor"\${eo ? ' fill-rule="evenodd"' : ''}/>\`).join("");

  function draw(name, kind, attrs){
    const [vb, ps] = ICONS[name][kind];
    return \`<svg viewBox="\${vb}" xmlns="http://www.w3.org/2000/svg" \${attrs || ""}>\`
         + paths(ps) + \`</svg>\`;
  }

  function drawHaze(name, cut, attrs){
    const h = HAZE[name], cols = PAL[cut];
    let body = "";
    for (let k = h.planes.length - 1; k >= 0; k--)        // back to front
      for (const [d, eo] of h.planes[k])
        body += \`<path d="\${d}" fill="\${cols[k]}"\${eo ? ' fill-rule="evenodd"' : ''}/>\`;
    return \`<svg viewBox="\${h.vb}" xmlns="http://www.w3.org/2000/svg" \${attrs || ""}>\${body}</svg>\`;
  }

  /* colour inheritance */
  document.getElementById("inherit").innerHTML = SWATCH.map(([c, label]) =>
    \`<div style="color:\${c}\${c === "#FFFFFF" ? ";background:#141414" : ""}">
       \${draw("settings", "s", 'height="34"')}
       <div class="sw" \${c === "#FFFFFF" ? 'style="color:#8B8B87"' : ""}>\${label} \${c}</div>
     </div>\`).join("");

  /* tight vs square, on the two icons where they differ most */
  document.getElementById("boxes").innerHTML =
    ["arrow-up", "scroll-top", "menu", "account", "settings"].map(name => {
      const cell = (kind, label) =>
        \`<div class="box"><span class="frame">\${draw(name, kind, 'height="64"')}</span>
           <b>\${label}</b></div>\`;
      return \`<div class="boxes">
                <div class="box"><b style="margin:0 0 10px">\${name}</b></div>
                \${cell("t", "tight " + box(ICONS[name].t[0]))}
                \${cell("s", "square " + box(ICONS[name].s[0]))}
              </div>\`;
    }).join("");

  /* aligned in a row - gap is half the icon size */
  const ROW_SIZES = [16, 24, 32, 48];
  document.getElementById("rows").innerHTML = ROW_SIZES.map(px => {
    const line = bg => \`<div class="rowline" data-bg="\${bg}" style="gap:\${px / 2}px">\${
      Object.keys(ICONS).map(n => draw(n, "s", \`height="\${px}" width="\${px}"\`)).join("")
    }</div>\`;
    return \`<div class="rowcap">\${px} px &middot; \${px / 2} px gap</div>\`
         + line("w") + line("k");
  }).join("");

  /* the set */
  document.getElementById("set").innerHTML = Object.keys(ICONS).map(name => {
    const [role, note] = NOTES[name] || ["", ""];
    const strip = bg => \`<div class="strip" data-bg="\${bg}">\${
      SIZES.map(h => draw(name, "s", \`height="\${h}"\`)).join("")}</div>\`;
    return \`<div class="icon">
      <div class="meta">
        <h3>\${name}</h3>
        <p><b>\${role}</b><br>\${note}</p>
        <div class="files">icon-\${name}.svg<br>icon-\${name}-square.svg</div>
      </div>
      <div><div class="strips">\${strip("w")}\${strip("k")}</div></div>
    </div>\`;
  }).join("");

  /* haze constraint */
  document.getElementById("haze").innerHTML = Object.keys(HAZE).map(name =>
    \`<div class="haze">
       <h3>\${name}</h3>
       <div class="grounds">
         <div class="g" data-bg="w">\${drawHaze(name, "vapour")}</div>
         <div class="g" data-bg="o">\${drawHaze(name, "dense")}</div>
         <div class="g" data-bg="k">\${drawHaze(name, "dense-reversed")}</div>
       </div>
     </div>\`).join("");
</script>
`
