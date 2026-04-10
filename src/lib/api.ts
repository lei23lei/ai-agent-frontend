import axios from "axios";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000",
  headers: { "Content-Type": "application/json" },
});

export default api;

// --- Types ---

export interface SessionOut {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface MessageOut {
  id: string;
  session_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export interface DocumentOut {
  id: string;
  filename: string;
  source_type: string;
  created_at: string;
}

export interface FileUploadResult {
  filename: string;
  status: string;
  document_id?: string | null;
  chunks_count: number;
  reason?: string | null;
}

export interface BatchUploadResponse {
  results: FileUploadResult[];
  total: number;
  completed: number;
  skipped: number;
}

export interface SettingsRead {
  system_prompt: string;
  openai_api_key: string;
}

// --- API helpers ---

export const sessionsApi = {
  list: () => api.get<SessionOut[]>("/api/sessions"),
  create: (title: string) =>
    api.post<SessionOut>("/api/sessions", { title }),
  rename: (id: string, title: string) =>
    api.patch<SessionOut>(`/api/sessions/${id}`, { title }),
  delete: (id: string) => api.delete(`/api/sessions/${id}`),
  getMessages: (id: string) =>
    api.get<MessageOut[]>(`/api/sessions/${id}/messages`),
};

export const filesApi = {
  list: () => api.get<DocumentOut[]>("/api/files"),
  delete: (documentId: string) =>
    api.delete(`/api/files/${documentId}`),
  clearAll: () => api.post("/api/files/clear-all"),
  uploadUrl: (url: string) =>
    api.post<FileUploadResult>("/api/files/upload-url", { url }),
};

export const settingsApi = {
  get: () => api.get<SettingsRead>("/api/settings"),
  update: (data: Partial<SettingsRead>) =>
    api.put<SettingsRead>("/api/settings", data),
};
