import axios from 'axios';

const BASE_URL = 'https://jules.googleapis.com/v1alpha';

export interface Session {
  name: string;
  createTime?: string;
  updateTime?: string;
  // Add other fields as discovered, but name is the key one
}

export interface Activity {
  name: string;
  // Activity structure not fully detailed in snippets, but likely has content/type
  type?: string;
  content?: string;
}

const getClient = (apiKey: string) => {
  return axios.create({
    baseURL: BASE_URL,
    headers: {
      'X-Goog-Api-Key': apiKey, // Assuming API Key auth
      'Content-Type': 'application/json',
    },
  });
};

export const listSessions = async (apiKey: string) => {
  const response = await getClient(apiKey).get<{ sessions: Session[] }>('/sessions');
  return response.data.sessions || [];
};

export const createSession = async (apiKey: string) => {
  // Empty body as per snippets implying just creating a session instance
  const response = await getClient(apiKey).post<Session>('/sessions', {});
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
  const url = name.startsWith('sessions/') ? `/${name}` : `/sessions/${name}`;
  const response = await getClient(apiKey).get<Session>(url);
  return response.data;
};

export const sendMessage = async (apiKey: string, sessionName: string, prompt: string) => {
  const url = sessionName.startsWith('sessions/') ? `/${sessionName}:sendMessage` : `/sessions/${sessionName}:sendMessage`;
  const response = await getClient(apiKey).post(url, { prompt });
  return response.data;
};

export const listActivities = async (apiKey: string, sessionName: string) => {
  const url = sessionName.startsWith('sessions/') ? `/${sessionName}/activities` : `/sessions/${sessionName}/activities`;
  const response = await getClient(apiKey).get<{ activities: Activity[] }>(url);
  return response.data.activities || [];
};
