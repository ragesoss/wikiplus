# wiki+ — TODO

Pending tasks not yet started. Remove items as they're done.

## Bump CI actions to Node 24-native versions
- **What:** in `.github/workflows/deploy.yml`, bump `actions/checkout@v4` → `@v5` and
  `actions/setup-node@v4` → `@v5`. (`actions/upload-pages-artifact@v3` and `actions/deploy-pages@v4`
  stay — their Node-20 usage is transitive and the runner forces Node 24 regardless.)
- **Why:** the deploy run warns that the v4 actions run on Node 20, which GitHub forces to Node 24 on
  **2026-06-16**. The deploy keeps working either way; this clears the warning and gets ahead of it.
- **Bonus:** a low-risk first change to confirm the cloud → commit → push → Pages loop end to end.
