// Hard gate: assert the packaged macOS .app carries a VALID code signature.
//
// On Apple Silicon every Mach-O must be signed to execute at all — an *invalid* signature is worse
// than none: the kernel refuses to map the binary and Gatekeeper reports "RetroPlaningStudio is
// damaged and can't be opened. You should move it to the Trash", which reads like a corrupt download
// and which `xattr -dr com.apple.quarantine` does NOT fix.
//
// Why this exists (a bug that shipped in a sibling project, artlux): ad-hoc signing the app in an
// `afterPack` hook while also setting `electronFuses` silently produces a broken app, because
// electron-builder flips fuses AFTER afterPack (it rewrites bytes in the Electron binary — see "the
// fuses MUST be flipped right before signing" in app-builder-lib/platformPackager). The hook's
// signature was invalidated, and with no Developer ID the built-in signing step re-signed nothing.
// Nothing in the build went red.
//
// Here the signature comes from electron-builder itself (`mac.identity: "-"`, `hardenedRuntime: false`,
// `electronFuses.resetAdHocDarwinSignature: true`), which signs after the fuse flip. This script is the
// tripwire proving it stayed that way. No-op off macOS.
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

if (process.platform !== 'darwin') {
  console.log('[verify-mac-signature] not macOS — skipped');
  process.exit(0);
}

const PRODUCT = 'RetroPlaningStudio';
const releaseDir = path.join(__dirname, '..', 'release');

// electron-builder emits release/mac-arm64/<Product>.app, release/mac-x64/… or release/mac/….
const apps = fs.existsSync(releaseDir)
  ? fs
      .readdirSync(releaseDir)
      .filter((d) => d === 'mac' || d.startsWith('mac-'))
      .filter((d) => fs.statSync(path.join(releaseDir, d)).isDirectory())
      .flatMap((d) =>
        fs
          .readdirSync(path.join(releaseDir, d))
          .filter((e) => e.endsWith('.app'))
          .map((e) => path.join(releaseDir, d, e))
      )
  : [];

if (apps.length === 0) {
  console.error(`[verify-mac-signature] no .app found under ${releaseDir}/mac*/ — nothing to verify`);
  process.exit(1);
}

let failed = false;
for (const app of apps) {
  if (path.basename(app) !== `${PRODUCT}.app`) {
    console.warn(`[verify-mac-signature] unexpected bundle name ${path.basename(app)} (expected ${PRODUCT}.app)`);
  }
  console.log(`[verify-mac-signature] verifying ${app}`);
  // --deep --strict is the right call for VERIFYING (unlike signing, where Apple discourages --deep):
  // it walks every nested helper, framework and .node addon rather than just the outer bundle.
  const res = spawnSync('codesign', ['--verify', '--deep', '--strict', '--verbose=2', app], { stdio: 'inherit' });
  if (res.status !== 0) {
    console.error(`[verify-mac-signature] INVALID signature: ${app}`);
    failed = true;
    continue;
  }
  // Print the signing authority / CDHash for the build log. `codesign --display` writes to stderr.
  spawnSync('codesign', ['--display', '--verbose=4', app], { stdio: 'inherit' });
}

if (failed) {
  console.error(
    '[verify-mac-signature] FAILED — the dmg would install an app macOS calls "damaged". ' +
      'Check that electronFuses are flipped BEFORE signing and that mac.identity is set.'
  );
  process.exit(1);
}
console.log('[verify-mac-signature] OK');
