import PDFDocument from "pdfkit";
import fs from "fs";
import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = path.join(__dirname, "../docs/sprint-planner-documentation.pdf");

const COLORS = {
  primary: "#6366f1",
  heading1: "#1e293b",
  heading2: "#334155",
  heading3: "#475569",
  body: "#1e293b",
  muted: "#64748b",
  accent: "#6366f1",
  border: "#cbd5e1",
  codeBg: "#f1f5f9",
  white: "#ffffff",
  tableHeader: "#e2e8f0",
  critical: "#ef4444",
  high: "#f97316",
  medium: "#3b82f6",
  low: "#94a3b8",
};

// Read git history dynamically so the document never drifts from real commits
const gitLog = execSync('git log --pretty=format:"%h|%as|%s"', { cwd: path.join(__dirname, ".."), encoding: "utf8" })
  .trim()
  .split("\n")
  .map(line => {
    const parts = line.split("|");
    return { hash: parts[0], date: parts[1], message: parts.slice(2).join("|") };
  });

const COMMIT_NARRATIVES = {
  "8337c4b": "Project scaffolded: pnpm monorepo structure, Vite + React frontend, Express backend skeleton, PostgreSQL connection, Drizzle ORM setup, base Tailwind configuration.",
  "dcdacce": "Full implementation: Drizzle schemas (features, prds, tasks, sprints), all API routes, OpenAI gpt-5.4 integration with JSON response_format, priority/risk scoring functions, full React frontend (4 pages, Layout, dark indigo/slate theme, Recharts admin charts).",
  "fc6c308": "Renamed heading from 'PRD Generator' to 'Sprint Planner'. Sidebar subtitle changed from 'Sprint Planner' (duplicate) to 'AI-powered planning'.",
  "24fb9b9": "Added ownerName field to features table (nullable at this stage), OpenAPI spec update, codegen run, frontend form (optional field), Features page owner display + dropdown filter, Admin dashboard Features by Owner table and grouped bar chart.",
  "8c966f1": "Changed owner_name column to NOT NULL. Existing null rows backfilled with 'Unassigned'. Updated OpenAPI spec (required field), regenerated Zod schemas, removed 'optional' label from form, added ownerName to button disabled condition.",
  "a29fb75": "Added LabelList component to the Tasks by Type BarChart with position='top', white bold text. Increased chart top margin from 5px to 24px to give value labels clearance above the bars.",
  "2f5c62a": "Production deployment checkpoint — app published to Replit hosting.",
  "261cec4": "Renamed 'Sprint Planner' to 'Sprint Generator' in Layout.tsx and Home.tsx headings.",
  "c960e3f": "Second production deployment checkpoint.",
  "7cbc8d5": "Reverted the name back from 'Sprint Generator' to 'Sprint Planner' in both Layout.tsx and Home.tsx.",
  "9138818": "Third production deployment checkpoint.",
  "3488519": "Repository housekeeping: transitioned from planning to build mode — no application code changed.",
  "a29201a": "Added scripts/generate-docs.mjs (pdfkit-based PDF generator) and installed pdfkit as a root devDependency. Output written to docs/sprint-planner-documentation.pdf.",
};

const doc = new PDFDocument({
  size: "A4",
  margins: { top: 60, bottom: 70, left: 60, right: 60 },
  info: {
    Title: "Sprint Planner — Application Documentation",
    Author: "Sprint Planner",
    Subject: "Technical and product documentation",
    Keywords: "sprint, planner, prd, documentation",
  },
});

const stream = fs.createWriteStream(OUTPUT_PATH);
doc.pipe(stream);

let currentPage = 0;

function addPage() {
  if (currentPage > 0) doc.addPage();
  currentPage++;
  addPageFooter();
}

function addPageFooter() {
  const bottom = doc.page.height - 40;
  doc
    .save()
    .fontSize(8)
    .fillColor(COLORS.muted)
    .text("Sprint Planner — Technical Documentation", 60, bottom, { continued: true, align: "left" })
    .text(`Page ${currentPage}`, { align: "right" })
    .restore();
}

function sectionDivider() {
  doc.moveDown(0.4);
  doc
    .save()
    .strokeColor(COLORS.border)
    .lineWidth(0.5)
    .moveTo(60, doc.y)
    .lineTo(doc.page.width - 60, doc.y)
    .stroke()
    .restore();
  doc.moveDown(0.6);
}

function h1(text) {
  checkPageBreak(60);
  doc.moveDown(0.5);
  const y = doc.y;
  doc
    .save()
    .rect(60, y - 4, doc.page.width - 120, 32)
    .fill(COLORS.primary)
    .restore();
  doc
    .fontSize(16)
    .font("Helvetica-Bold")
    .fillColor(COLORS.white)
    .text(text, 68, y + 4, { width: doc.page.width - 136 });
  doc.moveDown(1);
}

