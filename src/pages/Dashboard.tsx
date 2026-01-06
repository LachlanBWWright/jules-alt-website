import { useEffect, useState, useCallback } from "react";
import { useApiKey } from "@/context/ApiKeyContext";
import { listSessions, type Session } from "@/services/jules";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { Loader2, Plus, Settings } from "lucide-react";

export default function Dashboard() {
  const { apiKey } = useApiKey();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const loadSessions = useCallback(async () => {
    if (!apiKey) return;
    try {
      setLoading(true);
      const data = await listSessions(apiKey);
      setSessions(data);
      setError(null);
    } catch (err: unknown) {
      console.error(err);
      setError("Failed to load sessions. Please check your API key.");
    } finally {
      setLoading(false);
    }
  }, [apiKey]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  // Helper to format state for display
  const getStateDisplay = (state?: string) => {
    const stateMap: Record<string, { label: string; className: string }> = {
      STATE_UNSPECIFIED: {
        label: "Unknown",
        className: "bg-gray-500/20 text-gray-400",
      },
      QUEUED: {
        label: "Queued",
        className: "bg-yellow-500/20 text-yellow-400",
      },
      PLANNING: {
        label: "Planning",
        className: "bg-blue-500/20 text-blue-400",
      },
      AWAITING_PLAN_APPROVAL: {
        label: "Awaiting Approval",
        className: "bg-orange-500/20 text-orange-400",
      },
      AWAITING_USER_FEEDBACK: {
        label: "Needs Feedback",
        className: "bg-purple-500/20 text-purple-400",
      },
      IN_PROGRESS: {
        label: "In Progress",
        className: "bg-blue-500/20 text-blue-400",
      },
      PAUSED: { label: "Paused", className: "bg-gray-500/20 text-gray-400" },
      FAILED: { label: "Failed", className: "bg-red-500/20 text-red-400" },
      COMPLETED: {
        label: "Completed",
        className: "bg-green-500/20 text-green-400",
      },
    };
    return stateMap[state || "STATE_UNSPECIFIED"] || stateMap.STATE_UNSPECIFIED;
  };

  return (
    <div className="container mx-auto py-10 px-4 min-h-screen bg-background">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Your Sessions</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate("/settings")}
            title="Settings"
          >
            <Settings className="h-4 w-4" />
          </Button>
          <Button onClick={() => navigate("/new-session")}>
            <Plus className="mr-2 h-4 w-4" />
            New Session
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/15 text-destructive p-4 rounded-md mb-6">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {sessions.length === 0 ? (
            <p className="text-muted-foreground text-center py-10">
              No sessions found. Create one to get started!
            </p>
          ) : (
            sessions.map((session) => {
              const stateDisplay = getStateDisplay(session.state);
              return (
                <Card
                  key={session.name}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => navigate(`/${session.name}`)}
                >
                  <div className="flex items-center justify-between p-4 py-3 gap-4">
                    <div className="flex-1 min-w-0">
                      <h3
                        className="text-sm font-medium truncate"
                        title={session.title}
                      >
                        {session.title || "Untitled Session"}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {session.createTime
                          ? new Date(session.createTime).toLocaleString()
                          : "No date"}
                      </p>
                    </div>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${stateDisplay.className}`}
                    >
                      {stateDisplay.label}
                    </span>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
