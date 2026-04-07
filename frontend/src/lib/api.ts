const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const WS_BASE = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T = unknown>(url: string, options?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, options);
  } catch {
    throw new ApiError("Cannot connect to backend. Make sure the server is running.", 0);
  }
  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body.detail) detail = body.detail;
    } catch {
      // response body not JSON, use default message
    }
    throw new ApiError(detail, res.status);
  }
  return res.json() as Promise<T>;
}

export async function createProject(data: {
  name: string;
  description: string;
  plan: string;
  model: string;
}) {
  return request<{ project_id: string }>(`${API_BASE}/api/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function getProjects() {
  return request<unknown[]>(`${API_BASE}/api/projects`);
}

export async function getProject(id: string) {
  return request(`${API_BASE}/api/projects/${id}`);
}

export async function deleteProject(id: string) {
  return request(`${API_BASE}/api/projects/${id}`, { method: "DELETE" });
}

export async function getProjectFiles(id: string) {
  return request<Array<{ path: string; content: string; size: number }>>(
    `${API_BASE}/api/projects/${id}/files`
  );
}

export async function getModels() {
  return request(`${API_BASE}/api/settings/models`);
}

export async function getPlans() {
  return request(`${API_BASE}/api/settings/plans`);
}

export async function getApiKeys() {
  return request<Record<string, string>>(`${API_BASE}/api/settings/api-keys`);
}

export async function saveApiKey(provider: string, apiKey: string) {
  return request(`${API_BASE}/api/settings/api-keys`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider, api_key: apiKey }),
  });
}

export async function deleteApiKey(provider: string) {
  return request(`${API_BASE}/api/settings/api-keys/${provider}`, {
    method: "DELETE",
  });
}

export async function getAgents() {
  return request(`${API_BASE}/api/agents`);
}

/**
 * Connect a WebSocket with automatic reconnection and graceful error handling.
 * Returns a cleanup function to close the connection.
 */
export function connectWebSocket(
  projectId: string,
  callbacks: {
    onMessage: (data: Record<string, unknown>) => void;
    onError?: (error: string) => void;
    onClose?: () => void;
    onOpen?: () => void;
  }
): () => void {
  let ws: WebSocket | null = null;
  let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  let attempts = 0;
  const maxAttempts = 15;
  let disposed = false;

  function connect() {
    if (disposed) return;
    try {
      ws = new WebSocket(`${WS_BASE}/ws/${projectId}`);
    } catch {
      callbacks.onError?.("Failed to create WebSocket connection.");
      return;
    }

    ws.onopen = () => {
      attempts = 0;
      callbacks.onOpen?.();
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        callbacks.onMessage(data);
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onerror = () => {
      callbacks.onError?.("WebSocket connection error. Retrying...");
    };

    ws.onclose = () => {
      if (disposed) return;
      callbacks.onClose?.();
      attempts++;
      if (attempts < maxAttempts) {
        const delay = Math.min(1000 * Math.pow(2, attempts), 15000);
        reconnectTimeout = setTimeout(connect, delay);
      } else {
        callbacks.onError?.("Lost connection to server. Please refresh the page.");
      }
    };
  }

  connect();

  // Return cleanup function
  return () => {
    disposed = true;
    if (reconnectTimeout) clearTimeout(reconnectTimeout);
    if (ws) {
      ws.onclose = null;
      ws.onerror = null;
      ws.close();
    }
  };
}

export { ApiError };