function h2(text) {
  checkPageBreak(50);
  doc.moveDown(0.8);
  doc
    .fontSize(13)
    .font("Helvetica-Bold")
    .fillColor(COLORS.heading2)
    .text(text);
  doc
    .save()
    .strokeColor(COLORS.primary)
    .lineWidth(2)
    .moveTo(60, doc.y + 2)
    .lineTo(60 + doc.widthOfString(text) + 4, doc.y + 2)
    .stroke()
    .restore();
  doc.moveDown(0.6);
}

function h3(text) {
  checkPageBreak(40);
  doc.moveDown(0.5);
  doc
    .fontSize(11)
    .font("Helvetica-Bold")
    .fillColor(COLORS.heading3)
    .text(text);
  doc.moveDown(0.3);
}

function body(text, opts = {}) {
  doc
    .fontSize(9.5)
    .font("Helvetica")
    .fillColor(COLORS.body)
    .text(text, { lineGap: 3, ...opts });
  doc.moveDown(0.3);
}

function muted(text) {
  doc
    .fontSize(9)
    .font("Helvetica")
    .fillColor(COLORS.muted)
    .text(text, { lineGap: 2 });
  doc.moveDown(0.2);
}

function bullet(text, indent = 0) {
  checkPageBreak(20);
  const x = 60 + indent;
  const bx = x + 2;
  const ty = doc.y + 3;
  doc
    .save()
    .circle(bx, ty, 2)
    .fill(COLORS.primary)
    .restore();
  doc
    .fontSize(9.5)
    .font("Helvetica")
    .fillColor(COLORS.body)
    .text(text, x + 10, doc.y, { lineGap: 2, width: doc.page.width - 120 - indent });
  doc.moveDown(0.15);
}

function code(text) {
  checkPageBreak(30);
  const x = 60;
  const w = doc.page.width - 120;
  doc.save();
  const lines = text.split("\n");
  const lineH = 13;
  const boxH = lines.length * lineH + 12;
  doc.rect(x, doc.y, w, boxH).fill(COLORS.codeBg);
  doc.fontSize(8.5).font("Courier").fillColor("#374151");
  lines.forEach((line, i) => {
    doc.text(line, x + 8, doc.y + (i === 0 ? 6 : 0), { lineGap: 0, continued: i < lines.length - 1 });
    if (i < lines.length - 1) doc.moveDown(0);
  });
  doc.restore();
  doc.y += 6;
  doc.moveDown(0.5);
}

function tableRow(cells, widths, isHeader = false) {
  checkPageBreak(20);
  const x = 60;
  const rowH = 18;
  const y = doc.y;

  if (isHeader) {
    doc.save().rect(x, y, widths.reduce((a, b) => a + b, 0), rowH).fill(COLORS.tableHeader).restore();
  } else {
    doc.save().rect(x, y, widths.reduce((a, b) => a + b, 0), rowH).stroke(COLORS.border).restore();
  }

  let cx = x;
  cells.forEach((cell, i) => {
    doc
      .fontSize(isHeader ? 8.5 : 8.5)
      .font(isHeader ? "Helvetica-Bold" : "Helvetica")
      .fillColor(isHeader ? COLORS.heading2 : COLORS.body)
      .text(String(cell), cx + 4, y + 4, { width: widths[i] - 8, lineBreak: false, ellipsis: true });
    cx += widths[i];
  });

  doc.y = y + rowH;
}

function checkPageBreak(needed = 100) {
  if (doc.y + needed > doc.page.height - 80) {
    doc.addPage();
    currentPage++;
    addPageFooter();
  }
}

// ─────────────────────────────────────────────
// COVER PAGE
// ─────────────────────────────────────────────
addPage();

const cw = doc.page.width;
const ch = doc.page.height;

doc.save().rect(0, 0, cw, ch).fill("#0f172a").restore();
doc.save().rect(0, ch - 120, cw, 120).fill(COLORS.primary).restore();

doc
  .fontSize(9)
  .font("Helvetica")
  .fillColor("rgba(255,255,255,0.5)")
  .text("TECHNICAL DOCUMENTATION", 0, 180, { align: "center", width: cw });

doc
  .fontSize(38)
  .font("Helvetica-Bold")
  .fillColor("#ffffff")
  .text("Sprint Planner", 0, 200, { align: "center", width: cw });

doc
  .fontSize(18)
  .font("Helvetica")
  .fillColor(COLORS.primary)
  .text("Application Reference Guide", 0, 254, { align: "center", width: cw });

