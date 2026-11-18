/*
 * Answers of the E1 server, in the shapes the pages read
 * (docs/AZURE-INTEGRATION.md, docs/TRAINING.md, assets/js/e1-api.js).
 * Deliberately different from the preview data in e1-api.js, so a test can
 * tell that the page shows the server's answer and not the preview.
 */
const day = (iso) => new Date(iso).toISOString();

export function overview(overrides = {}) {
  return {
    csrf: "csrf-token-1",
    user: { id: "u-1", email: "kari.nordmann@example.com", name: "Kari Nordmann", givenName: "Kari", familyName: "Nordmann", picture: null, locale: "en" },
    org: { id: "org-fjord", name: "Fjord Process AS" },
    orgs: [
      { id: "org-fjord", name: "Fjord Process AS", role: "owner", license: "editor" },
      { id: "org-delta", name: "Delta Utilities", role: "member", license: "reviewer" }
    ],
    license: { type: "editor", name: "Editor", assignedAt: day("2027-05-03T09:00:00Z") },
    roles: { org: [{ key: "owner", name: "Owner" }], permissions: ["org.manage-members", "project.create"] },
    groups: [{ id: "g-1", name: "Hydrogen team" }],
    subscription: {
      plan: "standard", planName: "Standard", status: "active", source: "billing",
      periodStart: day("2027-07-01T00:00:00Z"), periodEnd: day("2027-08-01T00:00:00Z"), trialEndsAt: null, addOns: [],
      seats: { editor: { used: 3, total: 4 }, viewer: { used: 9, total: 10 } }
    },
    aiUsage: {
      periodStart: day("2027-07-01T00:00:00Z"), periodEnd: day("2027-08-01T00:00:00Z"),
      you: { credits: 120, requests: 37 },
      organization: { credits: 900, included: 1200, personalCap: 300 },
      byModel: [{ model: "GPT-4.1", credits: 120, requests: 37 }]
    },
    storage: {
      you: { bytes: 5 * 1024 * 1024 * 1024 },
      organization: { bytes: 40 * 1024 * 1024 * 1024, quota: 100 * 1024 * 1024 * 1024 },
      byProject: [{ project: "Ammonia plant", bytes: 3 * 1024 * 1024 * 1024 }]
    },
    projects: [
      { id: "p-a", name: "Ammonia plant", role: "lead", roleName: "Lead engineer", lastOpenedAt: day("2027-07-20T10:00:00Z"), objects: 5120 },
      { id: "p-b", name: "Water treatment", role: "reviewer", roleName: "Reviewer", lastOpenedAt: day("2027-07-11T10:00:00Z"), objects: 812 }
    ],
    academy: { courses: [], certificates: [] },
    packages: [{ key: "core", name: "Core", version: "1.0.0" }],
    billing: {
      canManage: true, portal: true,
      nextInvoice: { date: day("2027-08-01T00:00:00Z"), amount: 3180, currency: "USD" },
      paymentMethod: "Card ending 1881",
      invoices: [{ id: "INV-2027-07", date: day("2027-07-01T00:00:00Z"), amount: 3180, currency: "USD", status: "paid", url: "" }]
    },
    ...overrides
  };
}

/** GET /api/training: one course in progress, one included and done, one to buy. */
export function trainingList() {
  return {
    csrf: "csrf-token-2",
    learner: { name: "Kari Nordmann" },
    courses: [
      { key: "e1-fundamentals", title: "E1 Fundamentals", summary: "Find your way around E1.", level: "Beginner", access: "included", price: null, durationMinutes: 61, lessons: 9,
        progress: { percent: 44, completedLessons: 4, totalLessons: 9, status: "in_progress", nextLessonId: "f5", nextLessonTitle: "Place equipment and lines", lastActivityAt: day("2027-07-21T08:00:00Z") } },
      { key: "process-design", title: "Process design in E1", summary: "From PFD to P&ID.", level: "Intermediate", access: "included", price: null, durationMinutes: 72, lessons: 6, certificateId: "E1C-TEST-0001",
        progress: { percent: 100, completedLessons: 6, totalLessons: 6, status: "completed", lastActivityAt: day("2027-07-02T08:00:00Z") } },
      { key: "instrumentation-electrical", title: "Instrumentation and electrical", summary: "Instrument index and cables.", level: "Advanced", access: "available", price: { amount: 149, currency: "USD" }, durationMinutes: 80, lessons: 6 }
    ],
    certificates: [{ id: "E1C-TEST-0001", courseKey: "process-design", courseTitle: "Process design in E1", learnerName: "Kari Nordmann", issuedAt: day("2027-07-02T08:00:00Z"), score: 100 }]
  };
}

/*
 * GET /api/site/prices: E1's public price list (server/operator/data.mjs,
 * publicPrices), products shown on the website and active, by their sort.
 * Each product as the server sends it; `extra` adds products the operator
 * console made, with the same fields.
 */
export function sitePrices(extra = []) {
  const p = (id, name, kind, licenseType, period, description, aiCredits, usd, usdMonthly) =>
    ({ id, name, kind, licenseType, period, description, aiCredits, usd, usdMonthly, priceSince: day("2027-06-01T00:00:00Z") });
  return {
    products: [
      p("student", "University", "license", "student", "month", "For a school or university, for teaching.", null, 29, 29),
      p("university-viewer", "University Viewer", "license", null, "month", "Viewer in a University organization.", null, 9, 9),
      p("viewer", "Viewer", "license", "viewer", "month", "View, search and export in E1 itself.", null, 21, 25),
      p("reviewer", "Reviewer", "license", "reviewer", "month", "Comment, redline, approve, and ask Alex.", 300, 105, 125),
      p("editor-basic", "Editor Basic", "license", null, "month", "Editor in an Essentials organization.", 300, 355, 425),
      p("editor", "Editor", "license", "editor", "month", "Everything, with Alex making changes.", 2000, 800, 960),
      p("academy", "E1 Academy", "one_time", null, "one_time", "The full E1 Academy training, one-time payment.", null, 760, null),
      ...extra.map((x) => ({ licenseType: null, aiCredits: null, usdMonthly: null, description: "", priceSince: day("2027-06-01T00:00:00Z"), ...x }))
    ]
  };
}
