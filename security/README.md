# Temporary Picomatch mitigation

Reviewed 17 November 2026 for [GHSA-fc5q-39xc-vjpf / CVE-2026-112366](https://github.com/advisories/GHSA-fc5q-39xc-vjpf).
The published advisory affects Picomatch through 4.0.7 and has no patched release.
The linked upstream PR #194 explicitly does not fix `+(*a)`.

pnpm's `patchedDependencies` patches Picomatch 2.3.2 and 4.0.7. The install hook
also patches reviewed residual copies restored from an older build cache, then
verifies every physical copy, including nested dependencies. The patch files
are also included before dependency installation in the API Docker build.
The production-only deploy permits unused build-tool patches for that prune
operation and then verifies the deployed dependency tree. Normal installs retain
strict unused-patch checking.
A guard in `extglobOpen` rejects recognized `+(...)` and
`*(...)` extglobs before a regular expression can be constructed. This deliberately
disables repeated extglobs, including otherwise benign ones. Ordinary stars,
globstars, braces, optional/negative extglobs, and `@(...)` remain available.
This is a mitigation for this advisory, not a general sanitizer for arbitrary
regular expressions or Picomatch's low-level `toRegex`/`compileRe` APIs.

The helper recognizes exact reviewed upstream parser SHA-256 hashes, inserts
the guard at one exact location, and verifies the entire resulting source.
Unknown versions, changed source, missing guards, or duplicated/moved guards
fail closed. Atomic replacement avoids modifying pnpm's shared hard-linked store.
Do not install with lifecycle scripts disabled; verification rejects unpatched
copies. Dependency upgrades require reviewing the helper or removing it once an
upstream fix is available.

CI still obtains and prints the complete live package-manager audit report. The
guarded audit accepts only this exact Picomatch advisory and its npm transitive
metadata, after verifying all installed copies and affected npm paths. Other
findings, malformed/incomplete reports, and network/command failures fail the
gate at its existing severity threshold. The upstream advisory remains visible;
this does not claim the registry audit is clean. Existing full audit artifacts
and Go/image vulnerability checks remain in place.

Regression tests exercise malicious patterns through all parsing entry points,
options that could bypass upstream mitigations, a hard child-process timeout,
normal tool globs, nested installations, tampering, unrelated advisories, and
incomplete audit responses. Builds, tests, exports, and browser integration checks
must pass before merging changes to this mitigation.

Remove the pnpm patches, install verification, helper, and conditional audit handling together after
upgrading every locked copy to a reviewed upstream release that fixes the advisory.