doc
  .save()
  .strokeColor(COLORS.primary)
  .lineWidth(1)
  .moveTo(cw / 2 - 60, 285)
  .lineTo(cw / 2 + 60, 285)
  .stroke()
  .restore();

doc
  .fontSize(10)
  .font("Helvetica")
  .fillColor("rgba(255,255,255,0.7)")
  .text("System Architecture  ·  Frontend  ·  Backend & Logic Layer", 0, 305, { align: "center", width: cw })
  .text("Database Design  ·  Admin Dashboard  ·  Git History", 0, 322, { align: "center", width: cw });

doc
  .fontSize(9)
  .fillColor("rgba(255,255,255,0.5)")
  .text("Version 1.0  ·  April 2026", 0, ch - 80, { align: "center", width: cw });

// ─────────────────────────────────────────────
// TABLE OF CONTENTS
// ─────────────────────────────────────────────
doc.addPage();
currentPage++;
addPageFooter();

doc.moveDown(1);
doc
  .fontSize(20)
  .font("Helvetica-Bold")
  .fillColor(COLORS.heading1)
  .text("Table of Contents", 60, doc.y);
doc.moveDown(1);
sectionDivider();

const tocItems = [
  ["1", "System Architecture", "3"],
  ["2", "Frontend Implementation", "5"],
  ["3", "Backend Logic & Logic Layer", "7"],
  ["4", "Database Design", "10"],
  ["5", "Admin Dashboard Overview", "12"],
  ["6", "Git Commit Progression", "14"],
];

tocItems.forEach(([num, title, page]) => {
  const y = doc.y;
  doc
    .fontSize(10.5)
    .font("Helvetica-Bold")
    .fillColor(COLORS.primary)
    .text(`${num}.`, 60, y, { continued: true, width: 20 });
  doc
    .font("Helvetica")
    .fillColor(COLORS.body)
    .text(`  ${title}`, { continued: true });
  doc
    .fillColor(COLORS.muted)
    .text(page, { align: "right" });
  doc.moveDown(0.6);
});

// ─────────────────────────────────────────────
// SECTION 1: SYSTEM ARCHITECTURE
// ─────────────────────────────────────────────
doc.addPage();
currentPage++;
addPageFooter();

h1("1. System Architecture");

body(
  "Sprint Planner is a full-stack, AI-powered web application built as a pnpm monorepo. It converts " +
  "natural-language feature descriptions into structured Product Requirements Documents (PRDs), " +
  "prioritised task lists, and sprint groupings — all generated in a single AI call and persisted " +
  "to a PostgreSQL database."
);

h2("1.1 Monorepo Layout");

body("The repository is organised into three top-level directories:");

const repoRows = [
  ["Directory", "Package Name", "Purpose"],
  ["artifacts/sprint-planner", "@workspace/sprint-planner", "React + Vite frontend (web)"],
  ["artifacts/api-server", "@workspace/api-server", "Express 5 backend REST API"],
  ["lib/db", "@workspace/db", "Drizzle ORM schema + DB client"],
  ["lib/api-spec", "@workspace/api-spec", "OpenAPI 3.1 spec + Orval codegen"],
  ["lib/api-client-react", "@workspace/api-client-react", "Generated React Query hooks"],
  ["lib/api-zod", "@workspace/api-zod", "Generated Zod validation schemas"],
  ["lib/integrations-openai-ai-server", "@workspace/integrations-openai-ai-server", "OpenAI SDK via Replit proxy"],
];
repoRows.forEach((row, i) => tableRow(row, [170, 170, 195], i === 0));

h2("1.2 Service Boundaries");

bullet("Frontend (port $PORT via Vite) — serves the React SPA. Communicates exclusively with the API server via generated hooks.");
bullet("API Server (Express 5) — all routes mounted under /api. Handles CRUD for features, PRDs, tasks, sprints, and the AI generation flow.");
bullet("Database (PostgreSQL) — accessed only by the API server via Drizzle ORM. The frontend never connects to the database directly.");
bullet("AI (OpenAI gpt-5.4) — called only by the API server's POST /api/ai/generate-prd endpoint.");

h2("1.3 Data Flow");

body("A complete feature generation follows this sequence:");

const flowSteps = [
  "User fills in Feature Title, Feature Owner, and Description on the Generator page and clicks Generate Sprint Plan.",
  "Frontend calls POST /api/features → API creates a feature row with status = pending.",
  "Frontend calls POST /api/ai/generate-prd with featureId → API sets status = generating.",
  "API server sends a structured prompt to OpenAI gpt-5.4 requesting JSON output (PRD + tasks + sprints).",
  "AI returns a JSON object; the API parses it, computes priorityScore per task and riskScore for the PRD.",
  "API inserts one PRD row, 8–15 task rows (with dependency links), and 2–4 sprint rows into PostgreSQL.",
  "Feature status is set to completed. API returns the full payload to the frontend.",
  "Frontend navigates to /results/:prdId and renders the Results page with four tabs.",
];
flowSteps.forEach((step, i) => bullet(`${i + 1}. ${step}`));

