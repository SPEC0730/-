/*
 * Bundle the app into one self-contained HTML file (CSS and JS inlined).
 *   node tools/build-single.js            -> dist/dino-math.html (open directly on a tablet)
 *   node tools/build-single.js --fragment <out>  -> page body without <html>/<head>/<body>
 */
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
html = html.replace(/<link rel="stylesheet" href="([^"]+)">/, (m, href) => `<style>\n${fs.readFileSync(path.join(root, href), 'utf8')}\n</style>`);
html = html.replace(/<script src="([^"]+)"><\/script>/g, (m, src) => `<script>\n${fs.readFileSync(path.join(root, src), 'utf8')}\n</script>`);
const args = process.argv.slice(2);
if (args[0] === '--fragment') {
  const head = html.slice(html.indexOf('<head>') + 6, html.indexOf('</head>'));
  const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>'));
  // The host provides its own charset/viewport meta.
  const keep = head.split('\n').filter((l) => !/<meta (charset|name="viewport")/.test(l)).join('\n');
  fs.writeFileSync(args[1], keep.trim() + '\n' + body.trim() + '\n');
  console.log('fragment ->', args[1]);
} else {
  fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
  const out = path.join(root, 'dist', 'dino-math.html');
  fs.writeFileSync(out, html);
  console.log('bundle ->', out, Math.round(html.length / 1024) + 'KB');
}
