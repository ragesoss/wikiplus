import { reapE2E } from "./db-server";

// CLI for `yarn e2e:reap` (and `scripts/dev/shots.sh --cleanup`): stop + remove anything the e2e /
// screenshot harness left running after a crashed run — the orphaned ephemeral Postgres + Next web
// server + their datadir. Targets only resources the harness recorded as its OWN (the run registry);
// never a command-line pattern match. `--force` reaps even a run whose owner process still appears
// alive (use when you know no harness should be running). See db-server.ts `reapE2E`.
const force = process.argv.includes("--force");
reapE2E({ force }).catch((e) => {
  console.error(`e2e:reap failed: ${(e as Error).message}`);
  process.exit(1);
});