h2("1.4 Technology Stack");

const stackRows = [
  ["Layer", "Technology", "Version / Notes"],
  ["Package manager", "pnpm workspaces", "v10"],
  ["Runtime", "Node.js", "v24"],
  ["Frontend framework", "React + Vite", "React 19, Vite 7"],
  ["Routing (client)", "wouter", "Lightweight SPA router"],
  ["State / data fetching", "TanStack React Query", "Generated hooks via Orval"],
  ["Styling", "Tailwind CSS", "Deep indigo/slate dark palette"],
  ["Charts", "Recharts", "Admin dashboard visualisations"],
  ["Backend framework", "Express 5", "Async route handlers"],
  ["ORM", "Drizzle ORM", "Type-safe, schema-first"],
  ["Database", "PostgreSQL", "Hosted on Replit"],
  ["Validation", "Zod v4", "API boundaries + DB schemas"],
  ["AI", "OpenAI gpt-5.4", "JSON response_format, 8192 tokens"],
  ["Codegen", "Orval", "OpenAPI → React Query + Zod"],
];
stackRows.forEach((row, i) => tableRow(row, [155, 155, 225], i === 0));

// ─────────────────────────────────────────────
// SECTION 2: FRONTEND IMPLEMENTATION
// ─────────────────────────────────────────────
doc.addPage();
currentPage++;
addPageFooter();

h1("2. Frontend Implementation");

body(
  "The frontend is a React 19 single-page application built with Vite 7. It lives in " +
  "artifacts/sprint-planner and is served at the root path /. All API communication uses " +
  "auto-generated TanStack React Query hooks produced by Orval from the OpenAPI spec."
);

h2("2.1 Entry Point & Routing");

body("src/main.tsx bootstraps React and renders <App />. Routing is handled by wouter — a lightweight alternative to React Router that uses the browser history API.");

code(`// App.tsx — route definitions
<Route path="/"           component={Home} />
<Route path="/results/:id" component={Results} />
<Route path="/features"   component={Features} />
<Route path="/admin"      component={Admin} />
<Route                    component={NotFound} />`);

h2("2.2 Layout & Navigation");

body(
  "All pages are wrapped in <Layout /> which renders a fixed left sidebar (220px) and a scrollable " +
  "main content area. The sidebar contains:"
);
bullet("Brand mark — lightning-bolt icon, app name 'Sprint Planner', tagline 'AI-powered planning'");
bullet("Navigation links — Generator (/), Features (/features), Admin (/admin)");
bullet("Footer — 'Powered by AI' label");

h2("2.3 Pages");

h3("Home — Generator (/)")
body("The main entry point. Contains a form with three required fields: Feature Title, Feature Owner, and Feature Description. The Generate Sprint Plan button is disabled until all three fields have content.");
body("On submit: creates a feature via POST /api/features, then immediately calls POST /api/ai/generate-prd. A loading indicator with an animated progress bar is shown during generation (15–30 seconds). On success, navigates to /results/:prdId. Below the form, the five most recent completed plans are listed.");

h3("Results (/results/:id)");
body("Displays the full PRD for a given ID. Four tabs:");
bullet("Overview — product overview paragraphs, goals (bullet list), success metrics");
bullet("User Stories — each story numbered; technical requirements listed separately");
bullet("Tasks — all tasks sorted by priorityScore descending; each card shows type badge, priority badge, risk level, effort points, computed score, and dependency count");
bullet("Sprint Plan — sprints in order; each sprint card shows name, goal, effort total, task count, and the individual task cards within it");

h3("Feature Library (/features)");
body("Lists all features ever created. Features can be searched by title/description or filtered by owner using a dropdown (auto-populated from distinct owner values). Each row shows owner name with an avatar icon, status badge, task/sprint/effort metadata, and a delete button.");

h3("Admin Dashboard (/admin)");
body("Monitoring page — see Section 5 for full details.");

h3("Not Found");
body("Rendered for any unmatched route. Contains a back-to-Generator button.");

h2("2.4 API Client");

body(
  "The @workspace/api-client-react package is generated by Orval from lib/api-spec/openapi.yaml. " +
  "Re-running pnpm --filter @workspace/api-spec run codegen regenerates all hooks and Zod schemas. " +
  "Key hooks used across pages:"
);

