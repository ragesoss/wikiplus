import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  SCENES,
  sceneAuth,
  sceneSkins,
  sceneViewports,
  shotName,
  type AuthState,
  type Scene,
  type Skin,
  type Viewport,
} from "../../e2e/screenshots/catalog";

// Build the browsable HTML index for a screenshot run. Reads the catalog (the SINGLE source of
// truth) + the PNGs actually present in the output dir, and writes a self-contained `index.html`
// into that dir. A new scene shows up here automatically; a subset run (only some PNGs present)
// lists only what was produced. Focus scenes (catalog `focus: true`, or ids passed via
// SHOTS_FOCUS) are pinned to the top and badged — the shots a PR wants reviewers to look at first.
//
//   npx tsx scripts/dev/shots-index.ts <outDir>
//
// The index uses relative <img> srcs (it sits beside the PNGs), so it works the same in the
// gitignored working dir and in a committed docs/design/ gallery.

const outDir = process.argv[2] || process.env.SHOTS_OUT || "screenshots/standard";
const focusIds = new Set(
  (process.env.SHOTS_FOCUS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
);

interface Shot {
  file: string;
  viewport: Viewport;
  auth: AuthState;
  skin: Skin;
}

function shotsFor(scene: Scene): Shot[] {
  const shots: Shot[] = [];
  for (const viewport of sceneViewports(scene)) {
    for (const auth of sceneAuth(scene)) {
      for (const skin of sceneSkins(scene)) {
        const file = `${shotName(scene, viewport, auth, skin)}.png`;
        if (existsSync(join(outDir, file))) shots.push({ file, viewport, auth, skin });
      }
    }
  }
  return shots;
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

function authLabel(a: AuthState): string {
  return a === "in" ? "logged-in" : "logged-out";
}

// Scenes that have at least one produced shot, with focus pinned first.
const rendered = SCENES.map((scene) => ({ scene, shots: shotsFor(scene) })).filter(
  (r) => r.shots.length > 0
);
const isFocus = (s: Scene) => !!s.focus || focusIds.has(s.id);
rendered.sort((a, b) => Number(isFocus(b.scene)) - Number(isFocus(a.scene)));

const totalShots = rendered.reduce((n, r) => n + r.shots.length, 0);
const groups = [...new Set(rendered.map((r) => r.scene.group))];

function skinLabel(s: Skin): string {
  return s === "zine-dark" ? "zine-dark" : "light";
}

function figure(scene: Scene, shot: Shot): string {
  const skinTag =
    shot.skin === "light" ? "" : ` · <span class="skin">${esc(skinLabel(shot.skin))}</span>`;
  return `
        <figure class="shot" data-viewport="${shot.viewport}" data-auth="${shot.auth}" data-skin="${shot.skin}">
          <a href="${esc(shot.file)}" target="_blank" rel="noopener">
            <img loading="lazy" src="${esc(shot.file)}" alt="${esc(scene.label)} — ${shot.viewport} ${authLabel(shot.auth)} ${skinLabel(shot.skin)}">
          </a>
          <figcaption><span class="vp">${shot.viewport}</span> · ${authLabel(shot.auth)}${skinTag}</figcaption>
        </figure>`;
}

function sceneBlock(scene: Scene, shots: Shot[]): string {
  const focusBadge = isFocus(scene) ? `<span class="badge focus">focus</span>` : "";
  const haystack = esc(`${scene.label} ${scene.note ?? ""} ${scene.group} ${scene.id}`.toLowerCase());
  return `
      <article class="scene" data-group="${esc(scene.group)}" data-search="${haystack}">
        <h3>${esc(scene.label)} ${focusBadge}<span class="id">${esc(scene.id)}</span></h3>
        ${scene.note ? `<p class="note">${esc(scene.note)}</p>` : ""}
        <div class="shots">${shots.map((s) => figure(scene, s)).join("")}</div>
      </article>`;
}

function groupSection(group: string): string {
  const blocks = rendered
    .filter((r) => r.scene.group === group)
    .map((r) => sceneBlock(r.scene, r.shots))
    .join("");
  return `
    <section class="group" data-group="${esc(group)}">
      <h2>${esc(group)}</h2>
      ${blocks}
    </section>`;
}

const groupFilters = groups
  .map((g) => `<label><input type="checkbox" class="f-group" value="${esc(g)}" checked> ${esc(g)}</label>`)
  .join("");

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>wiki+ screenshots</title>
<style>
  :root { --brand:#676EB4; --ink:#2C2C2C; --gold:#E5AB28; --line:#e3e3ea; }
  * { box-sizing: border-box; }
  body { margin:0; font:15px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif; color:var(--ink); background:#fafafb; }
  header.top { position:sticky; top:0; z-index:5; background:#fff; border-bottom:2px solid var(--ink); padding:14px 20px; }
  header.top h1 { margin:0 0 2px; font-size:20px; }
  header.top h1 .plus { background:var(--brand); color:#fff; padding:0 6px; border-radius:3px; }
  .meta { color:#666; font-size:13px; margin-bottom:10px; }
  .controls { display:flex; flex-wrap:wrap; gap:14px; align-items:center; }
  .controls input[type=search] { padding:6px 10px; border:2px solid var(--ink); border-radius:4px; min-width:200px; font:inherit; }
  .controls fieldset { border:1px solid var(--line); border-radius:6px; padding:4px 10px; margin:0; display:flex; gap:10px; flex-wrap:wrap; }
  .controls legend { font-size:11px; text-transform:uppercase; letter-spacing:.05em; color:#888; padding:0 4px; }
  .controls label { font-size:13px; display:inline-flex; gap:4px; align-items:center; cursor:pointer; }
  main { padding:20px; max-width:1400px; margin:0 auto; }
  section.group { margin:0 0 28px; }
  section.group > h2 { font-size:16px; border-bottom:2px solid var(--brand); padding-bottom:4px; }
  article.scene { margin:0 0 22px; }
  article.scene h3 { font-size:14px; margin:0 0 2px; display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
  article.scene h3 .id { font:12px/1 ui-monospace,monospace; color:#999; }
  .note { margin:0 0 8px; color:#666; font-size:13px; }
  .badge { font-size:10px; text-transform:uppercase; letter-spacing:.05em; padding:1px 6px; border-radius:10px; }
  .badge.focus { background:var(--gold); color:var(--ink); font-weight:700; }
  .shots { display:grid; grid-template-columns:repeat(auto-fill,minmax(230px,1fr)); gap:12px; }
  figure.shot { margin:0; border:1px solid var(--line); border-radius:6px; overflow:hidden; background:#fff; }
  figure.shot img { display:block; width:100%; height:auto; background:#f0f0f3; }
  figure.shot figcaption { font-size:12px; padding:5px 8px; color:#555; border-top:1px solid var(--line); }
  figure.shot .vp { font-weight:700; color:var(--brand); }
  figure.shot .skin { font-weight:700; color:#111; background:#e8e6f3; padding:0 5px; border-radius:8px; }
  .empty { color:#999; padding:40px; text-align:center; }
</style>
</head>
<body>
<header class="top">
  <h1>wiki+ <span class="plus">screenshots</span></h1>
  <div class="meta">${totalShots} shot${totalShots === 1 ? "" : "s"} · ${rendered.length} scene${rendered.length === 1 ? "" : "s"} · generated from <code>e2e/screenshots/catalog.ts</code></div>
  <div class="controls">
    <input type="search" id="search" placeholder="Filter scenes…" aria-label="Filter scenes">
    <fieldset><legend>Viewport</legend>
      <label><input type="checkbox" class="f-vp" value="mobile" checked> mobile</label>
      <label><input type="checkbox" class="f-vp" value="tablet" checked> tablet</label>
      <label><input type="checkbox" class="f-vp" value="desktop" checked> desktop</label>
    </fieldset>
    <fieldset><legend>Auth</legend>
      <label><input type="checkbox" class="f-auth" value="out" checked> logged-out</label>
      <label><input type="checkbox" class="f-auth" value="in" checked> logged-in</label>
    </fieldset>
    <fieldset><legend>Skin</legend>
      <label><input type="checkbox" class="f-skin" value="light" checked> light</label>
      <label><input type="checkbox" class="f-skin" value="zine-dark" checked> zine-dark</label>
    </fieldset>
    <fieldset><legend>Group</legend>${groupFilters}</fieldset>
  </div>
</header>
<main id="gallery">
  ${groups.map(groupSection).join("")}
  <p class="empty" id="empty" hidden>No scenes match the current filters.</p>
</main>
<script>
  const $ = (s, r=document) => [...r.querySelectorAll(s)];
  const search = document.getElementById('search');
  const vps = () => new Set($('.f-vp:checked').map(c => c.value));
  const auths = () => new Set($('.f-auth:checked').map(c => c.value));
  const skins = () => new Set($('.f-skin:checked').map(c => c.value));
  const grps = () => new Set($('.f-group:checked').map(c => c.value));
  function apply() {
    const q = search.value.trim().toLowerCase();
    const vp = vps(), au = auths(), sk = skins(), gr = grps();
    let anyVisible = false;
    $('.scene').forEach(scene => {
      const inGroup = gr.has(scene.dataset.group);
      const matches = !q || scene.dataset.search.includes(q);
      let shotVisible = false;
      $('.shot', scene).forEach(fig => {
        const show = vp.has(fig.dataset.viewport) && au.has(fig.dataset.auth) && sk.has(fig.dataset.skin);
        fig.hidden = !show;
        if (show) shotVisible = true;
      });
      const visible = inGroup && matches && shotVisible;
      scene.hidden = !visible;
      if (visible) anyVisible = true;
    });
    $('.group').forEach(sec => {
      sec.hidden = !$('.scene', sec).some(s => !s.hidden);
    });
    document.getElementById('empty').hidden = anyVisible;
  }
  [search, ...$('.f-vp'), ...$('.f-auth'), ...$('.f-skin'), ...$('.f-group')].forEach(el =>
    el.addEventListener('input', apply));
  apply();
</script>
</body>
</html>
`;

const indexPath = join(outDir, "index.html");
writeFileSync(indexPath, html);
console.log(`shots: wrote ${indexPath} (${totalShots} shots across ${rendered.length} scenes)`);

// A tiny machine-readable manifest beside the index, for any downstream tooling (PR gallery, diff).
const manifest = rendered.flatMap((r) =>
  r.shots.map((s) => ({
    id: r.scene.id,
    group: r.scene.group,
    label: r.scene.label,
    viewport: s.viewport,
    auth: s.auth,
    skin: s.skin,
    file: s.file,
    focus: isFocus(r.scene),
  }))
);
writeFileSync(join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
