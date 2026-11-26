"use client";

import {
  Github, ArrowDownToLine, ArrowUpRight, Beaker, Check, ChevronDown,
  CircleHelp, Database, FlaskConical, LoaderCircle, LogOut, MapPin, Moon,
  Play, Plus, RefreshCw, Settings2, Sparkles, Sun, Users, X,
} from "lucide-react";
import {
  GoogleAuthProvider, User as FirebaseUser,
  createUserWithEmailAndPassword, getIdToken, onAuthStateChanged,
  signInWithPopup, signOut,
} from "firebase/auth";
import { type FormEvent, type InputHTMLAttributes, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, API_URL, ApiSession, Dataset, Environment, Experiment, IdeaDecisionBrief, Interpretation, jsonBody, Organization, Project, Run, RunInterpretation, Scenario, User } from "@/lib/api";
import { getFirebaseAuth } from "@/lib/firebase";
import { RunVisualizations } from "@/components/run-visualizations";
import { SandboxMascot } from "@/components/sandbox-mascot";

const SESSION_KEY = "sandbox.api-session";
const TERMINAL = new Set(["completed", "failed", "cancelled"]);
const profileSyncs = new Map<string, Promise<User>>();
type WaitlistAdminResponse = { total: number; limit: number; offset: number; entries: { email: string; source: string; created_at: string }[] };
const statusCopy: Record<string, string> = {
  queued: "Queued", running: "Running", cancel_requested: "Stopping",
  completed: "Complete", failed: "Failed", cancelled: "Cancelled",
};

function explainError(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Try again.";
}

function syncFirebaseProfile(token: string, uid: string, payload: Record<string, string> = {}) {
  const pending = profileSyncs.get(uid);
  if (pending) return pending;
  const request = api<User>("/auth/sync", token, jsonBody(payload));
  profileSyncs.set(uid, request);
  void request.finally(() => {
    if (profileSyncs.get(uid) === request) profileSyncs.delete(uid);
  }).catch(() => {});
  return request;
}

function formatMetric(name: string, value: unknown) {
  if (typeof value !== "number") return String(value);
  const percentMetric = name === "server_utilization" || name === "fill_rate" || name === "probability_positive_profit";
  const displayValue = percentMetric ? value * 100 : value;
  const unit = percentMetric ? "%" : name.includes("minutes") ? " min" : name === "duration_hours" ? " h" : name === "duration_days" ? " days" : "";
  return `${Number(displayValue.toFixed(2))}${unit}`;
}

function formatMarketRange(low: number | null, high: number | null) {
  if (low === null || high === null) return "Not estimated";
  const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 });
  return `${money.format(low)} – ${money.format(high)} / year`;
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
  return <article className="metric-tile min-w-0 border border-border bg-card p-4">
    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
    <p className="mt-3 truncate font-mono text-2xl font-bold tabular-nums">{value}</p>
    <p className="mt-1 text-xs text-muted-foreground">{note}</p>
  </article>;
}

const researchQuips = [
  "Hmm, looking at this…",
  "Aha, a branch in the market…",
  "Lemme grab a donut…",
  "Almost there…",
];