const hookRows = [
  ["Hook", "Method + Path", "Used in"],
  ["useListFeatures", "GET /api/features", "Home, Features"],
  ["useCreateFeature", "POST /api/features", "Home"],
  ["useGeneratePrd", "POST /api/ai/generate-prd", "Home"],
  ["useGetPrd", "GET /api/prds/:id", "Results"],
  ["useListTasks", "GET /api/tasks?prdId=", "Results"],
  ["useListSprints", "GET /api/sprints?prdId=", "Results"],
  ["useListPrds", "GET /api/prds", "Features, Admin"],
  ["useDeleteFeature", "DELETE /api/features/:id", "Features"],
  ["useGetAdminStats", "GET /api/admin/stats", "Admin"],
  ["useGetRecentActivity", "GET /api/admin/recent-activity", "Admin"],
];
hookRows.forEach((row, i) => tableRow(row, [175, 175, 185], i === 0));

// ─────────────────────────────────────────────
// SECTION 3: BACKEND LOGIC & LOGIC LAYER
// ─────────────────────────────────────────────
doc.addPage();
currentPage++;
addPageFooter();

h1("3. Backend Logic & Logic Layer");

body(
  "The API server is an Express 5 application (artifacts/api-server). All routes are mounted under " +
  "the /api prefix. Input validation uses Zod schemas generated from the OpenAPI spec. " +
  "Database access is handled exclusively through Drizzle ORM."
);

h2("3.1 Route Map");

const routeRows = [
  ["Method", "Path", "Description"],
  ["GET",    "/api/healthz",               "Health check — returns status: ok"],
  ["GET",    "/api/features",              "List all features ordered by createdAt"],
  ["POST",   "/api/features",              "Create feature (title, ownerName, description)"],
  ["GET",    "/api/features/:id",          "Get single feature by ID"],
  ["DELETE", "/api/features/:id",          "Delete feature row (related PRDs/tasks not auto-deleted)"],
  ["GET",    "/api/prds",                  "List all PRDs"],
  ["GET",    "/api/prds/:id",              "Get single PRD by ID"],
  ["GET",    "/api/tasks",                 "List tasks, filterable by ?prdId="],
  ["PATCH",  "/api/tasks/:id",             "Update task status or sprintId"],
  ["GET",    "/api/sprints",               "List sprints, filterable by ?prdId="],
  ["GET",    "/api/admin/stats",           "Aggregate stats for dashboard"],
  ["GET",    "/api/admin/recent-activity", "Latest 20 features with PRD metadata"],
  ["POST",   "/api/ai/generate-prd",       "AI generation — core endpoint"],
];
routeRows.forEach((row, i) => tableRow(row, [55, 200, 280], i === 0));

h2("3.2 AI Generation Endpoint (POST /api/ai/generate-prd)");

body("This is the core of the application. The full flow:");

bullet("1. Validates request body — requires featureId (integer).");
bullet("2. Fetches the feature row from the database — 404 if not found.");
bullet("3. Sets feature status to generating.");
bullet("4. Builds a structured prompt instructing OpenAI to act as a senior PM and engineering lead, and return a JSON object with PRD sections, 8–15 tasks, and 2–4 sprints.");
bullet("5. Calls openai.chat.completions.create with model gpt-5.4, response_format: { type: 'json_object' }, max_completion_tokens: 8192.");
bullet("6. Parses the JSON response into a GeneratedPlan object.");
bullet("7. Inserts one PRD row with computeRiskScore applied across all tasks.");
bullet("8. Inserts each task row with computePriorityScore applied per task. Builds a title→id map.");
bullet("9. Second pass: resolves dependencyTitles to actual task IDs and updates dependency arrays.");
bullet("10. Inserts sprint rows; updates each task with its sprintId and sets status to in_sprint.");
bullet("11. Sets feature status to completed. Returns full payload.");
bullet("12. On any error: sets feature status to failed, returns HTTP 500.");

h2("3.3 Priority Scoring Formula");

body(
  "Each task receives a computed priorityScore (stored as a float) that enables precise ordering " +
  "independent of the coarse AI-assigned label."
);

code(`function computePriorityScore(task) {
  const priorityWeights = { critical: 40, high: 30, medium: 20, low: 10 };
  const effortPenalty   = Math.min(task.effortPoints * 2, 20);
  const riskBonus       = task.riskLevel === "high"   ? 10
                        : task.riskLevel === "medium" ? 5 : 0;
  return priorityWeights[task.priority] + riskBonus - effortPenalty;
}`);

body("Component breakdown:");
bullet("Priority weight — base score from AI label: critical=40, high=30, medium=20, low=10");
bullet("Risk bonus — adds urgency for uncertain tasks: high risk +10, medium risk +5");
bullet("Effort penalty — effortPoints × 2, capped at 20. Discounts expensive tasks within same tier.");

