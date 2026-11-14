# Upstream and third-party notices

Paper Shooter is based on iifor/doodleshooter at commit 8d8fad9. Its Git history credits the
original game to Evan Milenko and the Chinese localization and packaging changes to iifor. That
source revision does not contain a license file. This repository preserves the upstream project's
authorship and does not claim to grant rights to inherited code. The PolyForm Noncommercial terms
in LICENSE.md apply only to original contributions by Meyer Pidiache in this fork.

Third-party libraries are now resolved through `pnpm-lock.yaml`. Three.js 0.170.0 and PeerJS 1.5.4
match the previously copied distributions; sirv serves the optional Node deployment. Their runtime
dependency license texts are included in [public/THIRD_PARTY_NOTICES.txt](public/THIRD_PARTY_NOTICES.txt)
and copied into the static artifact. Regenerate them with `pnpm licenses:generate` after changing
production dependencies. Those terms remain with their respective authors; this repository's
LICENSE.md does not replace or extend them.
