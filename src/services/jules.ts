import axios from "axios";
import { toast } from "sonner";

const BASE_URL = "https://jules.googleapis.com/v1alpha";

export interface GitHubBranch {
  displayName: string;
}

export interface GitHubRepo {
  owner: string;
  repo: string;
  isPrivate?: boolean;
  defaultBranch?: GitHubBranch;
  branches?: GitHubBranch[];
}

export interface Source {
  name: string;
  id?: string;
  githubRepo?: GitHubRepo;
}

export interface GitHubRepoContext {
  startingBranch: string;
}

export interface SourceContext {
  source: string;
  githubRepoContext?: GitHubRepoContext;
}

export interface Session {
  name: string;
  id?: string;
  prompt?: string;
  sourceContext?: SourceContext;
  title?: string;
  requirePlanApproval?: boolean;
  automationMode?: "AUTOMATION_MODE_UNSPECIFIED" | "AUTO_CREATE_PR";
  createTime?: string;
  updateTime?: string;
  state?: string;
  url?: string;
}

export interface PlanStep {
  id: string;
  title: string;
  description?: string;
  index: number;
}

export interface Plan {
  id: string;
  steps: PlanStep[];
  createTime?: string;
}

export interface GitPatch {
  unidiffPatch?: string;
  baseCommitId?: string;
  suggestedCommitMessage?: string;
}

export interface ChangeSet {
  source?: string;
  gitPatch?: GitPatch;
}

export interface Artifact {
  changeSet?: ChangeSet;
  media?: { url?: string };
  bashOutput?: { output?: string };
}

export interface Activity {
  name: string;
  id?: string;
  description?: string;
  createTime?: string;
  originator?: string;
  artifacts?: Artifact[];
  // Activity type union fields
  agentMessaged?: { agentMessage: string };
  userMessaged?: { userMessage: string };
  planGenerated?: { plan: Plan };
  planApproved?: { planId: string };
  progressUpdated?: { title: string; description?: string };
  sessionCompleted?: Record<string, never>;
  sessionFailed?: { reason: string };
}

export interface CreateSessionRequest {
  prompt: string;
  sourceContext: SourceContext;
  title?: string;
  requirePlanApproval?: boolean;
  automationMode?: "AUTOMATION_MODE_UNSPECIFIED" | "AUTO_CREATE_PR";
}

const getClient = (apiKey: string) => {
  const client = axios.create({
    baseURL: BASE_URL,
    headers: {
      "X-Goog-Api-Key": apiKey, // Assuming API Key auth
      "Content-Type": "application/json",
    },
  });

  // Add a response interceptor to handle errors globally with toasts
  client.interceptors.response.use(
    (response) => response,
    (error) => {
      if (axios.isAxiosError(error)) {
        const message =
          error.response?.data?.error?.message ||
          error.message ||
          "An unexpected error occurred";
        toast.error("API Error", {
          description: message,
          duration: 4000,
        });
      }
      return Promise.reject(error);
    },
  );

  return client;
};

export const listSources = async (apiKey: string) => {
  const response = await getClient(apiKey).get<{ sources: Source[] }>(
    "/sources",
  );
  return response.data.sources || [];
};

export const listSessions = async (apiKey: string) => {
  const response = await getClient(apiKey).get<{ sessions: Session[] }>(
    "/sessions",
  );
  return response.data.sessions || [];
};

export const createSession = async (
  apiKey: string,
  request: CreateSessionRequest,
) => {
  const response = await getClient(apiKey).post<Session>("/sessions", request);
  return response.data;
};

export const getSession = async (apiKey: string, name: string) => {
  // name is full resource name "sessions/..."
  // If name contains "sessions/", we might need to handle it.
  // The API likely expects the full path in the URL if we use the client base URL.
  // Actually, standard google apis: GET /v1alpha/{name=sessions/*}
  // So if name is "sessions/123", request is /sessions/123.
  // We need to ensure we don't double the prefix if the name already has it.

  // However, axios baseURL is .../v1alpha.
  // If name is "sessions/xyz", url is "/sessions/xyz".
  // If name is just "xyz", we might need to prepend.
  // But Google APIs usually return full resource name.
  const url = name.startsWith("sessions/") ? `/${name}` : `/sessions/${name}`;
  const response = await getClient(apiKey).get<Session>(url);
  return response.data;
};

export const sendMessage = async (
  apiKey: string,
  sessionName: string,
  prompt: string,
) => {
  const url = sessionName.startsWith("sessions/")
    ? `/${sessionName}:sendMessage`
    : `/sessions/${sessionName}:sendMessage`;
  const response = await getClient(apiKey).post(url, { prompt });
  return response.data;
};

export const approvePlan = async (
  apiKey: string,
  sessionName: string,
  planId: string,
) => {
  const url = sessionName.startsWith("sessions/")
    ? `/${sessionName}:approvePlan`
    : `/sessions/${sessionName}:approvePlan`;
  const response = await getClient(apiKey).post(url, { planId });
  return response.data;
};

export interface ListActivitiesResponse {
  activities: Activity[];
  nextPageToken?: string;
}

export const listActivities = async (
  apiKey: string,
  sessionName: string,
  pageSize: number = 100,
  pageToken?: string,
): Promise<ListActivitiesResponse> => {
  const url = sessionName.startsWith("sessions/")
    ? `/${sessionName}/activities`
    : `/sessions/${sessionName}/activities`;

  const response = await getClient(apiKey).get<{
    activities: Activity[];
    nextPageToken?: string;
  }>(url, {
    params: {
      pageSize,
      ...(pageToken ? { pageToken } : {}),
    },
  });
  return {
    activities: response.data.activities || [],
    nextPageToken: response.data.nextPageToken,
  };
};
