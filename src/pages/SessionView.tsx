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
  getSource,
  sendMessage,
  approvePlan,
  listActivities,
  type Activity,
  type Session,
  type Source,
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
import {
  Loader2,
  ArrowLeft,
  Send,
  FileCode,
  ArrowDown,
  Github,
  ExternalLink,
  GitPullRequest,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { ActivityItem } from "@/components/ActivityItem";

export default function SessionView() {
  const { apiKey, truncateDiffs, pageSize } = useSettings();
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [source, setSource] = useState<Source | null>(null);
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

  // Scroll state
  const [showScrollButton, setShowScrollButton] = useState(false);
  const shouldSnapToBottomRef = useRef(false);
  const catchingUpRef = useRef(false); // Guard against concurrent catchUp calls

  // Polling progress state
  const [pollingProgress, setPollingProgress] = useState(0);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );

  // Perspective: tokens[0] is the start of the session.
  // tokens[tokens.length - 1] is the furthest forward we've been.

  const workerRef = useRef<Worker | null>(null);
  const catchingUpToastId = useRef<string | number | null>(null);

  useEffect(() => {
    workerRef.current = new Worker(
      new URL("../workers/activity.worker.ts", import.meta.url),
      { type: "module" },
    );

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  // Show toast when catching up
  useEffect(() => {
    if (isCatchingUp) {
      catchingUpToastId.current = toast.loading(
        "Checking for newer messages...",
        {
          position: "top-right",
        },
      );
    } else if (catchingUpToastId.current) {
      toast.dismiss(catchingUpToastId.current);
      catchingUpToastId.current = null;
    }
  }, [isCatchingUp]);

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

  // Helper to save cache
  const saveCache = useCallback(
    (updatedTokens: string[], lastActivityTime?: string) => {
      const cache = {
        tokens: updatedTokens,
        lastActivityTime,
        lastUpdate: Date.now(),
      };
      localStorage.setItem(`jules_session_${name}`, JSON.stringify(cache));
      // Also save legacy format for backward compat
      localStorage.setItem(
        `jules_tokens_${name}`,
        JSON.stringify(updatedTokens),
      );
    },
    [name],
  );

  // Load existing cache with validation
  const loadCache = useCallback(() => {
    try {
      const cached = localStorage.getItem(`jules_session_${name}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        // Validate structure
        if (
          parsed &&
          typeof parsed === "object" &&
          Array.isArray(parsed.tokens) &&
          parsed.tokens.length > 0 &&
          parsed.tokens.every((t: unknown) => typeof t === "string")
        ) {
          return {
            tokens: parsed.tokens as string[],
            lastActivityTime:
              typeof parsed.lastActivityTime === "string"
                ? parsed.lastActivityTime
                : undefined,
            lastUpdate:
              typeof parsed.lastUpdate === "number" ? parsed.lastUpdate : 0,
          };
        }
        console.warn("Invalid cache structure, ignoring");
      }
      // Fallback to legacy format
      const legacyTokens = localStorage.getItem(`jules_tokens_${name}`);
      if (legacyTokens) {
        const parsed = JSON.parse(legacyTokens);
        if (
          Array.isArray(parsed) &&
          parsed.length > 1 &&
          parsed.every((t: unknown) => typeof t === "string")
        ) {
          return { tokens: parsed as string[], lastUpdate: 0 };
        }
      }
    } catch (e) {
      console.warn("Failed to load session cache:", e);
      // Clear corrupted cache
      localStorage.removeItem(`jules_session_${name}`);
      localStorage.removeItem(`jules_tokens_${name}`);
    }
    return null;
  }, [name]);

  const loadData = useCallback(async () => {
    if (!apiKey || !name) return;
    try {
      setLoading(true);
      const sessionData = await getSession(apiKey, sessionName);
      setSession(sessionData);

      // Fetch source for GitHub repo info
      if (sessionData.sourceContext?.source) {
        try {
          const sourceData = await getSource(
            apiKey,
            sessionData.sourceContext.source,
          );
          setSource(sourceData);
        } catch (e) {
          console.warn("Failed to fetch source:", e);
        }
      }

      const cache = loadCache();
      const hasValidCache = cache && cache.tokens.length > 1;

      if (hasValidCache) {
        // RETURNING VISIT: Start from last cached token (newest known page)
        console.log("[Load] Using cached tokens, starting from newest");
        const cachedTokens = cache.tokens;
        const startIndex = cachedTokens.length - 1;
        let currentToken: string | undefined = cachedTokens[startIndex];
        const updatedTokens = [...cachedTokens];
        const initialActivities: Activity[] = [];

        setTopIndex(startIndex);
        setBottomIndex(startIndex);
        setHasMoreHistory(startIndex > 0);
        setTokens(cachedTokens);

        // Force scroll to bottom on initial load
        shouldSnapToBottomRef.current = true;
        setIsCatchingUp(true);

        // Load from cached position forward to catch new activities
        let isFirstBatch = true;
        while (true) {
          const result = await listActivities(
            apiKey,
            sessionName,
            pageSize,
            currentToken || undefined,
          );
          const newActs = await processActivities(result.activities || []);

          initialActivities.push(...newActs);
          setActivities([...initialActivities]);

          if (isFirstBatch) {
            setLoading(false);
            isFirstBatch = false;
          }

          if (result.nextPageToken) {
            if (!updatedTokens.includes(result.nextPageToken)) {
              updatedTokens.push(result.nextPageToken);
            }
            currentToken = result.nextPageToken;
            setBottomIndex(updatedTokens.length - 1);
          } else {
            break;
          }
        }

        // Save updated cache
        setTokens(updatedTokens);
        const lastActivity = initialActivities[initialActivities.length - 1];
        saveCache(updatedTokens, lastActivity?.createTime);

        setIsCatchingUp(false);
        setLoading(false);
      } else {
        // FRESH VISIT: Load from beginning
        console.log("[Load] No cache, loading from beginning");
        let currentToken: string | undefined = "";
        let currentIndex = 0;
        const updatedTokens: string[] = [""];
        const allActivities: Activity[] = [];

        setIsCatchingUp(true);
        setTopIndex(0);
        setBottomIndex(0);
        setHasMoreHistory(false);

        let isFirstBatch = true;
        shouldSnapToBottomRef.current = true;

        while (true) {
          const result = await listActivities(
            apiKey,
            sessionName,
            pageSize,
            currentToken || undefined,
          );
          const newActs = await processActivities(result.activities || []);

          allActivities.push(...newActs);
          setActivities([...allActivities]);

          if (isFirstBatch) {
            setLoading(false);
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

        setTokens(updatedTokens);
        const lastActivity = allActivities[allActivities.length - 1];
        saveCache(updatedTokens, lastActivity?.createTime);
      }
    } catch (err: unknown) {
      console.error(err);
      setError("Failed to load session data.");
    } finally {
      setLoading(false);
      setIsCatchingUp(false);
    }
  }, [
    apiKey,
    name,
    sessionName,
    pageSize,
    processActivities,
    loadCache,
    saveCache,
  ]);

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
      // Do NOT snap to bottom when loading older history
      shouldSnapToBottomRef.current = false;

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

  // Restore scroll position after prepending activities OR snap to bottom if needed
  useLayoutEffect(() => {
    if (shouldRestoreScrollRef.current && scrollRef.current) {
      // Logic for restoring scroll position after loading OLDER messages
      const scrollHeightAfter = scrollRef.current.scrollHeight;
      const heightDelta = scrollHeightAfter - scrollHeightBeforeRef.current;
      scrollRef.current.scrollTop = scrollTopBeforeRef.current + heightDelta;
      shouldRestoreScrollRef.current = false;
      return;
    }

    // Logic for snapping to bottom (for incoming NEW messages)
    if (shouldSnapToBottomRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      // Only reset after snapping if NOT during initial catch-up
      // (we want to keep snapping during initial progressive load)
      if (!isCatchingUp) {
        shouldSnapToBottomRef.current = false;
      }
    }

    if (
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

  // Background history loading: after initial load, start loading older pages
  // This runs in background when user is scrolled near top or content is small
  useEffect(() => {
    if (
      loading ||
      loadingMore ||
      isCatchingUp ||
      !hasMoreHistory ||
      topIndex === 0
    ) {
      return;
    }

    const scrollContainer = scrollRef.current;
    if (!scrollContainer) return;

    // Check if user is within 3 viewport heights of top, or content doesn't fill container
    const threshold = scrollContainer.clientHeight * 3;
    const shouldLoadBackground =
      scrollContainer.scrollTop < threshold ||
      scrollContainer.scrollHeight <= scrollContainer.clientHeight;

    if (shouldLoadBackground) {
      console.log("[Background] Auto-loading history");
      void loadMore();
    }
  }, [
    loading,
    loadingMore,
    isCatchingUp,
    hasMoreHistory,
    topIndex,
    loadMore,
    activities,
  ]);

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
      shouldSnapToBottomRef.current = true; // User action, expect new content at bottom
      void catchUp();
    } catch (err: unknown) {
      console.error(err);
      // Toast error handled by axios interceptor
    } finally {
      setApprovingPlan(null);
    }
  };

  const catchUp = useCallback(async () => {
    if (!apiKey || catchingUpRef.current) return;
    catchingUpRef.current = true;
    // We start from the current bottom token
    let currentToken: string | undefined = tokens[bottomIndex];
    let currentIndex = bottomIndex;
    const updatedTokens = [...tokens];

    // Check if we are near bottom BEFORE fetching
    const scrollContainer = scrollRef.current;
    if (scrollContainer) {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
      const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);
      // If within 100px of bottom, we stick to bottom
      shouldSnapToBottomRef.current = distanceFromBottom < 100;
    }

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
        // Deduplicate by activity name to prevent duplicates from concurrent requests
        setActivities((prev) => {
          const existingNames = new Set(
            prev.map((a) => a.name).filter(Boolean),
          );
          const uniqueNewActs = newActs.filter(
            (a) => !a.name || !existingNames.has(a.name),
          );
          return [...prev, ...uniqueNewActs];
        });
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
    catchingUpRef.current = false;
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
      // 1. Detect if we should load more history
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

      // 2. Detect if we should show "Skip to bottom" button
      const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
      const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);
      setShowScrollButton(distanceFromBottom > 300); // Show if >300px from bottom
    };

    scrollContainer.addEventListener("scroll", handleScroll);
    return () => {
      console.log("[Scroll] Removing listener");
      scrollContainer.removeEventListener("scroll", handleScroll);
    };
  }, [hasMoreHistory, loadingMore, loadMore, loading, topIndex]);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || !apiKey) return;

    try {
      setSending(true);
      await sendMessage(apiKey, sessionName, prompt);
      setPrompt("");
      shouldSnapToBottomRef.current = true; // User sent message, snap to bottom
      await catchUp();
    } catch (err: unknown) {
      console.error(err);
      setError("Failed to send message.");
    } finally {
      setSending(false);
    }
  };

  // Polling for updates
  const POLL_INTERVAL = 5000; // 5 seconds
  const PROGRESS_STEP_INTERVAL = 50; // Update progress every 50ms

  useEffect(() => {
    if (!apiKey || !name || loading || isCatchingUp) {
      // Clear any running intervals if conditions not met
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      setPollingProgress(0);
      return;
    }

    // Don't poll if session is in a final state
    const finalStates = ["COMPLETED", "FAILED"];
    if (session?.state && finalStates.includes(session.state)) {
      setPollingProgress(0);
      return;
    }

    // Start progress animation
    const totalSteps = POLL_INTERVAL / PROGRESS_STEP_INTERVAL;
    let currentStep = 0;

    progressIntervalRef.current = setInterval(() => {
      currentStep++;
      setPollingProgress(Math.min((currentStep / totalSteps) * 100, 100));
    }, PROGRESS_STEP_INTERVAL);

    // Polling interval
    pollingIntervalRef.current = setInterval(async () => {
      try {
        // Reset progress
        currentStep = 0;
        setPollingProgress(0);

        // Update session state
        const updatedSession = await getSession(apiKey, sessionName);
        setSession(updatedSession);

        // Check for new activities
        await catchUp();
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, POLL_INTERVAL);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    };
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
    <div className="flex flex-col h-screen w-full px-6 py-4 bg-background relative">
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
        <div className="flex items-center gap-1">
          {source?.githubRepo && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title="Open GitHub Repository"
              onClick={() => {
                const gh = source.githubRepo;
                if (gh)
                  window.open(
                    `https://github.com/${gh.owner}/${gh.repo}`,
                    "_blank",
                  );
              }}
            >
              <Github className="h-4 w-4" />
            </Button>
          )}
          {session?.outputs?.some((o) => o.pullRequest?.url) && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title="Open Pull Request"
              onClick={() => {
                const prUrl = session?.outputs?.find((o) => o.pullRequest?.url)
                  ?.pullRequest?.url;
                if (prUrl) window.open(prUrl, "_blank");
              }}
            >
              <GitPullRequest className="h-4 w-4" />
            </Button>
          )}
          {session?.url && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title="Open in Jules"
              onClick={() => window.open(session.url, "_blank")}
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          )}
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
      {/* Polling Progress Indicator */}
      {!loading &&
        session?.state &&
        !["COMPLETED", "FAILED"].includes(session.state) && (
          <Progress value={pollingProgress} className="h-1 mb-2" />
        )}

      <Card className="flex-1 flex flex-col overflow-hidden mb-4 relative">
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
                        ? new Date(act.createTime).toLocaleString()
                        : ""
                    }
                    approvingPlan={approvingPlan}
                    onApprovePlan={handleApprovePlan}
                    onExpandDiff={(title, content) =>
                      setSelectedDiff({ title, content })
                    }
                  />
                ))}
              </>
            )}
          </div>
        )}

        {/* Floating Scroll Logic */}
        {showScrollButton && (
          <Button
            size="icon"
            className="absolute bottom-6 right-6 rounded-full shadow-lg opacity-90 hover:opacity-100 z-10"
            onClick={scrollToBottom}
          >
            <ArrowDown className="h-5 w-5" />
          </Button>
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
