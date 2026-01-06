import { type Activity } from "../services/jules";

export {};

// Helper to truncate large diffs to 20KB
const truncateActivities = (
  acts: Activity[],
  truncateDiffs: boolean,
): Activity[] => {
  if (!truncateDiffs) return acts;
  const maxSize = 20 * 1024; // 20KB
  return acts.map((act) => {
    if (!act.artifacts) return act;
    return {
      ...act,
      artifacts: act.artifacts.map((artifact) => {
        if (artifact.changeSet?.gitPatch?.unidiffPatch) {
          const patch = artifact.changeSet.gitPatch.unidiffPatch;
          if (patch.length > maxSize) {
            return {
              ...artifact,
              changeSet: {
                ...artifact.changeSet,
                gitPatch: {
                  ...artifact.changeSet.gitPatch,
                  unidiffPatch:
                    patch.substring(0, maxSize) +
                    "\n\n... (truncated, " +
                    Math.round(patch.length / 1024) +
                    "KB total)",
                },
              },
            };
          }
        }
        if (artifact.bashOutput?.output) {
          const output = artifact.bashOutput.output;
          if (output.length > maxSize) {
            return {
              ...artifact,
              bashOutput: {
                output:
                  output.substring(0, maxSize) +
                  "\n\n... (truncated, " +
                  Math.round(output.length / 1024) +
                  "KB total)",
              },
            };
          }
        }
        return artifact;
      }),
    };
  });
};

self.onmessage = (
  e: MessageEvent<{ activities: Activity[]; truncateDiffs: boolean }>,
) => {
  const { activities, truncateDiffs } = e.data;
  const processed = truncateActivities(activities, truncateDiffs);
  self.postMessage(processed);
};
