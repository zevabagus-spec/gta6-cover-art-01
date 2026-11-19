// Neon Coast — round 2 entry program for gta6-cover-art-01 (Node 22, stdlib only).
// The program hands the app in: it copies this repository's app/ and screenshots/
// into /output and writes /output/dossier.json with the vendored make.fun library.
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

if (!existsSync(join(here, 'app', 'index.html'))) {
  throw new Error('app/index.html is missing: nothing to hand in');
}
mkdirSync(out, { recursive: true });
cpSync(join(here, 'app'), join(out, 'app'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The gate's own caps (reference/gate.json): only text_max_bytes shapes the
// dossier bytes; the rest refuse an entry the scorer would refuse outright
// (more than 4 screenshots or one over 256 KiB; more than 993 files in app/ or
// 48 MiB of app files in all, or a path under app/ over 1000 bytes; app/
// counts beside /output's own 1000-entry cap and its screenshots/ and
// dossier.json). Round 2 rebuild: same hand-in, fonts fetched fresh in-session.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 50331648,
    app_path_max_bytes: 1000,
  }),
);
