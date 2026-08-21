// ---
// purpose: Entry point for the headless suite — node tests/parser.test.js
// exports: nothing (exits 1 on any failure)
// depends: tests/harness.js, syntax/fixture/exports/real .test.js
// ---
'use strict';
const { report } = require('./harness');

require('./syntax.test').run();
require('./fixture.test').run();
require('./exports.test').run();
require('./topics.test').run();
require('./sort.test').run();
require('./real.test').run();

process.exit(report() ? 0 : 1);
