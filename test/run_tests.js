// Cross-check engine.js against Python's email.message + mimetypes on the corpus.
const { execFileSync } = require('child_process');
const fs = require('fs');
const M = require('../engine.js');

const oracle = JSON.parse(execFileSync('python3', ['test/oracle.py', 'test/corpus']).toString());
let checked = 0, fails = 0;
function ok(c, label) { checked++; if (!c) { fails++; if (fails <= 8) console.log('FAIL', label); } }

for (const fn of Object.keys(oracle)) {
  if (fn === '_ext') continue;
  const src = fs.readFileSync('test/corpus/' + fn, 'utf8');
  const js = M.parse(src);
  const py = oracle[fn];
  ok(js.type === py.type && js.subtype === py.subtype, fn + ' type/subtype js=' + js.type + '/' + js.subtype + ' py=' + py.type + '/' + py.subtype);
  const jp = JSON.stringify(js.params), pp = JSON.stringify(py.params.filter(p => TOKENish(p)));
  ok(jp === pp, fn + ' params js=' + jp + ' py=' + pp);
}
function TOKENish(p) { return true; }

// extension map vs mimetypes (where they disagree, engine must match python or be flagged)
const exts = oracle._ext;
for (const ext of Object.keys(M.EXT)) {
  checked++;
  if (exts[ext] && exts[ext] !== M.EXT[ext]) { fails++; console.log('EXT DIFF', ext, 'js=' + M.EXT[ext], 'py=' + exts[ext]); }
}

// explanation sanity
const notes = f => M.explain(M.parse(fs.readFileSync('test/corpus/' + f, 'utf8')), fs.readFileSync('test/corpus/' + f, 'utf8')).map(n => n.text).join('\n');
ok(notes('default-charset.txt').includes('No charset'), 'default-charset note');
ok(notes('case-fold.txt').includes('Case folding'), 'case-fold note');
ok(notes('vendor-suffix.txt').includes('+json'), 'suffix note');
ok(notes('boundary.txt').includes('boundary'), 'boundary note');
ok(notes('svg-charset.txt').includes('meaningless'), 'svg charset note');
ok(notes('octet.txt').includes('octet-stream'), 'octet note');
ok(notes('whitespace.txt').includes('charset'), 'whitespace parsed');
ok(M.parse('application/json').suffix === null, 'no suffix on plain json');
ok(M.parse('application/ld+json').suffix === 'json', 'ld+json suffix');
ok(M.parse('application/vnd.api+json').tree === 'vnd', 'vnd tree');
console.log(`checked=${checked} fails=${fails}`);
process.exit(fails ? 1 : 0);