body("Worked examples:");
const scoreEx = [
  ["Task description", "Priority", "Effort", "Risk", "Score"],
  ["Auth middleware (blocker)", "critical", "3", "high", "40+10−6 = 44"],
  ["Dashboard API endpoint",    "high",     "5", "medium", "30+5−10 = 25"],
  ["Design system tokens",      "medium",   "2", "low",    "20+0−4 = 16"],
  ["Analytics integration",     "high",     "8", "high",   "30+10−16 = 24"],
  ["README update",             "low",      "1", "low",    "10+0−2 = 8"],
];
scoreEx.forEach((row, i) => tableRow(row, [165, 65, 55, 65, 185], i === 0));

h2("3.4 Risk Score Formula");

body(
  "A single float (0–1) is computed for the entire PRD and stored in prds.risk_score. " +
  "It drives the risk indicator shown on the Results page header."
);

code(`function computeRiskScore(tasks) {
  const highRisk    = tasks.filter(t => t.riskLevel === "high").length;
  const totalEffort = tasks.reduce((acc, t) => acc + t.effortPoints, 0);
  const riskRatio   = tasks.length > 0 ? highRisk / tasks.length : 0;
  const effortFactor = Math.min(totalEffort / 100, 1);
  return parseFloat((riskRatio * 0.6 + effortFactor * 0.4).toFixed(2));
}`);

bullet("Risk ratio (60% weight) — proportion of tasks labelled high risk.");
bullet("Effort factor (40% weight) — total effort ÷ 100, capped at 1.0.");
body("Example: 5 high-risk tasks out of 12 (ratio 0.42), total effort 72 pts (factor 0.72) → score = 0.42×0.6 + 0.72×0.4 = 0.252 + 0.288 = 0.54 (54% risk).");
body("Display thresholds on Results page: score > 0.6 → red, > 0.3 → amber, ≤ 0.3 → green.");

h2("3.5 Dependency Detection");

body(
  "The AI is instructed to populate dependencyTitles[] on each task using exact titles of tasks " +
  "it depends on. After all tasks are inserted, a second pass resolves titles to database IDs:"
);
code(`for (const task of insertedTasks) {
  const deps = (task.dependencyTitles || [])
    .map(title => titleToIdMap.get(title))
    .filter(id => id !== undefined);
  if (deps.length > 0) {
    await db.update(tasksTable)
      .set({ dependencies: JSON.stringify(deps) })
      .where(eq(tasksTable.id, task.dbId));
  }
}`);
body("Dependencies are stored as a JSON string (e.g. '[3, 7]') and parsed back to number[] in API responses.");

h2("3.6 Sprint Assignment");

body("Sprint slots are filled by the AI (max 25 effort points per sprint, 2–4 sprints). The server enforces effort totals by re-summing inserted task effort rather than trusting AI numbers. Each task's sprintId is set and status changed from backlog to in_sprint.");

// ─────────────────────────────────────────────
// SECTION 4: DATABASE DESIGN
// ─────────────────────────────────────────────
doc.addPage();
currentPage++;
addPageFooter();

h1("4. Database Design");

body(
  "The database is PostgreSQL, managed with Drizzle ORM. Schemas are defined in TypeScript in " +
  "lib/db/src/schema/ and applied with drizzle-kit push. There are four application tables."
);

h2("4.1 Entity Relationships");

body(
  "The schemas do not declare explicit PostgreSQL foreign key constraints via Drizzle's " +
  ".references() helper. Referential integrity is enforced at the application level: routes " +
  "check parent existence before inserting child rows, and the AI generation endpoint manages " +
  "the insertion order explicitly. The logical relationships are:"
);
code(`features (1) ──► prds (1) ──► tasks (N)
                          └──► sprints (N)
tasks.sprint_id ──► sprints.id  (optional, null = unassigned)`);

h2("4.2 Table: features");
muted("Core record for each feature idea submitted by a user.");

const featRows = [
  ["Column", "Type", "Nullable", "Default", "Notes"],
  ["id",          "serial",    "NO",  "autoincrement", "Primary key"],
  ["title",       "text",      "NO",  "—",             "Feature display name"],
  ["description", "text",      "NO",  "—",             "Full feature description"],
  ["owner_name",  "text",      "NO",  "—",             "Mandatory feature owner"],
  ["status",      "text",      "NO",  "'pending'",     "pending|generating|completed|failed"],
  ["created_at",  "timestamptz","NO", "now()",         "Row creation time"],
  ["updated_at",  "timestamptz","NO", "now()",         "Auto-updated on change"],
];
featRows.forEach((row, i) => tableRow(row, [90, 80, 65, 100, 200], i === 0));

h2("4.3 Table: prds");
muted("Generated PRD document. One-to-one with features.");

