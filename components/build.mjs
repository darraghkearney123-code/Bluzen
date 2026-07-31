/**
 * Compiles MidweekCheckIn.jsx to MidweekCheckIn.js, which is the file the
 * check-in page actually loads. The .jsx stays the source of truth. The .js is
 * generated and committed, so a client on bad broadband is not waiting on Babel
 * and the page needs nothing from a CDN.
 *
 *     npm i @babel/core @babel/preset-react
 *     node components/build.mjs
 *
 * Or without installing anything:
 *
 *     npx --yes -p @babel/core@7 -p @babel/preset-react@7 node components/build.mjs
 *
 * Run it with --check to verify the committed .js matches the .jsx without
 * writing anything. That is what the test suite does, so the two cannot drift
 * apart quietly.
 *
 * Output is a plain script, not a module: it reads window.React and hangs
 * MidweekCheckIn off window. That keeps checkin.html free of import maps and
 * module resolution, which is one less thing to go wrong on an old phone.
 */

import fs from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

/* createRequire, not import, so the npx -p invocation above resolves. NODE_PATH
   applies to require and not to ESM specifiers. */
const require = createRequire(import.meta.url);
let babel;
try {
  babel = require('@babel/core');
  require.resolve('@babel/preset-react');
} catch {
  console.error(
    'Could not find @babel/core and @babel/preset-react.\n' +
      'Either:  npm i @babel/core @babel/preset-react\n' +
      'Or:      npx --yes -p @babel/core@7 -p @babel/preset-react@7 node components/build.mjs'
  );
  process.exit(2);
}

const SRC = fileURLToPath(new URL('./MidweekCheckIn.jsx', import.meta.url));
const OUT = fileURLToPath(new URL('./MidweekCheckIn.js', import.meta.url));

const source = fs.readFileSync(SRC, 'utf8');

const compiled = babel
  .transformSync(source, {
    presets: [[require.resolve('@babel/preset-react'), { runtime: 'classic' }]],
    filename: 'MidweekCheckIn.jsx',
    sourceType: 'module',
    babelrc: false,
    configFile: false,
    compact: false,
    comments: true,
  })
  .code // hooks come in off the React global instead
  .replace(/^import[^\n]*\n/, '')
  .replace(/^export default function/m, 'function');

const banner =
  '/* GENERATED FILE, DO NOT EDIT.\n' +
  ' *\n' +
  ' * Built from MidweekCheckIn.jsx by components/build.mjs. Edit the .jsx and\n' +
  ' * rebuild:  node components/build.mjs\n' +
  ' *\n' +
  ' * Committed on purpose. checkin.html loads this directly, so there is no\n' +
  ' * build step and no CDN between a client and their check-in.\n' +
  ' */\n';

const body =
  banner +
  '(function (global, React) {\n' +
  "  'use strict';\n" +
  '  if (!React) throw new Error('
  + "'MidweekCheckIn needs React on the page before it loads.');\n" +
  '  var useEffect = React.useEffect,\n' +
  '    useMemo = React.useMemo,\n' +
  '    useRef = React.useRef,\n' +
  '    useState = React.useState;\n\n' +
  compiled.replace(/^/gm, '  ').replace(/[ \t]+$/gm, '') +
  '\n  global.MidweekCheckIn = MidweekCheckIn;\n' +
  '})(typeof window !== \'undefined\' ? window : this, typeof window !== \'undefined\' ? window.React : undefined);\n';

const check = process.argv.includes('--check');
const existing = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : null;

if (check) {
  if (existing === body) {
    console.log('MidweekCheckIn.js is up to date with the .jsx');
    process.exit(0);
  }
  console.error(
    existing === null
      ? 'MidweekCheckIn.js is missing. Run: node components/build.mjs'
      : 'MidweekCheckIn.js is stale. Run: node components/build.mjs'
  );
  process.exit(1);
}

if (existing === body) {
  console.log('MidweekCheckIn.js already up to date');
} else {
  fs.writeFileSync(OUT, body);
  console.log('wrote MidweekCheckIn.js (' + Math.round(body.length / 1024) + 'kb)');
}
