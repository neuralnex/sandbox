"use client";

import {
  Github, ArrowDownToLine, ArrowUpRight, Beaker, Check, ChevronDown,
  CircleHelp, Clock3, Database, FlaskConical, LoaderCircle, LogOut, MapPin, Moon,
  Play, Plus, RefreshCw, Settings2, Sparkles, Sun, X,
} from "lucide-react";
import {
  GithubAuthProvider, GoogleAuthProvider, User as FirebaseUser,
  createUserWithEmailAndPassword, getIdToken, onAuthStateChanged,
  signInWithPopup, signOut,
} from "firebase/auth";
import { type FormEvent, type InputHTMLAttributes, useCallback, useEffect, useMemo, useState } from "react";
import { api, API_URL, ApiSession, Dataset, Environment, Experiment, Interpretation, jsonBody, Organization, Project, Run, RunInterpretation, Scenario, User } from "@/lib/api";
import { getFirebaseAuth } from "@/lib/firebase";

const SESSION_KEY = "sandbox.api-session";
const TERMINAL = new Set(["completed", "failed", "cancelled"]);
const statusCopy: Record<string, string> = {
  queued: "Queued", running: "Running", cancel_requested: "Stopping",
  completed: "Complete", failed: "Failed", cancelled: "Cancelled",
};

const starterPrompts = [
  { label: "Retail & ecommerce", domain: "retail", title: "Retail service capacity", text: "Explore whether staffing capacity can keep up with customer arrivals across the operating day. Identify arrival patterns, service time, team capacity, peak periods, and the wait-time target." },
  { label: "Healthcare", domain: "healthcare", title: "Patient access and waiting", text: "Explore patient arrivals and service capacity for a care setting. Specify the service stages, observed arrival rate, service time, available staff, operating hours, and wait-time target. Do not assume clinical outcomes." },
  { label: "Logistics", domain: "logistics", title: "Fulfillment throughput", text: "Explore incoming orders or shipments against processing capacity. Specify arrival patterns, processing time, parallel workstations or teams, operating hours, and the backlog or turnaround target." },
  { label: "Manufacturing", domain: "manufacturing", title: "Production line capacity", text: "Explore work-item arrivals and production capacity. Describe the process step, cycle time, parallel machines or operators, operating schedule, and throughput or queue target." },
  { label: "Financial services", domain: "finance", title: "Service operations capacity", text: "Explore incoming service requests against team capacity. Specify request arrivals, handling time, parallel agents, operating hours, and the service-level target." },
  { label: "Education", domain: "education", title: "Learner support capacity", text: "Explore learner requests or appointments against support capacity. Specify arrivals, handling time, parallel staff, operating hours, and the wait-time or completion target." },
  { label: "Hospitality", domain: "hospitality", title: "Guest service flow", text: "Explore guest arrivals and service capacity. Specify arrival patterns, service time, parallel staff or stations, operating hours, and the wait-time target." },
  { label: "Public services", domain: "government", title: "Public service access", text: "Explore incoming service cases against processing capacity. Specify arrivals, handling time, parallel staff, operating schedule, and the backlog or wait-time target." },
  { label: "Technology & SaaS", domain: "technology", title: "Support queue capacity", text: "Explore incoming support tickets against team capacity. Specify arrival rate, resolution time, parallel agents, coverage hours, and the response-time or backlog target." },
  { label: "Other business", domain: "general", title: "Operations capacity", text: "Describe the work arriving in your system and the team or resources that process it. Specify arrival rate, service time, parallel capacity, operating period, and the outcome you want to measure." },
];

function explainError(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Try again.";
}

function formatMetric(name: string, value: unknown) {
  if (typeof value !== "number") return String(value);
  const displayValue = name === "server_utilization" ? value * 100 : value;
  const unit = name === "server_utilization" ? "%" : name.includes("minutes") ? " min" : name === "duration_hours" ? " h" : "";
  return `${Number(displayValue.toFixed(2))}${unit}`;
}

function Logo({ small = false }: { small?: boolean }) {
  return <div className="flex items-center gap-3" aria-label="Sandbox">
    <span className={`grid ${small ? "size-9 text-xs" : "size-11 text-sm"} place-items-center border-2 border-foreground bg-primary font-black tracking-tight text-primary-foreground`} aria-hidden="true">SD</span>
    {!small && <span className="text-lg font-extrabold tracking-tight">sandbox<span className="text-muted-foreground">.</span></span>}
  </div>;
}

function Field({ label, id, hint, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; id: string; hint?: string }) {
  return <div className="space-y-1.5">
    <label htmlFor={id} className="text-sm font-semibold">{label}</label>
    <input id={id} className="h-11 w-full border border-border bg-card px-3 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring" {...props} />
    {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
  </div>;
}

function MetricCard({ label, value, note }: { label: string; value: string; note: string }) {
  return <article className="min-w-0 border border-border bg-card p-4">
    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
    <p className="mt-3 truncate font-mono text-2xl font-bold tabular-nums">{value}</p>
    <p className="mt-1 text-xs text-muted-foreground">{note}</p>
  </article>;
}

function AuthScreen({ onReady }: { onReady: (token: string) => Promise<void> }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [identifier, setIdentifier] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [workspace, setWorkspace] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      if (mode === "register") {
        const auth = getFirebaseAuth();
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        const token = await getIdToken(credential.user);
        await fetch(`${API_URL}/auth/sync`, {
          method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ username, workspace_name: workspace || undefined }),
        }).then(async (response) => {
          if (!response.ok) { const body = await response.json().catch(() => null); throw new Error(body?.detail || "Could not create your Sandbox profile."); }
        });
        await onReady(token);
      } else {
        const response = await fetch(`${API_URL}/auth/login`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier, password }),
        });
        const body = await response.json().catch(() => null);
        if (!response.ok) throw new Error(body?.detail || "Sign in failed. Check your details and try again.");
        const session: ApiSession = { ...body, expires_at: Date.now() + Number(body.expires_in) * 1000 };
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
        await api<User>("/auth/sync", session.id_token, jsonBody(username ? { username } : {}));
        await onReady(session.id_token);
      }
    } catch (cause) { setError(explainError(cause)); }
    finally { setBusy(false); }
  }

  async function social(provider: "google" | "github") {
    setBusy(true); setError("");
    try {
      const auth = getFirebaseAuth();
      const authProvider = provider === "google" ? new GoogleAuthProvider() : new GithubAuthProvider();
      const credential = await signInWithPopup(auth, authProvider);
      const token = await getIdToken(credential.user);
      const response = await fetch(`${API_URL}/auth/sync`, {
        method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(username ? { username } : {}),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        if (response.status === 422 && !username) throw new Error("Add a username in the field above, then try again to finish your profile.");
        throw new Error(body?.detail || "Could not connect this sign-in to Sandbox.");
      }
      await onReady(token);
    } catch (cause) { setError(explainError(cause)); }
    finally { setBusy(false); }
  }

  return <main className="grid min-h-screen lg:grid-cols-[1.1fr_0.9fr]">
    <section className="flex min-h-[300px] flex-col justify-between bg-foreground p-7 text-background sm:p-12 lg:min-h-screen lg:p-16">
      <Logo />
      <div className="max-w-xl py-12">
        <p className="mb-5 inline-flex items-center gap-2 border border-background/30 px-3 py-2 text-xs font-bold uppercase tracking-widest"><span className="size-2 rounded-full bg-primary" /> An experiment workspace</p>
        <h1 className="text-4xl font-black leading-[1.02] tracking-tight sm:text-6xl">Make room<br />for <span className="bg-primary px-2 text-primary-foreground">what if.</span></h1>
        <p className="mt-6 max-w-md text-base leading-7 text-background/80">Shape an idea into a model, run scenarios, and see how the assumptions change the outcome.</p>
      </div>
      <div className="flex items-center gap-3 text-xs text-background/70"><Beaker size={15} aria-hidden="true" /> Every result is tied to a model, seed, and configuration.</div>
    </section>
    <section className="flex items-center justify-center p-6 sm:p-10">
      <div className="w-full max-w-md">
        <Logo small />
        <h2 className="mt-10 text-2xl font-extrabold">{mode === "login" ? "Welcome back" : "Create your workspace"}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{mode === "login" ? "Sign in to continue your experiments." : "Start with an email and a handle for your workspace."}</p>
        <div className="mt-7 grid grid-cols-2 gap-3">
          <button type="button" onClick={() => void social("google")} disabled={busy} className="flex h-11 items-center justify-center gap-2 border border-border bg-card text-sm font-semibold hover:bg-muted disabled:opacity-60"><span className="grid size-5 place-items-center rounded-full border border-border text-xs font-bold" aria-hidden="true">G</span> Google</button>
          <button type="button" onClick={() => void social("github")} disabled={busy} className="flex h-11 items-center justify-center gap-2 border border-border bg-card text-sm font-semibold hover:bg-muted disabled:opacity-60"><Github size={16} aria-hidden="true" /> GitHub</button>
        </div>
        <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" /> OR USE EMAIL <span className="h-px flex-1 bg-border" /></div>
        <form onSubmit={submit} className="space-y-4" aria-busy={busy}>
          {mode === "register" ? <>
            <Field id="username" label="Username" required minLength={3} maxLength={32} pattern="[A-Za-z0-9_]+" autoComplete="username" spellCheck={false} value={username} onChange={(event) => setUsername(event.target.value)} />
            <Field id="email" label="Email address" type="email" required autoComplete="email" spellCheck={false} value={email} onChange={(event) => setEmail(event.target.value)} />
            <Field id="workspace" label="Workspace name" autoComplete="organization" value={workspace} onChange={(event) => setWorkspace(event.target.value)} hint="Optional. You can change this later." />
          </> : <>
            <Field id="identifier" label="Username or email" required autoComplete="username" spellCheck={false} value={identifier} onChange={(event) => setIdentifier(event.target.value)} />
            <Field id="username-social" label="Username for a new social sign-in" autoComplete="username" spellCheck={false} value={username} onChange={(event) => setUsername(event.target.value)} hint="Only needed the first time you use Google or GitHub." />
          </>}
          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm font-semibold">Password</label>
            <div className="flex border border-border bg-card focus-within:ring-2 focus-within:ring-ring">
              <input id="password" type={showPassword ? "text" : "password"} required minLength={mode === "register" ? 12 : 1} autoComplete={mode === "register" ? "new-password" : "current-password"} className="h-11 min-w-0 flex-1 bg-transparent px-3 text-sm outline-none" value={password} onChange={(event) => setPassword(event.target.value)} />
              <button type="button" onClick={() => setShowPassword((value) => !value)} className="min-h-11 min-w-16 px-3 text-xs font-semibold text-muted-foreground hover:text-foreground">{showPassword ? "Hide" : "Show"}</button>
            </div>
            {mode === "register" && <p className="text-xs text-muted-foreground">Use at least 12 characters.</p>}
          </div>
          {error && <div role="alert" className="border border-destructive bg-card p-3 text-sm text-foreground">{error}</div>}
          <button type="submit" disabled={busy} className="flex h-12 w-full items-center justify-center gap-2 border border-foreground bg-primary text-sm font-extrabold text-primary-foreground transition hover:brightness-95 disabled:cursor-wait disabled:opacity-70">
            {busy && <LoaderCircle className="motion-safe:animate-spin" size={16} aria-hidden="true" />}{mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>
        <p className="mt-5 text-center text-sm text-muted-foreground">
          {mode === "login" ? "New to Sandbox?" : "Already have an account?"}{" "}
          <button type="button" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }} className="min-h-10 font-bold text-foreground underline decoration-primary decoration-2 underline-offset-4">{mode === "login" ? "Create an account" : "Sign in"}</button>
        </p>
        <p className="mt-8 text-center text-xs leading-5 text-muted-foreground">Sandbox results are outputs of their configured simulation model. They are not factual predictions.</p>
      </div>
    </section>
  </main>;
}

