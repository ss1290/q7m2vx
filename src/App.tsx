import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowDownToLine,
  ArrowRight,
  BarChart3,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Database,
  Info,
  LayoutDashboard,
  Menu,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  Wind,
  X,
} from 'lucide-react';

type Metric = {
  count: number;
  mae_mw: number | null;
  rmse_mw: number | null;
  bias_mw: number | null;
  wape_pct: number | null;
  p90_absolute_error_mw: number | null;
  shortfall_mwh: number | null;
};
type Row = {
  decision_date: string;
  decision_time: string;
  delivery_date: string;
  start_time: string;
  publish_time: string | null;
  forecast_mw: number | null;
  actual_mw: number | null;
  error_mw: number | null;
  forecast_age_hours: number | null;
  lead_hours: number | null;
};
type Analysis = {
  summary: Metric & {
    expected_hours: number;
    forecast_hours: number;
    actual_hours: number;
    coverage_pct: number;
  };
  daily: (Metric & { decision_date: string })[];
  rows: Row[];
  provenance: {
    fetched_at: string;
    source: string;
    synthetic: boolean;
    counts: Record<string, number>;
    sha256: Record<string, string>;
    urls: string[];
  };
};
type View = 'overview' | 'accuracy' | 'data' | 'methodology';
const navigation = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'accuracy', label: 'Forecast accuracy', icon: BarChart3 },
  { id: 'data', label: 'Data explorer', icon: Database },
  { id: 'methodology', label: 'Methodology', icon: BookOpen },
] as const;
const number = (value: number | null | undefined, digits = 0) =>
  value == null
    ? '\u2014'
    : value.toLocaleString('en-GB', {
        maximumFractionDigits: digits,
        minimumFractionDigits: digits,
      });
const shortDate = (value: string) =>
  new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'Europe/London',
  });
const clock = (value: string) =>
  new Date(value).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/London',
  });

