/* sync-web.js — מעתיק את נכסי המקור (src/) לתיקיית web/ להרצה בדפדפן.
 * src/ הוא מקור-האמת. web/ הוא עותק להרצה ללא Electron (localStorage).
 * שימוש: npm run sync:web
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const src = path.join(root, 'src');
const web = path.join(root, 'web');

// קבצים/תיקיות להעתקה (לא כולל main.js / preload.js — ייחודיים ל-Electron)
const ASSETS = ['index.html', 'styles.css', 'app.js', 'blocks.js', 'data'];

function copyRecursive(from, to) {
  const stat = fs.statSync(from);
  if (stat.isDirectory()) {
    if (!fs.existsSync(to)) fs.mkdirSync(to, { recursive: true });
    for (const name of fs.readdirSync(from)) copyRecursive(path.join(from, name), path.join(to, name));
  } else {
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to);
  }
}

if (!fs.existsSync(web)) fs.mkdirSync(web, { recursive: true });
for (const a of ASSETS) {
  const from = path.join(src, a);
  if (!fs.existsSync(from)) continue;
  copyRecursive(from, path.join(web, a));
}
console.log('✓ web/ סונכרן מ-src/ (' + ASSETS.join(', ') + ')');