function ResearchingIdea({ idea, region }: { idea: string; region: string }) {
  const [quipIndex, setQuipIndex] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setQuipIndex((index) => (index + 1) % researchQuips.length), 3000);
    return () => window.clearInterval(timer);
  }, []);

  return <div className="research-scene rise" role="status" aria-live="polite" aria-busy="true">
    <div className="research-scene-top"><span className="research-live-dot" /><span>Sandbox is thinking</span><span className="research-top-rule" /></div>
    <div className="research-scene-grid">
      <div className="research-character-stage">
        <div className="research-orbit research-orbit-one" /><div className="research-orbit research-orbit-two" />
        <div className="research-mascot-rotator"><SandboxMascot mood="working" size="large" /></div>
        <span className="research-spark research-spark-one">✳</span><span className="research-spark research-spark-two">✦</span>
        <div key={quipIndex} className="research-quip">{researchQuips[quipIndex]}</div>
      </div>
      <div className="research-context">
        <div><p className="research-kicker">Your starting point</p><h3>Let’s find the shape of it.</h3><p className="research-caption">We’re gathering context to make the decision brief useful, balanced, and grounded in what you shared.</p></div>
        <div className="research-idea-card"><span className="research-card-mark">IDEA</span><p>{idea}</p></div>
        {region.trim() && <div className="research-region"><MapPin size={15} aria-hidden="true" /><span>{region}</span></div>}
        <div className="research-footnote"><span className="research-pulse-bars" aria-hidden="true"><i /><i /><i /></span><span>Finding the useful signal in the noise</span></div>
      </div>
    </div>
  </div>;
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
        await syncFirebaseProfile(token, credential.user.uid, {
          username,
          ...(workspace.trim() ? { workspace_name: workspace.trim() } : {}),
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

  async function social() {
    setBusy(true); setError("");
    try {
      const auth = getFirebaseAuth();
      const credential = await signInWithPopup(auth, new GoogleAuthProvider());
      const token = await getIdToken(credential.user);
      await syncFirebaseProfile(token, credential.user.uid, username ? { username } : {});
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
          <button type="button" onClick={() => void social()} disabled={busy} className="flex h-11 items-center justify-center gap-2 border border-border bg-card text-sm font-semibold hover:bg-muted disabled:opacity-60"><span className="grid size-5 place-items-center rounded-full border border-border text-xs font-bold" aria-hidden="true">G</span> Google</button>
          <div>
            <button type="button" disabled aria-describedby="github-signin-note" className="flex h-11 w-full cursor-not-allowed items-center justify-center gap-2 border border-border bg-muted text-sm font-semibold text-muted-foreground opacity-60"><Github size={16} aria-hidden="true" /> GitHub</button>
            <p id="github-signin-note" className="mt-1.5 text-center text-xs text-muted-foreground">Unavailable until GitHub sign-in is configured in Firebase.</p>
          </div>
        </div>
        <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" /> OR USE EMAIL <span className="h-px flex-1 bg-border" /></div>
        <form onSubmit={submit} className="space-y-4" aria-busy={busy}>
          {mode === "register" ? <>
            <Field id="username" label="Username" required minLength={3} maxLength={32} pattern="[A-Za-z0-9_]+" autoComplete="username" spellCheck={false} value={username} onChange={(event) => setUsername(event.target.value)} />
            <Field id="email" label="Email address" type="email" required autoComplete="email" spellCheck={false} value={email} onChange={(event) => setEmail(event.target.value)} />
            <Field id="workspace" label="Workspace name" autoComplete="organization" value={workspace} onChange={(event) => setWorkspace(event.target.value)} hint="Optional. You can change this later." />
          </> : <>
            <Field id="identifier" label="Username or email" required autoComplete="username" spellCheck={false} value={identifier} onChange={(event) => setIdentifier(event.target.value)} />
            <Field id="username-social" label="Preferred username (optional)" autoComplete="username" spellCheck={false} value={username} onChange={(event) => setUsername(event.target.value)} hint="Leave blank to get a suggested username when you first use Google." />
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
  const firebaseUid = useRef<string | null>(null);
  const workspaceLoadId = useRef(0);
  const draftingRef = useRef(false);
  const interpretationRequests = useRef(new Set<string>());
  const [session, setSession] = useState<ApiSession | null>(null);
  const [authInitialized, setAuthInitialized] = useState(false);
  const restoredToken = useRef<string | null>(null);
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
  const [selectedRunId, setSelectedRunId] = useState("");
  const [selectedScenario, setSelectedScenario] = useState("");
  const [selectedRuns, setSelectedRuns] = useState<string[]>([]);
  const [comparison, setComparison] = useState<{ metrics: { metric: string; values: Record<string, number | string>; delta_from_first: Record<string, number> | null }[] } | null>(null);
  const [runExplanation, setRunExplanation] = useState<{ runId: string; result: RunInterpretation } | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showBranch, setShowBranch] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [waitlistAdminAccess, setWaitlistAdminAccess] = useState(false);
  const [waitlistAdminLoading, setWaitlistAdminLoading] = useState(false);
  const [waitlistAdminError, setWaitlistAdminError] = useState("");
  const [waitlistAdminData, setWaitlistAdminData] = useState<WaitlistAdminResponse | null>(null);

  const [title, setTitle] = useState("");
  const [idea, setIdea] = useState("");
  const [targetRegion, setTargetRegion] = useState("");
  const [researchConsent, setResearchConsent] = useState(false);
  const [simulationOpen, setSimulationOpen] = useState(false);
  const [whatIfQuestion, setWhatIfQuestion] = useState("");
  const [arrival, setArrival] = useState("");
  const [service, setService] = useState("");
  const [servers, setServers] = useState("");
  const [duration, setDuration] = useState("");
  const [engine, setEngine] = useState("queueing");
  const [inventoryInputs, setInventoryInputs] = useState({ average_daily_demand: "", demand_std_dev: "", reorder_point: "", order_quantity: "", lead_time_days: "", initial_inventory: "", duration_days: "", unit_price: "", unit_cost: "", holding_cost_per_unit_day: "", stockout_cost_per_unit: "" });
  const [monteInputs, setMonteInputs] = useState({ trials: "5000", periods: "12", demand_min: "", demand_mode: "", demand_max: "", revenue_per_unit_min: "", revenue_per_unit_mode: "", revenue_per_unit_max: "", variable_cost_per_unit_min: "", variable_cost_per_unit_mode: "", variable_cost_per_unit_max: "", fixed_cost_per_period: "", starting_cash: "" });
  const [runSeed, setRunSeed] = useState("");
  const [domain, setDomain] = useState("general");
  const [aiDraft, setAiDraft] = useState<Interpretation | null>(null);
  const [branchName, setBranchName] = useState("Higher arrivals");
  const [branchArrival, setBranchArrival] = useState("24");

  const currentExperiment = useMemo(() => experiments.find((experiment) => experiment.id === activeId) || null, [experiments, activeId]);
  const savedDiscovery = currentExperiment?.specification.discovery as { decision_brief?: IdeaDecisionBrief; market_research?: Interpretation["market_research"] } | undefined;
  // Discovery records created before all brief fields were required can contain
  // null or missing arrays. Normalize persisted JSON before rendering it so an
  // older exploration cannot crash the whole Studio route.
  const rawSavedDecisionBrief = savedDiscovery?.decision_brief;
  const savedDecisionBrief = rawSavedDecisionBrief ? {
    ...rawSavedDecisionBrief,
    assumptions: Array.isArray(rawSavedDecisionBrief.assumptions) ? rawSavedDecisionBrief.assumptions : [],
    what_supports_it: Array.isArray(rawSavedDecisionBrief.what_supports_it) ? rawSavedDecisionBrief.what_supports_it : [],
    what_makes_it_hard: Array.isArray(rawSavedDecisionBrief.what_makes_it_hard) ? rawSavedDecisionBrief.what_makes_it_hard : [],
  } : undefined;
  const savedMarketResearch = savedDiscovery?.market_research ? {
    ...savedDiscovery.market_research,
    assumptions: Array.isArray(savedDiscovery.market_research.assumptions) ? savedDiscovery.market_research.assumptions : [],
    caveats: Array.isArray(savedDiscovery.market_research.caveats) ? savedDiscovery.market_research.caveats : [],
    sources: Array.isArray(savedDiscovery.market_research.sources) ? savedDiscovery.market_research.sources : [],
  } : undefined;
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
      return onAuthStateChanged(auth, (nextUser) => {
        const previousUid = firebaseUid.current;
        firebaseUid.current = nextUser?.uid || null;
        setFirebaseUser(nextUser);
        setAuthInitialized(true);
        const hasRestSession = Boolean(sessionStorage.getItem(SESSION_KEY));
        if ((previousUid && previousUid !== nextUser?.uid) || (nextUser && hasRestSession)) {
          workspaceLoadId.current += 1;
          restoredToken.current = null;
          sessionStorage.removeItem(SESSION_KEY);
          setSession(null); setToken(""); setUser(null); setOrg(null); setProjects([]);
          setExperiments([]); setEnvironments([]); setScenarios([]); setRuns([]);
          setSelectedScenario(""); setSelectedRunId(""); setSelectedRuns([]); setComparison(null); setRunExplanation(null);
          setActiveId(""); setLoading(true); setError("");
        }
      });
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
    const requestId = ++workspaceLoadId.current;
    setLoading(true); setError("");
    try {
      const [me, organizations, projectRows, experimentRows] = await Promise.all([
        api<User>("/users/me", accessToken), api<Organization[]>("/organizations", accessToken),
        api<Project[]>("/projects", accessToken), api<Experiment[]>("/experiments", accessToken),
      ]);
      const activeOrg = organizations[0] || null;
      const environmentRows = activeOrg
        ? await api<Environment[]>(`/environments?organization_id=${activeOrg.id}`, accessToken)
        : [];
      if (requestId !== workspaceLoadId.current) return;

      setUser(me); setOrg(activeOrg); setProjects(projectRows); setExperiments(experimentRows);
      if (activeOrg) {
        setWorkspaceName(activeOrg.name);
        setBusinessType(activeOrg.business_type || "general");
        setWorkspaceCountry(activeOrg.country || ""); setWorkspaceRegion(activeOrg.region || "");
        setWorkspaceCity(activeOrg.city || ""); setWorkspaceTimezone(activeOrg.timezone || "");
        setWorkspaceCoordinates({ latitude: activeOrg.latitude, longitude: activeOrg.longitude });
      }
      setProjectForExperiment((previous) => projectRows.some((item) => item.id === previous) ? previous : projectRows[0]?.id || "__new");
      setEnvironments(environmentRows);
      setEnvironmentForExperiment((previous) => environmentRows.some((item) => item.id === previous) ? previous : "");
      setActiveId((previous) => experimentRows.some((item) => item.id === previous) ? previous : experimentRows[0]?.id || "");
      void api<WaitlistAdminResponse>("/waitlist/admin?limit=1", accessToken)
        .then(() => { if (requestId === workspaceLoadId.current) setWaitlistAdminAccess(true); })
        .catch(() => { if (requestId === workspaceLoadId.current) setWaitlistAdminAccess(false); });
    } catch (cause) {
      if (requestId === workspaceLoadId.current) setError(explainError(cause));
      throw cause;
    } finally {
      if (requestId === workspaceLoadId.current) setLoading(false);
    }
  }, []);

  async function loadWaitlistAdmin(offset = 0) {
    setWaitlistAdminLoading(true);
    setWaitlistAdminError("");
    try {
      const data = await api<WaitlistAdminResponse>(`/waitlist/admin?limit=50&offset=${offset}`, getToken);
      setWaitlistAdminAccess(true);
      setWaitlistAdminData(data);
    } catch (cause) {
      setWaitlistAdminError(explainError(cause));
    } finally {
      setWaitlistAdminLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function restore() {
      if (!authInitialized) return;
      if (firebaseUser) {
        try {
          const accessToken = await getIdToken(firebaseUser);
          if (restoredToken.current === accessToken) return;
          await syncFirebaseProfile(accessToken, firebaseUser.uid);
          if (!cancelled && restoredToken.current !== accessToken) {
            restoredToken.current = accessToken;
            setToken(accessToken); await loadWorkspace(accessToken);
          }
        } catch { if (!cancelled) setLoading(false); }
      } else if (session) {
        try {
          const accessToken = await getToken();
          if (restoredToken.current === accessToken) return;
          await api<User>("/auth/sync", accessToken, jsonBody({}));
          if (!cancelled && restoredToken.current !== accessToken) {
            restoredToken.current = accessToken;
            setToken(accessToken); await loadWorkspace(accessToken);
          }
        }
        catch { if (!cancelled) setLoading(false); }
      } else { setUser(null); setLoading(false); }
    }
    void restore();
    return () => { cancelled = true; };
  }, [authInitialized, firebaseUser, session, getToken, loadWorkspace]);

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

  const autoReviewRun = useMemo(() => runs.find((run) => run.scenario_id === selectedScenario && run.status === "completed") || null, [runs, selectedScenario]);
  useEffect(() => {
    if (!token || !autoReviewRun || interpretationRequests.current.has(autoReviewRun.id)) return;
    interpretationRequests.current.add(autoReviewRun.id);
    let cancelled = false;
    void api<RunInterpretation>(`/ai/runs/${autoReviewRun.id}/interpret`, getToken, jsonBody({}))
      .then((result) => { if (!cancelled) setRunExplanation({ runId: autoReviewRun.id, result }); })
      .catch(() => { if (!cancelled) setNotice("The simulation finished. The balanced AI review could not be prepared yet; use Retry review below."); });
    return () => { cancelled = true; };
  }, [token, autoReviewRun?.id, getToken]);

  async function ready(accessToken: string) {
    restoredToken.current = accessToken;
    setToken(accessToken); await loadWorkspace(accessToken);
  }

  async function logout() {
    workspaceLoadId.current += 1;
    restoredToken.current = null;
    try { if (firebaseUser) await signOut(getFirebaseAuth()); } catch { /* Clear the local API session even if the SDK is unavailable. */ }
    sessionStorage.removeItem(SESSION_KEY); setSession(null); setFirebaseUser(null); setToken(""); setUser(null); setExperiments([]); setActiveId(""); setWaitlistAdminAccess(false); setWaitlistAdminData(null);
  }

  function startNewExploration() {
    setTitle(""); setIdea(""); setTargetRegion(""); setResearchConsent(false); setAiDraft(null); setError(""); setNotice("");
    setSelectedRunId(""); setWorkspaceSettingsOpen(false); setShowNew(true);
  }

  async function createExperiment(event: FormEvent<HTMLFormElement>, runAfterSave = false) {
    event.preventDefault(); if (!org) { setError("Your workspace is not ready yet."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      let project = projects.find((item) => item.id === projectForExperiment && item.organization_id === org.id);
      if (!project) {
        project = await api<Project>("/projects", getToken, jsonBody({ organization_id: org.id, name: newProjectName.trim() || "First project", description: "Experiments in this workspace." }));
        setProjects((items) => [...items, project!]);
        setProjectForExperiment(project.id);
      }
      const simulationConfig = aiDraft?.configuration_valid ? Object.fromEntries(Object.entries(aiDraft.simulation_config).filter(([, value]) => value !== null)) : null;
      const experiment = await api<Experiment>("/experiments", getToken, jsonBody({
        project_id: project.id, environment_id: null, title: title.trim() || aiDraft?.title || "New exploration", description: idea.trim(), objective: aiDraft?.objective || idea.trim(), domain,
        specification: {
          business_context: {
            business_type: org.business_type,
            location: [org.city, org.region, org.country].filter(Boolean).join(", ") || null,
            target_geography: targetRegion.trim() || aiDraft?.market_research.geography || null,
            timezone: org.timezone,
          },
          ...(simulationConfig ? { simulation: { engine, config: simulationConfig } } : {}),
          discovery: {
            user_description: idea.trim(),
            user_answers: JSON.stringify({ idea: idea.trim(), target_geography: targetRegion.trim() || null }),
            ai_assumptions: aiDraft?.assumptions || [],
            unresolved_questions: [],
            suggested_variables: aiDraft?.variables || [],
            market_research: aiDraft?.market_research || null,
            decision_brief: aiDraft?.decision_brief || null,
            evidence_status: environmentForExperiment ? "environment_linked_not_used_for_calibration" : "no_external_evidence_attached",
          },
        },
      }));
      setExperiments((items) => [experiment, ...items]); setActiveId(experiment.id); setSelectedRunId(""); setShowNew(false); setTitle(""); setIdea(""); setTargetRegion(""); setResearchConsent(false); setAiDraft(null);
      if (runAfterSave && simulationConfig) {
        const experimentScenarios = await api<Scenario[]>(`/experiments/${experiment.id}/scenarios`, getToken);
        const baseline = experimentScenarios.find((scenario) => scenario.is_baseline);
        if (!baseline) throw new Error("The baseline scenario could not be created.");
        setScenarios(experimentScenarios); setSelectedScenario(baseline.id); setSimulationOpen(true);
        const run = await api<Run>(`/scenarios/${baseline.id}/runs`, getToken, jsonBody({}));
        setRuns([run]); setNotice("Decision saved and the first illustrative simulation is running. Its assumptions and limits stay visible with the results.");
      } else {
        setNotice("Decision brief saved. No simulation was run; open the optional sandbox when you want to model a specific sub-question.");
      }
    } catch (cause) { setError(explainError(cause)); }
    finally { setBusy(false); }
  }

  async function draftWithAi() {
    if (draftingRef.current) return;
    if (!researchConsent) {
      setError("Confirm that Sandbox may share this idea with its research providers before continuing.");
      return;
    }
    if (idea.trim().length < 20) {
      setError("Add a little more detail so Sandbox can research the idea responsibly.");
      return;
    }
    draftingRef.current = true; setDrafting(true); setError("");
    try {
      const draft = await api<Interpretation>("/ai/interpret", getToken, jsonBody({ idea: idea.trim(), geography: targetRegion.trim() || null }));
      setEngine(draft.suggested_engine); setAiDraft(draft); setTitle(draft.title); setDomain(draft.domain || "general"); setArrival(String(draft.simulation_config.arrival_rate_per_hour ?? ""));
      setService(String(draft.simulation_config.service_rate_per_hour_per_server ?? ""));
      setServers(String(draft.simulation_config.servers ?? "")); setDuration(String(draft.simulation_config.duration_hours ?? ""));
      setInventoryInputs((previous) => Object.fromEntries(Object.keys(previous).map((key) => [key, draft.simulation_config[key] == null ? previous[key as keyof typeof previous] : String(draft.simulation_config[key])])) as typeof previous);
      setMonteInputs((previous) => Object.fromEntries(Object.keys(previous).map((key) => [key, draft.simulation_config[key] == null ? previous[key as keyof typeof previous] : String(draft.simulation_config[key])])) as typeof previous);
    } catch (cause) { setError(explainError(cause)); }
    finally { draftingRef.current = false; setDrafting(false); }
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

  async function submitWhatIf(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeScenario || !activeId || whatIfQuestion.trim().length < 5) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await api<{ scenario: Scenario; rationale: string; research_sources: { title: string; url: string }[] }>(
        "/ai/what-if", getToken,
        jsonBody({ experiment_id: activeId, scenario_id: activeScenario.id, question: whatIfQuestion.trim() }),
      );
      setScenarios((items) => [...items, result.scenario]); setSelectedScenario(result.scenario.id); setSimulationOpen(true);
      const run = await api<Run>(`/scenarios/${result.scenario.id}/runs`, getToken, jsonBody({}));
      setRuns((items) => [run, ...items]); setSelectedRunId(""); setWhatIfQuestion("");
      setNotice(`${result.scenario.name}: ${result.rationale}${result.research_sources.length ? ` ${result.research_sources.length} web sources reviewed.` : ""}`);
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

  if (!user && loading) return <main className="boot-splash" role="status" aria-live="polite">
    <section className="boot-card">
      <Logo />
      <SandboxMascot mood="working" size="large" />
      <h1 className="text-2xl font-black tracking-tight">Opening your Sandbox</h1>
      <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">Getting your workspace ready for the next good question.</p>
      <div className="boot-lines" aria-hidden="true"><span /><span /><span /></div>
    </section>
  </main>;
  if (!user) return <AuthScreen onReady={ready} />;

  const simulation = currentExperiment?.specification.simulation as { engine?: string; config?: Record<string, number> } | undefined;
  const currentEngine = simulation?.engine || "queueing";
  const config = simulation?.config || {};
  const selectedHistoryRun = runs.find((run) => run.id === selectedRunId) || null;
  const latestRun = selectedHistoryRun || runs[0];
  const selectedScenarioRun = selectedHistoryRun?.status === "completed" ? selectedHistoryRun : runs.find((run) => run.scenario_id === activeScenario?.id && run.status === "completed");
  const metricLabels: Record<string, string> = {
    customers_arrived: "Arrivals", customers_entered_service: "Entered service", customers_served: "Completed by horizon",
    customers_completed_after_horizon: "Completed after horizon", customers_unfinished_at_horizon: "Unfinished at horizon", mean_wait_minutes: "Average wait",
    p95_wait_minutes: "95th percentile wait", server_utilization: "Server utilization", duration_hours: "Run duration",
    total_demand: "Total demand", units_fulfilled: "Units fulfilled", units_stocked_out: "Units stocked out", fill_rate: "Fill rate",
    replenishment_orders: "Replenishment orders", ending_inventory: "Ending inventory", net_operating_result: "Net operating result",
    mean_profit: "Mean profit", median_profit: "Median profit", p10_profit: "P10 profit", p90_profit: "P90 profit", probability_positive_profit: "Positive profit share", trials: "Trials",
  };
  return <main className="studio-shell min-h-screen overflow-x-hidden">
    <div className="mx-auto flex min-h-screen max-w-[1600px]">
      <aside className="studio-sidebar hidden w-64 shrink-0 flex-col border-r border-border bg-card p-5 md:flex">
        <div className="flex min-w-0 flex-col items-start gap-3"><Logo /><span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-secondary-foreground">Studio</span></div>
        <button type="button" onClick={() => setWorkspaceSettingsOpen((open) => !open)} aria-expanded={workspaceSettingsOpen} className="mt-9 flex min-h-11 w-full items-center justify-between border border-border px-3 text-left text-sm font-semibold hover:bg-muted"><span className="truncate">{org?.name || "Workspace"}</span><ChevronDown size={15} aria-hidden="true" /></button>
        <p className="mb-2 mt-8 text-xs font-bold uppercase tracking-widest text-muted-foreground">Workspace</p>
        <a href="#experiments" className="flex min-h-11 items-center gap-3 border-l-2 border-primary bg-accent px-3 text-sm font-bold"><FlaskConical size={16} aria-hidden="true" />Explorations</a>
        <a href="#environment" className="flex min-h-11 items-center gap-3 px-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"><Database size={16} aria-hidden="true" />Environments</a>
        <a href="#reports" className="flex min-h-11 items-center gap-3 px-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"><ArrowDownToLine size={16} aria-hidden="true" />Reports</a>
        {waitlistAdminAccess && <a href="#waitlist-admin" onClick={() => void loadWaitlistAdmin(0)} className="flex min-h-11 items-center gap-3 px-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"><Users size={16} aria-hidden="true" />Waitlist</a>}
        <div className="sidebar-content">
          <section className="sidebar-explorations">
            <div className="flex shrink-0 items-center justify-between"><p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Your explorations</p><button type="button" onClick={startNewExploration} aria-label="Start an exploration" className="grid size-10 shrink-0 place-items-center hover:bg-muted"><Plus size={17} aria-hidden="true" /></button></div>
            <nav id="experiments" className="studio-nav mt-2 space-y-1" aria-label="Experiments">
              {experiments.length ? experiments.map((experiment) => <button type="button" key={experiment.id} onClick={() => { setShowNew(false); setSelectedRunId(""); setActiveId(experiment.id); setComparison(null); }} className={`flex min-h-11 w-full items-center gap-3 px-3 text-left text-sm ${activeId === experiment.id ? "bg-primary font-bold text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}><span className="size-2 shrink-0 rounded-full bg-secondary" /><span className="truncate">{experiment.title}</span></button>) : <p className="px-3 py-3 text-sm text-muted-foreground">No explorations yet.</p>}
            </nav>
          </section>
          <section className="sidebar-runs">
            <p className="shrink-0 px-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Recent runs</p>
            {runs.length ? <nav aria-label="Recent runs" className="studio-nav mt-2 space-y-1">{runs.slice(0, 8).map((run) => <button type="button" key={run.id} onClick={() => { setShowNew(false); setSelectedScenario(run.scenario_id); setSelectedRunId(run.id); setComparison(null); }} className={`w-full rounded-2xl px-3 py-2.5 text-left transition-colors ${selectedRunId === run.id ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}><span className="block truncate text-sm font-semibold">{scenarios.find((scenario) => scenario.id === run.scenario_id)?.name || "Scenario run"}</span><span className="mt-1 flex items-center justify-between gap-2 text-xs"><span className="truncate">Seed {run.seed}</span><span className="shrink-0 font-bold">{statusCopy[run.status] || run.status}</span></span></button>)}</nav> : <p className="px-3 py-2 text-xs leading-5 text-muted-foreground">Runs appear here after you start a scenario.</p>}
          </section>
        </div>
        <div className="sidebar-footer border-t border-border pt-3">
          <button type="button" onClick={() => setTheme(theme === "light" ? "dark" : "light")} className="flex min-h-11 w-full items-center gap-3 px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">{theme === "light" ? <Moon size={16} aria-hidden="true" /> : <Sun size={16} aria-hidden="true" />}{theme === "light" ? "Dark appearance" : "Light appearance"}</button>
          <div className="mt-2 flex items-center gap-3 px-3 py-2"><span className="grid size-9 place-items-center rounded-full bg-secondary text-sm font-bold text-secondary-foreground">{user.username.slice(0, 1).toUpperCase()}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{user.username}</span><span className="block truncate text-xs text-muted-foreground">{user.email || "Sandbox member"}</span></span><button type="button" onClick={() => void logout()} aria-label="Sign out" className="grid size-10 place-items-center text-muted-foreground hover:bg-muted hover:text-foreground"><LogOut size={16} aria-hidden="true" /></button></div>
        </div>
      </aside>

      <section className="min-w-0 flex-1 overflow-x-hidden">
        <header className="studio-topbar flex min-h-16 items-center justify-between border-b border-border bg-background px-4 sm:px-6 lg:px-9">
          <div className="flex min-w-0 items-center gap-2 md:hidden"><Logo small /><span className="font-bold">Sandbox</span><button type="button" onClick={() => setWorkspaceSettingsOpen((open) => !open)} aria-label="Workspace settings" aria-expanded={workspaceSettingsOpen} className="grid size-10 shrink-0 place-items-center text-muted-foreground hover:bg-muted hover:text-foreground"><MapPin size={17} aria-hidden="true" /></button>{experiments.length > 0 && <select aria-label="Select experiment" value={activeId} onChange={(event) => { setShowNew(false); setSelectedRunId(""); setActiveId(event.target.value); setComparison(null); }} className="min-h-10 min-w-0 max-w-36 border border-border bg-card px-2 text-xs font-semibold sm:max-w-56">{experiments.map((experiment) => <option key={experiment.id} value={experiment.id}>{experiment.title}</option>)}</select>}</div>
          <div className="hidden min-w-0 items-center gap-2 text-xs text-muted-foreground md:flex"><span>Workspace</span><span aria-hidden="true">/</span><span className="shrink-0 font-semibold text-foreground">Explorations</span>{currentExperiment && <><span aria-hidden="true">/</span><span className="min-w-0 max-w-48 truncate font-semibold text-foreground">{currentExperiment.title}</span></>}</div>
          <div className="flex items-center gap-2">{waitlistAdminAccess && <a href="#waitlist-admin" onClick={() => void loadWaitlistAdmin(0)} className="flex min-h-10 items-center gap-2 rounded-full border border-border px-3 text-xs font-bold text-muted-foreground hover:bg-muted hover:text-foreground"><Users size={15} aria-hidden="true" /><span>Waitlist</span></a>}<button type="button" onClick={() => setTheme(theme === "light" ? "dark" : "light")} aria-label={`Switch to ${theme === "light" ? "dark" : "light"} appearance`} className="grid size-10 place-items-center hover:bg-muted md:hidden">{theme === "light" ? <Moon size={17} aria-hidden="true" /> : <Sun size={17} aria-hidden="true" />}</button><button type="button" onClick={startNewExploration} className="flex min-h-10 items-center gap-2 border border-foreground bg-primary px-3 text-sm font-extrabold text-primary-foreground hover:brightness-95"><Plus size={16} aria-hidden="true" /><span className="hidden sm:inline">New exploration</span><span className="sm:hidden">New</span></button><button type="button" onClick={() => void logout()} aria-label="Sign out" className="grid size-10 place-items-center text-muted-foreground hover:bg-muted hover:text-foreground md:hidden"><LogOut size={16} aria-hidden="true" /></button></div>
        </header>

        <div className="studio-canvas mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-9 lg:py-10">
          {!showNew && error && <div role="alert" className="mb-5 flex items-center gap-3 border border-destructive bg-card p-4 text-sm"><SandboxMascot mood="oops" size="small" /><span className="min-w-0 flex-1">{error}</span><div className="flex shrink-0 items-center gap-1">{token && <button type="button" onClick={() => void loadWorkspace(token).catch(() => undefined)} className="min-h-10 px-3 font-bold underline underline-offset-4">Retry</button>}<button type="button" onClick={() => setError("")} aria-label="Dismiss error" className="grid size-10 place-items-center hover:bg-muted"><X size={16} aria-hidden="true" /></button></div></div>}
          {!showNew && notice && <div role="status" className="mb-5 flex items-center justify-between gap-3 border border-secondary bg-accent p-4 text-sm"><span className="flex items-center gap-2"><Check size={16} aria-hidden="true" />{notice}</span><button type="button" onClick={() => setNotice("")} aria-label="Dismiss message" className="grid size-10 shrink-0 place-items-center hover:bg-muted"><X size={16} aria-hidden="true" /></button></div>}
          {waitlistAdminAccess && <a href="#waitlist-admin" onClick={() => void loadWaitlistAdmin(0)} className="mb-5 inline-flex min-h-10 items-center gap-2 rounded-full border border-border bg-card px-4 text-xs font-bold text-muted-foreground hover:bg-muted hover:text-foreground md:hidden"><Users size={15} aria-hidden="true" />Waitlist admin</a>}

          {workspaceSettingsOpen && !showNew && org && <section className="rise mb-8 border-2 border-foreground bg-card">
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

          {showNew && <section className="glass-panel rise mx-auto mb-8 min-w-0 max-w-4xl overflow-hidden">
            <div className="flex items-start justify-between gap-4 border-b border-border/60 p-5 sm:p-7">
              <div><p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Founder decision brief</p><h2 className="mt-1 text-2xl font-black sm:text-3xl">One idea in. One decision out.</h2><p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">Describe it in your own words. Sandbox researches the market, weighs the alternatives, and gives you the three assumptions to test first.</p></div>
              <button type="button" onClick={() => setShowNew(false)} aria-label="Close idea review" className="glass-icon grid size-11 shrink-0 place-items-center focus-visible:ring-2 focus-visible:ring-ring"><X size={18} aria-hidden="true" /></button>
            </div>
            <form onSubmit={(event) => { event.preventDefault(); if (aiDraft) { const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null; void createExperiment(event, submitter?.value === "simulate"); } else void draftWithAi(); }} className="space-y-5 p-5 sm:p-7" aria-busy={busy || drafting}>
              {!aiDraft && !drafting && <>
                <div className="space-y-2">
                  <label htmlFor="founder-idea" className="block text-sm font-bold">What do you want to build?</label>
                  <textarea id="founder-idea" rows={6} minLength={20} maxLength={32000} required value={idea} onChange={(event) => { setIdea(event.target.value); setError(""); }} placeholder="Describe the idea, who you hope it helps, and where you might start. If you do not know those yet, just say what you want to build." className="glass-control w-full min-w-0 resize-y p-4 text-base leading-7 focus-visible:ring-2 focus-visible:ring-ring" />
                  <p className="text-xs leading-5 text-muted-foreground">No market data or technical numbers needed. Describe the opportunity, who benefits, what exists today, and why your approach could matter.</p>
                </div>
                <div className="space-y-2"><label htmlFor="target-region" className="block text-sm font-bold">Which ecosystem and regions do you want to serve?</label><textarea id="target-region" rows={2} maxLength={1000} value={targetRegion} onChange={(event) => setTargetRegion(event.target.value)} placeholder="For example: independent AI developers and API teams in Nigeria and Kenya, starting with Solana ecosystem builders; online-first across West Africa." className="glass-control w-full min-w-0 resize-y p-4 text-sm leading-6 focus-visible:ring-2 focus-visible:ring-ring" /><p className="text-xs leading-5 text-muted-foreground">Use your own words. Name countries, cities, communities, industries, or say you’re still exploring.</p></div>
                <label htmlFor="research-consent" className="flex cursor-pointer items-start gap-3 rounded-2xl border border-warning/70 bg-warning/10 p-4 text-sm leading-5">
                  <input id="research-consent" type="checkbox" checked={researchConsent} onChange={(event) => setResearchConsent(event.target.checked)} className="mt-0.5 size-4 shrink-0 accent-[var(--primary)] focus-visible:ring-2 focus-visible:ring-ring" />
                  <span><strong>Share this idea for research.</strong> Sandbox sends it to Firecrawl and the selected AI provider to prepare the brief. Do not include anything you are unwilling to share with those services. Your idea is saved to your workspace only if you choose to save the brief.</span>
                </label>
                {error && <div role="alert" className="rounded-2xl border border-destructive bg-card p-3 text-sm">{error}</div>}
                <button type="submit" disabled={drafting || !researchConsent || idea.trim().length < 20} className="glass-primary flex min-h-12 w-full items-center justify-center gap-2 px-6 text-sm font-extrabold disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"><Sparkles size={17} aria-hidden="true" />Research my idea<ArrowUpRight size={16} aria-hidden="true" /></button>
              </>}
              {drafting && <ResearchingIdea idea={idea} region={targetRegion} />}
              {aiDraft && <article id="decision-brief" className="decision-brief space-y-5" aria-label="Sandbox decision brief">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4"><span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Decision brief · {aiDraft.market_research.geography || "Geography not established"}</span><span className={`rounded-full border px-3 py-1.5 text-sm font-extrabold ${aiDraft.decision_brief.verdict === "strong" ? "border-success bg-success/10 text-success" : aiDraft.decision_brief.verdict === "weak" ? "border-destructive bg-destructive/10 text-destructive" : "border-warning bg-warning/15 text-foreground"}`}>{aiDraft.decision_brief.verdict === "strong" ? "Strong case to test" : "Weak case so far"}</span></div>
                <header><h3 className="break-words text-2xl font-black leading-tight sm:text-3xl">{aiDraft.title || title || "Your idea"}</h3><p className="mt-2 max-w-3xl break-words text-sm leading-6 text-muted-foreground">{aiDraft.objective}</p><p className="mt-4 max-w-3xl break-words text-base leading-7">{aiDraft.decision_brief.verdict_reason}</p></header>
                <section className="grid gap-3 md:grid-cols-2"><div className="rounded-3xl border border-success/40 bg-success/5 p-5"><p className="text-xs font-bold uppercase tracking-widest text-success">Why it could work</p><ul className="mt-3 space-y-3">{aiDraft.decision_brief.what_supports_it.map((item, index) => <li key={index} className="flex gap-3 text-sm leading-6"><span className="mt-2 size-2 shrink-0 rounded-full bg-success" />{item}</li>)}</ul></div><div className="rounded-3xl border border-warning/60 bg-warning/10 p-5"><p className="text-xs font-bold uppercase tracking-widest">What makes it hard</p><ul className="mt-3 space-y-3">{aiDraft.decision_brief.what_makes_it_hard.map((item, index) => <li key={index} className="flex gap-3 text-sm leading-6"><span className="mt-2 size-2 shrink-0 rounded-full bg-warning" />{item}</li>)}</ul></div></section>
                <section className="grid gap-3 sm:grid-cols-2"><div className="glass-metric rounded-3xl p-5"><p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Total addressable market · annual</p><p className="mt-2 text-2xl font-black tracking-tight">{formatMarketRange(aiDraft.market_research.tam_low_usd, aiDraft.market_research.tam_high_usd)}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">TAM · cited estimate, when evidence supports one</p></div><div className="glass-metric rounded-3xl p-5"><p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Serviceable market · annual</p><p className="mt-2 text-2xl font-black tracking-tight">{formatMarketRange(aiDraft.market_research.sam_low_usd, aiDraft.market_research.sam_high_usd)}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">SAM · narrowed to the stated customers and geography</p></div><p className="text-xs leading-5 text-muted-foreground sm:col-span-2">{aiDraft.market_research.status === "ready" ? aiDraft.market_research.method : `Not estimated: ${aiDraft.market_research.caveats[0] || "the available sources do not support a defensible range yet."}`}</p></section>
                <section aria-labelledby="assumptions-title"><div className="flex flex-wrap items-baseline justify-between gap-2"><h4 id="assumptions-title" className="text-lg font-extrabold">The three assumptions this idea rests on</h4><span className="text-xs text-muted-foreground">Ranked by how badly it breaks if wrong</span></div><ol className="mt-3 space-y-3">{aiDraft.decision_brief.assumptions.slice().sort((a, b) => a.rank - b.rank).map((item) => <li key={item.rank} className="grid gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-[2.5rem_minmax(0,1fr)]"><span className="grid size-10 place-items-center rounded-full bg-primary text-sm font-black text-primary-foreground">{item.rank}</span><div className="min-w-0"><p className="font-bold">{item.assumption}</p><p className="mt-1 text-sm leading-5 text-muted-foreground">If wrong: {item.why_it_matters}</p><p className="mt-3 text-sm leading-5"><strong>Cheapest test this week:</strong> {item.cheapest_test_this_week}</p><p className="mt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Evidence: {item.evidence_strength}</p></div></li>)}</ol></section>
                <section className="grid gap-4 border-y border-border py-4 sm:grid-cols-2"><div><h4 className="text-sm font-extrabold">Who it is for</h4><p className="mt-1 text-sm leading-5">{aiDraft.decision_brief.target_audience}</p></div><div><h4 className="text-sm font-extrabold">Market and alternatives</h4><p className="mt-1 text-sm leading-5">{aiDraft.decision_brief.market_and_competition}</p></div></section>
                <section className="rounded-2xl border border-secondary bg-accent p-4"><p className="text-xs font-bold uppercase tracking-widest">The next move</p><p className="mt-2 text-sm font-semibold leading-6">{aiDraft.decision_brief.recommended_next_step}</p><p className="mt-3 text-xs leading-5 text-muted-foreground"><strong>Biggest risk:</strong> {aiDraft.decision_brief.biggest_risk}</p></section>
                <details className="rounded-2xl border border-border p-4"><summary className="min-h-10 cursor-pointer py-2 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Research trail · sources and method</summary><div className="mt-3 space-y-4 text-sm"><p className="leading-6">{aiDraft.market_research.market_definition}</p><p className="leading-6">{aiDraft.market_research.method}</p>{aiDraft.market_research.assumptions.length > 0 && <ul className="list-disc space-y-1 pl-5 text-muted-foreground">{aiDraft.market_research.assumptions.map((item) => <li key={item}>{item}</li>)}</ul>}<div><h5 className="font-bold">Sources · market, competitors, pitch and outcome examples</h5>{aiDraft.market_research.sources.length ? <ul className="mt-2 space-y-3">{aiDraft.market_research.sources.map((source) => <li key={source.url} className="text-xs leading-5"><a href={source.url} target="_blank" rel="noreferrer" className="font-semibold underline underline-offset-2">{source.title}</a><span className="text-muted-foreground"> · {[source.publisher, source.published_at].filter(Boolean).join(" · ")}</span><p className="mt-1 text-muted-foreground">{source.supports}</p></li>)}</ul> : <p className="mt-2 text-xs leading-5 text-muted-foreground">No reliable source returned; market size is left unestimated.</p>}</div>{aiDraft.market_research.caveats.length > 0 && <ul className="list-disc space-y-1 pl-5 text-xs leading-5 text-muted-foreground">{aiDraft.market_research.caveats.map((item) => <li key={item}>{item}</li>)}</ul>}<p className="border-t border-border pt-3 text-xs leading-5 text-muted-foreground">Firecrawl search results can be incomplete or biased. Market ranges are estimates, not forecasts. Sources and pitch examples provide context; they do not calibrate the simulation.</p></div></details>
                {error && <div role="alert" className="rounded-2xl border border-destructive bg-card p-3 text-sm">{error}</div>}
                <div className="flex flex-col-reverse gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between"><button type="button" disabled={busy} onClick={() => { setAiDraft(null); setResearchConsent(false); setError(""); }} className="glass-button min-h-11 px-4 text-sm font-semibold">Edit idea</button><div className="flex flex-col gap-2 sm:flex-row"><button type="submit" value="save" disabled={busy} className="glass-button min-h-12 px-5 text-sm font-bold disabled:opacity-60">{busy ? <LoaderCircle size={16} className="mr-2 motion-safe:animate-spin" aria-hidden="true" /> : null}Save brief</button><button type="submit" value="simulate" disabled={busy || !aiDraft.configuration_valid} title={!aiDraft.configuration_valid ? "The research could not construct a responsible configuration for one of the available models." : "Save this brief and run its clearly labeled illustrative model"} className="glass-primary flex min-h-12 items-center justify-center px-6 text-sm font-extrabold disabled:cursor-not-allowed disabled:opacity-50"><Play size={16} className="mr-2" aria-hidden="true" />Save & simulate<ArrowUpRight size={16} className="ml-2" aria-hidden="true" /></button></div></div>
                <p className="text-xs leading-5 text-muted-foreground">This is a research judgment based on the idea and cited sources, not a guarantee or forecast. Saving stores the idea and brief in your workspace.</p>
              </article>}
            </form>
          </section>}

          {!showNew && (!currentExperiment ? <section className="studio-welcome mx-auto max-w-3xl border-2 border-foreground bg-card p-6 sm:p-10">
            <div className="inline-flex items-center gap-2 bg-accent px-3 py-2 text-xs font-bold uppercase tracking-wider"><FlaskConical size={14} aria-hidden="true" /> Your workspace</div>
            <h1 className="mt-6 max-w-xl text-3xl font-black tracking-tight sm:text-4xl">One idea in. One honest decision out.</h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">Tell Sandbox what you want to build. It researches the market and alternatives, then returns a clear verdict, the three assumptions most likely to break the idea, and the cheapest way to test each this week.</p>
            <button type="button" onClick={startNewExploration} className="mt-7 flex min-h-12 items-center gap-2 border border-foreground bg-primary px-5 text-sm font-extrabold text-primary-foreground hover:brightness-95"><Plus size={17} aria-hidden="true" />Get a decision brief</button>
          </section> : <div className="studio-dashboard rise space-y-7">
            <div className="dashboard-intro flex min-w-0 flex-col justify-between gap-5 sm:flex-row sm:items-end"><div className="dashboard-intro-copy min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="max-w-full break-words rounded-full border border-border bg-card px-3 py-1 text-xs font-bold uppercase tracking-wider">{currentExperiment.domain.replaceAll("_", " ")}</span><span className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className="size-2 rounded-full bg-secondary" /> Version {currentExperiment.version}</span></div><h1 className="mt-3 break-words text-3xl font-black tracking-tight sm:text-4xl">{currentExperiment.title}</h1><p className="mt-2 max-w-2xl break-words text-sm leading-6 text-muted-foreground">{currentExperiment.objective || "No objective added."}</p></div>{simulation && <button type="button" onClick={() => setSimulationOpen((open) => !open)} className="glass-primary flex min-h-11 shrink-0 items-center justify-center gap-2 px-4 text-sm font-extrabold"><Play size={15} aria-hidden="true" />{runs.length ? "Open simulation" : "Simulate assumptions"}</button>}</div>
            {savedDecisionBrief ? <article className="glass-panel mx-auto w-full max-w-4xl space-y-5 p-5 sm:p-7" aria-label="Saved founder decision brief">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4"><p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Your decision brief</p><span className={`rounded-full border px-3 py-1.5 text-sm font-extrabold ${savedDecisionBrief.verdict === "strong" ? "border-success bg-success/10 text-success" : savedDecisionBrief.verdict === "weak" ? "border-destructive bg-destructive/10 text-destructive" : "border-warning bg-warning/15 text-foreground"}`}>{savedDecisionBrief.verdict === "strong" ? "Strong case to test" : "Weak case so far"}</span></div>
              <p className="text-base leading-7">{savedDecisionBrief.verdict_reason}</p>
              <section><h2 className="text-lg font-extrabold">Three assumptions to test this week</h2><ol className="mt-3 space-y-3">{savedDecisionBrief.assumptions.slice().sort((a, b) => a.rank - b.rank).map((item) => <li key={item.rank} className="grid gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-[2.5rem_minmax(0,1fr)]"><span className="grid size-10 place-items-center rounded-full bg-primary text-sm font-black text-primary-foreground">{item.rank}</span><div className="min-w-0"><p className="font-bold">{item.assumption}</p><p className="mt-1 text-sm leading-5 text-muted-foreground">If wrong: {item.why_it_matters}</p><p className="mt-3 text-sm leading-5"><strong>Cheapest test:</strong> {item.cheapest_test_this_week}</p></div></li>)}</ol></section>
              <div className="grid gap-4 border-y border-border py-4 sm:grid-cols-2"><div><h3 className="text-sm font-extrabold">Market and alternatives</h3><p className="mt-1 text-sm leading-5">{savedDecisionBrief.market_and_competition}</p></div><div><h3 className="text-sm font-extrabold">Recommended next move</h3><p className="mt-1 text-sm leading-5">{savedDecisionBrief.recommended_next_step}</p></div></div>
              <section className="grid gap-3 sm:grid-cols-2"><div className="rounded-3xl border border-success/40 bg-success/5 p-4"><h3 className="text-xs font-bold uppercase tracking-widest text-success">Why it could work</h3><ul className="mt-3 space-y-2">{savedDecisionBrief.what_supports_it.map((item, index) => <li key={index} className="flex gap-2 text-sm leading-5"><span className="mt-1.5 size-2 shrink-0 rounded-full bg-success" />{item}</li>)}</ul></div><div className="rounded-3xl border border-warning/60 bg-warning/10 p-4"><h3 className="text-xs font-bold uppercase tracking-widest">What makes it hard</h3><ul className="mt-3 space-y-2">{savedDecisionBrief.what_makes_it_hard.map((item, index) => <li key={index} className="flex gap-2 text-sm leading-5"><span className="mt-1.5 size-2 shrink-0 rounded-full bg-warning" />{item}</li>)}</ul></div></section>
              {savedMarketResearch && <section className="grid gap-3 sm:grid-cols-2"><div className="glass-metric rounded-3xl p-4"><p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">TAM · annual</p><p className="mt-2 text-2xl font-black">{formatMarketRange(savedMarketResearch.tam_low_usd, savedMarketResearch.tam_high_usd)}</p></div><div className="glass-metric rounded-3xl p-4"><p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">SAM · annual</p><p className="mt-2 text-2xl font-black">{formatMarketRange(savedMarketResearch.sam_low_usd, savedMarketResearch.sam_high_usd)}</p></div></section>}
              <details className="rounded-2xl border border-border p-4"><summary className="min-h-10 cursor-pointer py-2 text-sm font-bold">Research trail and risk notes</summary><div className="mt-3 space-y-3 text-sm leading-6"><p><strong>Who it is for:</strong> {savedDecisionBrief.target_audience}</p><p><strong>Biggest risk:</strong> {savedDecisionBrief.biggest_risk}</p>{savedMarketResearch && <><p>{savedMarketResearch.market_definition}</p><p><strong>Market sizing method:</strong> {savedMarketResearch.method}</p><p><strong>TAM:</strong> {formatMarketRange(savedMarketResearch.tam_low_usd, savedMarketResearch.tam_high_usd)} · <strong>SAM:</strong> {formatMarketRange(savedMarketResearch.sam_low_usd, savedMarketResearch.sam_high_usd)}</p>{savedMarketResearch.sources.length > 0 ? <ul className="space-y-2">{savedMarketResearch.sources.map((source) => <li key={source.url}><a className="font-semibold underline underline-offset-2" href={source.url} target="_blank" rel="noreferrer">{source.title}</a><span className="text-muted-foreground"> · {[source.publisher, source.published_at].filter(Boolean).join(" · ")}</span><p className="text-muted-foreground">{source.supports}</p></li>)}</ul> : <p>No reliable external sources were returned.</p>}{savedMarketResearch.caveats.map((caveat) => <p key={caveat} className="text-muted-foreground">{caveat}</p>)}</>}<p className="text-xs text-muted-foreground">Research supports this judgment; it does not validate the idea or guarantee a result.</p></div></details>
            </article> : <section className="glass-question discovery-saved"><div className="flex items-center gap-4"><SandboxMascot mood="ready" size="small" /><div className="min-w-0"><h2 className="font-extrabold">Decision brief saved</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">This older exploration contains your idea and research summary but no saved decision brief. Start a new decision brief to get the verdict and three highest-risk assumptions.</p></div></div></section>}
            {simulation && <details open={simulationOpen} onToggle={(event) => setSimulationOpen(event.currentTarget.open)} className="rounded-[2rem] border border-border bg-card shadow-[0_28px_90px_-60px_rgba(25,20,35,0.55)]"><summary className="min-h-16 cursor-pointer px-5 py-5 text-sm font-extrabold sm:px-7">Simulation studio <span className="ml-2 font-normal text-muted-foreground">· charts, scenarios, and plain-language what-ifs</span></summary><div className="space-y-6 border-t border-border p-4 sm:p-7"><div className="grid gap-4 rounded-3xl bg-foreground p-5 text-background sm:grid-cols-[1fr_auto] sm:items-center"><div><p className="text-xs font-bold uppercase tracking-widest text-background/60">Explore a possible future</p><p className="mt-2 max-w-2xl text-sm leading-6 text-background/85">This model explores the specific financial or operating question described in its assumptions. It is not a market forecast, and its result does not change the evidence-based decision above.</p></div><button type="button" disabled={!activeScenario || busy} onClick={() => activeScenario && void startRun(activeScenario)} className="flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-extrabold text-primary-foreground disabled:opacity-50"><Play size={15} aria-hidden="true" />Run baseline</button></div><form onSubmit={submitWhatIf} className="grid gap-3 rounded-3xl border border-border bg-muted/55 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end sm:p-5"><div className="space-y-2"><label htmlFor="what-if-question" className="text-sm font-extrabold">What if something changed?</label><textarea id="what-if-question" rows={2} minLength={5} maxLength={1200} required value={whatIfQuestion} onChange={(event) => setWhatIfQuestion(event.target.value)} placeholder="What if buyer acquisition takes twice as long? What if the platform keeps a 12% fee? What if demand is only half the expected level?" className="glass-control w-full resize-y p-3 text-sm leading-6 focus-visible:ring-2 focus-visible:ring-ring" /><p className="text-xs leading-5 text-muted-foreground">Ask in plain language. Sandbox researches the scenario, changes only variables this model can represent, then runs a comparable branch.</p></div><button type="submit" disabled={busy || !activeScenario || whatIfQuestion.trim().length < 5} className="glass-primary flex min-h-11 items-center justify-center gap-2 px-5 text-sm font-extrabold disabled:opacity-50">{busy ? <LoaderCircle size={15} className="motion-safe:animate-spin" aria-hidden="true" /> : <ArrowUpRight size={15} aria-hidden="true" />}Explore what-if</button></form>
            <section aria-label="Experiment overview" className="metric-grid grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{(currentEngine === "queueing" ? [["Arrivals / hour", config.arrival_rate_per_hour, "Configured assumption"], ["Service rate", config.service_rate_per_hour_per_server, "Per server, per hour"], ["Servers", config.servers, "Parallel capacity"], ["Duration", `${config.duration_hours ?? "—"} h`, "Simulation window"]] : currentEngine === "inventory" ? [["Demand / day", config.average_daily_demand, "Average assumption"], ["Reorder point", config.reorder_point, "Inventory threshold"], ["Order quantity", config.order_quantity, "Units per order"], ["Duration", `${config.duration_days ?? "—"} days`, "Simulation window"]] : [["Trials", config.trials, "Repeated scenarios"], ["Periods", config.periods, "Per trial"], ["Demand likely", config.demand_mode, "Units per period"], ["Fixed cost", config.fixed_cost_per_period, "Per period"]]).map(([label, value, note]) => <MetricCard key={String(label)} label={String(label)} value={String(value ?? "—")} note={String(note)} />)}</section>

            <div className="dashboard-grid grid gap-7 xl:grid-cols-[minmax(0,1.3fr)_minmax(300px,0.7fr)]">
              <section className="workbench-panel min-w-0 border border-border bg-card">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5"><div><p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Scenario workbench</p><h2 className="mt-1 text-lg font-extrabold">Choose a scenario</h2></div>{currentEngine === "queueing" && <button type="button" onClick={() => { setBranchArrival(String(Number(config.arrival_rate_per_hour || 0) * 1.25)); setShowBranch(true); }} disabled={!activeScenario} className="flex min-h-10 items-center gap-2 border border-border px-3 text-sm font-bold hover:bg-muted disabled:opacity-50"><Plus size={15} aria-hidden="true" />Branch scenario</button>}</div>
                {showBranch && <form onSubmit={branchScenario} className="grid gap-3 border-b border-border bg-muted p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"><Field id="branch-name" label="Scenario name" required value={branchName} onChange={(event) => setBranchName(event.target.value)} /><Field id="branch-arrival" label="Arrivals / hour" type="text" inputMode="decimal" required value={branchArrival} onChange={(event) => setBranchArrival(event.target.value)} hint="Other settings inherit from parent" /><div className="flex gap-2"><button type="button" onClick={() => setShowBranch(false)} className="min-h-11 border border-border px-3 text-sm font-semibold">Cancel</button><button type="submit" disabled={busy} className="min-h-11 border border-foreground bg-primary px-3 text-sm font-extrabold text-primary-foreground">Create & run</button></div></form>}
                <div className="divide-y divide-border">
                  {scenarios.length === 0 ? <div className="state-mascot p-8" role="status"><SandboxMascot mood="working" size="small" /><p className="font-bold">Setting up your scenarios</p><p className="max-w-xs text-sm leading-5 text-muted-foreground">Your baseline will appear here as soon as the workspace finishes loading.</p></div> : scenarios.map((scenario) => {
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
                <section className="result-panel border border-border bg-card">
                  <div className="border-b border-border p-5"><p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Selected scenario</p><h2 className="mt-1 text-lg font-extrabold">{activeScenario?.name || "Choose a scenario"}</h2></div>
                  {selectedScenarioRun ? <div className="space-y-4 p-5">
                    <RunVisualizations engine={currentEngine} metrics={selectedScenarioRun.metrics || {}} />
                    {Object.entries(selectedScenarioRun.metrics || {}).filter(([name, value]) => name !== "assumptions" && name !== "series" && name !== "histogram" && typeof value !== "object").map(([name, value]) => <div key={name} className="flex items-baseline justify-between gap-4 border-b border-border pb-3"><span className="text-sm text-muted-foreground">{metricLabels[name] || name.replaceAll("_", " ")}</span><span className="font-mono text-sm font-bold tabular-nums">{formatMetric(name, value)}</span></div>)}
                    <p className="text-xs leading-5 text-muted-foreground">Seed {selectedScenarioRun.seed}. Outputs are generated by the {currentEngine.replaceAll("_", " ")} model.</p>
                    {!runExplanation || runExplanation.runId !== selectedScenarioRun.id ? <div className="space-y-2 border border-border bg-muted p-3 text-sm"><p className="font-semibold">Preparing the balanced review…</p><p className="text-xs leading-5 text-muted-foreground">Sandbox is separating model-supported upside and downside from evidence it does not have.</p><button type="button" disabled={busy} onClick={() => void interpretRun(selectedScenarioRun)} className="min-h-10 border border-border bg-card px-3 text-xs font-bold hover:bg-background disabled:opacity-50">Retry review</button></div> : <button type="button" disabled={busy} onClick={() => void interpretRun(selectedScenarioRun)} className="flex min-h-10 w-full items-center justify-center gap-2 border border-border px-3 text-sm font-bold hover:bg-muted disabled:opacity-50"><Sparkles size={15} aria-hidden="true" />Refresh balanced review</button>}
                    {runExplanation?.runId === selectedScenarioRun.id && <div className="review-summary rounded-2xl bg-muted p-4"><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Balanced readout</p><p className="mt-2 text-sm leading-6">{runExplanation.result.summary}</p><details className="review-details mt-4"><summary className="min-h-11 cursor-pointer rounded-xl border border-border bg-card px-4 py-3 text-sm font-bold">Explore the full review</summary><div className="mt-4 space-y-4 text-sm"><div className="grid gap-3 sm:grid-cols-2"><div className="border border-success/50 bg-card p-3"><p className="font-bold text-success">What looks promising</p><ul className="mt-2 list-disc space-y-1 pl-5">{runExplanation.result.upside.map((item) => <li key={item}>{item}</li>)}</ul></div><div className="border border-warning bg-card p-3"><p className="font-bold">Risks and downside</p><ul className="mt-2 list-disc space-y-1 pl-5">{runExplanation.result.downside.map((item) => <li key={item}>{item}</li>)}</ul></div></div><div className="border border-border bg-card p-3"><p className="font-bold">Costs and competition</p><ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">{runExplanation.result.cost_and_competition.map((item) => <li key={item}>{item}</li>)}</ul></div>{runExplanation.result.findings.length > 0 && <div><p className="text-xs font-bold uppercase tracking-wider">What the run shows</p><ul className="mt-1 list-disc space-y-1 pl-5">{runExplanation.result.findings.map((item) => <li key={item}>{item}</li>)}</ul></div>}{runExplanation.result.evidence_sources.length > 0 && <div className="border border-border bg-card p-3"><p className="font-bold">Sources reviewed as context</p><ul className="mt-2 space-y-2">{runExplanation.result.evidence_sources.map((source, index) => <li key={`${source.name}-${index}`} className="text-xs leading-5"><span className="font-semibold">{source.name}</span><span className="text-muted-foreground"> · {[source.provider, source.reference_area, source.period, source.license].filter(Boolean).join(" · ")}</span>{source.source_url && <> · <a className="underline underline-offset-2" href={source.source_url} target="_blank" rel="noreferrer">Source</a></>}</li>)}</ul><p className="mt-2 text-xs text-muted-foreground">These sources provide context; they did not calibrate or change the simulation.</p></div>}{runExplanation.result.evidence_gaps.length > 0 && <div><p className="text-xs font-bold uppercase tracking-wider">Evidence still needed</p><ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">{runExplanation.result.evidence_gaps.map((item) => <li key={item}>{item}</li>)}</ul></div>}{runExplanation.result.limitations.length > 0 && <div><p className="text-xs font-bold uppercase tracking-wider">Model limits</p><ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">{runExplanation.result.limitations.map((item) => <li key={item}>{item}</li>)}</ul></div>}{runExplanation.result.follow_up_questions.length > 0 && <div><p className="text-xs font-bold uppercase tracking-wider">Next questions</p><ul className="mt-1 list-disc space-y-1 pl-5">{runExplanation.result.follow_up_questions.map((item) => <li key={item}>{item}</li>)}</ul></div>}<p className="border-t border-border pt-3 text-xs leading-5 text-muted-foreground">{runExplanation.result.interpretation_notice}</p></div></details></div>}
                    {runExplanation?.runId === selectedScenarioRun.id && <div className="border-2 border-foreground bg-accent p-4"><p className="text-xs font-bold uppercase tracking-wider">Suggested next step</p><p className="mt-2 text-sm leading-6">{runExplanation.result.recommendation}</p></div>}
                    {Array.isArray(selectedScenarioRun.metrics?.assumptions) && <details className="border border-border p-3"><summary className="cursor-pointer text-sm font-semibold">Model assumptions</summary><ul className="mt-3 list-disc space-y-2 pl-5 text-xs leading-5 text-muted-foreground">{(selectedScenarioRun.metrics.assumptions as unknown as string[]).map((assumption) => <li key={assumption}>{assumption}</li>)}</ul></details>}
                    <div className="grid grid-cols-3 gap-2" id="reports"><button type="button" disabled={busy} onClick={() => void downloadReport(selectedScenarioRun, "pdf")} className="min-h-10 border border-border text-xs font-bold hover:bg-muted">PDF</button><button type="button" disabled={busy} onClick={() => void downloadReport(selectedScenarioRun, "csv")} className="min-h-10 border border-border text-xs font-bold hover:bg-muted">CSV</button><button type="button" disabled={busy} onClick={() => void downloadReport(selectedScenarioRun, "json")} className="min-h-10 border border-border text-xs font-bold hover:bg-muted">JSON</button></div>
                  </div> : <div className="state-mascot p-5"><SandboxMascot mood={runs.some((run) => run.scenario_id === activeScenario?.id && (run.status === "queued" || run.status === "running")) ? "working" : "curious"} size="small" /><p className="font-bold">{runs.find((run) => run.scenario_id === activeScenario?.id) ? "Run in progress" : "No completed run yet"}</p><p className="max-w-xs text-sm leading-5 text-muted-foreground">Start this scenario to see modelled metrics and export a report.</p>{runs.filter((run) => run.scenario_id === activeScenario?.id).map((run) => <div key={run.id} className="mt-2 flex w-full items-center justify-between gap-3 border border-border p-3 text-xs"><span className="font-mono">{run.id.slice(0, 8)} · seed {run.seed}</span><span className="font-bold">{statusCopy[run.status] || run.status}{run.status === "running" && ` ${run.progress}%`}</span></div>)}</div>}
                </section>
                <section className="history-panel border border-border bg-card">
                  <div className="flex items-start justify-between gap-3 border-b border-border p-5"><div><p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Run history</p><h2 className="mt-1 text-lg font-extrabold">Compare results</h2></div><RefreshCw size={16} className={liveRuns ? "motion-safe:animate-spin text-secondary" : "text-muted-foreground"} aria-hidden="true" /></div>
                  {runs.length === 0 ? <div className="state-mascot p-5"><SandboxMascot mood="resting" size="small" /><p className="text-sm font-semibold">No runs yet</p><p className="max-w-xs text-xs leading-5 text-muted-foreground">Run a scenario and your history will gather here for comparison.</p></div> : <div className="max-h-72 divide-y divide-border overflow-auto">{runs.map((run) => <div key={run.id} className="flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-muted"><input id={`compare-${run.id}`} type="checkbox" checked={selectedRuns.includes(run.id)} disabled={run.status !== "completed" || (!selectedRuns.includes(run.id) && selectedRuns.length >= 10)} onChange={(event) => setSelectedRuns((items) => event.target.checked ? [...items, run.id] : items.filter((id) => id !== run.id))} className="size-4 accent-[var(--primary)]" /><label htmlFor={`compare-${run.id}`} className="min-w-0 flex-1 cursor-pointer"><span className="block truncate text-sm font-semibold">{scenarios.find((item) => item.id === run.scenario_id)?.name || "Scenario"}</span><span className="block text-xs text-muted-foreground">{new Date(run.created_at).toLocaleString()} · seed {run.seed}</span></label><span className="text-xs font-bold">{statusCopy[run.status] || run.status}</span>{(run.status === "queued" || run.status === "running") && <button type="button" disabled={busy} onClick={() => void cancelRun(run)} className="min-h-10 border border-border px-2 text-xs font-semibold hover:bg-card disabled:opacity-50">Cancel</button>}</div>)}</div>}
                  <div className="border-t border-border p-4"><button type="button" disabled={selectedRuns.length < 2 || busy} onClick={() => void compareRuns()} className="flex min-h-10 w-full items-center justify-center gap-2 border border-foreground bg-primary px-3 text-sm font-extrabold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50">Compare selected ({selectedRuns.length})</button>
                    {comparison && <div className="mt-4 space-y-3">{comparison.metrics.map((item) => <div key={item.metric} className="border border-border p-3"><p className="text-sm font-bold">{metricLabels[item.metric] || item.metric.replaceAll("_", " ")}</p><div className="mt-2 space-y-1">{Object.entries(item.values).map(([id, value]) => <p key={id} className="flex justify-between gap-3 font-mono text-xs"><span>{scenarios.find((s) => s.id === runs.find((r) => r.id === id)?.scenario_id)?.name || id.slice(0, 8)}</span><span>{formatMetric(item.metric, value)}{item.delta_from_first && item.delta_from_first[id] !== 0 && <span className="ml-2 text-muted-foreground">({item.delta_from_first[id] > 0 ? "+" : ""}{formatMetric(item.metric, item.delta_from_first[id])})</span>}</span></p>)}</div></div>)}</div>}
                  </div>
                </section>
              </aside>
            </div>
            </div></details>}
            <details className="rounded-2xl border border-border bg-card"><summary className="min-h-14 cursor-pointer px-5 py-4 text-sm font-bold">Supporting research sources and environments</summary><div className="space-y-4 border-t border-border p-4 sm:p-6"><section id="environment" className="border border-border bg-card">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5"><div><p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Environment library</p><h2 className="mt-1 text-lg font-extrabold">Sources & context</h2></div><button type="button" onClick={() => setNewEnvironmentOpen((open) => !open)} className="flex min-h-10 items-center gap-2 border border-border px-3 text-sm font-bold hover:bg-muted"><Plus size={15} aria-hidden="true" />New environment</button></div>
              {newEnvironmentOpen && <form onSubmit={createEnvironment} className="grid gap-3 border-b border-border bg-muted p-4 sm:grid-cols-2 xl:grid-cols-3 sm:items-end"><Field id="environment-name" label="Environment name" required value={environmentName} onChange={(event) => setEnvironmentName(event.target.value)} placeholder="e.g. Lagos service desk" /><div className="space-y-1.5"><label htmlFor="environment-type" className="text-sm font-semibold">Environment type</label><select id="environment-type" value={environmentType} onChange={(event) => setEnvironmentType(event.target.value as Environment["environment_type"])} className="h-11 w-full border border-border bg-card px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring"><option value="synthetic">Synthetic assumptions</option><option value="real_world">Real-world context</option></select></div><Field id="environment-country" label="Country" autoComplete="country-name" value={environmentCountry} onChange={(event) => setEnvironmentCountry(event.target.value)} placeholder="e.g. Nigeria" /><Field id="environment-city" label="City / area" autoComplete="address-level2" value={environmentCity} onChange={(event) => setEnvironmentCity(event.target.value)} placeholder="e.g. Lagos" /><div className="space-y-2"><p className="text-sm font-semibold">Coordinates <span className="font-normal text-muted-foreground">(optional)</span></p><button type="button" onClick={locateEnvironment} className="min-h-11 w-full border border-border bg-card px-3 text-sm font-bold hover:bg-background">{environmentCoordinates.latitude === null ? "Use current location" : `${environmentCoordinates.latitude}, ${environmentCoordinates.longitude}`}</button></div><div className="flex items-end"><button type="submit" disabled={busy} className="min-h-11 w-full border border-foreground bg-primary px-4 text-sm font-extrabold text-primary-foreground">Save environment</button></div><p className="text-xs leading-5 text-muted-foreground sm:col-span-2 xl:col-span-3">Location is optional. Current location is only requested after you choose the button, and it is stored as environment metadata. No map data is imported automatically.</p></form>}
              {environments.length ? <div className="grid gap-0 lg:grid-cols-[0.8fr_1.2fr]">
                <div className="divide-y divide-border border-b border-border lg:border-b-0 lg:border-r">{environments.map((environment) => <button type="button" key={environment.id} onClick={() => void selectEnvironment(environment.id)} className={`flex min-h-16 w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted ${activeEnvironmentId === environment.id ? "bg-accent/60" : ""}`}><span className="min-w-0"><span className="block truncate text-sm font-bold">{environment.name}</span><span className="text-xs text-muted-foreground">{environment.environment_type.replaceAll("_", " ")} · v{environment.version}</span></span><ArrowUpRight size={16} aria-hidden="true" /></button>)}</div>
                <div className="p-4"><p className="font-bold">{environments.find((item) => item.id === activeEnvironmentId)?.name || "Select an environment"}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Keep source details and previewed public time series together. A source record shows where data came from; it does not calibrate a model unless you explicitly configure and validate that relationship.</p>
                  {activeEnvironmentId && <><form onSubmit={attachDataset} className="mt-4 grid gap-3 sm:grid-cols-2"><Field id="dataset-name" label="Source record name" required value={datasetName} onChange={(event) => setDatasetName(event.target.value)} /><Field id="dataset-source" label="Source URL" type="url" value={datasetSource} onChange={(event) => setDatasetSource(event.target.value)} placeholder="https://" /><button type="submit" disabled={busy} className="min-h-11 border border-foreground bg-secondary px-3 text-sm font-bold text-secondary-foreground sm:col-span-2">Attach source details</button></form>
                    <div className="mt-5 rounded-2xl border border-border bg-muted/40 p-4"><p className="text-sm font-bold">Firecrawl research trail</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Live web research is gathered while Sandbox reviews an idea. Verified source links stay with the saved exploration; they inform the decision brief but do not silently calibrate simulation inputs.</p></div>
                    <div className="mt-4 space-y-2">{datasets.map((dataset) => <div key={dataset.id} className="flex flex-wrap items-center justify-between gap-2 border border-border p-3 text-xs"><span className="font-bold">{dataset.name}</span><span className="text-muted-foreground">{typeof dataset.metadata_json.provider === "string" ? dataset.metadata_json.provider : "Source record"}</span>{dataset.source_url ? <a className="max-w-full truncate underline" href={dataset.source_url} target="_blank" rel="noreferrer">Open source data</a> : <span className="text-muted-foreground">No source URL</span>}</div>)}{datasets.length === 0 && <p className="mt-4 border border-dashed border-border p-4 text-xs text-muted-foreground">No sources saved to this environment yet.</p>}</div></>}
                </div>
              </div> : <div className="p-5 text-sm text-muted-foreground">Create an environment to keep its type, configuration, and source provenance alongside an experiment.</div>}
            </section>
            <section className="flex flex-col justify-between gap-3 border border-border bg-muted p-5 sm:flex-row sm:items-center"><div className="flex items-start gap-3"><Database size={18} className="mt-0.5" aria-hidden="true" /><div><p className="font-bold">Model notes</p><p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">Queueing models exponential arrivals and service across parallel servers. Inventory models daily demand and fixed lead-time replenishment. Monte Carlo samples user-provided ranges across repeated trials. None currently consumes live business feeds, calibrated maps, staffing calendars, or seasonality. AI-generated content is a draft and never determines run results.</p></div></div><span className="grid size-10 shrink-0 place-items-center border border-border bg-card" title="Model details"><CircleHelp size={16} aria-hidden="true" /></span></section>
            {latestRun?.status === "failed" && latestRun.error && <p role="alert" className="border border-destructive p-4 text-sm">Run failed: {latestRun.error}</p>}
            </div></details>
          </div>)}
        </div>
        {waitlistAdminAccess && <section id="waitlist-admin" className="mt-8 overflow-hidden rounded-2xl border border-border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5"><div><p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Sandbox admin</p><h2 className="mt-1 text-lg font-extrabold">Waitlist signups</h2></div><button type="button" disabled={waitlistAdminLoading} onClick={() => void loadWaitlistAdmin(waitlistAdminData?.offset || 0)} className="flex min-h-10 items-center gap-2 rounded-full border border-border px-4 text-sm font-bold hover:bg-muted disabled:opacity-50"><RefreshCw size={15} className={waitlistAdminLoading ? "animate-spin" : ""} aria-hidden="true" />Refresh</button></div>
          {waitlistAdminError && <p role="alert" className="m-4 rounded-xl border border-destructive p-3 text-sm">{waitlistAdminError}</p>}
          {!waitlistAdminData && <div className="p-5"><p className="text-sm text-muted-foreground">Load the current count and latest signup emails.</p><button type="button" disabled={waitlistAdminLoading} onClick={() => void loadWaitlistAdmin(0)} className="mt-3 min-h-10 rounded-full bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50">{waitlistAdminLoading ? "Loading…" : "Load waitlist"}</button></div>}
          {waitlistAdminData && <><div className="flex flex-wrap items-baseline gap-2 border-b border-border bg-muted/50 px-5 py-4"><strong className="font-mono text-3xl tabular-nums">{waitlistAdminData.total.toLocaleString()}</strong><span className="text-sm text-muted-foreground">total signups</span><span className="ml-auto text-xs text-muted-foreground">Showing {waitlistAdminData.entries.length ? waitlistAdminData.offset + 1 : 0}–{waitlistAdminData.offset + waitlistAdminData.entries.length}</span></div>
            {waitlistAdminData.entries.length ? <div className="overflow-x-auto"><table className="w-full min-w-[34rem] text-left text-sm"><thead className="text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-5 py-3 font-bold">Email</th><th className="px-5 py-3 font-bold">Joined</th><th className="px-5 py-3 font-bold">Source</th></tr></thead><tbody>{waitlistAdminData.entries.map((entry) => <tr key={`${entry.email}-${entry.created_at}`} className="border-t border-border"><td className="px-5 py-3 font-medium">{entry.email}</td><td className="px-5 py-3 text-muted-foreground">{new Date(entry.created_at).toLocaleString()}</td><td className="px-5 py-3 text-muted-foreground">{entry.source}</td></tr>)}</tbody></table></div> : <p className="p-5 text-sm text-muted-foreground">No signups yet. New waitlist entries will appear here.</p>}
            <div className="flex justify-between border-t border-border p-4"><button type="button" disabled={waitlistAdminLoading || waitlistAdminData.offset === 0} onClick={() => void loadWaitlistAdmin(Math.max(0, waitlistAdminData.offset - waitlistAdminData.limit))} className="min-h-10 rounded-full border border-border px-4 text-sm font-bold disabled:opacity-40">Previous</button><button type="button" disabled={waitlistAdminLoading || waitlistAdminData.offset + waitlistAdminData.limit >= waitlistAdminData.total} onClick={() => void loadWaitlistAdmin(waitlistAdminData.offset + waitlistAdminData.limit)} className="min-h-10 rounded-full border border-border px-4 text-sm font-bold disabled:opacity-40">Next</button></div>
          </>}
        </section>}
      </section>
    </div>
  </main>;
}
