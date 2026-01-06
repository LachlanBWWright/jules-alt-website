import React, {
  useEffect,
  useLayoutEffect,
  useState,
  useRef,
  useCallback,
} from "react";
import { toast } from "sonner";
import { useParams, useNavigate } from "react-router-dom";
import { useSettings } from "@/context/ApiKeyContext";
import {
  getSession,
  sendMessage,
  approvePlan,
  listActivities,
  type Activity,
  type Session,
} from "@/services/jules";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, ArrowLeft, Send, FileCode } from "lucide-react";
import { ActivityItem } from "@/components/ActivityItem";

export default function SessionView() {
  const { apiKey, truncateDiffs, pageSize } = useSettings();
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [approvingPlan, setApprovingPlan] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Advanced Paging State
  const [tokens, setTokens] = useState<string[]>(() => {
    const saved = localStorage.getItem(`jules_tokens_${name}`);
    return saved ? JSON.parse(saved) : [""];
  });
  const [topIndex, setTopIndex] = useState(0);
  const [bottomIndex, setBottomIndex] = useState(0);
  const [isCatchingUp, setIsCatchingUp] = useState(false);

  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreHistory, setHasMoreHistory] = useState(false);

  const [selectedDiff, setSelectedDiff] = useState<{
    title: string;
    content: string;
  } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const loadingMoreRef = useRef(false); // Ref to prevent duplicate loads
  const scrollHeightBeforeRef = useRef(0); // Track scroll height before adding new content
  const scrollTopBeforeRef = useRef(0); // Track scroll top before adding new content
  const shouldRestoreScrollRef = useRef(false); // Flag to trigger scroll restoration

  // Perspective: tokens[0] is the start of the session.
  // tokens[tokens.length - 1] is the furthest forward we've been.

  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    workerRef.current = new Worker(
      new URL("../workers/activity.worker.ts", import.meta.url),
      { type: "module" },
    );

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const processActivities = useCallback(
    (acts: Activity[]): Promise<Activity[]> => {
      return new Promise((resolve) => {
        if (!workerRef.current) {
          resolve(acts);
          return;
        }

        const handleMessage = (e: MessageEvent<Activity[]>) => {
          workerRef.current?.removeEventListener("message", handleMessage);
          resolve(e.data);
        };

        workerRef.current.addEventListener("message", handleMessage);
        workerRef.current.postMessage({ activities: acts, truncateDiffs });
      });
    },
    [truncateDiffs],
  );

  const sessionName = `sessions/${name}`;

  const loadData = useCallback(async () => {
    if (!apiKey || !name) return;
    try {
      setLoading(true);
      const sessionData = await getSession(apiKey, sessionName);
      setSession(sessionData);

      // Always start from the beginning (empty token) to get full history in order
      let currentToken: string | undefined = "";
      let currentIndex = 0;
      const updatedTokens: string[] = [""];
      const allActivities: Activity[] = [];

      setIsCatchingUp(true);
      setTopIndex(0);
      setBottomIndex(0);
      setHasMoreHistory(false);

      let isFirstBatch = true;

      // Fetch all pages from the beginning to get complete history
      while (true) {
        const result = await listActivities(
          apiKey,
          sessionName,
          pageSize,
          currentToken || undefined,
        );
        const newActs = await processActivities(result.activities || []);

        // Append new activities in order
        allActivities.push(...newActs);

        // Update UI progressively
        setActivities([...allActivities]);

        if (isFirstBatch) {
          setLoading(false); // Switch from full-page loader to content
          isFirstBatch = false;
        }

        if (result.nextPageToken) {
          if (!updatedTokens.includes(result.nextPageToken)) {
            updatedTokens.push(result.nextPageToken);
          }
          currentToken = result.nextPageToken;
          currentIndex++;
          setBottomIndex(currentIndex);
        } else {
          break;
        }
      }

      // Save the complete token list to localStorage
      setTokens(updatedTokens);
      localStorage.setItem(
        `jules_tokens_${name}`,
        JSON.stringify(updatedTokens),
      );
    } catch (err: unknown) {
      console.error(err);
      setError("Failed to load session data.");
    } finally {
      setLoading(false);
      setIsCatchingUp(false);
    }
  }, [apiKey, name, sessionName, pageSize, processActivities]);

  // Load more activities (older ones) - Navigates backwards through the token cache
  const loadMore = useCallback(async () => {
    if (!apiKey || topIndex === 0 || loadingMoreRef.current) return;

    // Set ref immediately to prevent duplicate calls
    loadingMoreRef.current = true;
    try {
      setLoadingMore(true);
      const scrollContainer = scrollRef.current;

      const prevToken = tokens[topIndex - 1];
      const result = await listActivities(
        apiKey,
        sessionName,
        pageSize,
        prevToken,
      );
      const newActivities = await processActivities(result.activities || []);

      // Prepend older activities and set up scroll restoration
      scrollHeightBeforeRef.current = scrollContainer?.scrollHeight || 0;
      scrollTopBeforeRef.current = scrollContainer?.scrollTop || 0;
      shouldRestoreScrollRef.current = true;

      setLoadingMore(false);
      loadingMoreRef.current = false;

      setActivities((prev) => [...newActivities, ...prev]);
      const newTopIndex = topIndex - 1;
      setTopIndex(newTopIndex);
      setHasMoreHistory(newTopIndex > 0);

      // Show toast with payload info
      const payloadSize = JSON.stringify(result).length;
      const sizeKB = (payloadSize / 1024).toFixed(1);
      toast.success(`Loaded history`, {
        description: `${newActivities.length} activities (${sizeKB} KB)`,
        duration: 2000,
      });
    } catch (err: unknown) {
      console.error(err);
      setError("Failed to load more activities.");
      setLoadingMore(false);
      loadingMoreRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, sessionName, topIndex, tokens, truncateDiffs]);

  useEffect(() => {
    if (apiKey && name) {
      void loadData();
    }
  }, [apiKey, name, loadData]);

  // Restore scroll position after prepending activities (runs synchronously after DOM update)
  useLayoutEffect(() => {
    if (shouldRestoreScrollRef.current && scrollRef.current) {
      const scrollHeightAfter = scrollRef.current.scrollHeight;
      const heightDelta = scrollHeightAfter - scrollHeightBeforeRef.current;
      scrollRef.current.scrollTop = scrollTopBeforeRef.current + heightDelta;
      shouldRestoreScrollRef.current = false;
    } else if (
      !loading &&
      !loadingMore &&
      !isCatchingUp &&
      hasMoreHistory &&
      scrollRef.current &&
      scrollRef.current.scrollHeight <= scrollRef.current.clientHeight
    ) {
      // If content doesn't fill the container and we have more history, load more
      console.log("[Scroll] Content too small, auto-loading more");
      void loadMore();
    }
  }, [
    activities,
    loading,
    loadingMore,
    isCatchingUp,
    hasMoreHistory,
    loadMore,
  ]);

  // Scroll to bottom only on initial load (not when loading more)
  const initialLoadDone = useRef(false);
  useEffect(() => {
    if (
      !loading &&
      !isCatchingUp &&
      scrollRef.current &&
      activities.length > 0 &&
      !initialLoadDone.current
    ) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      initialLoadDone.current = true;
    }
  }, [loading, isCatchingUp, activities.length]);

  // Detect scroll near top and load more
  const handleApprovePlan = async (planId: string) => {
    if (!apiKey) return;
    try {
      setApprovingPlan(planId);
      await approvePlan(apiKey, sessionName, planId);
      toast.success("Plan approved!");

      // Update session state locally if possible, or just catch up
      const sessionData = await getSession(apiKey, sessionName);
      setSession(sessionData);

      // Trigger catch-up to find new activities
      void catchUp();
    } catch (err: unknown) {
      console.error(err);
      // Toast error handled by axios interceptor
    } finally {
      setApprovingPlan(null);
    }
  };

  const catchUp = useCallback(async () => {
    if (!apiKey) return;
    // We start from the current bottom token
    let currentToken: string | undefined = tokens[bottomIndex];
    let currentIndex = bottomIndex;
    const updatedTokens = [...tokens];

    setIsCatchingUp(true);
    while (true) {
      const result = await listActivities(
        apiKey,
        sessionName,
        pageSize,
        currentToken,
      );
      const newActs = await processActivities(result.activities || []);

      if (newActs.length > 0) {
        setActivities((prev) => [...prev, ...newActs]);
      }

      if (result.nextPageToken) {
        if (!updatedTokens.includes(result.nextPageToken)) {
          updatedTokens.push(result.nextPageToken);
          setTokens([...updatedTokens]);
          localStorage.setItem(
            `jules_tokens_${name}`,
            JSON.stringify(updatedTokens),
          );
        }
        currentToken = result.nextPageToken;
        currentIndex++;
        setBottomIndex(currentIndex);
      } else {
        break;
      }
    }
    setIsCatchingUp(false);
  }, [
    apiKey,
    tokens,
    bottomIndex,
    sessionName,
    pageSize,
    processActivities,
    name,
  ]);

  useEffect(() => {
    const scrollContainer = scrollRef.current;
    if (!scrollContainer) {
      console.log("[Scroll] No container found");
      return;
    }

    console.log("[Scroll] Attaching listener", { hasMoreHistory, loadingMore });

    const handleScroll = () => {
      // If within 5x container height of the top, load more history
      const threshold = scrollContainer.clientHeight * 5;
      const shouldLoad =
        scrollContainer.scrollTop < threshold && hasMoreHistory && !loadingMore;

      if (shouldLoad) {
        console.log("[Scroll] Triggering loadMore", {
          scrollTop: scrollContainer.scrollTop,
          threshold,
          topIndex,
        });
        void loadMore();
      }
    };

    scrollContainer.addEventListener("scroll", handleScroll);
    return () => {
      console.log("[Scroll] Removing listener");
      scrollContainer.removeEventListener("scroll", handleScroll);
    };
  }, [hasMoreHistory, loadingMore, loadMore, loading, topIndex]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || !apiKey) return;

    try {
      setSending(true);
      await sendMessage(apiKey, sessionName, prompt);
      setPrompt("");
      await catchUp();
    } catch (err: unknown) {
      console.error(err);
      setError("Failed to send message.");
    } finally {
      setSending(false);
    }
  };

  // Polling for updates
  useEffect(() => {
    if (!apiKey || !name || loading || isCatchingUp) return;

    // Don't poll if session is in a final state
    const finalStates = ["COMPLETED", "FAILED"];
    if (session?.state && finalStates.includes(session.state)) {
      return;
    }

    const intervalId = setInterval(async () => {
      try {
        // Update session state
        const updatedSession = await getSession(apiKey, sessionName);
        setSession(updatedSession);

        // Check for new activities
        await catchUp();
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(intervalId);
  }, [
    apiKey,
    name,
    sessionName,
    session?.state,
    loading,
    isCatchingUp,
    catchUp,
  ]);

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

  const stateDisplay = getStateDisplay(session?.state);

  return (
    <div className="flex flex-col h-screen w-full px-6 py-4 bg-background">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Button
            variant="ghost"
            onClick={() => navigate("/")}
            className="flex-shrink-0"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="text-xl font-bold truncate min-w-0">
            {session?.title || "Loading..."}
          </h1>
        </div>
        {session && (
          <span
            className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${stateDisplay.className}`}
          >
            {stateDisplay.label}
          </span>
        )}
      </div>

      {error && (
        <div className="bg-destructive/15 text-destructive p-3 rounded-md mb-4">
          {error}
        </div>
      )}

      <Card className="flex-1 flex flex-col overflow-hidden mb-4">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
            {loadingMore && (
              <div className="flex justify-center py-2">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}
            {hasMoreHistory ? (
              <div className="flex justify-center py-2 border-b border-muted/20">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => loadMore()}
                  disabled={loadingMore}
                >
                  {loadingMore ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-2" />
                  ) : (
                    <ArrowLeft className="h-3 w-3 rotate-90 mr-2" />
                  )}
                  Load Previous {pageSize} Messages
                </Button>
              </div>
            ) : (
              activities.length > 0 && (
                <p className="text-center text-xs text-muted-foreground py-2 border-b border-muted/20">
                  Beginning of session
                </p>
              )
            )}
            {activities.length === 0 ? (
              <p className="text-center text-muted-foreground mt-10">
                No activity yet. Start a conversation!
              </p>
            ) : (
              <>
                {activities.map((act, index) => (
                  <ActivityItem
                    key={index}
                    activity={act}
                    session={session}
                    time={
                      act.createTime
                        ? new Date(act.createTime).toLocaleTimeString()
                        : ""
                    }
                    approvingPlan={approvingPlan}
                    onApprovePlan={handleApprovePlan}
                    onExpandDiff={(title, content) =>
                      setSelectedDiff({ title, content })
                    }
                  />
                ))}
                {isCatchingUp && (
                  <div className="flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground border-t border-muted/20">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Checking for newer messages...
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </Card>

      <form onSubmit={handleSend} className="flex gap-2">
        <Input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Type your message..."
          disabled={sending || loading}
          className="flex-1"
        />
        <Button type="submit" disabled={sending || loading || !prompt.trim()}>
          {sending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </form>

      {/* Modal for viewing full code diffs */}
      <Dialog
        open={!!selectedDiff}
        onOpenChange={(open) => !open && setSelectedDiff(null)}
      >
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileCode className="h-5 w-5" />
              {selectedDiff?.title}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            <pre className="text-xs text-gray-300 bg-gray-900 p-4 rounded overflow-x-auto">
              {selectedDiff?.content}
            </pre>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