const prdRows = [
  ["Column", "Type", "Nullable", "Notes"],
  ["id",                    "serial",      "NO",  "Primary key"],
  ["feature_id",            "integer",     "NO",  "FK → features.id"],
  ["feature_title",         "text",        "NO",  "Denormalised for display"],
  ["overview",              "text",        "NO",  "2-3 paragraph product overview"],
  ["goals",                 "text",        "NO",  "Newline-separated bullet list"],
  ["user_stories",          "text",        "NO",  "Newline-separated stories"],
  ["technical_requirements","text",        "NO",  "Newline-separated requirements"],
  ["success_metrics",       "text",        "NO",  "Newline-separated metrics"],
  ["total_tasks",           "integer",     "NO",  "Cached count, default 0"],
  ["total_sprints",         "integer",     "NO",  "Cached count, default 0"],
  ["total_effort_points",   "integer",     "NO",  "Sum of all task effort"],
  ["risk_score",            "real",        "NO",  "0.0–1.0 composite risk"],
  ["created_at",            "timestamptz", "NO",  "Row creation time"],
  ["updated_at",            "timestamptz", "NO",  "Auto-updated on change"],
];
prdRows.forEach((row, i) => tableRow(row, [160, 80, 65, 230], i === 0));

h2("4.4 Table: tasks");
muted("Individual tasks within a PRD. 8–15 per PRD.");

const taskRows = [
  ["Column", "Type", "Nullable", "Notes"],
  ["id",             "serial",      "NO",  "Primary key"],
  ["prd_id",         "integer",     "NO",  "FK → prds.id"],
  ["sprint_id",      "integer",     "YES", "FK → sprints.id (null = unassigned)"],
  ["title",          "text",        "NO",  "Short task name"],
  ["description",    "text",        "NO",  "Detailed task description"],
  ["type",           "text",        "NO",  "user_story|engineering|bug|infrastructure|design"],
  ["priority",       "text",        "NO",  "critical|high|medium|low"],
  ["effort_points",  "integer",     "NO",  "Fibonacci: 1,2,3,5,8,13"],
  ["priority_score", "real",        "NO",  "Computed — see Section 3.3"],
  ["risk_level",     "text",        "NO",  "high|medium|low"],
  ["dependencies",   "text",        "NO",  "JSON string of task ID array"],
  ["status",         "text",        "NO",  "backlog|in_sprint"],
  ["created_at",     "timestamptz", "NO",  "Row creation time"],
];
taskRows.forEach((row, i) => tableRow(row, [130, 80, 65, 260], i === 0));

h2("4.5 Table: sprints");
muted("Sprint groupings. 2–4 per PRD.");

const sprintRows = [
  ["Column", "Type", "Nullable", "Notes"],
  ["id",                  "serial",      "NO",  "Primary key"],
  ["prd_id",              "integer",     "NO",  "FK → prds.id"],
  ["sprint_number",       "integer",     "NO",  "1-based ordering"],
  ["name",                "text",        "NO",  "e.g. 'Sprint 1: Foundation'"],
  ["goal",                "text",        "NO",  "One-sentence sprint goal"],
  ["total_effort_points", "integer",     "NO",  "Sum of task effort in sprint"],
  ["task_count",          "integer",     "NO",  "Number of tasks"],
  ["start_date",          "timestamptz", "YES", "Optional sprint start"],
  ["end_date",            "timestamptz", "YES", "Optional sprint end"],
  ["created_at",          "timestamptz", "NO",  "Row creation time"],
];
sprintRows.forEach((row, i) => tableRow(row, [130, 80, 65, 260], i === 0));

// ─────────────────────────────────────────────
// SECTION 5: ADMIN DASHBOARD
// ─────────────────────────────────────────────
doc.addPage();
currentPage++;
addPageFooter();

h1("5. Admin Dashboard Overview");

body(
  "The Admin Dashboard (/admin) provides real-time monitoring of all generated sprint plans. " +
  "Data is fetched from two API endpoints and supplemented by client-side computation over the " +
  "full features and PRDs lists."
);

h2("5.1 Data Sources");

const adminDataRows = [
  ["Source", "Endpoint", "Contents"],
  ["useGetAdminStats",      "GET /api/admin/stats",           "Aggregated counts and per-type/priority breakdowns"],
  ["useGetRecentActivity",  "GET /api/admin/recent-activity", "Latest 20 features with PRD metadata joined"],
  ["useListPrds",           "GET /api/prds",                  "All PRDs (for owner metrics)"],
  ["useListFeatures",       "GET /api/features",              "All features (for owner grouping)"],
];
adminDataRows.forEach((row, i) => tableRow(row, [145, 195, 195], i === 0));

h2("5.2 Stat Cards (Row 1)");

