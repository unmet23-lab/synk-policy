# SYNK Platform common Preview release

The checked `release-input.json` and `source/` directory are one immutable source snapshot for Windows x64, macOS arm64 and macOS x64. Both the homepage and the installed Platform read `https://synk.im/desktop/releases/preview.json`. Do not patch an installed ASAR as a release or replace bytes under an existing version/tag.

## Release sequence

1. Increase the semantic version and build ID in a release definition. Freeze reviewed product source with `tools/freeze-platform-release.cjs --source=<desktop> --out=<new-snapshot> --definition=<definition.json>`.
2. Build Windows with `tools/build-platform-release.cjs` on Windows. Commit the same frozen snapshot here and run `desktop-platform-unified.yml` for both Mac architectures. The draft release must already exist. Preserve native QA, build reports and artifact descriptors. The builder verifies all frozen bytes and pins its public runtime baseline.
3. Use `tools/assemble-platform-release.cjs --release=<snapshot> --report=<windows-report> --report=<arm64-report> --report=<x64-report> --remote-assets=<gh-release-assets.json> --out=<preview.json>` after all native QA passes. Remote asset proof is only for already uploaded, digest-matching draft assets.
4. Run `tools/publish-platform-release.cjs --manifest=<preview.json> --artifacts=<installers> --public=<clean-public-checkout> --client=<desktop-release.js> --remote-artifacts --website=<website-source>` for preflight, then add `--apply`. Omit `--remote-artifacts` when all installers are local. The publisher never rebuilds: it verifies uploaded/public bytes before committing the homepage links and feed together. It rejects partial platform sets, changed bytes under the same version, and concurrent changes to public main.
5. Verify the live feed and Korean/English homepage after Pages completes. Install the very same published Windows installer locally and compare its payload inventory. Update source/operation records with the public commit and checksums.

The website source keeps the same canonical manifest at `desktop/releases/preview.json`; its normal build uses that manifest rather than hard-coded installer links. Build scripts and this workflow do not advance the public feed on their own; the common publisher is the release entry point.

## Installed client behavior

Platform 0.4.4 and later check the feed at startup and every six hours. The user can check immediately, download the verified installer, and choose installation. Windows protects unsaved drafts, exits, and opens the regular Signal installer; its Install button still requires user action. macOS opens the verified DMG for manual installation. No account/profile migration is performed. Preview signing/notarization remains deferred.

Older clients without the updater need one installation of 0.4.4 or later from the homepage. WORLD and Workspace have their own product versions; this feed updates Platform only.