export default function App() {
  const [view, setView] = useState<View>('overview');
  const [from, setFrom] = useState('2026-01-01');
  const [to, setTo] = useState('2026-01-31');
  const [cutoff, setCutoff] = useState('09:00');
  const [data, setData] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [selectedDay, setSelectedDay] = useState('2026-01-31');
  const [mobileNav, setMobileNav] = useState(false);
  const [tableLimit, setTableLimit] = useState(48);
  const query = new URLSearchParams({ decision_from: from, decision_to: to, cutoff }).toString();

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    // Cancel older requests so a slow response cannot overwrite newer filters.
    fetch(`/api/analysis?${query}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          const detail = await response.json();
          throw new Error(
            typeof detail.detail === 'string' ? detail.detail : 'Unable to load analysis.',
          );
        }
        return response.json() as Promise<Analysis>;
      })
      .then((value) => {
        setData(value);
        setSelectedDay((day) =>
          value.daily.some((d) => d.decision_date === day)
            ? day
            : value.daily.at(-1)!.decision_date,
        );
      })
      .catch((reason) => {
        if (reason.name !== 'AbortError') setError(reason.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [query, refresh]);

  const dayRows = useMemo(
    () => data?.rows.filter((row) => row.decision_date === selectedDay) ?? [],
    [data, selectedDay],
  );
  const selectedMetric = data?.daily.find((day) => day.decision_date === selectedDay);
  const summary = data?.summary;
  const forecastValues = dayRows.filter((row) => row.forecast_mw != null);
  const dayEnergy =
    forecastValues.length === 24
      ? forecastValues.reduce((sum, row) => sum + row.forecast_mw!, 0)
      : null;
  const publications = [...new Set(forecastValues.map((row) => row.publish_time!))].sort();
  const dailyChart =
    data?.daily.map((day) => ({ ...day, label: shortDate(day.decision_date) })) ?? [];
  const changeView = (next: View) => {
    setView(next);
    setMobileNav(false);
  };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? 'is-open' : ''}`}>
        <a
          className="brand"
          href="#"
          onClick={(event) => {
            event.preventDefault();
            changeView('overview');
          }}
        >
          <span className="brand-icon">
            <Wind size={25} />
          </span>
          <span>
            windward<span className="brand-dot">.</span>
          </span>
        </a>
        <div className="workspace">
          <span className="workspace-symbol">GB</span>
          <div>
            Power procurement<small>Great Britain workspace</small>
          </div>
          <ChevronRight size={15} />
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav aria-label="Main navigation">
          {navigation.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`nav-link ${view === id ? 'active' : ''}`}
              onClick={() => changeView(id)}
              aria-current={view === id ? 'page' : undefined}
            >
              <Icon size={18} />
              <span>{label}</span>
              {view === id && <span className="nav-active-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <ShieldCheck size={23} />
          <strong>Decisions with perspective.</strong>
          <p>
            Understand the wind.
            <br />
            Plan the power.
          </p>
          <span>JANUARY 2026 PILOT</span>
        </div>
        <div className="sidebar-bottom">
          <div className="avatar">PA</div>
          <div>
            Procurement analyst<small>UK energy operations</small>
          </div>
          <span className="status-dot" />
        </div>
      </aside>
      {mobileNav && (
        <button
          className="nav-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobileNav(false)}
        />
      )}
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="mobile-menu icon-button"
              aria-label="Toggle navigation"
              onClick={() => setMobileNav(!mobileNav)}
            >
              {mobileNav ? <X size={19} /> : <Menu size={19} />}
            </button>
            <span>Workspace</span>
            <ChevronRight size={13} />
            <strong>{navigation.find((item) => item.id === view)?.label}</strong>
          </div>
          <div className="topbar-right">
            <span className="source-pill">
              <span className="status-dot" /> Elexon data
            </span>
            <span className="topbar-separator" />
            <span>
              GB <span className="muted">/</span> Europe/London
            </span>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                WIND INTELLIGENCE <span>/</span> DAY-AHEAD MARKET
              </div>
              <h1>
                {view === 'overview'
                  ? 'A clearer view of tomorrow.'
                  : navigation.find((item) => item.id === view)?.label}
              </h1>
              <p>
                {view === 'overview'
                  ? 'The forecast, the uncertainty, and the context to buy with confidence.'
                  : 'An auditable view of January 2026 wind forecast performance.'}
              </p>
            </div>
            <a className="button export-button" href={`/api/export?${query}`}>
              <ArrowDownToLine size={16} /> Export CSV
            </a>
          </div>
          <section className="filter-bar" aria-label="Analysis filters">
            <div className="filter-intro">
              <CalendarDays size={18} />
              <strong>Decision window</strong>
            </div>
            <input
              aria-label="Decision start date"
              type="date"
              min="2026-01-01"
              max="2026-01-31"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setTableLimit(48);
              }}
            />
            <span className="muted">to</span>
            <input
              aria-label="Decision end date"
              type="date"
              min="2026-01-01"
              max="2026-01-31"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setTableLimit(48);
              }}
            />
            <div className="filter-divider" />
            <label className="cutoff-label">
              Decision cutoff{' '}
              <input
                aria-label="Decision cutoff London time"
                type="time"
                value={cutoff}
                onChange={(e) => setCutoff(e.target.value)}
              />
              <span className="muted">GMT</span>
            </label>
            <button
              className="icon-button refresh-button"
              aria-label="Reload saved data snapshot"
              onClick={() => setRefresh((v) => v + 1)}
            >
              <RefreshCw size={16} className={loading ? 'spin' : ''} />
            </button>
          </section>
          <div className="filter-footnote">
            <Info size={13} /> Cutoff is a configurable assumption. Each decision day D uses only
            publications available by cutoff for delivery on D+1.
          </div>
          {error ? (
            <div className="error-panel" role="alert">
              <strong>We could not load this analysis.</strong>
              <p>{error}</p>
              <button className="button" onClick={() => setRefresh((v) => v + 1)}>
                Try again
              </button>
            </div>
          ) : loading ? (
            <div className="loading-panel" role="status">
              <Wind className="spin" size={32} />
              <h2>Preparing your wind outlook</h2>
              <p>Matching forecasts to their decision-time publications...</p>
            </div>
          ) : (
            data && (
              <>
                {view === 'overview' && (
                  <>
                    <section className="outlook-banner">
                      <div className="outlook-copy">
                        <span className="banner-label">
                          <span className="status-dot" /> YOUR NEXT-DAY OUTLOOK
                        </span>
                        <h2>
                          Wind in view.
                          <br />
                          <span>Uncertainty accounted for.</span>
                        </h2>
                        <p>
                          Review the wind forecast available at your chosen cutoff,
                          <br className="desktop-break" /> then put it in context with historical
                          forecast error.
                        </p>
                        <button className="text-button" onClick={() => changeView('accuracy')}>
                          Explore forecast performance <ArrowRight size={16} />
                        </button>
                      </div>
                      <div className="banner-stat">
                        <Wind size={35} strokeWidth={1.2} />
                        <div>
                          {number(dayEnergy == null ? null : dayEnergy / 1000, 1)}
                          <span>GWh</span>
                        </div>
                        <p>
                          Forecast wind energy ·{' '}
                          {dayRows[0] ? shortDate(dayRows[0].delivery_date) : '?'}
                        </p>
                        <small>24 delivery hours · decision {shortDate(selectedDay)}</small>
                      </div>
                      <div className="wind-lines" aria-hidden="true">
                        <i />
                        <i />
                        <i />
                      </div>
                    </section>
                    <div className="section-label">
                      <h2>Performance at a glance</h2>
                      <span>
                        {shortDate(from)} – {shortDate(to)} 2026 decisions
                      </span>
                    </div>
                  </>
                )}
                {(view === 'overview' || view === 'accuracy') && (
                  <>
                    <section className="metric-grid" aria-label="Forecast accuracy metrics">
                      <MetricCard
                        label="Mean absolute error"
                        value={number(summary?.mae_mw)}
                        unit="MW"
                        detail="Typical magnitude of forecast error"
                        icon={<TrendingUp size={17} />}
                      />
                      <MetricCard
                        label="Root mean square error"
                        value={number(summary?.rmse_mw)}
                        unit="MW"
                        detail="Gives more weight to larger misses"
                        icon={<BarChart3 size={17} />}
                      />
                      <MetricCard
                        label="Forecast bias"
                        value={`${summary?.bias_mw != null && summary.bias_mw > 0 ? '+' : ''}${number(summary?.bias_mw)}`}
                        unit="MW"
                        detail={
                          (summary?.bias_mw ?? 0) > 0
                            ? 'Positive = wind overforecast on average'
                            : 'Negative = wind underforecast on average'
                        }
                        icon={<Wind size={17} />}
                      />
                      <MetricCard
                        label="Matched data coverage"
                        value={number(summary?.coverage_pct, 1)}
                        unit="%"
                        detail={`${summary?.count} of ${summary?.expected_hours} delivery hours matched`}
                        icon={<CheckCircle2 size={17} />}
                      />
                    </section>
                    <div className="charts-grid">
                      <section className="panel forecast-panel">
                        <div className="panel-heading">
                          <div>
                            <h2>Forecast meets reality</h2>
                            <p>
                              Hourly wind generation · MW · delivery{' '}
                              {dayRows[0] ? shortDate(dayRows[0].delivery_date) : '?'}
                            </p>
                          </div>
                          <label className="day-selector">
                            <span>Decision</span>
                            <select
                              aria-label="Chart decision day"
                              value={selectedDay}
                              onChange={(e) => setSelectedDay(e.target.value)}
                            >
                              {data.daily.map((day) => (
                                <option key={day.decision_date} value={day.decision_date}>
                                  {shortDate(day.decision_date)}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                        <div className="chart-legend">
                          <span>
                            <i className="legend-forecast" /> As-of forecast
                          </span>
                          <span>
                            <i className="legend-actual" /> Actual generation
                          </span>
                        </div>
                        <div className="chart-container">
                          <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart
                              data={dayRows.map((row) => ({
                                ...row,
                                label: clock(row.start_time),
                              }))}
                              margin={{ top: 14, right: 12, bottom: 0, left: 0 }}
                            >
                              <defs>
                                <linearGradient id="forecastFill" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#4a8068" stopOpacity={0.16} />
                                  <stop offset="100%" stopColor="#4a8068" stopOpacity={0.01} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid
                                strokeDasharray="3 5"
                                vertical={false}
                                stroke="#e8ece7"
                              />
                              <XAxis
                                dataKey="label"
                                tick={{ fontSize: 11, fill: '#87918c' }}
                                axisLine={false}
                                tickLine={false}
                                interval={3}
                                dy={8}
                              />
                              <YAxis
                                tick={{ fontSize: 11, fill: '#87918c' }}
                                axisLine={false}
                                tickLine={false}
                                width={52}
                                tickFormatter={(value) => `${number(value / 1000, 1)}k`}
                              />
                              <Tooltip
                                formatter={(value: number, name: string) => [
                                  `${number(value)} MW`,
                                  name === 'forecast_mw' ? 'As-of forecast' : 'Actual generation',
                                ]}
                                contentStyle={{
                                  borderRadius: 10,
                                  border: '1px solid #e5e9e2',
                                  fontSize: 12,
                                }}
                              />
                              <Area
                                isAnimationActive={false}
                                type="monotone"
                                dataKey="forecast_mw"
                                stroke="#42765e"
                                fill="url(#forecastFill)"
                                strokeWidth={2.5}
                                connectNulls={false}
                              />
                              <Line
                                isAnimationActive={false}
                                type="monotone"
                                dataKey="actual_mw"
                                stroke="#bd9957"
                                strokeWidth={2}
                                strokeDasharray="5 4"
                                dot={false}
                                connectNulls={false}
                              />
                            </ComposedChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="panel-footer">
                          <ShieldCheck size={14} />
                          <span>
                            Latest eligible publication{publications.length > 1 ? 's' : ''}:{' '}
                            {publications.length
                              ? publications.map((p) => `${shortDate(p)} ${clock(p)}`).join(', ')
                              : 'unavailable'}{' '}
                            GMT
                          </span>
                        </div>
                      </section>
                      <section className="panel context-panel">
                        <div className="panel-heading">
                          <div>
                            <span className="mini-eyebrow">THE DECISION CONTEXT</span>
                            <h2>Plan for the miss.</h2>
                          </div>
                          <span className="context-icon">
                            <ShieldCheck size={20} />
                          </span>
                        </div>
                        <p className="context-intro">
                          Across your selected decision window, 90% of matched hourly errors were
                          within:
                        </p>
                        <div className="context-number">
                          {number(summary?.p90_absolute_error_mw)} <span>MW</span>
                        </div>
                        <span className="context-tag">Historical P90 absolute error</span>
                        <div className="context-divider" />
                        <div className="context-row">
                          <span>Weighted absolute error</span>
                          <strong>{number(summary?.wape_pct, 1)}%</strong>
                        </div>
                        <div className="context-row">
                          <span>Selected day's MAE</span>
                          <strong>{number(selectedMetric?.mae_mw)} MW</strong>
                        </div>
                        <div className="context-note">
                          <Info size={16} />
                          <p>
                            Retrospective error context, not a calibrated prediction interval. Wind
                            alone cannot determine total procurement.
                          </p>
                        </div>
                      </section>
                    </div>
                    <section className="panel daily-panel">
                      <div className="panel-heading">
                        <div>
                          <h2>Every decision day, in perspective</h2>
                          <p>Mean absolute forecast error by January decision date · MW</p>
                        </div>
                        <span className="subtle-badge">{data.daily.length} decision days</span>
                      </div>
                      <div className="daily-chart">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={dailyChart} margin={{ left: 0, right: 12, top: 8 }}>
                            <CartesianGrid
                              vertical={false}
                              strokeDasharray="3 5"
                              stroke="#e8ece7"
                            />
                            <XAxis
                              dataKey="label"
                              tick={{ fontSize: 10, fill: '#87918c' }}
                              axisLine={false}
                              tickLine={false}
                              interval={Math.max(0, Math.floor(data.daily.length / 10) - 1)}
                            />
                            <YAxis
                              width={52}
                              tick={{ fontSize: 10, fill: '#87918c' }}
                              axisLine={false}
                              tickLine={false}
                            />
                            <Tooltip
                              formatter={(value: number) => [`${number(value)} MW`, 'MAE']}
                              contentStyle={{ borderRadius: 10, fontSize: 12 }}
                            />
                            <ReferenceLine
                              y={summary?.mae_mw ?? 0}
                              stroke="#bd9957"
                              strokeDasharray="5 4"
                            />
                            <Bar
                              isAnimationActive={false}
                              dataKey="mae_mw"
                              fill="#628b76"
                              radius={[4, 4, 0, 0]}
                              maxBarSize={28}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="panel-footer">
                        <span className="gold-dash" />
                        <span>
                          Dashed line: selected-window MAE. Missing values are excluded, never
                          treated as zero.
                        </span>
                      </div>
                    </section>
                  </>
                )}
                {view === 'accuracy' && (
                  <section className="panel explanatory-panel">
                    <h2>What the metrics tell you</h2>
                    <div className="explanation-grid">
                      <div>
                        <h3>Magnitude</h3>
                        <p>
                          MAE describes an average miss. RMSE penalises larger errors more heavily.
                          WAPE is total absolute error divided by total matched actual generation,
                          avoiding unstable per-hour percentages near zero.
                        </p>
                      </div>
                      <div>
                        <h3>Direction</h3>
                        <p>
                          Error = forecast - actual. Positive bias means wind was overforecast,
                          creating potential replacement-power exposure. Negative bias means actual
                          wind exceeded the forecast.
                        </p>
                      </div>
                      <div>
                        <h3>Limits</h3>
                        <p>
                          This is a one-month national wind pilot. Later actual revisions may be
                          present; forecasts remain frozen at the historical cutoff. These metrics
                          do not include demand, prices, or embedded wind.
                        </p>
                      </div>
                    </div>
                  </section>
                )}
                {view === 'data' && (
                  <section className="panel table-panel">
                    <div className="panel-heading">
                      <div>
                        <h2>A publication trail for every hour</h2>
                        <p>
                          {data.rows.length} expected delivery hours. All timestamps are GMT; power
                          is MW.
                        </p>
                      </div>
                      <span className="subtle-badge">{data.summary.count} matched</span>
                    </div>
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Decision day</th>
                            <th>Delivery start</th>
                            <th>Published at</th>
                            <th>Forecast</th>
                            <th>Actual</th>
                            <th>Error</th>
                            <th>Lead time</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.rows.slice(0, tableLimit).map((row) => (
                            <tr key={row.start_time}>
                              <td>{shortDate(row.decision_date)}</td>
                              <td>
                                {shortDate(row.start_time)} · {clock(row.start_time)}
                              </td>
                              <td>
                                {row.publish_time
                                  ? `${shortDate(row.publish_time)} · ${clock(row.publish_time)}`
                                  : 'Missing'}
                              </td>
                              <td>{number(row.forecast_mw)}</td>
                              <td>{number(row.actual_mw, 1)}</td>
                              <td className={(row.error_mw ?? 0) > 0 ? 'positive-error' : ''}>
                                {row.error_mw != null && row.error_mw > 0 ? '+' : ''}
                                {number(row.error_mw, 1)}
                              </td>
                              <td>{number(row.lead_hours, 1)} h</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="table-pagination">
                      <span>
                        Showing {Math.min(tableLimit, data.rows.length)} of {data.rows.length} hours
                      </span>
                      {tableLimit < data.rows.length && (
                        <button
                          className="button"
                          onClick={() => setTableLimit((limit) => limit + 96)}
                        >
                          Show more hours
                        </button>
                      )}
                    </div>
                  </section>
                )}
                {view === 'methodology' && (
                  <>
                    <section className="panel explanatory-panel">
                      <span className="mini-eyebrow">TRANSPARENT BY DESIGN</span>
                      <h2>From publication to purchasing context.</h2>
                      <div className="method-steps">
                        <div>
                          <span>01</span>
                          <h3>Freeze the decision</h3>
                          <p>
                            Decision dates are 1-31 January 2026. Deliveries are 2 January-1
                            February. Default cutoff: 09:00 Europe/London, an editable pilot
                            assumption, not a claimed market gate closure.
                          </p>
                        </div>
                        <div>
                          <span>02</span>
                          <h3>Select what was known</h3>
                          <p>
                            For each delivery hour on D+1, choose the latest WINDFOR publication at
                            or before the decision cutoff. Selection is per target. Missing
                            forecasts remain missing. Earlier publications are retained for
                            fallback.
                          </p>
                        </div>
                        <div>
                          <span>03</span>
                          <h3>Align the actuals</h3>
                          <p>
                            Average the two FUELHH WIND half-hour power values within each forecast
                            hour. Both must exist. An hourly average in MW multiplied by one hour
                            gives energy in MWh.
                          </p>
                        </div>
                        <div>
                          <span>04</span>
                          <h3>Measure transparently</h3>
                          <p>
                            Calculate errors only on matched pairs. MAE = mean |error|; RMSE =
                            sqrt(mean(error squared)); bias = mean(error). P90 uses the nearest-rank
                            empirical quantile.
                          </p>
                        </div>
                      </div>
                    </section>
                    <section className="panel explanatory-panel">
                      <h2>Source & reproducibility</h2>
                      <p>
                        This app uses a bundled historical snapshot, not a live market feed.
                        Reloading the dashboard reloads the same saved snapshot. Run the documented
                        fetch script to update the files, then restart the backend.
                      </p>
                      <div className="source-grid">
                        <div>
                          <span>Provider</span>
                          <strong>{data.provenance.source}</strong>
                        </div>
                        <div>
                          <span>Snapshot retrieved</span>
                          <strong>
                            {new Date(data.provenance.fetched_at).toLocaleString('en-GB', {
                              timeZone: 'Europe/London',
                            })}{' '}
                            GMT
                          </strong>
                        </div>
                        <div>
                          <span>Forecast versions</span>
                          <strong>{number(data.provenance.counts.WINDFOR)}</strong>
                        </div>
                        <div>
                          <span>Actual records</span>
                          <strong>{number(data.provenance.counts.FUELHH)}</strong>
                        </div>
                      </div>
                      <p>
                        <a
                          href="https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/WINDFOR/stream"
                          target="_blank"
                          rel="noreferrer"
                        >
                          WINDFOR documentation ↗
                        </a>
                        <span className="link-spacer" />
                        <a
                          href="https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/FUELHH/stream"
                          target="_blank"
                          rel="noreferrer"
                        >
                          FUELHH documentation ↗
                        </a>
                      </p>
                      <details>
                        <summary>Snapshot checksums and source requests</summary>
                        <pre>
                          {JSON.stringify(
                            { sha256: data.provenance.sha256, urls: data.provenance.urls },
                            null,
                            2,
                          )}
                        </pre>
                      </details>
                    </section>
                  </>
                )}
                <footer className="page-footer">
                  <span>
                    <span className="status-dot" /> Historical Elexon snapshot · January 2026 pilot
                  </span>
                  <span>
                    National wind generation only <span className="footer-dot">·</span> All times
                    GMT
                  </span>
                </footer>
              </>
            )
          )}
        </main>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  unit,
  detail,
  icon,
}: {
  label: string;
  value: string;
  unit: string;
  detail: string;
  icon: React.ReactNode;
}) {
  return (
    <article className="metric-card">
      <div className="metric-label">
        {label}
        <span>{icon}</span>
      </div>
      <div className="metric-value">
        {value}
        <span>{unit}</span>
      </div>
      <p>{detail}</p>
    </article>
  );
}
