import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useApiKey } from "@/context/ApiKeyContext";
import {
  listSources,
  createSession,
  type Source,
  type CreateSessionRequest,
} from "@/services/jules";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Loader2, Plus } from "lucide-react";

export default function NewSession() {
  const { apiKey } = useApiKey();
  const navigate = useNavigate();

  const [sources, setSources] = useState<Source[]>([]);
  const [loadingSources, setLoadingSources] = useState(true);
  const [sourcesError, setSourcesError] = useState<string | null>(null);

  const [selectedSourceName, setSelectedSourceName] = useState<string>("");
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [prompt, setPrompt] = useState("");
  const [title, setTitle] = useState("");
  const [requirePlanApproval, setRequirePlanApproval] = useState(false);
  const [autoCreatePr, setAutoCreatePr] = useState(false);

  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const loadSources = useCallback(async () => {
    if (!apiKey) return;
    try {
      setLoadingSources(true);
      setSourcesError(null);
      const data = await listSources(apiKey);
      setSources(data);
      // Auto-select first source if available
      if (data.length > 0) {
        setSelectedSourceName(data[0].name);
        // Auto-select default branch if available
        const firstSource = data[0];
        if (firstSource.githubRepo?.defaultBranch?.displayName) {
          setSelectedBranch(firstSource.githubRepo.defaultBranch.displayName);
        } else if (
          firstSource.githubRepo?.branches &&
          firstSource.githubRepo.branches.length > 0
        ) {
          setSelectedBranch(firstSource.githubRepo.branches[0].displayName);
        }
      }
    } catch (err: unknown) {
      console.error(err);
      setSourcesError("Failed to load sources. Please check your API key.");
    } finally {
      setLoadingSources(false);
    }
  }, [apiKey]);

  useEffect(() => {
    void loadSources();
  }, [loadSources]);

  // Get the currently selected source object
  const selectedSource = sources.find((s) => s.name === selectedSourceName);

  // Get available branches for the selected source
  const availableBranches = useMemo(
    () => selectedSource?.githubRepo?.branches || [],
    [selectedSource?.githubRepo?.branches],
  );

  // When source changes, reset branch selection
  useEffect(() => {
    if (selectedSource) {
      if (selectedSource.githubRepo?.defaultBranch?.displayName) {
        setSelectedBranch(selectedSource.githubRepo.defaultBranch.displayName);
      } else if (availableBranches.length > 0) {
        setSelectedBranch(availableBranches[0].displayName);
      } else {
        setSelectedBranch("");
      }
    }
  }, [selectedSourceName, selectedSource, availableBranches]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey || !selectedSourceName || !selectedBranch || !prompt.trim()) {
      return;
    }

    try {
      setCreating(true);
      setCreateError(null);

      const request: CreateSessionRequest = {
        prompt: prompt.trim(),
        sourceContext: {
          source: selectedSourceName,
          githubRepoContext: {
            startingBranch: selectedBranch,
          },
        },
      };

      if (title.trim()) {
        request.title = title.trim();
      }

      if (requirePlanApproval) {
        request.requirePlanApproval = true;
      }

      if (autoCreatePr) {
        request.automationMode = "AUTO_CREATE_PR";
      }

      const newSession = await createSession(apiKey, request);
      // Navigate to the session view
      const sessionId = newSession.name.replace("sessions/", "");
      navigate(`/sessions/${sessionId}`);
    } catch (err: unknown) {
      console.error(err);
      setCreateError("Failed to create session. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  const canSubmit =
    selectedSourceName && selectedBranch && prompt.trim() && !creating;

  // Helper function to format source display name
  const getSourceDisplayName = (source: Source) => {
    if (source.githubRepo) {
      return `${source.githubRepo.owner}/${source.githubRepo.repo}`;
    }
    return source.id || source.name.split("/").pop() || source.name;
  };

  return (
    <div className="container mx-auto py-10 px-4 min-h-screen bg-background">
      <div className="max-w-2xl mx-auto">
        <Button variant="ghost" onClick={() => navigate("/")} className="mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Create New Session
            </CardTitle>
            <CardDescription>
              Start a new coding session with Jules. Select a repository,
              branch, and describe what you want to accomplish.
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-6">
              {sourcesError && (
                <div className="bg-destructive/15 text-destructive p-4 rounded-md">
                  {sourcesError}
                </div>
              )}

              {createError && (
                <div className="bg-destructive/15 text-destructive p-4 rounded-md">
                  {createError}
                </div>
              )}

              {loadingSources ? (
                <div className="flex justify-center p-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : (
                <>
                  {/* Source Selection */}
                  <div className="space-y-2">
                    <Label htmlFor="source">Repository *</Label>
                    <Select
                      value={selectedSourceName}
                      onValueChange={setSelectedSourceName}
                    >
                      <SelectTrigger id="source">
                        <SelectValue placeholder="Select a repository" />
                      </SelectTrigger>
                      <SelectContent>
                        {sources.map((source) => (
                          <SelectItem key={source.name} value={source.name}>
                            {getSourceDisplayName(source)}
                            {source.githubRepo?.isPrivate && " (Private)"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {sources.length === 0 && !sourcesError && (
                      <p className="text-sm text-muted-foreground">
                        No repositories found. Make sure you have connected your
                        GitHub account to Jules.
                      </p>
                    )}
                  </div>

                  {/* Branch Selection */}
                  <div className="space-y-2">
                    <Label htmlFor="branch">Branch *</Label>
                    {availableBranches.length > 0 ? (
                      <Select
                        value={selectedBranch}
                        onValueChange={setSelectedBranch}
                      >
                        <SelectTrigger id="branch">
                          <SelectValue placeholder="Select a branch" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableBranches.map((branch) => (
                            <SelectItem
                              key={branch.displayName}
                              value={branch.displayName}
                            >
                              {branch.displayName}
                              {selectedSource?.githubRepo?.defaultBranch
                                ?.displayName === branch.displayName &&
                                " (default)"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        id="branch"
                        placeholder="Enter branch name (e.g., main)"
                        value={selectedBranch}
                        onChange={(e) => setSelectedBranch(e.target.value)}
                      />
                    )}
                  </div>

                  {/* Prompt */}
                  <div className="space-y-2">
                    <Label htmlFor="prompt">Task Description *</Label>
                    <Textarea
                      id="prompt"
                      placeholder="Describe what you want Jules to work on..."
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      rows={4}
                      className="resize-none"
                    />
                    <p className="text-sm text-muted-foreground">
                      Be specific about what changes you want Jules to make.
                    </p>
                  </div>

                  {/* Optional Title */}
                  <div className="space-y-2">
                    <Label htmlFor="title">Session Title (Optional)</Label>
                    <Input
                      id="title"
                      placeholder="A brief title for this session"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                    <p className="text-sm text-muted-foreground">
                      If not provided, Jules will generate a title.
                    </p>
                  </div>

                  {/* Options */}
                  <div className="space-y-4">
                    <Label>Options</Label>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="planApproval"
                        checked={requirePlanApproval}
                        onCheckedChange={(checked) =>
                          setRequirePlanApproval(checked === true)
                        }
                      />
                      <Label
                        htmlFor="planApproval"
                        className="text-sm font-normal cursor-pointer"
                      >
                        Require plan approval before execution
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="autoCreatePr"
                        checked={autoCreatePr}
                        onCheckedChange={(checked) =>
                          setAutoCreatePr(checked === true)
                        }
                      />
                      <Label
                        htmlFor="autoCreatePr"
                        className="text-sm font-normal cursor-pointer"
                      >
                        Automatically create a pull request when complete
                      </Label>
                    </div>
                  </div>
                </>
              )}
            </CardContent>

            <CardFooter className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/")}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!canSubmit}>
                {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Session
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
