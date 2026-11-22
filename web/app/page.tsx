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
import { type FormEvent, type InputHTMLAttributes, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, API_URL, ApiSession, Dataset, Environment, Experiment, Interpretation, jsonBody, Organization, Project, Run, RunInterpretation, Scenario, User } from "@/lib/api";
import { getFirebaseAuth } from "@/lib/firebase";
import { RunVisualizations } from "@/components/run-visualizations";
import { Data360Explorer } from "@/components/data360-explorer";

const SESSION_KEY = "sandbox.api-session";
const TERMINAL = new Set(["completed", "failed", "cancelled"]);
const profileSyncs = new Map<string, Promise<User>>();
const DISCOVERY_QUESTIONS = [
  { section: "Idea & problem", question: "What do you want to build?", hint: "Describe the product or service as you imagine it today.", placeholder: "A rough idea is enough. What should it help people do?" },
  { section: "Idea & problem", question: "What frustrating problem or unmet need should it solve?", hint: "Think about what is difficult, slow, expensive, risky, or missing today.", placeholder: "Who experiences the problem, and what happens?" },
  { section: "Idea & problem", question: "Why does this feel important to solve now?", hint: "A change in technology, habits, costs, policy, or your own experience may have sparked it.", placeholder: "What made you start thinking about this idea?" },
  { section: "People & market", question: "Who are the first people or organizations you most want to help?", hint: "Describe the people who would get the most value first.", placeholder: "What are they trying to accomplish, and what makes their situation specific?" },
  { section: "People & market", question: "Who would use it, who would choose it, and who would pay?", hint: "Those roles can belong to different people or organizations.", placeholder: "For example, a team may use a product while a manager buys it." },
  { section: "People & market", question: "Where do you want to launch and serve people first?", hint: "Include countries, cities, regions, or online markets. Your workspace location is not a substitute.", placeholder: "For example: developers in Nigeria first, then other African markets." },
  { section: "Product & delivery", question: "What needs to be available for your product to deliver its promise?", hint: "For a marketplace, think about providers and offerings as well as customers.", placeholder: "Who or what needs to participate, and what might make providers or partners join?" },
  { section: "Product & delivery", question: "Who will come to use or buy it, and what are they trying to get done?", hint: "If the product brings two sides together, describe what would bring buyers to it and back again.", placeholder: "What would a customer be looking for, and when would they need it?" },
  { section: "Product & delivery", question: "How does someone go from finding your product to getting value from it?", hint: "For a marketplace, include provider discovery, comparison, trials, payment, and what happens after purchase.", placeholder: "Walk through the experience in everyday language." },
  { section: "Value & competition", question: "What do your potential customers use or do today instead?", hint: "If your idea connects two sides, include what both sides use today. Workarounds and doing nothing count too.", placeholder: "Name any alternatives you know, or describe the current workaround." },
  { section: "Value & competition", question: "Why might customers—and providers, if your product connects two sides—choose it over those alternatives?", hint: "Different people may value different things.", placeholder: "What should feel better for each person or organization involved?" },
  { section: "Value & competition", question: "How should people judge whether an offering is a good fit?", hint: "Consider quality, price, speed, reliability, safety, compatibility, or transparency.", placeholder: "Which information or proof would help someone choose confidently?" },
  { section: "Business model & reach", question: "How might the product earn money or stay funded?", hint: "A possible approach is enough; you do not need a forecast.", placeholder: "For example: usage fees, subscriptions, commissions, listing fees, or grants." },
  { section: "Business model & reach", question: "What would feel fair for customers to pay and providers or partners to earn, if both are involved?", hint: "Think about pricing, payouts, and the platform's share without needing exact figures.", placeholder: "For example: transparent usage pricing, subscriptions, or a small commission." },
  { section: "Business model & reach", question: "How might you reach your first customers and attract any providers or partners you need?", hint: "If the idea serves two sides, it may need to build both sides—perhaps starting with one focused niche.", placeholder: "Consider communities, partnerships, direct sales, or existing networks." },
  { section: "Trust & operations", question: "What must people be able to trust before they use your product?", hint: "Consider privacy, security, payments, permissions, safety, quality, and accountability. For a marketplace, what proof should providers offer?", placeholder: "What could go wrong, and what protection or transparency would matter?" },
  { section: "Trust & operations", question: "What needs to happen behind the scenes for the experience to work reliably?", hint: "Think about onboarding, evaluation, support, uptime, disputes, moderation, or integrations.", placeholder: "What will you need to do for customers and any partners after signup?" },
  { section: "Trust & operations", question: "Are there local rules, access limits, or dependencies that could shape the product?", hint: "Consider regulation, language, connectivity, payment methods, partners, or infrastructure.", placeholder: "Which conditions might matter in your first market? It is fine not to know yet." },
  { section: "Readiness & validation", question: "What have you done so far to learn whether people want this?", hint: "Conversations, waitlists, sketches, prototypes, tests, or no research yet all count.", placeholder: "What have you heard or observed from potential customers, users, or partners?" },
  { section: "Readiness & validation", question: "What resources, timing, or constraints should Sandbox know about?", hint: "People, partners, skills, budget limits, access, or deadlines are useful context.", placeholder: "Share practical realities. Exact figures are not required." },
  { section: "Readiness & validation", question: "What would early success look like, and what worries you most?", hint: "Describe a meaningful first signal and the biggest reason the idea might fail.", placeholder: "What would make you more confident? What could stop this from working?" },
] as const;

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

  async function social(provider: "google" | "github") {
    setBusy(true); setError("");
    try {
      const auth = getFirebaseAuth();
      const authProvider = provider === "google" ? new GoogleAuthProvider() : new GithubAuthProvider();
      const credential = await signInWithPopup(auth, authProvider);
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
            <Field id="username-social" label="Preferred username (optional)" autoComplete="username" spellCheck={false} value={username} onChange={(event) => setUsername(event.target.value)} hint="Leave blank to get a suggested username when you first use Google or GitHub." />
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

  const [title, setTitle] = useState("");
  const [idea, setIdea] = useState("");
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
  const [clarificationAnswers, setClarificationAnswers] = useState<Record<number, string>>({});
  const [clarificationTranscript, setClarificationTranscript] = useState("");
  const [questionDirection, setQuestionDirection] = useState<"next" | "previous">("next");
  const [newStep, setNewStep] = useState(1);
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
      return onAuthStateChanged(auth, (nextUser) => {
        const previousUid = firebaseUid.current;
        firebaseUid.current = nextUser?.uid || null;
        setFirebaseUser(nextUser);
        const hasRestSession = Boolean(sessionStorage.getItem(SESSION_KEY));
        if ((previousUid && previousUid !== nextUser?.uid) || (nextUser && hasRestSession)) {
          workspaceLoadId.current += 1;
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
    } catch (cause) {
      if (requestId === workspaceLoadId.current) setError(explainError(cause));
      throw cause;
    } finally {
      if (requestId === workspaceLoadId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function restore() {
      if (firebaseUser) {
        try {
          const accessToken = await getIdToken(firebaseUser);
          await syncFirebaseProfile(accessToken, firebaseUser.uid);
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
    setToken(accessToken); await loadWorkspace(accessToken);
  }

  async function logout() {
    workspaceLoadId.current += 1;
    try { if (firebaseUser) await signOut(getFirebaseAuth()); } catch { /* Clear the local API session even if the SDK is unavailable. */ }
    sessionStorage.removeItem(SESSION_KEY); setSession(null); setFirebaseUser(null); setToken(""); setUser(null); setExperiments([]); setActiveId("");
  }

  function discoveryTranscript(answers: Record<number, string> = clarificationAnswers, firstAnswer: string = idea) {
    return DISCOVERY_QUESTIONS.map((item, index) => {
      const questionNumber = index + 1;
      const answer = questionNumber === 1 ? firstAnswer : answers[questionNumber];
      return `${questionNumber}. ${item.question}\nFounder answer: ${answer?.trim() || "Not sure yet; leave this unknown and do not assume an answer."}`;
    }).join("\n\n");
  }

  function startNewExploration() {
    setNewStep(1); setTitle(""); setIdea(""); setAiDraft(null); setClarificationAnswers({});
    setClarificationTranscript(""); setQuestionDirection("next"); setSelectedRunId(""); setError(""); setNotice(""); setWorkspaceSettingsOpen(false); setShowNew(true);
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
      const simulationConfig = aiDraft?.configuration_valid ? Object.fromEntries(Object.entries(aiDraft.simulation_config).filter(([, value]) => value !== null)) : null;
      const experiment = await api<Experiment>("/experiments", getToken, jsonBody({
        project_id: project.id, environment_id: null, title: title.trim() || aiDraft?.title || "New exploration", description: idea.trim(), objective: aiDraft?.objective || idea.trim(), domain,
        specification: {
          business_context: {
            business_type: org.business_type,
            location: [org.city, org.region, org.country].filter(Boolean).join(", ") || null,
            timezone: org.timezone,
          },
          ...(simulationConfig ? { simulation: { engine, config: simulationConfig } } : {}),
          discovery: {
            user_description: idea.trim(),
            user_answers: clarificationTranscript || discoveryTranscript(),
            ai_assumptions: aiDraft?.assumptions || [],
            unresolved_questions: [],
            suggested_variables: aiDraft?.variables || [],
            market_research: aiDraft?.market_research || null,
            evidence_status: environmentForExperiment ? "environment_linked_not_used_for_calibration" : "no_external_evidence_attached",
          },
        },
      }));
      setExperiments((items) => [experiment, ...items]); setActiveId(experiment.id); setSelectedRunId(""); setShowNew(false); setTitle(""); setIdea(""); setAiDraft(null); setClarificationAnswers({}); setClarificationTranscript(""); setNewStep(1);
      if (simulationConfig) {
        try {
          const experimentScenarios = await api<Scenario[]>(`/experiments/${experiment.id}/scenarios`, getToken);
          const baseline = experimentScenarios.find((scenario) => scenario.is_baseline);
          if (!baseline) throw new Error("The baseline scenario was not created.");
          const queuedRun = await api<Run>(`/scenarios/${baseline.id}/runs`, getToken, jsonBody({}));
          setSelectedScenario(baseline.id); setRuns([queuedRun]);
          setNotice("Exploration saved. Sandbox has started a provisional simulation; review its assumptions, sources, and limits alongside the results.");
        } catch {
          setNotice("Exploration saved with a runnable model, but Sandbox could not start the run yet. Use Run scenario from the dashboard to retry.");
        }
      } else {
        setNotice("Exploration saved with its discovery and market research. No structurally valid model configuration was available, so no run was created.");
      }
    } catch (cause) { setError(explainError(cause)); }
    finally { setBusy(false); }
  }

  async function draftWithAi(answers: Record<number, string> = clarificationAnswers, firstAnswer: string = idea) {
    if (draftingRef.current) return;
    const transcript = discoveryTranscript(answers, firstAnswer);
    draftingRef.current = true; setDrafting(true); setError("");
    try {
      const businessContext = org ? `\n\nWorkspace context (user-provided): business type: ${org.business_type}; location: ${[org.city, org.region, org.country].filter(Boolean).join(", ") || "not provided"}; time zone: ${org.timezone || "not provided"}. Use this only to interpret terminology and questions; do not infer demand or operating facts from location.` : "";
      const draft = await api<Interpretation>("/ai/interpret", getToken, jsonBody({ idea: `Founder idea and completed 21-question discovery. The founder has completed the fixed questionnaire; do not ask another question. Treat skipped answers as unknown, not facts.\n\n${transcript}${businessContext}` }));
      setEngine(draft.suggested_engine); setAiDraft(draft); setTitle(draft.title); setDomain(draft.domain || "general"); setArrival(String(draft.simulation_config.arrival_rate_per_hour ?? ""));
      setClarificationTranscript(transcript);
      setService(String(draft.simulation_config.service_rate_per_hour_per_server ?? ""));
      setServers(String(draft.simulation_config.servers ?? "")); setDuration(String(draft.simulation_config.duration_hours ?? ""));
      setInventoryInputs((previous) => Object.fromEntries(Object.keys(previous).map((key) => [key, draft.simulation_config[key] == null ? previous[key as keyof typeof previous] : String(draft.simulation_config[key])])) as typeof previous);
      setMonteInputs((previous) => Object.fromEntries(Object.keys(previous).map((key) => [key, draft.simulation_config[key] == null ? previous[key as keyof typeof previous] : String(draft.simulation_config[key])])) as typeof previous);
      setQuestionDirection("next"); setNewStep(22);
    } catch (cause) { setError(explainError(cause)); }
    finally { draftingRef.current = false; setDrafting(false); }
  }

  function continueDiscoveryQuestion() {
    const answer = (newStep === 1 ? idea : clarificationAnswers[newStep] || "").trim() || "Not sure yet.";
    const nextAnswers = newStep === 1 ? clarificationAnswers : { ...clarificationAnswers, [newStep]: answer };
    if (newStep === 1) setIdea(answer);
    else setClarificationAnswers(nextAnswers);
    setError("");
    if (newStep === 21) {
      void draftWithAi(nextAnswers, idea);
      return;
    }
    setQuestionDirection("next");
    setNewStep((step) => Math.min(step + 1, 22));
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
  return <main className="min-h-screen overflow-x-hidden">
    <div className="mx-auto flex min-h-screen max-w-[1600px]">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-card p-5 md:flex">
        <div className="flex items-center justify-between"><Logo /><span className="bg-secondary px-2 py-1 text-xs font-bold uppercase tracking-wider text-secondary-foreground">Studio</span></div>
        <button type="button" onClick={() => setWorkspaceSettingsOpen((open) => !open)} aria-expanded={workspaceSettingsOpen} className="mt-9 flex min-h-11 w-full items-center justify-between border border-border px-3 text-left text-sm font-semibold hover:bg-muted"><span className="truncate">{org?.name || "Workspace"}</span><ChevronDown size={15} aria-hidden="true" /></button>
        <p className="mb-2 mt-8 text-xs font-bold uppercase tracking-widest text-muted-foreground">Workspace</p>
        <a href="#experiments" className="flex min-h-11 items-center gap-3 border-l-2 border-primary bg-accent px-3 text-sm font-bold"><FlaskConical size={16} aria-hidden="true" />Explorations</a>
        <a href="#environment" className="flex min-h-11 items-center gap-3 px-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"><Database size={16} aria-hidden="true" />Environments</a>
        <a href="#reports" className="flex min-h-11 items-center gap-3 px-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"><ArrowDownToLine size={16} aria-hidden="true" />Reports</a>
        <div className="mt-9 flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Your explorations</p><button type="button" onClick={startNewExploration} aria-label="Start an exploration" className="grid size-10 place-items-center hover:bg-muted"><Plus size={17} aria-hidden="true" /></button></div>
        <nav id="experiments" className="mt-2 max-h-[32vh] space-y-1 overflow-y-auto" aria-label="Experiments">
          {experiments.length ? experiments.map((experiment) => <button type="button" key={experiment.id} onClick={() => { setShowNew(false); setSelectedRunId(""); setActiveId(experiment.id); setComparison(null); }} className={`flex min-h-11 w-full items-center gap-3 px-3 text-left text-sm ${activeId === experiment.id ? "bg-primary font-bold text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}><span className="size-2 shrink-0 rounded-full bg-secondary" /><span className="truncate">{experiment.title}</span></button>) : <p className="px-3 py-3 text-sm text-muted-foreground">No explorations yet.</p>}
        </nav>
        <div className="mt-6 min-h-0">
          <p className="px-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Recent runs</p>
          {runs.length ? <nav aria-label="Recent runs" className="mt-2 max-h-[26vh] space-y-1 overflow-y-auto">{runs.slice(0, 8).map((run) => <button type="button" key={run.id} onClick={() => { setShowNew(false); setSelectedScenario(run.scenario_id); setSelectedRunId(run.id); setComparison(null); }} className={`w-full rounded-2xl px-3 py-2.5 text-left transition-colors ${selectedRunId === run.id ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}><span className="block truncate text-sm font-semibold">{scenarios.find((scenario) => scenario.id === run.scenario_id)?.name || "Scenario run"}</span><span className="mt-1 flex items-center justify-between gap-2 text-xs"><span className="truncate">Seed {run.seed}</span><span className="shrink-0 font-bold">{statusCopy[run.status] || run.status}</span></span></button>)}</nav> : <p className="px-3 py-2 text-xs leading-5 text-muted-foreground">Runs appear here after you start a scenario.</p>}
        </div>
        <div className="mt-auto border-t border-border pt-4">
          <button type="button" onClick={() => setTheme(theme === "light" ? "dark" : "light")} className="flex min-h-11 w-full items-center gap-3 px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">{theme === "light" ? <Moon size={16} aria-hidden="true" /> : <Sun size={16} aria-hidden="true" />}{theme === "light" ? "Dark appearance" : "Light appearance"}</button>
          <div className="mt-2 flex items-center gap-3 px-3 py-2"><span className="grid size-9 place-items-center rounded-full bg-secondary text-sm font-bold text-secondary-foreground">{user.username.slice(0, 1).toUpperCase()}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{user.username}</span><span className="block truncate text-xs text-muted-foreground">{user.email || "Sandbox member"}</span></span><button type="button" onClick={() => void logout()} aria-label="Sign out" className="grid size-10 place-items-center text-muted-foreground hover:bg-muted hover:text-foreground"><LogOut size={16} aria-hidden="true" /></button></div>
        </div>
      </aside>

      <section className="min-w-0 flex-1 overflow-x-hidden">
        <header className="flex min-h-16 items-center justify-between border-b border-border bg-background px-4 sm:px-6 lg:px-9">
          <div className="flex min-w-0 items-center gap-2 md:hidden"><Logo small /><span className="font-bold">Sandbox</span><span className="border border-secondary px-1.5 py-1 text-xs font-bold uppercase tracking-wider text-secondary">Alpha</span><button type="button" onClick={() => setWorkspaceSettingsOpen((open) => !open)} aria-label="Workspace settings" aria-expanded={workspaceSettingsOpen} className="grid size-10 shrink-0 place-items-center text-muted-foreground hover:bg-muted hover:text-foreground"><MapPin size={17} aria-hidden="true" /></button>{experiments.length > 0 && <select aria-label="Select experiment" value={activeId} onChange={(event) => { setShowNew(false); setSelectedRunId(""); setActiveId(event.target.value); setComparison(null); }} className="min-h-10 min-w-0 max-w-36 border border-border bg-card px-2 text-xs font-semibold sm:max-w-56">{experiments.map((experiment) => <option key={experiment.id} value={experiment.id}>{experiment.title}</option>)}</select>}</div>
          <div className="hidden items-center gap-2 text-xs text-muted-foreground md:flex"><span>Workspace</span><span>/</span><span className="font-semibold text-foreground">Explorations</span>{currentExperiment && <><span>/</span><span className="max-w-48 truncate font-semibold text-foreground">{currentExperiment.title}</span></>}<span className="ml-2 border border-secondary px-1.5 py-1 text-xs font-bold uppercase tracking-wider text-secondary">Alpha</span></div>
          <div className="flex items-center gap-2"><button type="button" onClick={() => setTheme(theme === "light" ? "dark" : "light")} aria-label={`Switch to ${theme === "light" ? "dark" : "light"} appearance`} className="grid size-10 place-items-center hover:bg-muted md:hidden">{theme === "light" ? <Moon size={17} aria-hidden="true" /> : <Sun size={17} aria-hidden="true" />}</button><button type="button" onClick={startNewExploration} className="flex min-h-10 items-center gap-2 border border-foreground bg-primary px-3 text-sm font-extrabold text-primary-foreground hover:brightness-95"><Plus size={16} aria-hidden="true" /><span className="hidden sm:inline">New exploration</span><span className="sm:hidden">New</span></button><button type="button" onClick={() => void logout()} aria-label="Sign out" className="grid size-10 place-items-center text-muted-foreground hover:bg-muted hover:text-foreground md:hidden"><LogOut size={16} aria-hidden="true" /></button></div>
        </header>

        <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-9 lg:py-10">
          {!showNew && error && <div role="alert" className="mb-5 flex items-start justify-between gap-3 border border-destructive bg-card p-4 text-sm"><span>{error}</span><div className="flex shrink-0 items-center gap-1">{token && <button type="button" onClick={() => void loadWorkspace(token).catch(() => undefined)} className="min-h-10 px-3 font-bold underline underline-offset-4">Retry</button>}<button type="button" onClick={() => setError("")} aria-label="Dismiss error" className="grid size-10 place-items-center hover:bg-muted"><X size={16} aria-hidden="true" /></button></div></div>}
          {!showNew && notice && <div role="status" className="mb-5 flex items-center justify-between gap-3 border border-secondary bg-accent p-4 text-sm"><span className="flex items-center gap-2"><Check size={16} aria-hidden="true" />{notice}</span><button type="button" onClick={() => setNotice("")} aria-label="Dismiss message" className="grid size-10 shrink-0 place-items-center hover:bg-muted"><X size={16} aria-hidden="true" /></button></div>}

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

          {showNew && <section className="glass-panel rise mb-8 min-w-0 overflow-hidden">
            <div className="flex items-start justify-between border-b border-border/60 p-5 sm:p-6">
              <div><p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Founder discovery</p><h2 className="mt-1 text-xl font-extrabold">A clear picture of your idea</h2></div>
              <button type="button" onClick={() => setShowNew(false)} aria-label="Close exploration questions" className="glass-icon grid size-11 place-items-center"><X size={18} aria-hidden="true" /></button>
            </div>
            <form onSubmit={(event) => { event.preventDefault(); if (newStep === 22) void createExperiment(event); else continueDiscoveryQuestion(); }} className="mx-auto w-full min-w-0 max-w-3xl p-4 sm:p-8" aria-busy={busy || drafting}>
              {newStep <= 21 && (() => {
                const question = DISCOVERY_QUESTIONS[newStep - 1];
                const sectionIndex = Math.floor((newStep - 1) / 3);
                const sectionNames = ["Idea & problem", "People & market", "Product & delivery", "Value & competition", "Business model & reach", "Trust & operations", "Readiness & validation"];
                const answer = newStep === 1 ? idea : clarificationAnswers[newStep] || "";
                return <div key={newStep} className={`question-slide-in question-slide-in-${questionDirection}`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-2 rounded-full bg-accent/80 px-3 py-1.5 text-xs font-bold"><Sparkles size={14} aria-hidden="true" /> Set {sectionIndex + 1} of 7 · {sectionNames[sectionIndex]}</span>
                    <span className="font-mono text-xs text-muted-foreground">Question {newStep} of 21</span>
                  </div>
                  <div className="mt-5 grid gap-1.5" style={{ gridTemplateColumns: "repeat(21, minmax(0, 1fr))" }} aria-label={`Question ${newStep} of 21`}>
                    {DISCOVERY_QUESTIONS.map((_, index) => <span key={index} className={`h-1.5 rounded-full transition-colors duration-300 ${index < newStep ? "bg-secondary" : "bg-foreground/10"}`} />)}
                  </div>
                  <p className="mt-7 text-sm leading-6 text-muted-foreground">{question.hint}</p>
                  <label htmlFor="discovery-answer" className="mt-2 block break-words text-2xl font-extrabold leading-tight sm:text-3xl">{question.question}</label>
                  <textarea id="discovery-answer" autoFocus rows={5} value={answer} onChange={(event) => newStep === 1 ? setIdea(event.target.value) : setClarificationAnswers((previous) => ({ ...previous, [newStep]: event.target.value }))} placeholder={question.placeholder} className="glass-control mt-6 w-full min-w-0 resize-y p-4 text-base leading-7" />
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">Answer in plain language. Exact figures are not expected. If you are unsure, leave this blank and we will mark it as unknown.</p>
                  {error && <div role="alert" className="mt-4 rounded-2xl border border-destructive bg-card p-3 text-sm">{error}</div>}
                  <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <button type="button" disabled={newStep === 1 || drafting} onClick={() => { setQuestionDirection("previous"); setNewStep((step) => Math.max(1, step - 1)); setError(""); }} className="glass-button min-h-11 px-4 text-sm font-semibold disabled:opacity-40">Previous</button>
                    <button type="button" disabled={drafting} onClick={continueDiscoveryQuestion} className="glass-primary flex min-h-11 items-center justify-center px-5 text-sm font-extrabold disabled:opacity-60">{newStep === 21 ? drafting ? "Researching your idea…" : "Review your summary" : "Continue"}<ArrowUpRight size={16} className="ml-2" aria-hidden="true" /></button>
                  </div>
                </div>;
              })()}
              {newStep === 22 && aiDraft && <div className="question-slide-in question-slide-in-next space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3"><span className="inline-flex items-center gap-2 rounded-full bg-accent/80 px-3 py-1.5 text-xs font-bold"><Check size={14} aria-hidden="true" /> Summary · Ready for Sandbox</span><span className="font-mono text-xs text-muted-foreground">Page 22 of 22</span></div>
                <div className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(22, minmax(0, 1fr))" }} aria-hidden="true">{Array.from({ length: 22 }, (_, index) => <span key={index} className="h-1.5 rounded-full bg-secondary" />)}</div>
                <header><p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Your idea, refined</p><h3 className="mt-2 break-words text-2xl font-black leading-tight sm:text-3xl">{aiDraft.title || title || "Your exploration"}</h3><p className="mt-3 break-words text-sm leading-6 text-muted-foreground">{aiDraft.objective}</p></header>

                <section className="glass-question" aria-label="Market research summary">
                  <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Market research</p><h4 className="mt-1 break-words text-lg font-extrabold">{aiDraft.market_research.market_definition || "Market opportunity"}</h4></div><span className="rounded-full bg-secondary/15 px-3 py-1.5 text-xs font-bold">{aiDraft.market_research.status === "ready" ? "Sources found" : aiDraft.market_research.status === "needs_clarification" ? "More evidence needed" : "No reliable estimate"}</span></div>
                  <p className="mt-3 break-words text-sm leading-5"><strong>Audience:</strong> {aiDraft.market_research.target_customer || "Not established from your answers"}</p><p className="mt-1 break-words text-sm leading-5"><strong>Geography:</strong> {aiDraft.market_research.geography || "Not established from your answers"}</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl border border-border/60 bg-card/60 p-4"><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total addressable market · TAM</p><p className="mt-2 text-lg font-extrabold">{formatMarketRange(aiDraft.market_research.tam_low_usd, aiDraft.market_research.tam_high_usd)}</p></div><div className="rounded-2xl border border-border/60 bg-card/60 p-4"><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Serviceable market · SAM</p><p className="mt-2 text-lg font-extrabold">{formatMarketRange(aiDraft.market_research.sam_low_usd, aiDraft.market_research.sam_high_usd)}</p></div></div>
                  <p className="mt-4 text-sm leading-6">{aiDraft.market_research.method}</p>
                  {aiDraft.market_research.assumptions.length > 0 && <div className="mt-4"><p className="text-xs font-bold uppercase tracking-wider">Sizing assumptions</p><ul className="mt-2 space-y-1 text-sm leading-5">{aiDraft.market_research.assumptions.map((item) => <li key={item}>• {item}</li>)}</ul></div>}
                  <div className="mt-4 border-t border-border/60 pt-3"><p className="text-xs font-bold uppercase tracking-wider">Sources reviewed</p>{aiDraft.market_research.sources.length > 0 ? <ul className="mt-2 space-y-2">{aiDraft.market_research.sources.map((source) => <li key={source.url} className="text-xs leading-5"><a href={source.url} target="_blank" rel="noreferrer" className="font-semibold underline underline-offset-2">{source.title}</a><span className="text-muted-foreground"> · {[source.publisher, source.published_at].filter(Boolean).join(" · ")}</span><p className="text-muted-foreground">Supports: {source.supports}</p></li>)}</ul> : <p className="mt-2 text-sm leading-5 text-muted-foreground">No credible source was returned for a market estimate. The ranges remain unestimated.</p>}</div>
                  {aiDraft.market_research.caveats.length > 0 && <div className="mt-4 rounded-2xl border border-border/60 bg-card/50 p-3"><p className="text-xs font-bold uppercase tracking-wider">Research limits</p><ul className="mt-2 space-y-1 text-xs leading-5 text-muted-foreground">{aiDraft.market_research.caveats.map((item) => <li key={item}>• {item}</li>)}</ul></div>}
                  <p className="mt-4 border-t border-border/60 pt-3 text-xs leading-5 text-muted-foreground">TAM and SAM are sourced estimates with assumptions, not a forecast of sales. Market research does not calibrate the simulation.</p>
                </section>

                <section className="glass-question" aria-label="Balanced idea review"><p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">What looks promising and what could go wrong</p><div className="mt-4 grid gap-5 sm:grid-cols-2"><div><h4 className="font-extrabold">Founder’s intended value</h4><p className="mt-2 break-words text-sm leading-5">{clarificationAnswers[11]?.trim() || "No specific advantage was provided yet; treat differentiation as an open question."}</p></div><div><h4 className="font-extrabold">Risks and unknowns</h4><ul className="mt-2 space-y-2 text-sm leading-5 text-muted-foreground">{[...aiDraft.market_research.caveats, ...aiDraft.missing_information].slice(0, 6).map((item) => <li key={item} className="break-words">• {item}</li>)}{aiDraft.market_research.caveats.length === 0 && aiDraft.missing_information.length === 0 && <li>• Costs, competition, and adoption still need independent validation.</li>}</ul></div></div></section>

                <section className="glass-question" aria-label="Costs and competition"><p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Costs and competition</p><p className="mt-2 text-sm leading-6">Your answers and the sources above can surface alternatives people use today. This research draft does not provide verified competitor comparisons or operating costs. Treat both as open questions until supported by specific evidence.</p><p className="mt-2 text-xs leading-5 text-muted-foreground">The sandbox model does not include acquisition costs, staffing or infrastructure expenses, pricing, payment fees, or competitor behavior unless those are explicitly represented in its assumptions.</p></section>

                <section className="glass-question" aria-label="Model readiness"><p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Sandbox model readiness</p><p className="mt-2 text-sm leading-6">{aiDraft.configuration_valid ? `Sandbox prepared a provisional ${aiDraft.suggested_engine.replaceAll("_", " ")} scenario using cited benchmarks where available and clearly labeled assumptions where evidence is missing. Its outputs are conditional model results, not verified real-world truth or a forecast.` : "No available model could represent a useful question with responsibly bounded inputs yet. Your idea and research will still be saved; the dashboard will explain the model limitations."}</p>{aiDraft.assumptions.length > 0 && <div className="mt-3"><h4 className="text-xs font-bold uppercase tracking-wider">Scenario assumptions to review</h4><ul className="mt-2 space-y-1 text-sm leading-5">{aiDraft.assumptions.map((item) => <li key={item}>• {item}</li>)}</ul></div>}{aiDraft.variables.length > 0 && <ul className="mt-3 space-y-2">{aiDraft.variables.map((variable) => <li key={variable.name} className="text-sm"><strong>{variable.name.replaceAll("_", " ")}:</strong> {variable.value ?? "Not estimated"}{variable.unit ? ` ${variable.unit}` : ""}<p className="text-xs leading-5 text-muted-foreground">{variable.rationale}</p></li>)}</ul>}{aiDraft.configuration_errors.length > 0 && <ul className="mt-3 space-y-1 text-xs leading-5 text-muted-foreground">{aiDraft.configuration_errors.map((item) => <li key={item}>• {item}</li>)}</ul>}</section>

                <details className="glass-question"><summary className="cursor-pointer font-extrabold">Your answers · 21 questions in seven sets</summary><div className="mt-4 space-y-5">{Array.from({ length: 7 }, (_, setIndex) => <section key={setIndex}><h4 className="font-bold">Set {setIndex + 1} · {DISCOVERY_QUESTIONS[setIndex * 3].section}</h4><dl className="mt-2 space-y-3">{DISCOVERY_QUESTIONS.slice(setIndex * 3, setIndex * 3 + 3).map((item, offset) => { const questionNumber = setIndex * 3 + offset + 1; const answer = questionNumber === 1 ? idea : clarificationAnswers[questionNumber]; return <div key={questionNumber} className="border-t border-border/60 pt-2"><dt className="text-xs font-semibold text-muted-foreground">{questionNumber}. {item.question}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm">{answer?.trim() || "Not sure yet."}</dd></div>; })}</dl></section>)}</div></details>

                {error && <div role="alert" className="rounded-2xl border border-destructive bg-card p-3 text-sm">{error}</div>}
                <p className="text-xs leading-5 text-muted-foreground">AI research and commentary can be incomplete. Sources do not guarantee demand, costs or competitors. You can edit your answers before starting the exploration.</p>
                <div className="flex flex-col-reverse gap-3 border-t border-border/60 pt-5 sm:flex-row sm:items-center sm:justify-between"><button type="button" disabled={busy} onClick={() => { setQuestionDirection("previous"); setNewStep(21); }} className="glass-button min-h-11 px-4 text-sm font-semibold">Back to question 21</button><button disabled={busy || drafting} type="submit" className="glass-primary flex min-h-12 items-center justify-center px-6 text-sm font-extrabold disabled:opacity-60">{busy ? <LoaderCircle size={16} className="mr-2 motion-safe:animate-spin" aria-hidden="true" /> : null}Enter Sandbox<ArrowUpRight size={16} className="ml-2" aria-hidden="true" /></button></div>
              </div>}
              {newStep === 22 && !aiDraft && <div className="py-12 text-center"><LoaderCircle size={24} className="mx-auto motion-safe:animate-spin" aria-hidden="true" /><p className="mt-4 font-semibold">Researching your idea and preparing the summary…</p></div>}
            </form>
          </section>}

          {!showNew && (!currentExperiment ? <section className="mx-auto max-w-3xl border-2 border-foreground bg-card p-6 sm:p-10">
            <div className="inline-flex items-center gap-2 bg-accent px-3 py-2 text-xs font-bold uppercase tracking-wider"><FlaskConical size={14} aria-hidden="true" /> Your workspace</div>
            <h1 className="mt-6 max-w-xl text-3xl font-black tracking-tight sm:text-4xl">Explore your idea before you have all the answers.</h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">Describe what you want to build. Sandbox will ask about the people you want to serve and where, research the market with citations, then help you decide whether the available evidence supports a simulation.</p>
            <button type="button" onClick={startNewExploration} className="mt-7 flex min-h-12 items-center gap-2 border border-foreground bg-primary px-5 text-sm font-extrabold text-primary-foreground hover:brightness-95"><Plus size={17} aria-hidden="true" />Explore an idea</button>
            <div className="mt-9 grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border border-border p-4"><span className="font-mono text-xs text-muted-foreground">01</span><p className="mt-2 font-bold">Describe</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Start with the idea in everyday language.</p></div><div className="rounded-2xl border border-border p-4"><span className="font-mono text-xs text-muted-foreground">02</span><p className="mt-2 font-bold">Research</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Clarify audience and geography, then inspect sources and assumptions.</p></div><div className="rounded-2xl border border-border p-4"><span className="font-mono text-xs text-muted-foreground">03</span><p className="mt-2 font-bold">Model when ready</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Run a simulation once usable inputs have evidence behind them.</p></div></div>
          </section> : <div className="rise space-y-7">
            <div className="flex min-w-0 flex-col justify-between gap-5 sm:flex-row sm:items-end"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="max-w-full break-words rounded-full border border-border bg-card px-3 py-1 text-xs font-bold uppercase tracking-wider">{currentExperiment.domain.replaceAll("_", " ")}</span><span className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className="size-2 rounded-full bg-secondary" /> Version {currentExperiment.version}</span></div><h1 className="mt-3 break-words text-3xl font-black tracking-tight sm:text-4xl">{currentExperiment.title}</h1><p className="mt-2 max-w-2xl break-words text-sm leading-6 text-muted-foreground">{currentExperiment.objective || "No objective added."}</p></div>{simulation && <div className="flex flex-wrap items-end gap-3"><div className="space-y-1"><label htmlFor="run-seed" className="text-xs font-semibold">Seed (optional)</label><input id="run-seed" type="text" inputMode="numeric" pattern="[0-9]+" value={runSeed} onChange={(event) => setRunSeed(event.target.value)} placeholder="Random" className="h-11 w-28 border border-border bg-card px-3 font-mono text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" /></div><button type="button" disabled={!activeScenario || busy} onClick={() => activeScenario && void startRun(activeScenario)} className="flex min-h-11 shrink-0 items-center justify-center gap-2 border border-foreground bg-primary px-4 text-sm font-extrabold text-primary-foreground disabled:opacity-50"><Play size={16} aria-hidden="true" />Run scenario</button></div>}</div>
            {!simulation && <section className="glass-question"><div className="flex items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-full bg-accent"><Sparkles size={18} aria-hidden="true" /></span><div className="min-w-0"><h2 className="font-extrabold">Discovery saved</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">This exploration contains your idea, founder answers, and market research. Sandbox did not have evidence-backed inputs for a responsible simulation, so it did not create a run or present market estimates as simulation results.</p></div></div></section>}
            {simulation && <>
            <section aria-label="Experiment overview" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{(currentEngine === "queueing" ? [["Arrivals / hour", config.arrival_rate_per_hour, "Configured assumption"], ["Service rate", config.service_rate_per_hour_per_server, "Per server, per hour"], ["Servers", config.servers, "Parallel capacity"], ["Duration", `${config.duration_hours ?? "—"} h`, "Simulation window"]] : currentEngine === "inventory" ? [["Demand / day", config.average_daily_demand, "Average assumption"], ["Reorder point", config.reorder_point, "Inventory threshold"], ["Order quantity", config.order_quantity, "Units per order"], ["Duration", `${config.duration_days ?? "—"} days`, "Simulation window"]] : [["Trials", config.trials, "Repeated scenarios"], ["Periods", config.periods, "Per trial"], ["Demand likely", config.demand_mode, "Units per period"], ["Fixed cost", config.fixed_cost_per_period, "Per period"]]).map(([label, value, note]) => <MetricCard key={String(label)} label={String(label)} value={String(value ?? "—")} note={String(note)} />)}</section>

            <div className="grid gap-7 xl:grid-cols-[minmax(0,1.3fr)_minmax(300px,0.7fr)]">
              <section className="min-w-0 border border-border bg-card">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5"><div><p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Scenario workbench</p><h2 className="mt-1 text-lg font-extrabold">Choose a scenario</h2></div>{currentEngine === "queueing" && <button type="button" onClick={() => { setBranchArrival(String(Number(config.arrival_rate_per_hour || 0) * 1.25)); setShowBranch(true); }} disabled={!activeScenario} className="flex min-h-10 items-center gap-2 border border-border px-3 text-sm font-bold hover:bg-muted disabled:opacity-50"><Plus size={15} aria-hidden="true" />Branch scenario</button>}</div>
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
                    <RunVisualizations engine={currentEngine} metrics={selectedScenarioRun.metrics || {}} />
                    {Object.entries(selectedScenarioRun.metrics || {}).filter(([name, value]) => name !== "assumptions" && name !== "series" && name !== "histogram" && typeof value !== "object").map(([name, value]) => <div key={name} className="flex items-baseline justify-between gap-4 border-b border-border pb-3"><span className="text-sm text-muted-foreground">{metricLabels[name] || name.replaceAll("_", " ")}</span><span className="font-mono text-sm font-bold tabular-nums">{formatMetric(name, value)}</span></div>)}
                    <p className="text-xs leading-5 text-muted-foreground">Seed {selectedScenarioRun.seed}. Outputs are generated by the {currentEngine.replaceAll("_", " ")} model.</p>
                    {!runExplanation || runExplanation.runId !== selectedScenarioRun.id ? <div className="space-y-2 border border-border bg-muted p-3 text-sm"><p className="font-semibold">Preparing the balanced review…</p><p className="text-xs leading-5 text-muted-foreground">Sandbox is separating model-supported upside and downside from evidence it does not have.</p><button type="button" disabled={busy} onClick={() => void interpretRun(selectedScenarioRun)} className="min-h-10 border border-border bg-card px-3 text-xs font-bold hover:bg-background disabled:opacity-50">Retry review</button></div> : <button type="button" disabled={busy} onClick={() => void interpretRun(selectedScenarioRun)} className="flex min-h-10 w-full items-center justify-center gap-2 border border-border px-3 text-sm font-bold hover:bg-muted disabled:opacity-50"><Sparkles size={15} aria-hidden="true" />Refresh balanced review</button>}
                    {runExplanation?.runId === selectedScenarioRun.id && <div className="space-y-4 border border-border bg-muted p-4 text-sm"><div><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Balanced readout</p><p className="mt-2 leading-6">{runExplanation.result.summary}</p></div><div className="grid gap-3 sm:grid-cols-2"><div className="border border-success/50 bg-card p-3"><p className="font-bold text-success">What looks promising</p><ul className="mt-2 list-disc space-y-1 pl-5">{runExplanation.result.upside.map((item) => <li key={item}>{item}</li>)}</ul></div><div className="border border-warning bg-card p-3"><p className="font-bold">Risks and downside</p><ul className="mt-2 list-disc space-y-1 pl-5">{runExplanation.result.downside.map((item) => <li key={item}>{item}</li>)}</ul></div></div><div className="border border-border bg-card p-3"><p className="font-bold">Costs and competition</p><ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">{runExplanation.result.cost_and_competition.map((item) => <li key={item}>{item}</li>)}</ul></div>{runExplanation.result.findings.length > 0 && <div><p className="text-xs font-bold uppercase tracking-wider">What the run shows</p><ul className="mt-1 list-disc space-y-1 pl-5">{runExplanation.result.findings.map((item) => <li key={item}>{item}</li>)}</ul></div>}{runExplanation.result.evidence_sources.length > 0 && <div className="border border-border bg-card p-3"><p className="font-bold">Sources reviewed as context</p><ul className="mt-2 space-y-2">{runExplanation.result.evidence_sources.map((source, index) => <li key={`${source.name}-${index}`} className="text-xs leading-5"><span className="font-semibold">{source.name}</span><span className="text-muted-foreground"> · {[source.provider, source.reference_area, source.period, source.license].filter(Boolean).join(" · ")}</span>{source.source_url && <> · <a className="underline underline-offset-2" href={source.source_url} target="_blank" rel="noreferrer">Source</a></>}</li>)}</ul><p className="mt-2 text-xs text-muted-foreground">These sources provide context; they did not calibrate or change the simulation.</p></div>}{runExplanation.result.evidence_gaps.length > 0 && <div><p className="text-xs font-bold uppercase tracking-wider">Evidence still needed</p><ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">{runExplanation.result.evidence_gaps.map((item) => <li key={item}>{item}</li>)}</ul></div>}{runExplanation.result.limitations.length > 0 && <div><p className="text-xs font-bold uppercase tracking-wider">Model limits</p><ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">{runExplanation.result.limitations.map((item) => <li key={item}>{item}</li>)}</ul></div>}{runExplanation.result.follow_up_questions.length > 0 && <div><p className="text-xs font-bold uppercase tracking-wider">Next questions</p><ul className="mt-1 list-disc space-y-1 pl-5">{runExplanation.result.follow_up_questions.map((item) => <li key={item}>{item}</li>)}</ul></div>}<p className="border-t border-border pt-3 text-xs leading-5 text-muted-foreground">{runExplanation.result.interpretation_notice}</p></div>}
                    {runExplanation?.runId === selectedScenarioRun.id && <div className="border-2 border-foreground bg-accent p-4"><p className="text-xs font-bold uppercase tracking-wider">Suggested next step</p><p className="mt-2 text-sm leading-6">{runExplanation.result.recommendation}</p></div>}
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
            </>}
            <section id="environment" className="border border-border bg-card">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5"><div><p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Environment library</p><h2 className="mt-1 text-lg font-extrabold">Sources & context</h2></div><button type="button" onClick={() => setNewEnvironmentOpen((open) => !open)} className="flex min-h-10 items-center gap-2 border border-border px-3 text-sm font-bold hover:bg-muted"><Plus size={15} aria-hidden="true" />New environment</button></div>
              {newEnvironmentOpen && <form onSubmit={createEnvironment} className="grid gap-3 border-b border-border bg-muted p-4 sm:grid-cols-2 xl:grid-cols-3 sm:items-end"><Field id="environment-name" label="Environment name" required value={environmentName} onChange={(event) => setEnvironmentName(event.target.value)} placeholder="e.g. Lagos service desk" /><div className="space-y-1.5"><label htmlFor="environment-type" className="text-sm font-semibold">Environment type</label><select id="environment-type" value={environmentType} onChange={(event) => setEnvironmentType(event.target.value as Environment["environment_type"])} className="h-11 w-full border border-border bg-card px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring"><option value="synthetic">Synthetic assumptions</option><option value="real_world">Real-world context</option></select></div><Field id="environment-country" label="Country" autoComplete="country-name" value={environmentCountry} onChange={(event) => setEnvironmentCountry(event.target.value)} placeholder="e.g. Nigeria" /><Field id="environment-city" label="City / area" autoComplete="address-level2" value={environmentCity} onChange={(event) => setEnvironmentCity(event.target.value)} placeholder="e.g. Lagos" /><div className="space-y-2"><p className="text-sm font-semibold">Coordinates <span className="font-normal text-muted-foreground">(optional)</span></p><button type="button" onClick={locateEnvironment} className="min-h-11 w-full border border-border bg-card px-3 text-sm font-bold hover:bg-background">{environmentCoordinates.latitude === null ? "Use current location" : `${environmentCoordinates.latitude}, ${environmentCoordinates.longitude}`}</button></div><div className="flex items-end"><button type="submit" disabled={busy} className="min-h-11 w-full border border-foreground bg-primary px-4 text-sm font-extrabold text-primary-foreground">Save environment</button></div><p className="text-xs leading-5 text-muted-foreground sm:col-span-2 xl:col-span-3">Location is optional. Current location is only requested after you choose the button, and it is stored as environment metadata. No map data is imported automatically.</p></form>}
              {environments.length ? <div className="grid gap-0 lg:grid-cols-[0.8fr_1.2fr]">
                <div className="divide-y divide-border border-b border-border lg:border-b-0 lg:border-r">{environments.map((environment) => <button type="button" key={environment.id} onClick={() => void selectEnvironment(environment.id)} className={`flex min-h-16 w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted ${activeEnvironmentId === environment.id ? "bg-accent/60" : ""}`}><span className="min-w-0"><span className="block truncate text-sm font-bold">{environment.name}</span><span className="text-xs text-muted-foreground">{environment.environment_type.replaceAll("_", " ")} · v{environment.version}</span></span><ArrowUpRight size={16} aria-hidden="true" /></button>)}</div>
                <div className="p-4"><p className="font-bold">{environments.find((item) => item.id === activeEnvironmentId)?.name || "Select an environment"}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Keep source details and previewed public time series together. A source record shows where data came from; it does not calibrate a model unless you explicitly configure and validate that relationship.</p>
                  {activeEnvironmentId && <><form onSubmit={attachDataset} className="mt-4 grid gap-3 sm:grid-cols-2"><Field id="dataset-name" label="Source record name" required value={datasetName} onChange={(event) => setDatasetName(event.target.value)} /><Field id="dataset-source" label="Source URL" type="url" value={datasetSource} onChange={(event) => setDatasetSource(event.target.value)} placeholder="https://" /><button type="submit" disabled={busy} className="min-h-11 border border-foreground bg-secondary px-3 text-sm font-bold text-secondary-foreground sm:col-span-2">Attach source details</button></form>
                    <Data360Explorer environmentId={activeEnvironmentId} token={getToken} onSaved={(dataset) => { setDatasets((items) => [...items, dataset]); setNotice("Data360 series saved to this environment as contextual data."); }} />
                    <div className="mt-4 space-y-2">{datasets.map((dataset) => <div key={dataset.id} className="flex flex-wrap items-center justify-between gap-2 border border-border p-3 text-xs"><span className="font-bold">{dataset.name}</span><span className="text-muted-foreground">{typeof dataset.metadata_json.provider === "string" ? dataset.metadata_json.provider : "Source record"}</span>{dataset.source_url ? <a className="max-w-full truncate underline" href={dataset.source_url} target="_blank" rel="noreferrer">Open source data</a> : <span className="text-muted-foreground">No source URL</span>}</div>)}{datasets.length === 0 && <p className="mt-4 border border-dashed border-border p-4 text-xs text-muted-foreground">No sources saved to this environment yet.</p>}</div></>}
                </div>
              </div> : <div className="p-5 text-sm text-muted-foreground">Create an environment to keep its type, configuration, and source provenance alongside an experiment.</div>}
            </section>
            <section className="flex flex-col justify-between gap-3 border border-border bg-muted p-5 sm:flex-row sm:items-center"><div className="flex items-start gap-3"><Database size={18} className="mt-0.5" aria-hidden="true" /><div><p className="font-bold">Model notes</p><p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">Queueing models exponential arrivals and service across parallel servers. Inventory models daily demand and fixed lead-time replenishment. Monte Carlo samples user-provided ranges across repeated trials. None currently consumes live business feeds, calibrated maps, staffing calendars, or seasonality. AI-generated content is a draft and never determines run results.</p></div></div><span className="grid size-10 shrink-0 place-items-center border border-border bg-card" title="Model details"><CircleHelp size={16} aria-hidden="true" /></span></section>
            {latestRun?.status === "failed" && latestRun.error && <p role="alert" className="border border-destructive p-4 text-sm">Run failed: {latestRun.error}</p>}
          </div>)}
        </div>
      </section>
    </div>
  </main>;
}
