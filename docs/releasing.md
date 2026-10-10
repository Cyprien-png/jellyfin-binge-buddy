# Releasing

1. Open a pull request into `master` and add a label. The release drafter uses the label, not the `fix:` prefix in the title.

   | Label | Next version after `v1.0.1` |
   |---|---|
   | `fix`, `patch`, or `chore` | `v1.0.2` |
   | `feature` or `minor` | `v1.1.0` |
   | `major` | `v2.0.0` |

   With no label, the version is still a patch, but the pull request is left out of the Bug Fixes section.

2. Merge into `master`. The changelog workflow updates the release draft and sets the tag (`v1.0.2`).

3. Publish that draft. Do not leave it as a draft. Publishing creates the git tag and starts the build.

The publish workflow checks out `master`, not the tag commit. It compiles that branch, writes the four-part version (`1.0.2.0`) into `manifest.json` using the `targetAbi` from `build.yaml`, and attaches the zip to the GitHub release.

`targetAbi` must already be on `master` before you publish. It is catalog metadata, not something compiled into the DLL.
