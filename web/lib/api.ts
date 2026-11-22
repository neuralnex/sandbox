export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export type ApiSession = {
  id_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at?: number;
  token_type?: string;
};

export type User = { id: string; username: string; email: string | null; created_at: string };
export type Organization = {
  id: string; name: string; business_type: string; country: string | null; region: string | null;
  city: string | null; timezone: string | null; latitude: number | null; longitude: number | null;
  role: string; created_at: string;
};
export type Project = { id: string; organization_id: string; name: string; description: string };
export type Experiment = {
  id: string; project_id: string; title: string; description: string; objective: string;
  domain: string; specification: Record<string, unknown>; version: number;
};
export type Scenario = {
  id: string; experiment_id: string; parent_id: string | null; name: string;
  overrides: Record<string, unknown>; is_baseline: boolean; version: number;
};
export type Run = {
  id: string; scenario_id: string; seed: number; config: Record<string, number>;
  status: "queued" | "running" | "cancel_requested" | "completed" | "failed" | "cancelled";
  progress: number; metrics: Record<string, unknown> | null; error: string | null;
  created_at: string; finished_at: string | null;
};
export type Environment = { id: string; name: string; environment_type: "real_world" | "digital_twin" | "synthetic"; configuration: Record<string, unknown>; provenance: Record<string, unknown>; version: number };
export type Dataset = { id: string; environment_id: string; name: string; source_url: string | null; license: string | null; observed_at: string | null; metadata_json: Record<string, unknown> };
export type Data360Indicator = { series_description?: { idno?: string; name?: string; database_id?: string }; [key: string]: unknown };
export type Data360Observation = { OBS_VALUE?: string | null; TIME_PERIOD?: string; REF_AREA?: string; UNIT_MEASURE?: string | null; COMMENT_TS?: string | null; [key: string]: unknown };
export type Data360SearchResponse = { "@odata.count"?: number; value?: Data360Indicator[] };
export type Data360DataResponse = { count?: number; value?: Data360Observation[] };
export type Interpretation = {
  title: string; objective: string; domain: string; assumptions: string[];
  variables: { name: string; description: string; value: string | number | boolean | null; unit: string | null; rationale: string }[];
  missing_information: string[]; suggested_engine: string; simulation_config: Record<string, number | null>;
  market_research: {
    status: "ready" | "needs_clarification" | "not_researchable";
    market_definition: string; target_customer: string | null; geography: string | null;
    tam_low_usd: number | null; tam_high_usd: number | null; sam_low_usd: number | null; sam_high_usd: number | null;
    method: string; assumptions: string[]; caveats: string[];
    sources: { title: string; url: string; publisher: string | null; published_at: string | null; supports: string }[];
  };
  configuration_valid: boolean; configuration_errors: string[]; interpretation_notice: string;
};
export type RunInterpretation = {
  summary: string; recommendation: string; upside: string[]; downside: string[]; cost_and_competition: string[]; evidence_gaps: string[];
  findings: string[]; limitations: string[]; follow_up_questions: string[]; interpretation_notice: string;
  evidence_sources: { name: string; source_url: string | null; license: string | null; provider: string | null; reference_area: string | null; period: string | null }[];
};

export async function api<T>(path: string, token: string | (() => Promise<string>), init: RequestInit = {}): Promise<T> {
  const bearerToken = typeof token === "function" ? await token() : token;
  const send = () => fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${bearerToken}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
    cache: "no-store",
  });
  let response = await send();
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    // A valid Firebase session can outlive an interrupted profile-sync step.
    // Repair the local profile once before retrying a protected request.
    if (
      response.status === 403 &&
      body?.detail === "Complete profile setup before accessing Sandbox" &&
      path !== "/auth/sync"
    ) {
      const sync = await fetch(`${API_URL}/auth/sync`, {
        method: "POST",
        headers: { Authorization: `Bearer ${bearerToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({}),
        cache: "no-store",
      });
      if (sync.ok) response = await send();
      else {
        const syncBody = await sync.json().catch(() => null);
        throw new Error(typeof syncBody?.detail === "string" ? syncBody.detail : "Could not complete your Sandbox profile setup. Sign in again to retry.");
      }
    }
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const detail = body?.detail;
    throw new Error(typeof detail === "string" ? detail : `Request failed (${response.status})`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function jsonBody(value: unknown): RequestInit { return { method: "POST", body: JSON.stringify(value) }; }
