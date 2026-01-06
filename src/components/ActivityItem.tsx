import React from "react";
import {
  Bot,
  User,
  ListChecks,
  CheckCircle,
  Activity as ActivityIcon,
  FileCode,
  Expand,
  XCircle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { type Activity, type Session } from "@/services/jules";

interface ActivityItemProps {
  activity: Activity;
  session: Session | null;
  time: string;
  approvingPlan: string | null;
  onApprovePlan: (planId: string) => void;
  onExpandDiff: (title: string, content: string) => void;
}

const getActivityType = (activity: Activity) => {
  if (activity.agentMessaged) return "agent";
  if (activity.userMessaged) return "user";
  if (activity.planGenerated) return "plan";
  if (activity.planApproved) return "planApproved";
  if (activity.progressUpdated) return "progress";
  if (activity.sessionCompleted) return "completed";
  if (activity.sessionFailed) return "failed";
  return "unknown";
};

export const ActivityItem = React.memo(
  ({
    activity,
    session,
    time,
    approvingPlan,
    onApprovePlan,
    onExpandDiff,
  }: ActivityItemProps) => {
    const type = getActivityType(activity);

    switch (type) {
      case "agent":
        return (
          <div className="flex gap-3 p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                <Bot className="h-4 w-4 text-blue-400" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium text-blue-400">Jules</span>
                {time && (
                  <span className="text-xs text-muted-foreground">{time}</span>
                )}
              </div>
              <div className="text-sm whitespace-pre-wrap">
                {activity.agentMessaged?.agentMessage}
              </div>
            </div>
          </div>
        );

      case "user":
        return (
          <div className="flex gap-3 p-4 bg-purple-500/10 rounded-lg border border-purple-500/20">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                <User className="h-4 w-4 text-purple-400" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium text-purple-400">You</span>
                {time && (
                  <span className="text-xs text-muted-foreground">{time}</span>
                )}
              </div>
              <div className="text-sm whitespace-pre-wrap">
                {activity.userMessaged?.userMessage}
              </div>
            </div>
          </div>
        );

      case "plan": {
        const plan = activity.planGenerated?.plan;
        return (
          <div className="p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
            <div className="flex items-center gap-2 mb-3">
              <ListChecks className="h-4 w-4 text-yellow-400" />
              <span className="text-sm font-medium text-yellow-400">
                Plan Generated
              </span>
              {time && (
                <span className="text-xs text-muted-foreground">{time}</span>
              )}
            </div>
            {plan?.steps && plan.steps.length > 0 && (
              <ol className="list-decimal list-inside space-y-2 mb-4">
                {plan.steps.map((step, stepIndex) => (
                  <li key={stepIndex} className="text-sm">
                    <span className="font-medium text-gray-200">
                      {step.title}
                    </span>
                    {step.description && (
                      <p className="text-muted-foreground ml-5 mt-1">
                        {step.description}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            )}
            {session?.state === "AWAITING_PLAN_APPROVAL" && plan?.id && (
              <div className="flex justify-end border-t border-yellow-500/20 pt-3">
                <Button
                  size="sm"
                  variant="default"
                  className="bg-yellow-600 hover:bg-yellow-700 text-white"
                  onClick={() => onApprovePlan(plan.id)}
                  disabled={!!approvingPlan}
                >
                  {approvingPlan === plan.id ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  )}
                  Approve Plan
                </Button>
              </div>
            )}
          </div>
        );
      }

      case "planApproved":
        return (
          <div className="flex items-center gap-2 p-3 bg-green-500/10 rounded-lg border border-green-500/20">
            <CheckCircle className="h-4 w-4 text-green-400" />
            <span className="text-sm text-green-400">Plan Approved</span>
            {time && (
              <span className="text-xs text-muted-foreground">{time}</span>
            )}
          </div>
        );

      case "progress":
        return (
          <div className="p-4 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
            <div className="flex items-center gap-2 mb-2">
              <ActivityIcon className="h-4 w-4 text-cyan-400" />
              <span className="text-sm font-medium text-cyan-400">
                {activity.progressUpdated?.title || "Progress Update"}
              </span>
              {time && (
                <span className="text-xs text-muted-foreground">{time}</span>
              )}
            </div>
            {activity.progressUpdated?.description && (
              <p className="text-sm text-muted-foreground">
                {activity.progressUpdated.description}
              </p>
            )}
            {/* Show artifacts if present */}
            {activity.artifacts && activity.artifacts.length > 0 && (
              <div className="mt-3 space-y-2">
                {activity.artifacts.map((artifact, artifactIndex) => {
                  if (artifact.changeSet?.gitPatch) {
                    const patch = artifact.changeSet.gitPatch.unidiffPatch;
                    const commitMsg =
                      artifact.changeSet.gitPatch.suggestedCommitMessage;
                    return (
                      <div
                        key={artifactIndex}
                        className="bg-gray-800 rounded p-3"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <FileCode className="h-4 w-4 text-gray-400" />
                            <span className="text-xs text-gray-400">
                              Code Changes
                            </span>
                          </div>
                          {patch && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-xs text-gray-400 hover:text-white"
                              onClick={() =>
                                onExpandDiff(commitMsg || "Code Changes", patch)
                              }
                            >
                              <Expand className="h-3 w-3 mr-1" />
                              Expand
                            </Button>
                          )}
                        </div>
                        {commitMsg && (
                          <p className="text-sm mb-2 text-gray-300">
                            {commitMsg}
                          </p>
                        )}
                        {patch && (
                          <pre className="text-xs overflow-hidden text-gray-400 max-h-32 relative">
                            {patch.slice(0, 1000)}
                            {patch.length > 1000 && (
                              <span className="text-gray-500">
                                {"\n"}... (click Expand to see full diff)
                              </span>
                            )}
                          </pre>
                        )}
                      </div>
                    );
                  }
                  if (artifact.bashOutput?.output) {
                    const output = artifact.bashOutput.output;
                    return (
                      <div
                        key={artifactIndex}
                        className="bg-gray-800 rounded p-3"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <ActivityIcon className="h-4 w-4 text-gray-400" />
                            <span className="text-xs text-gray-400">
                              Terminal Output
                            </span>
                          </div>
                          {output && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-xs text-gray-400 hover:text-white"
                              onClick={() =>
                                onExpandDiff("Terminal Output", output)
                              }
                            >
                              <Expand className="h-3 w-3 mr-1" />
                              Expand
                            </Button>
                          )}
                        </div>
                        {output && (
                          <pre className="text-xs overflow-hidden text-gray-400 max-h-32 relative">
                            {output.slice(0, 1000)}
                            {output.length > 1000 && (
                              <span className="text-gray-500">
                                {"\n"}... (click Expand to see full output)
                              </span>
                            )}
                          </pre>
                        )}
                      </div>
                    );
                  }
                  return null;
                })}
              </div>
            )}
          </div>
        );

      case "completed":
        return (
          <div className="flex items-center gap-2 p-4 bg-green-500/10 rounded-lg border border-green-500/20">
            <CheckCircle className="h-5 w-5 text-green-400" />
            <span className="text-sm font-medium text-green-400">
              Session Completed
            </span>
            {time && (
              <span className="text-xs text-muted-foreground">{time}</span>
            )}
          </div>
        );

      case "failed":
        return (
          <div className="p-4 bg-red-500/10 rounded-lg border border-red-500/20">
            <div className="flex items-center gap-2 mb-2">
              <XCircle className="h-5 w-5 text-red-400" />
              <span className="text-sm font-medium text-red-400">
                Session Failed
              </span>
              {time && (
                <span className="text-xs text-muted-foreground">{time}</span>
              )}
            </div>
            {activity.sessionFailed?.reason && (
              <p className="text-sm text-red-300">
                {activity.sessionFailed.reason}
              </p>
            )}
          </div>
        );

      default:
        return (
          <div className="p-3 bg-gray-500/10 rounded-lg border border-gray-500/20">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-muted-foreground">
                {activity.originator || "System"}
              </span>
              {time && (
                <span className="text-xs text-muted-foreground">{time}</span>
              )}
            </div>
            <p className="text-sm">
              {activity.description || "Activity occurred"}
            </p>
          </div>
        );
    }
  },
);

ActivityItem.displayName = "ActivityItem";
