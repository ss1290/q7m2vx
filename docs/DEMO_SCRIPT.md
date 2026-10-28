# Windward demo narration

Two-part customer presentation and technical handover. AI assistance and narration are disclosed in the README.

## Part 1 | Customer pilot overview

Welcome to Windward, a pilot for day-ahead power procurement. Wind generation changes with the weather, while tomorrow's electricity must be secured today. Windward shows the forecast available at the purchasing decision time and places it alongside measured forecast error. This pilot focuses on national wind generation using the two Elexon datasets in scope, for decisions made in January 2026.

## The forecast you could actually have seen

The decision window runs from January first through January thirty-first. The cutoff is configurable and defaults to nine AM London time. Each decision date maps to the following delivery day. Here, January fifteenth shows the outlook for January sixteenth. The green line is the latest forecast available by the cutoff, and the dashed line is actual wind generation. The publication timestamp makes the selection auditable, while changing the cutoff immediately recalculates the view.

## Quantify the uncertainty

The default analysis matches all seven hundred and forty-four delivery hours. Mean absolute error is about two thousand and thirty-nine megawatts, while root mean square error is about two thousand five hundred and five. Positive bias of roughly seventeen hundred and forty-eight megawatts shows that wind was overforecast on average. The P ninety absolute error is about four thousand and ninety-nine megawatts. Together, these measures show the typical miss, the impact of larger misses, and the direction of exposure. The daily view highlights the dates that deserve closer review.

## Take the evidence with you

The data explorer provides the evidence behind every hour: decision date, delivery start, publication time, forecast, actual generation, signed error, and forecast lead time. The same filtered records can be exported to CSV for further analysis. Missing observations remain visible in the coverage measure instead of being silently filled. The methodology view documents the source, alignment rules, and snapshot checksums, giving the team a clear audit trail from publication to metric.

## Part 2 | Architecture and request flow

Now for the technical handover. React and TypeScript provide the dashboard. FastAPI validates the filters, calls a pure Python analysis layer, and returns summary, daily, and hourly results. An offline downloader captures the Elexon streams in a versioned JSON snapshot, so the analysis remains reproducible and the user request path does not depend on Elexon availability. Docker serves the compiled frontend and API on one origin, while the Vercel configuration supports static assets with the same Python application.

## Selection, alignment, and units

The key analytical rule prevents look-ahead leakage. For each delivery hour, the code selects the latest forecast published at or before the decision cutoff. WINDFOR provides hourly targets, while FUELHH actuals are half-hourly, so the two actual values within each hour are averaged. Both observations must exist for a valid comparison. Error is forecast minus actual, making positive error an overforecast of wind. These rules preserve the information that was genuinely available when the purchasing decision was made.

## Codebase, tests, and development practices

The codebase separates analysis, data loading, API routes, and presentation concerns. React cancels stale requests when filters change. The downloader uses bounded retries, exact-version deduplication, and atomic file writes. Sixteen backend checks cover publication cutoffs, missing intervals, revisions, date boundaries, metrics, validation, and CSV output. Two browser checks cover desktop and mobile workflows. TypeScript compilation and the production build also pass. The README explains the architecture, assumptions, commands, and data provenance for a straightforward technical handover.
