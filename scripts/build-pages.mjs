import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
let html = await readFile(resolve(root, "dist/index.html"), "utf8");
const script = html.match(
  /<script\b[^>]*src="(\/assets\/[^\"]+\.js)"[^>]*><\/script>/,
);
const style = html.match(/<link\b[^>]*href="(\/assets\/[^\"]+\.css)"[^>]*>/);
if (!script || !style)
  throw new Error(
    "Expected a production JavaScript bundle and stylesheet. Run npm run build first.",
  );
const js = (
  await readFile(resolve(root, "dist", script[1].slice(1)), "utf8")
).replace(/<\/script/gi, "<\\/script");
const css = (
  await readFile(resolve(root, "dist", style[1].slice(1)), "utf8")
).replace(/<\/style/gi, "<\\/style");
html = html.replace(
  script[0],
  () => `<script type="module">\n${js}\n</script>`,
);
html = html.replace(style[0], () => `<style>\n${css}\n</style>`);
const favicon = (await readFile(resolve(root, "dist/favicon.svg"))).toString(
  "base64",
);
html = html.replace(
  'href="/favicon.svg"',
  `href="data:image/svg+xml;base64,${favicon}"`,
);
html = html.replace(
  '<div id="root"></div>',
  '<noscript>Chrome 또는 Edge에서 JavaScript를 켜고 열어 주세요.</noscript><div id="root"></div>',
);
await mkdir(resolve(root, "docs"), { recursive: true });
await writeFile(resolve(root, "docs/index.html"), html);
await writeFile(resolve(root, "docs/.nojekyll"), "");
console.log(
  "GitHub Pages build generated in docs/. Publish main with Pages source /docs.",
);
