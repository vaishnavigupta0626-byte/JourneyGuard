

import { useEffect, useMemo, useState } from "react";

import {

  ResponsiveContainer,

  BarChart,

  Bar,

  XAxis,

  YAxis,

  CartesianGrid,

  Tooltip,

} from "recharts";

import "./App.css";

import "./JourneyGuardLayout.css";

const API = "http://127.0.0.1:5000";

function safeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function App() {

  const [journeys, setJourneys] = useState([]);

  const [summary, setSummary] = useState(null);

  const [analytics, setAnalytics] = useState(null);

  const [insights, setInsights] = useState([]);

  const [filter, setFilter] = useState("All");

  const [search, setSearch] = useState("");

  const [selected, setSelected] = useState(null);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  async function loadDashboard(risk = filter) {

    setLoading(true);

    setError("");

    try {

      const [summaryResponse, journeysResponse, analyticsResponse, insightsResponse] = await Promise.all([

        fetch(`${API}/api/summary`),

        fetch(`${API}/api/journeys?risk=${encodeURIComponent(risk)}&limit=100`),

        fetch(`${API}/api/analytics`),

        fetch(`${API}/api/insights`),

      ]);

      if (![summaryResponse, journeysResponse, analyticsResponse, insightsResponse].every((response) => response.ok)) {

        throw new Error("The backend returned an error.");

      }

      const [summaryData, journeysData, analyticsData, insightsData] = await Promise.all([

        summaryResponse.json(), journeysResponse.json(), analyticsResponse.json(), insightsResponse.json(),

      ]);

      setSummary(summaryData);

      setJourneys(journeysData.journeys || []);

      setAnalytics(analyticsData);

      setInsights(insightsData.insights || []);

      setSelected(null);

    } catch {

      setError(

        "Could not connect to JourneyGuard's API. Make sure the Flask server is running at http://127.0.0.1:5000."

      );

    } finally {

      setLoading(false);

    }

  }

  useEffect(() => {

    loadDashboard("All");

    // eslint-disable-next-line react-hooks/exhaustive-deps

  }, []);

  const visibleJourneys = useMemo(() => {

    const query = search.trim().toLowerCase();

    if (!query) return journeys;

    return journeys.filter((journey) =>

      [

        journey.id,

        journey.customer,

        journey.stage,

        journey.issue,

        journey.risk,

        ...(journey.risk_reasons || []),

      ]

        .filter(Boolean)

        .some((value) => String(value).toLowerCase().includes(query))

    );

  }, [journeys, search]);

  const stageData = useMemo(() => {

    const counts = {};

    journeys.forEach((journey) => {

      const stage = journey.stage || "Unknown";

      counts[stage] = (counts[stage] || 0) + 1;

    });

    return Object.entries(counts)

      .map(([stage, count]) => ({ stage, count }))

      .sort((a, b) => b.count - a.count);

  }, [journeys]);

  function changeFilter(nextFilter) {

    setFilter(nextFilter);

    loadDashboard(nextFilter);

  }

  function handleExportCSV() {

    if (!visibleJourneys.length) {

      window.alert("No journeys available to export.");

      return;

    }

    // Use the actual fields returned by the API.

    const columns = [

      ...new Set(visibleJourneys.flatMap((journey) => Object.keys(journey))),

    ];

    const escapeCSV = (value) => {

      let text = "";

      if (value === null || value === undefined) {

        text = "";

      } else if (Array.isArray(value) || typeof value === "object") {

        text = JSON.stringify(value);

      } else {

        text = String(value);

      }

      return `"${text.replace(/"/g, '""')}"`;

    };

    const csvRows = [

      columns.map(escapeCSV).join(","),

      ...visibleJourneys.map((journey) =>

        columns.map((column) => escapeCSV(journey[column])).join(",")

      ),

    ];

    const csvContent = "\uFEFF" + csvRows.join("\r\n");

    const blob = new Blob([csvContent], {

      type: "text/csv;charset=utf-8;",

    });

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;

    link.download = "journeyguard-journeys.csv";

    document.body.appendChild(link);

    link.click();

    link.remove();

    URL.revokeObjectURL(url);

  }

  return (

    <div className="app-shell">

      <aside className="sidebar">

        <a className="brand" href="#overview">

          <div className="brand-mark">JG</div>

          <div className="brand-copy">

            <h2>JourneyGuard</h2>

            <p>Customer Experience AI</p>

          </div>

        </a>

        <div className="nav-label">WORKSPACE</div>

        <nav className="sidebar-nav">

          <a className="nav-item active" href="#overview">

            ▦ &nbsp; Journey overview

          </a>

          <a className="nav-item" href="#analytics">

            ⌁ &nbsp; Friction signals

          </a>

          <a className="nav-item" href="#journeys">

            ◎ &nbsp; Recovery insights

          </a>

        </nav>

        <div className="sidebar-bottom">

          <div className="connection-card">

            <div className={`status-dot ${error ? "offline" : ""}`} />

            <div>

              <strong>Backend connection</strong>

              <p>{error ? "Connection issue" : "API integration enabled"}</p>

            </div>

          </div>

          <p className="sidebar-caption">JourneyGuard Analytics</p>

        </div>

      </aside>

      <main className="main-content" id="overview">

        <header className="topbar">

          <div>

            <p className="eyebrow">CUSTOMER INTELLIGENCE / OVERVIEW</p>

            <h1>Journey overview</h1>

            <p className="subtitle">

              Detect friction signals and prioritize customer recovery.

            </p>

          </div>

          <div className={`live-badge ${error ? "offline-badge" : ""}`}>

            <span />

            {error ? "API disconnected" : "Dataset connected"}

          </div>

        </header>

        {error && (

          <div className="error-banner">

            {error}

            <button onClick={() => loadDashboard(filter)}>Retry</button>

          </div>

        )}

        <section className="metrics-grid">

          <MetricCard

            label="Total sessions"

            value={summary?.total_sessions}

            note="Sessions in the dataset"

            icon="◫"

            loading={loading && !summary}

          />

          <MetricCard

            label="High risk"

            value={summary?.high_risk}

            note="Friction and abandonment flags"

            icon="!"

            tone="high"

            loading={loading && !summary}

          />

          <MetricCard

            label="Medium risk"

            value={summary?.medium_risk}

            note="Potential friction signals"

            icon="↗"

            tone="medium"

            loading={loading && !summary}

          />

          <MetricCard

            label="Low risk"

            value={summary?.low_risk}

            note="No predefined risk signal"

            icon="✓"

            tone="low"

            loading={loading && !summary}

          />

        </section>

        <section className="analytics-metrics" aria-label="Conversion analytics">
          <MetricCard
            label="Conversion rate"
            value={`${safeNumber(analytics?.conversion_rate_percent).toFixed(2)}%`}
            note="Sessions with at least one transaction"
            icon="↗"
            loading={loading && !analytics}
          />
          <MetricCard
            label="Cart without purchase"
            value={safeNumber(analytics?.cart_without_transaction).toLocaleString("en-IN")}
            note={`${safeNumber(analytics?.cart_without_transaction_percent).toFixed(2)}% of all sessions`}
            icon="◷"
            tone="medium"
            loading={loading && !analytics}
          />
          <MetricCard
            label="High-risk share"
            value={`${safeNumber(analytics?.high_risk_percent).toFixed(2)}%`}
            note="Rule-based high-risk sessions"
            icon="!"
            tone="high"
            loading={loading && !analytics}
          />
        </section>

        <section className="analytics-panel" id="analytics">

          <div className="panel-heading">

            <div>

              <SectionHeading>Journey stage distribution</SectionHeading>

              <p>

                Counts for the sessions currently loaded below (up to 100).

              </p>

            </div>

          </div>

          {loading ? (

            <div className="chart-empty">Loading journey analytics…</div>

          ) : stageData.length === 0 ? (

            <div className="chart-empty">

              No stage data is available. Check the backend connection.

            </div>

          ) : (

            <div className="chart-container">

              <ResponsiveContainer width="100%" height={260}>

                <BarChart

                  data={stageData}

                  margin={{ top: 12, right: 20, left: 0, bottom: 10 }}

                >

                  <CartesianGrid

                    strokeDasharray="3 3"

                    vertical={false}

                    stroke="#e8ebf2"

                  />

                  <XAxis

                    dataKey="stage"

                    tick={{ fontSize: 12, fill: "#697386" }}

                    axisLine={false}

                    tickLine={false}

                  />

                  <YAxis

                    allowDecimals={false}

                    tick={{ fontSize: 12, fill: "#697386" }}

                    axisLine={false}

                    tickLine={false}

                  />

                  <Tooltip

                    cursor={{ fill: "#f3f4f8" }}

                    contentStyle={{

                      borderRadius: 10,

                      border: "1px solid #e5e7eb",

                    }}

                  />

                  <Bar

                    dataKey="count"

                    name="Sessions"

                    fill="#6366f1"

                    radius={[6, 6, 0, 0]}

                    maxBarSize={72}

                  />

                </BarChart>

              </ResponsiveContainer>

            </div>

          )}

        </section>

        <section className="insights-panel" aria-labelledby="insights-title">

          <div className="panel-heading">

            <div>

              <SectionHeading>Recovery insights</SectionHeading>

              <p>Dataset-level indicators with suggested areas to investigate.</p>

            </div>

          </div>

          <div className="insights-grid">

            {insights.map((insight) => (

              <article className="insight-card" key={insight.id}>

                <div className="insight-card-top"><span className="insight-severity">{insight.severity}</span><strong>{Number(insight.count ?? 0).toLocaleString()}</strong></div>

                <h3>{insight.title}</h3>

                <p>{insight.recommendation}</p>

              </article>

            ))}

          </div>

          <p className="disclaimer">Insights are rule-based indicators and do not establish the cause of customer behavior.</p>

        </section>

        <section className="journey-panel" id="journeys">

          <div className="panel-heading">

            <div>

              <SectionHeading>Customer sessions</SectionHeading>

              <p>Showing up to 100 sessions for the selected risk level.</p>

            </div>

            <div className="journey-actions">

              <button

                className="export-button"

                onClick={handleExportCSV}

                disabled={loading || visibleJourneys.length === 0}

                type="button"

              >

                ↓ Export CSV

              </button>

              <button

                className="refresh-button"

                onClick={() => loadDashboard(filter)}

                disabled={loading}

                type="button"

              >

                ↻ Refresh

              </button>

            </div>

          </div>

          <div className="toolbar">

            <div className="filter-tabs">

              {["All", "High", "Medium", "Low"].map((risk) => (

                <button

                  key={risk}

                  className={

                    filter === risk ? "filter-tab selected" : "filter-tab"

                  }

                  onClick={() => changeFilter(risk)}

                  type="button"

                >

                  {risk}

                </button>

              ))}

            </div>

            <input

              className="search-input"

              value={search}

              onChange={(event) => setSearch(event.target.value)}

              placeholder="Search session or customer..."

              aria-label="Search sessions"

            />

          </div>

          {loading ? (

            <div className="empty-state">Loading customer sessions…</div>

          ) : visibleJourneys.length === 0 ? (

            <div className="empty-state">

              {error

                ? "Unable to load sessions. Check the backend."

                : "No sessions match your search."}

            </div>

          ) : (

            <div className="table-wrap">

              <table>

                <thead>

                  <tr>

                    <th>SESSION / CUSTOMER</th>

                    <th>JOURNEY STAGE</th>

                    <th>FRICTION SIGNAL</th>

                    <th>RISK</th>

                    <th>SCORE</th>

                    <th />

                  </tr>

                </thead>

                <tbody>

                  {visibleJourneys.map((journey) => (

                    <tr key={journey.id}>

                      <td>

                        <strong>{journey.id}</strong>

                        <span className="secondary-cell">

                          Customer {journey.customer}

                        </span>

                      </td>

                      <td>{journey.stage}</td>

                      <td className="issue-cell">{journey.issue}</td>

                      <td>

                        <span

                          className={`risk-badge ${(journey.risk || "low").toLowerCase()}`}

                        >

                          {journey.risk}

                        </span>

                      </td>

                      <td>

                        <div className="score-cell">

                          <strong>{journey.risk_score ?? 0}/100</strong>

                          <div className="score-track"><span style={{ width: `${Math.min(100, journey.risk_score ?? 0)}%` }} /></div>

                        </div>

                      </td>

                      <td>

                        <button

                          className="view-button"

                          onClick={() => setSelected(journey)}

                          type="button"

                        >

                          Details →

                        </button>

                      </td>

                    </tr>

                  ))}

                </tbody>

              </table>

            </div>

          )}

          <div className="table-footer">

            <span>{visibleJourneys.length} sessions displayed</span>

            <span>Source: session_features.csv</span>

          </div>

        </section>

        {selected && (

          <section className="details-panel">

            <div className="panel-heading">

              <div>

                <p className="eyebrow">SESSION DETAILS</p>

                <h2>Session {selected.id}</h2>

                <p className="subtitle">Customer {selected.customer}</p>

              </div>

              <button

                className="refresh-button"

                onClick={() => setSelected(null)}

                type="button"

              >

                Close ×

              </button>

            </div>

            <div className="detail-metrics">

              <Detail label="Events" value={selected.event_count} />

              <Detail label="Product views" value={selected.views} />

              <Detail label="Add to cart" value={selected.add_to_cart} />

              <Detail label="Transactions" value={selected.transactions} />

              <Detail

                label="Duration"

                value={`${selected.duration_minutes ?? 0} min`}

              />

            </div>

            <h3>Detected signal</h3>

            <p>{selected.issue}</p>

            <div className="score-detail">

              <div><span>Explainable heuristic score</span><strong>{selected.risk_score ?? 0}/100</strong></div>

              <div className="score-track large"><span style={{ width: `${Math.min(100, selected.risk_score ?? 0)}%` }} /></div>

              <p>This is a rule-based indicator, not a probability that a customer will abandon.</p>

            </div>

            <h3>Why this score?</h3>

            <ul>{(selected.risk_reasons || ["No score explanation provided by the API."]).map((reason, index) => <li key={`${selected.id}-reason-${index}`}>{reason}</li>)}</ul>

            <h3>Evidence</h3>

            <ul>

              {(selected.evidence || [

                "No additional evidence provided.",

              ]).map((item, index) => (

                <li key={`${selected.id}-evidence-${index}`}>{item}</li>

              ))}

            </ul>

            <h3>Suggested recovery action</h3>

            <p>{selected.action}</p>

            <p className="disclaimer">

              Risk levels and scores are transparent heuristic indicators based on available session features. They are not trained ML predictions, calibrated probabilities, or proof of customer intent.

            </p>

          </section>

        )}

        <footer className="page-footer">

          JourneyGuard · Customer journey friction monitoring

        </footer>

      </main>

    </div>

  );

}

function SectionHeading({ children }) {

  return <h2>{children}</h2>;

}

function MetricCard({ label, value, note, icon, tone = "", loading }) {

  return (

    <div className="metric-card">

      <div className="metric-top">

        <span>{label}</span>

        <span className={`metric-icon ${tone}`}>{icon}</span>

      </div>

      <div className="metric-value">

        {loading
          ? "…"
          : typeof value === "string"
            ? value
            : safeNumber(value).toLocaleString("en-IN")}

      </div>

      <p>{note}</p>

    </div>

  );

}

function Detail({ label, value }) {

  return (

    <div className="detail-metric">

      <span>{label}</span>

      <strong>{value ?? 0}</strong>

    </div>

  );

}

export default App;