export default function Home() {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [session, setSession] = useState<ApiSession | null>(null);
  const [token, setToken] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [org, setOrg] = useState<Organization | null>(null);
  const [workspaceSettingsOpen, setWorkspaceSettingsOpen] = useState(false);
  const [workspaceName, setWorkspaceName] = useState("");
  const [businessType, setBusinessType] = useState("general");
  const [workspaceCountry, setWorkspaceCountry] = useState("");
  const [workspaceRegion, setWorkspaceRegion] = useState("");
  const [workspaceCity, setWorkspaceCity] = useState("");
  const [workspaceTimezone, setWorkspaceTimezone] = useState("");
  const [workspaceCoordinates, setWorkspaceCoordinates] = useState<{ latitude: number | null; longitude: number | null }>({ latitude: null, longitude: null });
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectForExperiment, setProjectForExperiment] = useState("");
  const [newProjectName, setNewProjectName] = useState("First project");
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [environmentType, setEnvironmentType] = useState<Environment["environment_type"]>("synthetic");
  const [environmentName, setEnvironmentName] = useState("");
  const [environmentCountry, setEnvironmentCountry] = useState("");
  const [environmentCity, setEnvironmentCity] = useState("");
  const [environmentCoordinates, setEnvironmentCoordinates] = useState<{ latitude: number | null; longitude: number | null }>({ latitude: null, longitude: null });
  const [datasetName, setDatasetName] = useState("");
  const [datasetSource, setDatasetSource] = useState("");
  const [activeEnvironmentId, setActiveEnvironmentId] = useState("");
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [newEnvironmentOpen, setNewEnvironmentOpen] = useState(false);
  const [environmentForExperiment, setEnvironmentForExperiment] = useState("");
  const [activeId, setActiveId] = useState("");
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [selectedScenario, setSelectedScenario] = useState("");
  const [selectedRuns, setSelectedRuns] = useState<string[]>([]);
  const [comparison, setComparison] = useState<{ metrics: { metric: string; values: Record<string, number | string>; delta_from_first: Record<string, number> | null }[] } | null>(null);
  const [runExplanation, setRunExplanation] = useState<{ runId: string; result: RunInterpretation } | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showBranch, setShowBranch] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  const [title, setTitle] = useState("");
  const [idea, setIdea] = useState("");
  const [arrival, setArrival] = useState("");
  const [service, setService] = useState("");
  const [servers, setServers] = useState("");
  const [duration, setDuration] = useState("");
  const [runSeed, setRunSeed] = useState("");
  const [domain, setDomain] = useState("general");
  const [selectedStarter, setSelectedStarter] = useState("");
  const [aiDraft, setAiDraft] = useState<Interpretation | null>(null);
  const [branchName, setBranchName] = useState("Higher arrivals");
  const [branchArrival, setBranchArrival] = useState("24");

  const currentExperiment = useMemo(() => experiments.find((experiment) => experiment.id === activeId) || null, [experiments, activeId]);
  const activeScenario = scenarios.find((scenario) => scenario.id === selectedScenario) || scenarios.find((scenario) => scenario.is_baseline) || null;
  const liveRuns = runs.some((run) => !TERMINAL.has(run.status));

  useEffect(() => {
    const storedTheme = localStorage.getItem("sandbox.theme");
    if (storedTheme === "dark" || storedTheme === "light") setTheme(storedTheme);
    const storedSession = sessionStorage.getItem(SESSION_KEY);
    if (storedSession) {
      try { setSession(JSON.parse(storedSession) as ApiSession); }
      catch { sessionStorage.removeItem(SESSION_KEY); }
    }
    try {
      const auth = getFirebaseAuth();
      return onAuthStateChanged(auth, (nextUser) => setFirebaseUser(nextUser));
    } catch { setLoading(false); }
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("sandbox.theme", theme);
  }, [theme]);

  const getToken = useCallback(async () => {
    if (firebaseUser) return getIdToken(firebaseUser);
    let activeSession = session;
    if (!activeSession && typeof window !== "undefined") {
      const stored = sessionStorage.getItem(SESSION_KEY);
      if (stored) activeSession = JSON.parse(stored) as ApiSession;
    }
    if (!activeSession) throw new Error("Your session has expired. Sign in again.");
    if ((activeSession.expires_at || 0) < Date.now() + 60_000) {
      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: activeSession.refresh_token }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) { sessionStorage.removeItem(SESSION_KEY); setSession(null); throw new Error(body?.detail || "Your session expired. Sign in again."); }
      activeSession = { ...body, expires_at: Date.now() + Number(body.expires_in) * 1000 };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(activeSession)); setSession(activeSession);
    }
    const idToken = activeSession?.id_token;
    if (!idToken) throw new Error("Your session has expired. Sign in again.");
    return idToken;
  }, [firebaseUser, session]);

  const loadWorkspace = useCallback(async (accessToken: string) => {
    setLoading(true); setError("");
    try {
      const [me, organizations, projectRows, experimentRows] = await Promise.all([
        api<User>("/users/me", accessToken), api<Organization[]>("/organizations", accessToken),
        api<Project[]>("/projects", accessToken), api<Experiment[]>("/experiments", accessToken),
      ]);
      const activeOrg = organizations[0] || null;
      setUser(me); setOrg(activeOrg); setProjects(projectRows); setExperiments(experimentRows);
      if (activeOrg) {
        setWorkspaceName(activeOrg.name);
        setBusinessType(activeOrg.business_type || "general");
        setWorkspaceCountry(activeOrg.country || ""); setWorkspaceRegion(activeOrg.region || "");
        setWorkspaceCity(activeOrg.city || ""); setWorkspaceTimezone(activeOrg.timezone || "");
        setWorkspaceCoordinates({ latitude: activeOrg.latitude, longitude: activeOrg.longitude });
      }
      setProjectForExperiment((previous) => projectRows.some((item) => item.id === previous) ? previous : projectRows[0]?.id || "__new");
      const environmentRows = organizations[0] ? await api<Environment[]>(`/environments?organization_id=${organizations[0].id}`, accessToken) : [];
      setEnvironments(environmentRows);
      setEnvironmentForExperiment((previous) => environmentRows.some((item) => item.id === previous) ? previous : "");
      setActiveId((previous) => experimentRows.some((item) => item.id === previous) ? previous : experimentRows[0]?.id || "");
    } catch (cause) { setError(explainError(cause)); throw cause; }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function restore() {
      if (firebaseUser) {
        try {
          const accessToken = await getIdToken(firebaseUser);
          await api<User>("/auth/sync", accessToken, jsonBody({}));
          if (!cancelled) { setToken(accessToken); await loadWorkspace(accessToken); }
        } catch { if (!cancelled) setLoading(false); }
      } else if (session) {
        try {
          const accessToken = await getToken();
          await api<User>("/auth/sync", accessToken, jsonBody({}));
          if (!cancelled) { setToken(accessToken); await loadWorkspace(accessToken); }
        }
        catch { if (!cancelled) setLoading(false); }
      } else { setUser(null); setLoading(false); }
    }
    void restore();
    return () => { cancelled = true; };
  }, [firebaseUser, session, getToken, loadWorkspace]);

  useEffect(() => {
    if (!token || !currentExperiment) { setScenarios([]); setRuns([]); return; }
    let cancelled = false;
    async function loadExperiment() {
      try {
        const [scenarioRows, runRows] = await Promise.all([
          api<Scenario[]>(`/experiments/${currentExperiment!.id}/scenarios`, getToken),
          api<Run[]>(`/experiments/${currentExperiment!.id}/runs`, getToken),
        ]);
        if (!cancelled) {
          setScenarios(scenarioRows); setRuns(runRows);
          setSelectedScenario((current) => scenarioRows.some((item) => item.id === current) ? current : scenarioRows.find((item) => item.is_baseline)?.id || "");
        }
      } catch (cause) { if (!cancelled) setError(explainError(cause)); }
    }
    void loadExperiment();
    const timer = liveRuns ? window.setInterval(() => { if (!cancelled) void loadExperiment(); }, 1400) : undefined;
    return () => { cancelled = true; if (timer) window.clearInterval(timer); };
  }, [token, currentExperiment, liveRuns, getToken]);

  async function ready(accessToken: string) {
    setToken(accessToken); await loadWorkspace(accessToken);
  }

  async function logout() {
    try { if (firebaseUser) await signOut(getFirebaseAuth()); } catch { /* Clear the local API session even if the SDK is unavailable. */ }
    sessionStorage.removeItem(SESSION_KEY); setSession(null); setFirebaseUser(null); setToken(""); setUser(null); setExperiments([]); setActiveId("");
  }

  async function createExperiment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!org) { setError("Your workspace is not ready yet."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      let project = projects.find((item) => item.id === projectForExperiment && item.organization_id === org.id);
      if (!project) {
        project = await api<Project>("/projects", getToken, jsonBody({ organization_id: org.id, name: newProjectName.trim() || "First project", description: "Experiments in this workspace." }));
        setProjects((items) => [...items, project!]);
        setProjectForExperiment(project.id);
      }
      const experiment = await api<Experiment>("/experiments", getToken, jsonBody({
        project_id: project.id, environment_id: environmentForExperiment || null, title: title.trim(), description: idea.trim(), objective: idea.trim(), domain,
        specification: {
          business_context: {
            business_type: org.business_type,
            location: [org.city, org.region, org.country].filter(Boolean).join(", ") || null,
            timezone: org.timezone,
          },
          simulation: { engine: "queueing", config: {
          arrival_rate_per_hour: Number(arrival), service_rate_per_hour_per_server: Number(service),
          servers: Number(servers), duration_hours: Number(duration),
          } },
        },
      }));
      setExperiments((items) => [experiment, ...items]); setActiveId(experiment.id); setShowNew(false); setTitle(""); setIdea(""); setAiDraft(null);
      setNotice("Experiment created. Review the baseline configuration, then start a run.");
    } catch (cause) { setError(explainError(cause)); }
    finally { setBusy(false); }
  }

  async function draftWithAi() {
    if (idea.trim().length < 20) { setError("Add a little more detail before asking AI for an experiment draft."); return; }
    setBusy(true); setError("");
    try {
      const businessContext = org ? `\n\nWorkspace context (user-provided): business type: ${org.business_type}; location: ${[org.city, org.region, org.country].filter(Boolean).join(", ") || "not provided"}; time zone: ${org.timezone || "not provided"}. Use this only to interpret terminology and questions; do not infer demand or operating facts from location.` : "";
      const draft = await api<Interpretation>("/ai/interpret", getToken, jsonBody({ idea: `${idea.trim()}${businessContext}` }));
      setAiDraft(draft); setTitle(draft.title); setDomain(draft.domain || "general"); setArrival(String(draft.simulation_config.arrival_rate_per_hour ?? ""));
      setService(String(draft.simulation_config.service_rate_per_hour_per_server ?? ""));
      setServers(String(draft.simulation_config.servers ?? "")); setDuration(String(draft.simulation_config.duration_hours ?? ""));
      if (!draft.configuration_valid) setNotice("AI returned a draft with missing or unsupported configuration. Review the assumptions and fill in each required value.");
    } catch (cause) { setError(explainError(cause)); }
    finally { setBusy(false); }
  }

  async function startRun(scenario: Scenario) {
    setBusy(true); setError(""); setNotice("");
    try {
      await api<Run>(`/scenarios/${scenario.id}/runs`, getToken, jsonBody(runSeed.trim() ? { seed: Number(runSeed) } : {}));
      setSelectedScenario(scenario.id); setNotice(`Run queued for ${scenario.name}.`);
      const updated = await api<Run[]>(`/experiments/${activeId}/runs`, getToken);
      setRuns(updated);
    } catch (cause) { setError(explainError(cause)); }
    finally { setBusy(false); }
  }

  async function branchScenario(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!activeScenario || !activeId) return;
    setBusy(true); setError("");
    try {
      const branched = await api<Scenario>(`/scenarios/${activeScenario.id}/branch`, getToken, jsonBody({
        name: branchName.trim(), overrides: { arrival_rate_per_hour: Number(branchArrival) },
      }));
      setScenarios((items) => [...items, branched]); setSelectedScenario(branched.id); setShowBranch(false);
      await startRun(branched);
    } catch (cause) { setError(explainError(cause)); setBusy(false); }
  }

  async function compareRuns() {
    if (selectedRuns.length < 2) return;
    setBusy(true); setError("");
    try { setComparison(await api<{ metrics: { metric: string; values: Record<string, number | string>; delta_from_first: Record<string, number> | null }[] }>(`/experiments/${activeId}/scenarios/compare`, getToken, jsonBody({ run_ids: selectedRuns }))); }
    catch (cause) { setError(explainError(cause)); }
    finally { setBusy(false); }
  }

  async function cancelRun(run: Run) {
    setBusy(true); setError("");
    try {
      const updated = await api<Run>(`/runs/${run.id}/cancel`, getToken, { method: "POST" });
      setRuns((items) => items.map((item) => item.id === run.id ? updated : item));
      setNotice("Cancellation requested. The worker will stop at its next checkpoint.");
    } catch (cause) { setError(explainError(cause)); }
    finally { setBusy(false); }
  }

  async function interpretRun(run: Run) {
    setBusy(true); setError("");
    try {
      const result = await api<RunInterpretation>(`/ai/runs/${run.id}/interpret`, getToken, jsonBody({}));
      setRunExplanation({ runId: run.id, result });
    } catch (cause) { setError(explainError(cause)); }
    finally { setBusy(false); }
  }

  async function downloadReport(run: Run, format: "pdf" | "csv" | "json") {
    setBusy(true); setError("");
    try {
      const report = await api<{ id: string }>(`/runs/${run.id}/reports`, getToken, jsonBody({ format }));
      const accessToken = await getToken();
      const response = await fetch(`${API_URL}/reports/${report.id}/download`, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!response.ok) throw new Error("Could not download this report.");
      const url = URL.createObjectURL(await response.blob()); const anchor = document.createElement("a");
      anchor.href = url; anchor.download = `sandbox-report-${run.id}.${format}`; anchor.click(); URL.revokeObjectURL(url);
      setNotice(`${format.toUpperCase()} report downloaded.`);
    } catch (cause) { setError(explainError(cause)); }
    finally { setBusy(false); }
  }

  async function createEnvironment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!org) return;
    setBusy(true); setError("");
    try {
      const environment = await api<Environment>("/environments", getToken, jsonBody({
        organization_id: org.id, name: environmentName.trim(), environment_type: environmentType,
        configuration: {
          business_type: org.business_type,
          location: {
            country: environmentCountry.trim() || null,
            city: environmentCity.trim() || null,
            latitude: environmentCoordinates.latitude,
            longitude: environmentCoordinates.longitude,
          },
        },
        provenance: { description: "Created in Sandbox workspace", location_source: "user_provided_or_explicit_browser_permission" },
      }));
      setEnvironments((items) => [environment, ...items]); setActiveEnvironmentId(environment.id);
      setEnvironmentName(""); setEnvironmentCountry(""); setEnvironmentCity("");
      setEnvironmentCoordinates({ latitude: null, longitude: null });
      setNewEnvironmentOpen(false); setNotice("Environment created.");
    } catch (cause) { setError(explainError(cause)); }
    finally { setBusy(false); }
  }

  async function attachDataset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!activeEnvironmentId) return;
    setBusy(true); setError("");
    try {
      const dataset = await api<Dataset>(`/environments/${activeEnvironmentId}/datasets`, getToken, jsonBody({
        name: datasetName.trim(), source_url: datasetSource.trim() || null,
        metadata: { provenance_note: "Source recorded by workspace user" },
      }));
      setDatasets((items) => [...items, dataset]); setDatasetName(""); setDatasetSource(""); setNotice("Dataset source attached to this environment.");
    } catch (cause) { setError(explainError(cause)); }
    finally { setBusy(false); }
  }

  async function selectEnvironment(environmentId: string) {
    setActiveEnvironmentId(environmentId); setDatasets([]);
    if (!environmentId) return;
    try { setDatasets(await api<Dataset[]>(`/environments/${environmentId}/datasets`, getToken)); }
    catch (cause) { setError(explainError(cause)); }
  }

  async function saveWorkspaceProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!org) return;
    setBusy(true); setError("");
    try {
      const updated = await api<Organization>(`/organizations/${org.id}`, getToken, {
        method: "PATCH",
        body: JSON.stringify({
          name: workspaceName.trim(), business_type: businessType,
          country: workspaceCountry.trim() || null, region: workspaceRegion.trim() || null,
          city: workspaceCity.trim() || null, timezone: workspaceTimezone.trim() || null,
          latitude: workspaceCoordinates.latitude, longitude: workspaceCoordinates.longitude,
        }),
      });
      setOrg(updated); setWorkspaceSettingsOpen(false); setNotice("Workspace profile saved.");
    } catch (cause) { setError(explainError(cause)); }
    finally { setBusy(false); }
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) { setError("Location is not available in this browser."); return; }
    setError("");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => setWorkspaceCoordinates({ latitude: Number(coords.latitude.toFixed(5)), longitude: Number(coords.longitude.toFixed(5)) }),
      () => setError("Location was not shared. You can still save your country, region, and city."),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  }

  function locateEnvironment() {
    if (!navigator.geolocation) { setError("Location is not available in this browser."); return; }
    setError("");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => setEnvironmentCoordinates({ latitude: Number(coords.latitude.toFixed(5)), longitude: Number(coords.longitude.toFixed(5)) }),
      () => setError("Location was not shared. You can still enter the environment city and country."),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  }

  if (!user && loading) return <main className="min-h-screen p-6"><div className="mx-auto max-w-7xl"><div className="h-12 w-44 motion-safe:animate-pulse bg-muted" /><div className="mt-8 h-64 motion-safe:animate-pulse border border-border bg-card" /></div></main>;
  if (!user) return <AuthScreen onReady={ready} />;

  const config = (currentExperiment?.specification.simulation as { config?: Record<string, number> } | undefined)?.config || {};
  const latestRun = runs[0];
  const selectedScenarioRun = runs.find((run) => run.scenario_id === activeScenario?.id && run.status === "completed");
  const metricLabels: Record<string, string> = {
    customers_arrived: "Arrivals", customers_started_service: "Entered service", customers_served: "Completed service",
    customers_unfinished_at_horizon: "Unfinished at horizon", mean_wait_minutes: "Average wait",
    p95_wait_minutes: "95th percentile wait", server_utilization: "Server utilization", duration_hours: "Run duration",
  };
  return <main className="min-h-screen">
    <div className="mx-auto flex min-h-screen max-w-[1600px]">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-card p-5 md:flex">
        <div className="flex items-center justify-between"><Logo /><span className="bg-secondary px-2 py-1 text-xs font-bold uppercase tracking-wider text-secondary-foreground">Studio</span></div>
        <button type="button" onClick={() => setWorkspaceSettingsOpen((open) => !open)} aria-expanded={workspaceSettingsOpen} className="mt-9 flex min-h-11 w-full items-center justify-between border border-border px-3 text-left text-sm font-semibold hover:bg-muted"><span className="truncate">{org?.name || "Workspace"}</span><ChevronDown size={15} aria-hidden="true" /></button>
        <p className="mb-2 mt-8 text-xs font-bold uppercase tracking-widest text-muted-foreground">Workspace</p>
        <a href="#experiments" className="flex min-h-11 items-center gap-3 border-l-2 border-primary bg-accent px-3 text-sm font-bold"><FlaskConical size={16} aria-hidden="true" />Experiments</a>
        <a href="#environment" className="flex min-h-11 items-center gap-3 px-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"><Database size={16} aria-hidden="true" />Environments</a>
        <a href="#reports" className="flex min-h-11 items-center gap-3 px-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"><ArrowDownToLine size={16} aria-hidden="true" />Reports</a>
        <div className="mt-9 flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Experiments</p><button type="button" onClick={() => setShowNew(true)} aria-label="Create experiment" className="grid size-10 place-items-center hover:bg-muted"><Plus size={17} aria-hidden="true" /></button></div>
        <nav id="experiments" className="mt-2 space-y-1" aria-label="Experiments">
          {experiments.length ? experiments.map((experiment) => <button type="button" key={experiment.id} onClick={() => { setActiveId(experiment.id); setComparison(null); }} className={`flex min-h-11 w-full items-center gap-3 px-3 text-left text-sm ${activeId === experiment.id ? "bg-primary font-bold text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}><span className="size-2 shrink-0 rounded-full bg-secondary" /><span className="truncate">{experiment.title}</span></button>) : <p className="px-3 py-3 text-sm text-muted-foreground">No experiments yet.</p>}
        </nav>
        <div className="mt-auto border-t border-border pt-4">
          <button type="button" onClick={() => setTheme(theme === "light" ? "dark" : "light")} className="flex min-h-11 w-full items-center gap-3 px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">{theme === "light" ? <Moon size={16} aria-hidden="true" /> : <Sun size={16} aria-hidden="true" />}{theme === "light" ? "Dark appearance" : "Light appearance"}</button>
          <div className="mt-2 flex items-center gap-3 px-3 py-2"><span className="grid size-9 place-items-center rounded-full bg-secondary text-sm font-bold text-secondary-foreground">{user.username.slice(0, 1).toUpperCase()}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{user.username}</span><span className="block truncate text-xs text-muted-foreground">{user.email || "Sandbox member"}</span></span><button type="button" onClick={() => void logout()} aria-label="Sign out" className="grid size-10 place-items-center text-muted-foreground hover:bg-muted hover:text-foreground"><LogOut size={16} aria-hidden="true" /></button></div>
        </div>
      </aside>

      <section className="min-w-0 flex-1">
        <header className="flex min-h-16 items-center justify-between border-b border-border bg-background px-4 sm:px-6 lg:px-9">
          <div className="flex min-w-0 items-center gap-3 md:hidden"><Logo small /><span className="font-bold">Sandbox</span>{experiments.length > 0 && <select aria-label="Select experiment" value={activeId} onChange={(event) => { setActiveId(event.target.value); setComparison(null); }} className="min-h-10 min-w-0 max-w-36 border border-border bg-card px-2 text-xs font-semibold sm:max-w-56">{experiments.map((experiment) => <option key={experiment.id} value={experiment.id}>{experiment.title}</option>)}</select>}</div>
          <div className="hidden items-center gap-2 text-xs text-muted-foreground md:flex"><span>Workspace</span><span>/</span><span className="font-semibold text-foreground">Experiments</span>{currentExperiment && <><span>/</span><span className="max-w-48 truncate font-semibold text-foreground">{currentExperiment.title}</span></>}</div>
          <div className="flex items-center gap-2"><button type="button" onClick={() => setTheme(theme === "light" ? "dark" : "light")} aria-label={`Switch to ${theme === "light" ? "dark" : "light"} appearance`} className="grid size-10 place-items-center hover:bg-muted md:hidden">{theme === "light" ? <Moon size={17} aria-hidden="true" /> : <Sun size={17} aria-hidden="true" />}</button><button type="button" onClick={() => setShowNew(true)} className="flex min-h-10 items-center gap-2 border border-foreground bg-primary px-3 text-sm font-extrabold text-primary-foreground hover:brightness-95"><Plus size={16} aria-hidden="true" /><span className="hidden sm:inline">New experiment</span><span className="sm:hidden">New</span></button><button type="button" onClick={() => void logout()} aria-label="Sign out" className="grid size-10 place-items-center text-muted-foreground hover:bg-muted hover:text-foreground md:hidden"><LogOut size={16} aria-hidden="true" /></button></div>
        </header>

        <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-9 lg:py-10">
              {error && <div role="alert" className="mb-5 flex items-start justify-between gap-3 border border-destructive bg-card p-4 text-sm"><span>{error}</span><div className="flex shrink-0 items-center gap-1">{token && <button type="button" onClick={() => void loadWorkspace(token).catch(() => undefined)} className="min-h-10 px-3 font-bold underline underline-offset-4">Retry</button>}<button type="button" onClick={() => setError("")} aria-label="Dismiss error" className="grid size-10 place-items-center hover:bg-muted"><X size={16} aria-hidden="true" /></button></div></div>}
          {notice && <div role="status" className="mb-5 flex items-center justify-between gap-3 border border-secondary bg-accent p-4 text-sm"><span className="flex items-center gap-2"><Check size={16} aria-hidden="true" />{notice}</span><button type="button" onClick={() => setNotice("")} aria-label="Dismiss message" className="grid size-10 shrink-0 place-items-center hover:bg-muted"><X size={16} aria-hidden="true" /></button></div>}

          {workspaceSettingsOpen && org && <section className="rise mb-8 border-2 border-foreground bg-card">
            <div className="border-b border-border p-5 sm:p-6"><p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Workspace profile</p><h2 className="mt-1 text-xl font-extrabold">Business context & location</h2><p className="mt-1 text-sm text-muted-foreground">Choose a sector and optionally add a business location to give experiment drafts useful context.</p></div>
            <form onSubmit={saveWorkspaceProfile} className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
              <Field id="workspace-name" label="Workspace name" required maxLength={160} value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} />
              <div className="space-y-1.5"><label htmlFor="business-type" className="text-sm font-semibold">Business type</label><select id="business-type" value={businessType} onChange={(event) => setBusinessType(event.target.value)} className="h-11 w-full border border-border bg-card px-3 text-sm"><option value="general">General / cross-industry</option><option value="technology">Technology & SaaS</option><option value="healthcare">Healthcare & life sciences</option><option value="finance">Finance & insurance</option><option value="retail">Retail & ecommerce</option><option value="manufacturing">Manufacturing</option><option value="logistics">Logistics & transportation</option><option value="hospitality">Hospitality & travel</option><option value="education">Education</option><option value="government">Government & public services</option><option value="energy">Energy & utilities</option><option value="construction">Construction & real estate</option><option value="agriculture">Agriculture & food</option><option value="media">Media & entertainment</option><option value="professional_services">Professional services</option><option value="nonprofit">Nonprofit</option><option value="other">Other</option></select></div>
              <Field id="workspace-country" label="Country" autoComplete="country-name" value={workspaceCountry} onChange={(event) => setWorkspaceCountry(event.target.value)} placeholder="e.g. Nigeria" />
              <Field id="workspace-region" label="State / region" autoComplete="address-level1" value={workspaceRegion} onChange={(event) => setWorkspaceRegion(event.target.value)} placeholder="e.g. Lagos State" />
              <Field id="workspace-city" label="City" autoComplete="address-level2" value={workspaceCity} onChange={(event) => setWorkspaceCity(event.target.value)} placeholder="e.g. Lagos" />
              <Field id="workspace-timezone" label="Time zone" value={workspaceTimezone} onChange={(event) => setWorkspaceTimezone(event.target.value)} placeholder="e.g. Africa/Lagos" hint="Used as business context; it does not change simulation time units." />
              <div className="border border-border p-3 sm:col-span-2"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-start gap-2"><MapPin size={16} className="mt-0.5" aria-hidden="true" /><div><p className="text-sm font-semibold">Precise coordinates (optional)</p><p className="mt-1 text-xs text-muted-foreground">Browser location is requested only when you click the button. Firebase Authentication does not provide a business address or GPS location.</p></div></div><button type="button" onClick={useCurrentLocation} className="min-h-10 border border-border px-3 text-sm font-bold hover:bg-muted">Use current location</button></div>{workspaceCoordinates.latitude !== null && <p className="mt-3 font-mono text-xs text-muted-foreground">{workspaceCoordinates.latitude}, {workspaceCoordinates.longitude}</p>}</div>
              <div className="flex justify-end gap-2 sm:col-span-2"><button type="button" onClick={() => setWorkspaceSettingsOpen(false)} className="min-h-11 border border-border px-4 text-sm font-semibold">Cancel</button><button type="submit" disabled={busy} className="min-h-11 border border-foreground bg-primary px-4 text-sm font-extrabold text-primary-foreground">Save workspace profile</button></div>
            </form>
          </section>}

          {showNew && <section className="rise mb-8 border-2 border-foreground bg-card">
            <div className="flex items-start justify-between border-b border-border p-5 sm:p-6"><div><p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">New experiment</p><h2 className="mt-1 text-xl font-extrabold">Start with a question</h2></div><button type="button" onClick={() => setShowNew(false)} aria-label="Close new experiment form" className="grid size-10 place-items-center hover:bg-muted"><X size={18} aria-hidden="true" /></button></div>
            <form onSubmit={createExperiment} className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[1fr_1fr]" aria-busy={busy}>
              <div className="space-y-4">
                <Field id="experiment-title" label="Experiment name" required maxLength={200} placeholder="e.g. Service desk capacity" value={title} onChange={(event) => setTitle(event.target.value)} />
                <div className="border border-border bg-muted p-4"><p className="text-sm font-bold">Start with an industry prompt</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Prompts help frame the question. They do not supply business facts or model assumptions.</p><div className="mt-3 flex flex-col gap-2 sm:flex-row"><select aria-label="Industry starter prompt" value={selectedStarter} onChange={(event) => setSelectedStarter(event.target.value)} className="h-11 min-w-0 flex-1 border border-border bg-card px-3 text-sm"><option value="">Choose a starting point…</option>{starterPrompts.map((starter) => <option key={starter.domain} value={starter.domain}>{starter.label}</option>)}</select><button type="button" disabled={!selectedStarter} onClick={() => { const starter = starterPrompts.find((item) => item.domain === selectedStarter); if (starter) { setTitle(starter.title); setIdea(starter.text); setDomain(starter.domain); setAiDraft(null); } }} className="min-h-11 border border-border bg-card px-4 text-sm font-bold hover:bg-background disabled:opacity-50">Use prompt</button></div></div>
                {projects.length > 0 && projectForExperiment !== "__new" ? <div className="space-y-1.5"><label htmlFor="experiment-project" className="text-sm font-semibold">Project</label><select id="experiment-project" value={projectForExperiment} onChange={(event) => setProjectForExperiment(event.target.value)} className="h-11 w-full border border-border bg-card px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring">{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}<option value="__new">Create a new project…</option></select></div> : <Field id="project-name" label="Project name" required maxLength={160} value={newProjectName} onChange={(event) => setNewProjectName(event.target.value)} hint="Experiments are grouped into projects." />}
                <div className="space-y-1.5"><label htmlFor="experiment-environment" className="text-sm font-semibold">Environment <span className="font-normal text-muted-foreground">(optional)</span></label><select id="experiment-environment" value={environmentForExperiment} onChange={(event) => setEnvironmentForExperiment(event.target.value)} className="h-11 w-full border border-border bg-card px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring"><option value="">No environment linked</option>{environments.map((environment) => <option key={environment.id} value={environment.id}>{environment.name}</option>)}</select><p className="text-xs text-muted-foreground">Attach source and provenance records to an experiment environment.</p></div>
                <div className="space-y-1.5"><label htmlFor="idea" className="text-sm font-semibold">What are you trying to understand?</label><textarea id="idea" required minLength={5} rows={4} value={idea} onChange={(event) => setIdea(event.target.value)} placeholder="Describe the system and the decision you want to explore." className="w-full resize-y border border-border bg-card p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" /><p className="text-xs text-muted-foreground">AI can help turn this into a draft. You review every assumption before saving.</p></div>
                <button type="button" disabled={busy || idea.trim().length < 20} onClick={() => void draftWithAi()} className="flex min-h-11 items-center gap-2 border border-border px-4 text-sm font-bold hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"><Sparkles size={16} aria-hidden="true" />{busy ? "Working…" : "Draft configuration with AI"}</button>
                {aiDraft && <div className="border border-border bg-muted p-4 text-sm"><p className="font-bold">AI draft · {aiDraft.suggested_engine}</p><p className="mt-1 text-muted-foreground">{aiDraft.interpretation_notice}</p>{aiDraft.assumptions.length > 0 && <ul className="mt-3 list-disc space-y-1 pl-5">{aiDraft.assumptions.map((item) => <li key={item}>{item}</li>)}</ul>}{aiDraft.missing_information.length > 0 && <div className="mt-3"><p className="font-semibold">Questions to resolve</p><ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">{aiDraft.missing_information.map((item) => <li key={item}>{item}</li>)}</ul></div>}{aiDraft.configuration_errors.length > 0 && <p className="mt-3 font-semibold text-destructive">{aiDraft.configuration_errors.join(" ")}</p>}</div>}
              </div>
              <div className="border border-border bg-background p-4 sm:p-5">
                <div className="flex items-center gap-2"><Settings2 size={17} aria-hidden="true" /><h3 className="font-extrabold">Queue model configuration</h3></div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">A discrete event model of incoming work and parallel servers. These values are assumptions you can edit.</p>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <Field id="arrival" label="Arrivals per hour" type="text" inputMode="decimal" pattern="[0-9]+([.][0-9]+)?" required placeholder="e.g. 18" value={arrival} onChange={(event) => setArrival(event.target.value)} />
                  <Field id="service" label="Service rate per server" type="text" inputMode="decimal" pattern="[0-9]+([.][0-9]+)?" required placeholder="e.g. 24" value={service} onChange={(event) => setService(event.target.value)} hint="Jobs per hour, each server" />
                  <Field id="servers" label="Number of servers" type="text" inputMode="numeric" pattern="[0-9]+" required placeholder="e.g. 2" value={servers} onChange={(event) => setServers(event.target.value)} />
                  <Field id="duration" label="Run duration (hours)" type="text" inputMode="decimal" pattern="[0-9]+([.][0-9]+)?" required placeholder="e.g. 8" value={duration} onChange={(event) => setDuration(event.target.value)} />
                </div>
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4"><p className="max-w-sm text-xs leading-5 text-muted-foreground">Modelled outputs depend on the inputs and engine assumptions. They are not forecasts.</p><button disabled={busy} type="submit" className="flex min-h-11 items-center gap-2 border border-foreground bg-primary px-4 text-sm font-extrabold text-primary-foreground disabled:opacity-60">{busy && <LoaderCircle size={15} className="motion-safe:animate-spin" aria-hidden="true" />}Save experiment</button></div>
              </div>
            </form>
          </section>}

          {!currentExperiment ? <section className="mx-auto max-w-3xl border-2 border-foreground bg-card p-6 sm:p-10">
            <div className="inline-flex items-center gap-2 bg-accent px-3 py-2 text-xs font-bold uppercase tracking-wider"><FlaskConical size={14} aria-hidden="true" /> Your workspace</div>
            <h1 className="mt-6 max-w-xl text-3xl font-black tracking-tight sm:text-4xl">Turn a question into a model you can inspect.</h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">Create an experiment, choose its assumptions, then run and compare scenarios. Start with the queue model and add other simulation engines as your work grows.</p>
            <button type="button" onClick={() => setShowNew(true)} className="mt-7 flex min-h-12 items-center gap-2 border border-foreground bg-primary px-5 text-sm font-extrabold text-primary-foreground hover:brightness-95"><Plus size={17} aria-hidden="true" />Create your first experiment</button>
            <div className="mt-9 grid gap-3 sm:grid-cols-3"><div className="border border-border p-4"><span className="font-mono text-xs text-muted-foreground">01</span><p className="mt-2 font-bold">Define</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Record the question and assumptions.</p></div><div className="border border-border p-4"><span className="font-mono text-xs text-muted-foreground">02</span><p className="mt-2 font-bold">Run</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Launch a reproducible simulation.</p></div><div className="border border-border p-4"><span className="font-mono text-xs text-muted-foreground">03</span><p className="mt-2 font-bold">Compare</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Inspect changes across scenarios.</p></div></div>
          </section> : <div className="rise space-y-7">
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><div className="flex flex-wrap items-center gap-2"><span className="border border-border bg-card px-2 py-1 text-xs font-bold uppercase tracking-wider">{currentExperiment.domain.replaceAll("_", " ")}</span><span className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className="size-2 rounded-full bg-secondary" /> Version {currentExperiment.version}</span></div><h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">{currentExperiment.title}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{currentExperiment.objective || "No objective added."}</p></div><div className="flex flex-wrap items-end gap-3"><div className="space-y-1"><label htmlFor="run-seed" className="text-xs font-semibold">Seed (optional)</label><input id="run-seed" type="text" inputMode="numeric" pattern="[0-9]+" value={runSeed} onChange={(event) => setRunSeed(event.target.value)} placeholder="Random" className="h-11 w-28 border border-border bg-card px-3 font-mono text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" /></div><button type="button" disabled={!activeScenario || busy} onClick={() => activeScenario && void startRun(activeScenario)} className="flex min-h-11 shrink-0 items-center justify-center gap-2 border border-foreground bg-primary px-4 text-sm font-extrabold text-primary-foreground disabled:opacity-50"><Play size={16} aria-hidden="true" />Run scenario</button></div></div>
            <section aria-label="Experiment overview" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Arrivals / hour" value={String(config.arrival_rate_per_hour ?? "—")} note="Configured assumption" /><MetricCard label="Service rate" value={String(config.service_rate_per_hour_per_server ?? "—")} note="Per server, per hour" /><MetricCard label="Servers" value={String(config.servers ?? "—")} note="Parallel capacity" /><MetricCard label="Duration" value={`${config.duration_hours ?? "—"} h`} note="Simulation window" /></section>

            <div className="grid gap-7 xl:grid-cols-[minmax(0,1.3fr)_minmax(300px,0.7fr)]">
              <section className="min-w-0 border border-border bg-card">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5"><div><p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Scenario workbench</p><h2 className="mt-1 text-lg font-extrabold">Choose a scenario</h2></div><button type="button" onClick={() => { setBranchArrival(String(Number(config.arrival_rate_per_hour || 0) * 1.25)); setShowBranch(true); }} disabled={!activeScenario} className="flex min-h-10 items-center gap-2 border border-border px-3 text-sm font-bold hover:bg-muted disabled:opacity-50"><Plus size={15} aria-hidden="true" />Branch scenario</button></div>
                {showBranch && <form onSubmit={branchScenario} className="grid gap-3 border-b border-border bg-muted p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"><Field id="branch-name" label="Scenario name" required value={branchName} onChange={(event) => setBranchName(event.target.value)} /><Field id="branch-arrival" label="Arrivals / hour" type="text" inputMode="decimal" required value={branchArrival} onChange={(event) => setBranchArrival(event.target.value)} hint="Other settings inherit from parent" /><div className="flex gap-2"><button type="button" onClick={() => setShowBranch(false)} className="min-h-11 border border-border px-3 text-sm font-semibold">Cancel</button><button type="submit" disabled={busy} className="min-h-11 border border-foreground bg-primary px-3 text-sm font-extrabold text-primary-foreground">Create & run</button></div></form>}
                <div className="divide-y divide-border">
                  {scenarios.length === 0 ? <div className="p-8 text-center"><p className="font-bold">Loading scenarios</p><p className="mt-1 text-sm text-muted-foreground">The baseline scenario appears here when it is ready.</p></div> : scenarios.map((scenario) => {
                    const scenarioRuns = runs.filter((run) => run.scenario_id === scenario.id);
                    const latest = scenarioRuns[0];
                    return <button type="button" key={scenario.id} onClick={() => { setSelectedScenario(scenario.id); setComparison(null); }} className={`flex min-h-20 w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-muted ${activeScenario?.id === scenario.id ? "bg-accent/60" : ""}`}>
                      <span className="flex min-w-0 items-center gap-3"><span className={`grid size-10 shrink-0 place-items-center border border-border ${scenario.is_baseline ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}><FlaskConical size={17} aria-hidden="true" /></span><span className="min-w-0"><span className="flex flex-wrap items-center gap-2"><span className="truncate font-bold">{scenario.name}</span>{scenario.is_baseline && <span className="bg-muted px-2 py-0.5 text-xs font-bold uppercase tracking-wider">Baseline</span>}</span><span className="mt-1 block text-xs text-muted-foreground">{Object.keys(scenario.overrides).length ? `${Object.entries(scenario.overrides).map(([key, value]) => `${key.replaceAll("_", " ")}: ${value}`).join(" · ")}` : "Uses experiment settings"}</span></span></span>
                      <span className="flex shrink-0 items-center gap-3"><span className="hidden text-xs text-muted-foreground sm:inline">{latest ? <span className="inline-flex items-center gap-1.5"><span className={`size-2 rounded-full ${latest.status === "completed" ? "bg-success" : latest.status === "failed" ? "bg-destructive" : "motion-safe:animate-pulse bg-secondary"}`} />{statusCopy[latest.status] || latest.status}</span> : "No runs"}</span><ArrowUpRight size={16} className="text-muted-foreground" aria-hidden="true" /></span>
                    </button>;
                  })}
                </div>
              </section>

              <aside className="space-y-5">
                <section className="border border-border bg-card">
                  <div className="border-b border-border p-5"><p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Selected scenario</p><h2 className="mt-1 text-lg font-extrabold">{activeScenario?.name || "Choose a scenario"}</h2></div>
                  {selectedScenarioRun ? <div className="space-y-4 p-5">
                    {Object.entries(selectedScenarioRun.metrics || {}).filter(([name]) => name !== "assumptions").map(([name, value]) => <div key={name} className="flex items-baseline justify-between gap-4 border-b border-border pb-3"><span className="text-sm text-muted-foreground">{metricLabels[name] || name.replaceAll("_", " ")}</span><span className="font-mono text-sm font-bold tabular-nums">{formatMetric(name, value)}</span></div>)}
                    <p className="text-xs leading-5 text-muted-foreground">Seed {selectedScenarioRun.seed}. This result is from the configured queueing model.</p>
                    <button type="button" disabled={busy} onClick={() => void interpretRun(selectedScenarioRun)} className="flex min-h-10 w-full items-center justify-center gap-2 border border-border px-3 text-sm font-bold hover:bg-muted disabled:opacity-50"><Sparkles size={15} aria-hidden="true" />Explain these outputs with AI</button>
                    {runExplanation?.runId === selectedScenarioRun.id && <div className="border border-border bg-muted p-4 text-sm"><p className="font-bold">AI commentary</p><p className="mt-2 leading-6">{runExplanation.result.summary}</p>{runExplanation.result.findings.length > 0 && <><p className="mt-3 text-xs font-bold uppercase tracking-wider">Findings</p><ul className="mt-1 list-disc space-y-1 pl-5">{runExplanation.result.findings.map((item) => <li key={item}>{item}</li>)}</ul></>}{runExplanation.result.limitations.length > 0 && <><p className="mt-3 text-xs font-bold uppercase tracking-wider">Limitations</p><ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">{runExplanation.result.limitations.map((item) => <li key={item}>{item}</li>)}</ul></>}{runExplanation.result.follow_up_questions.length > 0 && <><p className="mt-3 text-xs font-bold uppercase tracking-wider">Questions to explore</p><ul className="mt-1 list-disc space-y-1 pl-5">{runExplanation.result.follow_up_questions.map((item) => <li key={item}>{item}</li>)}</ul></>}<p className="mt-3 border-t border-border pt-3 text-xs leading-5 text-muted-foreground">{runExplanation.result.interpretation_notice}</p></div>}
                    {Array.isArray(selectedScenarioRun.metrics?.assumptions) && <details className="border border-border p-3"><summary className="cursor-pointer text-sm font-semibold">Model assumptions</summary><ul className="mt-3 list-disc space-y-2 pl-5 text-xs leading-5 text-muted-foreground">{(selectedScenarioRun.metrics.assumptions as unknown as string[]).map((assumption) => <li key={assumption}>{assumption}</li>)}</ul></details>}
                    <div className="grid grid-cols-3 gap-2" id="reports"><button type="button" disabled={busy} onClick={() => void downloadReport(selectedScenarioRun, "pdf")} className="min-h-10 border border-border text-xs font-bold hover:bg-muted">PDF</button><button type="button" disabled={busy} onClick={() => void downloadReport(selectedScenarioRun, "csv")} className="min-h-10 border border-border text-xs font-bold hover:bg-muted">CSV</button><button type="button" disabled={busy} onClick={() => void downloadReport(selectedScenarioRun, "json")} className="min-h-10 border border-border text-xs font-bold hover:bg-muted">JSON</button></div>
                  </div> : <div className="p-5"><div className="grid size-10 place-items-center bg-muted"><Clock3 size={18} aria-hidden="true" /></div><p className="mt-3 font-bold">{runs.find((run) => run.scenario_id === activeScenario?.id) ? "Run in progress" : "No completed run yet"}</p><p className="mt-1 text-sm leading-5 text-muted-foreground">Start this scenario to see modelled metrics and export a report.</p>{runs.filter((run) => run.scenario_id === activeScenario?.id).map((run) => <div key={run.id} className="mt-4 flex items-center justify-between border border-border p-3 text-xs"><span className="font-mono">{run.id.slice(0, 8)} · seed {run.seed}</span><span className="font-bold">{statusCopy[run.status] || run.status}{run.status === "running" && ` ${run.progress}%`}</span></div>)}</div>}
                </section>
                <section className="border border-border bg-card">
                  <div className="flex items-start justify-between gap-3 border-b border-border p-5"><div><p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Run history</p><h2 className="mt-1 text-lg font-extrabold">Compare results</h2></div><RefreshCw size={16} className={liveRuns ? "motion-safe:animate-spin text-secondary" : "text-muted-foreground"} aria-hidden="true" /></div>
                  {runs.length === 0 ? <div className="p-5 text-sm text-muted-foreground">Runs will appear here after you start a scenario.</div> : <div className="max-h-72 divide-y divide-border overflow-auto">{runs.map((run) => <div key={run.id} className="flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-muted"><input id={`compare-${run.id}`} type="checkbox" checked={selectedRuns.includes(run.id)} disabled={run.status !== "completed" || (!selectedRuns.includes(run.id) && selectedRuns.length >= 10)} onChange={(event) => setSelectedRuns((items) => event.target.checked ? [...items, run.id] : items.filter((id) => id !== run.id))} className="size-4 accent-[var(--primary)]" /><label htmlFor={`compare-${run.id}`} className="min-w-0 flex-1 cursor-pointer"><span className="block truncate text-sm font-semibold">{scenarios.find((item) => item.id === run.scenario_id)?.name || "Scenario"}</span><span className="block text-xs text-muted-foreground">{new Date(run.created_at).toLocaleString()} · seed {run.seed}</span></label><span className="text-xs font-bold">{statusCopy[run.status] || run.status}</span>{(run.status === "queued" || run.status === "running") && <button type="button" disabled={busy} onClick={() => void cancelRun(run)} className="min-h-10 border border-border px-2 text-xs font-semibold hover:bg-card disabled:opacity-50">Cancel</button>}</div>)}</div>}
                  <div className="border-t border-border p-4"><button type="button" disabled={selectedRuns.length < 2 || busy} onClick={() => void compareRuns()} className="flex min-h-10 w-full items-center justify-center gap-2 border border-foreground bg-primary px-3 text-sm font-extrabold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50">Compare selected ({selectedRuns.length})</button>
                    {comparison && <div className="mt-4 space-y-3">{comparison.metrics.map((item) => <div key={item.metric} className="border border-border p-3"><p className="text-sm font-bold">{metricLabels[item.metric] || item.metric.replaceAll("_", " ")}</p><div className="mt-2 space-y-1">{Object.entries(item.values).map(([id, value]) => <p key={id} className="flex justify-between gap-3 font-mono text-xs"><span>{scenarios.find((s) => s.id === runs.find((r) => r.id === id)?.scenario_id)?.name || id.slice(0, 8)}</span><span>{formatMetric(item.metric, value)}{item.delta_from_first && item.delta_from_first[id] !== 0 && <span className="ml-2 text-muted-foreground">({item.delta_from_first[id] > 0 ? "+" : ""}{formatMetric(item.metric, item.delta_from_first[id])})</span>}</span></p>)}</div></div>)}</div>}
                  </div>
                </section>
              </aside>
            </div>
            <section id="environment" className="border border-border bg-card">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5"><div><p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Environment library</p><h2 className="mt-1 text-lg font-extrabold">Sources & context</h2></div><button type="button" onClick={() => setNewEnvironmentOpen((open) => !open)} className="flex min-h-10 items-center gap-2 border border-border px-3 text-sm font-bold hover:bg-muted"><Plus size={15} aria-hidden="true" />New environment</button></div>
              {newEnvironmentOpen && <form onSubmit={createEnvironment} className="grid gap-3 border-b border-border bg-muted p-4 sm:grid-cols-2 xl:grid-cols-3 sm:items-end"><Field id="environment-name" label="Environment name" required value={environmentName} onChange={(event) => setEnvironmentName(event.target.value)} placeholder="e.g. Lagos service desk" /><div className="space-y-1.5"><label htmlFor="environment-type" className="text-sm font-semibold">Environment type</label><select id="environment-type" value={environmentType} onChange={(event) => setEnvironmentType(event.target.value as Environment["environment_type"])} className="h-11 w-full border border-border bg-card px-3 text-sm"><option value="synthetic">Synthetic</option><option value="real_world">Real world</option><option value="digital_twin">Digital twin</option></select></div><Field id="environment-country" label="Country" autoComplete="country-name" value={environmentCountry} onChange={(event) => setEnvironmentCountry(event.target.value)} placeholder="e.g. Nigeria" /><Field id="environment-city" label="City / area" autoComplete="address-level2" value={environmentCity} onChange={(event) => setEnvironmentCity(event.target.value)} placeholder="e.g. Lagos" /><div className="space-y-2"><p className="text-sm font-semibold">Coordinates <span className="font-normal text-muted-foreground">(optional)</span></p><button type="button" onClick={locateEnvironment} className="min-h-11 w-full border border-border bg-card px-3 text-sm font-bold hover:bg-background">{environmentCoordinates.latitude === null ? "Use current location" : `${environmentCoordinates.latitude}, ${environmentCoordinates.longitude}`}</button></div><div className="flex items-end"><button type="submit" disabled={busy} className="min-h-11 w-full border border-foreground bg-primary px-4 text-sm font-extrabold text-primary-foreground">Save environment</button></div><p className="text-xs leading-5 text-muted-foreground sm:col-span-2 xl:col-span-3">Location is optional. Current location is only requested after you choose the button, and it is stored as environment metadata. No map data is imported automatically.</p></form>}
              {environments.length ? <div className="grid gap-0 lg:grid-cols-[0.8fr_1.2fr]">
                <div className="divide-y divide-border border-b border-border lg:border-b-0 lg:border-r">{environments.map((environment) => <button type="button" key={environment.id} onClick={() => void selectEnvironment(environment.id)} className={`flex min-h-16 w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted ${activeEnvironmentId === environment.id ? "bg-accent/60" : ""}`}><span className="min-w-0"><span className="block truncate text-sm font-bold">{environment.name}</span><span className="text-xs text-muted-foreground">{environment.environment_type.replaceAll("_", " ")} · v{environment.version}</span></span><ArrowUpRight size={16} aria-hidden="true" /></button>)}</div>
                <div className="p-4"><p className="font-bold">{environments.find((item) => item.id === activeEnvironmentId)?.name || "Select an environment"}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Record dataset names, source links, and licenses for traceability. Attaching a source does not automatically import or validate its contents.</p>
                  {activeEnvironmentId && <><form onSubmit={attachDataset} className="mt-4 grid gap-3 sm:grid-cols-2"><Field id="dataset-name" label="Dataset name" required value={datasetName} onChange={(event) => setDatasetName(event.target.value)} /><Field id="dataset-source" label="Source URL" type="url" value={datasetSource} onChange={(event) => setDatasetSource(event.target.value)} placeholder="https://" /><button type="submit" disabled={busy} className="min-h-10 border border-foreground bg-secondary px-3 text-sm font-bold text-secondary-foreground sm:col-span-2">Attach source record</button></form><div className="mt-4 space-y-2">{datasets.map((dataset) => <div key={dataset.id} className="flex flex-wrap items-center justify-between gap-2 border border-border p-3 text-xs"><span className="font-bold">{dataset.name}</span>{dataset.source_url ? <a className="max-w-full truncate underline" href={dataset.source_url} target="_blank" rel="noreferrer">{dataset.source_url}</a> : <span className="text-muted-foreground">No source URL</span>}</div>)}{datasets.length === 0 && <p className="text-xs text-muted-foreground">No source records attached yet.</p>}</div></>}
                </div>
              </div> : <div className="p-5 text-sm text-muted-foreground">Create an environment to keep its type, configuration, and source provenance alongside an experiment.</div>}
            </section>
            <section className="flex flex-col justify-between gap-3 border border-border bg-muted p-5 sm:flex-row sm:items-center"><div className="flex items-start gap-3"><Database size={18} className="mt-0.5" aria-hidden="true" /><div><p className="font-bold">Model notes</p><p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">This first engine simulates exponential arrivals and service times with parallel servers. It does not include real-world demand data, staffing schedules, or domain-specific effects. AI-generated content is a draft and never determines run results.</p></div></div><span className="grid size-10 shrink-0 place-items-center border border-border bg-card" title="Model details"><CircleHelp size={16} aria-hidden="true" /></span></section>
            {latestRun?.status === "failed" && latestRun.error && <p role="alert" className="border border-destructive p-4 text-sm">Run failed: {latestRun.error}</p>}
          </div>}
        </div>
      </section>
    </div>
  </main>;
}