bullet("Total Features — count of all rows in the features table.");
bullet("PRDs Generated — count of all rows in the prds table.");
bullet("Total Tasks — count of all rows in the tasks table, with avg tasks per PRD as sub-label.");
bullet("Total Sprints — count of all rows in the sprints table, with avg sprints per PRD as sub-label.");

h2("5.3 Stat Cards (Row 2)");

bullet("Avg Effort per PRD — average of prds.total_effort_points across all PRDs.");
bullet("Recent Generations — count of features created in the last 7 days.");
bullet("Completion Rate — (totalPrds / totalFeatures) × 100, indicating what proportion of submitted features reached a completed state.");

h2("5.4 Tasks by Priority Chart");

body(
  "A Recharts PieChart showing the distribution of tasks across the four priority levels. " +
  "Colour coding: Critical = red (#ef4444), High = orange (#f97316), Medium = blue (#3b82f6), " +
  "Low = slate (#94a3b8). Zero-value segments are hidden. Tooltip styled to match the dark theme."
);

h2("5.5 Tasks by Type Chart");

body(
  "A Recharts BarChart showing task counts by type. Each bar is a distinct colour: " +
  "User Story = violet, Engineering = blue, Bug = red, Infrastructure = amber, Design = pink. " +
  "Value labels (white, bold, 12pt) are rendered above each bar via a LabelList component " +
  "with position='top'. The chart top margin is 24px to provide clearance for the labels."
);

h2("5.6 Features by Owner Section");

body(
  "This section is computed entirely client-side by joining features and prds data. " +
  "It appears only when at least one feature has an owner set."
);
body("Computation logic:");
code(`const ownerData = features.reduce((map, feature) => {
  const owner = feature.ownerName || "Unassigned";
  const prd   = prdByFeatureId.get(feature.id);
  const entry = map.get(owner) || { features: 0, tasks: 0, effortPoints: 0 };
  map.set(owner, {
    features:     entry.features + 1,
    tasks:        entry.tasks + (prd?.totalTasks ?? 0),
    effortPoints: entry.effortPoints + (prd?.totalEffortPoints ?? 0),
  });
  return map;
}, new Map());`);

body("Displayed as:");
bullet("A sortable table with columns: Owner (with initial avatar), Features, Tasks, Effort pts.");
bullet("A grouped BarChart (features + tasks per owner) rendered when ≥ 2 distinct owners exist.");

h2("5.7 Recent Activity Feed");

body(
  "A table of the latest 20 features (newest first) with columns: Feature Title, task count, " +
  "sprint count, status badge (colour-coded), and creation date. Rows with a linked PRD are " +
  "clickable and navigate to /results/:prdId."
);

// ─────────────────────────────────────────────
// SECTION 6: GIT COMMIT PROGRESSION
// ─────────────────────────────────────────────
doc.addPage();
currentPage++;
addPageFooter();

h1("6. Git Commit Progression");

body(
  "The following table shows the full commit history of the Sprint Planner repository in " +
  "chronological order (oldest first), with a narrative description of what each commit introduced."
);

doc.moveDown(0.5);

const commits = [...gitLog].reverse();

commits.forEach((commit, idx) => {
  const { hash, date, message } = commit;
  const narrative = COMMIT_NARRATIVES[hash] || "See commit diff for full details.";
  checkPageBreak(55);
  const y = doc.y;
  const isEven = idx % 2 === 0;
  const rowBg = isEven ? "#f8fafc" : "#ffffff";

  doc.save().rect(60, y, doc.page.width - 120, 50).fill(rowBg).restore();
  doc.save().rect(60, y, 3, 50).fill(COLORS.primary).restore();

  doc
    .fontSize(8)
    .font("Courier")
    .fillColor(COLORS.primary)
    .text(`${hash}  ·  ${date}`, 68, y + 5, { width: doc.page.width - 136 });

  doc
    .fontSize(8.5)
    .font("Helvetica-Bold")
    .fillColor(COLORS.heading2)
    .text(message, 68, y + 17, { width: doc.page.width - 136 });

  doc
    .fontSize(8)
    .font("Helvetica")
    .fillColor(COLORS.muted)
    .text(narrative, 68, y + 29, { width: doc.page.width - 136, lineGap: 1 });

  doc.y = y + 54;
});

doc.moveDown(1);
sectionDivider();

body("End of document.", { align: "center" });
muted(`Generated: ${new Date().toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" })}  ·  Sprint Planner v1.0`);

// Finalise
doc.end();

stream.on("finish", () => {
  console.log(`✓ PDF written to: ${OUTPUT_PATH}`);
});
stream.on("error", (err) => {
  console.error("Failed to write PDF:", err);
  process.exit(1);
});
