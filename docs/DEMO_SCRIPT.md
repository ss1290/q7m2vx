# Windward demo narration

Computer-generated narration, disclosed in the recording. Two parts, under ten minutes total.

## Part 1 | Customer pilot overview

Welcome to Windward, a pilot for day-ahead power procurement. This presentation uses computer-generated narration. The commercial problem is simple: wind changes with the weather, but tomorrow's power must be bought today. Windward helps your team see the wind forecast available at a chosen decision time, then understand how much it has historically missed. This pilot uses only the two Elexon datasets requested in the brief. It covers buying decisions made in January 2026. It does not invent demand, prices or purchase volumes.

## The forecast you could actually have seen

The decision window is January first through January thirty-first. The default cutoff is nine AM London time. This is an editable pilot assumption, not a claimed exchange deadline. Every decision date maps to delivery on the following day. Here I select January fifteenth to inspect January sixteenth delivery. The green line is the latest forecast published before the cutoff. The dashed line is actual wind generation. The publication timestamp below the chart makes the comparison auditable. Changing the cutoff recalculates the selection rather than using today's latest forecast.

## Quantify the uncertainty

Across all seven hundred and forty-four delivery hours, the default analysis has complete matched coverage. Mean absolute error is about two thousand and thirty-nine megawatts. Root mean square error is about two thousand five hundred and five. Bias is positive, about seventeen hundred and forty-eight megawatts, meaning wind was overforecast on average. Historical P ninety absolute error is about four thousand and ninety-nine megawatts. These statistics are retrospective evaluation, not a guaranteed future interval. The daily chart reveals which decisions had larger misses. The benefit is better visibility into wind exposure, without pretending wind alone determines what to buy.

## Take the evidence with you

The data explorer exposes the evidence behind each hour: decision date, delivery start, publication time, forecast, actual, signed error and forecast lead time. Export CSV downloads the same filtered rows for review in a trading workbook. Missing data remain missing and would reduce coverage, rather than being filled with invented values. The methodology page also records the exact sources and snapshot checksums. For a next pilot, I would agree the team's real cutoff, evaluate a longer history, and calibrate a risk policy before making operational buying recommendations.

## Part 2 | Architecture and request flow

Now the technical handover. React and TypeScript provide the dashboard. FastAPI in Python validates filters, calls the pure analysis functions, and returns summary, daily and hourly results. An offline downloader fetches the two Elexon streams into a versioned JSON snapshot. The request path never calls Elexon. For this small fixed historical window, a database would add deployment complexity without improving the product. Docker serves the compiled React app and API on one origin. The Vercel configuration instead serves static React assets alongside the same Python ASGI application.

## Selection, alignment, and units

The most important design choice is preventing look-ahead leakage. For each delivery target, the code selects the maximum publication timestamp less than or equal to the decision cutoff. Although the broad brief mentions half-hour targets, the actual WINDFOR responses contain hourly targets. FUELHH actuals are half-hourly. Therefore each forecast hour is compared against the mean of the two WIND actual values in that hour. Both observations must exist. We average power in megawatts, and multiply by one hour only when calculating energy. Actual revisions use the latest available version. Error is forecast minus actual, so positive error means overforecast wind.

## Codebase, tests, and development practices

The backend separates the pure analysis core, snapshot loading, and HTTP routes. React owns presentation state and cancels stale requests when filters change. The fetcher has bounded retries, four workers, exact-version deduplication and per-file atomic writes. Sixteen backend checks passed, covering cutoff equality, future publication exclusion, missing half hours, real zeros, revisions, January boundaries, metric formulas, validation and CSV output. Two browser checks passed for desktop workflows and mobile navigation. TypeScript compilation and the production build succeeded. Formatting is applied with Prettier and Ruff, and comments explain the important domain choices.

## Reproducibility and delivery status

To run locally, install the dependencies, build React, and start Uvicorn. Docker Compose provides a single-service alternative when the Docker engine is available. The README documents every directory, commands, formulas, data sources and AI assistance. The public GitHub repository uses the anonymous name shown on this slide. The historical snapshot contains real data and provenance checksums. At recording time, public Vercel deployment and unlisted YouTube upload still require account access. Docker configuration is included, but the local engine could not start. Those remaining external checks are explicitly disclosed. The submission form has not been sent without the required hosted app and video links.
