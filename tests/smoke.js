// Smoke test (no dependencies, run with `node tests/smoke.js`).
//
// Chrome runs the files in one content_scripts entry in a single shared scope,
// so a top-level `const correctionMap` in two files throws
// "Identifier 'correctionMap' has already been declared" and silently drops the
// whole dictionary. This test loads the data files exactly the way Chrome would
// (concatenated, in manifest order) and asserts the merged map actually exists,
// guarding against that regression. It also sanity-checks the manifest.

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
let ok = true;
function check(cond, msg) {
    if (cond) { console.log('ok   -', msg); }
    else { console.error('FAIL -', msg); ok = false; }
}

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const js = manifest.content_scripts[0].js;

// Load the data files (everything before content.js, which needs the DOM) in
// one shared scope, like the browser does.
const dataFiles = js.filter((f) => f !== 'content.js');
const src =
    dataFiles.map((f) => fs.readFileSync(path.join(root, f), 'utf8')).join('\n') +
    '\n;__RESULT = { cm: correctionMap, vw: validWords };';

const ctx = {};
vm.createContext(ctx);
vm.runInContext(src, ctx); // throws if a const is redeclared

const { cm, vw } = ctx.__RESULT;
check(cm && typeof cm === 'object', 'correctionMap is an object');
check(Object.keys(cm).length > 1000, `correctionMap has many entries (${Object.keys(cm).length})`);
check(cm['yuo'] === 'you', 'curated override is present (yuo -> you)');
// Duck-typed: vw is a Set from the vm realm, so cross-realm `instanceof Set` is false.
check(vw && typeof vw.has === 'function' && vw.size > 0, 'validWords is a non-empty Set');

check(js.indexOf('dictionary.js') < js.indexOf('override.js'), 'dictionary.js loads before override.js');
check(js.includes('validWords.js'), 'validWords.js is listed in the manifest');
js.forEach((f) => check(fs.existsSync(path.join(root, f)), `${f} exists`));
Object.values(manifest.icons).forEach((f) => check(fs.existsSync(path.join(root, f)), `${f} exists`));

console.log(ok ? '\nAll smoke checks passed.' : '\nSmoke checks FAILED.');
process.exit(ok ? 0 : 1);
