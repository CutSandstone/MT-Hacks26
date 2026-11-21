# What Would Hedge This?

Describe a decision with money at stake in your own words — an expense, an income stream, or a foreign-currency bill. A server-side inference provider identifies the cash flow at risk, you confirm the assumptions, and the app tests how much a fictional paper position would offset over the same period. All exposure and return arithmetic runs in a local engine; the demo uses synthetic data and places no trades.

## Requirements

- Node.js 24 — the tested version (the code uses JSON module import attributes); not a strict minimum
- Python 3.13+ — the tested version; not a strict minimum

## Running locally

From the repository root:

```sh
cp .env.example .env   # optional — defaults need no credentials
npm start              # then open http://localhost:8000
```

By default the server expects a local Devin Gateway, an OpenAI-compatible endpoint on port 3001 (`http://127.0.0.1:3001/v1`) serving the `swe-2-high` model. To point at a different endpoint or model, set `DEVIN_GATEWAY_BASE_URL` and/or `DEVIN_GATEWAY_MODEL` in `.env`. `.env.example` also documents the optional Snowflake Cortex mode (`INFERENCE_PROVIDER=snowflake`).

If the active inference provider is unreachable, the manual calculators keep working.

## Tests

`npm test` runs the JavaScript and Python regression suites.

## More

See [PLAN2.md](PLAN2.md) for the product plan, reference calculations, and acceptance criteria.
