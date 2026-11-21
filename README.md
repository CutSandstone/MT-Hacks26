# What Would Hedge This?

Choose one of three scenarios: starting a cybersecurity career, commuting in a gas car, or paying tuition in yen. Review the assumptions, then see how much a hypothetical investment would offset over the same period. All calculations run locally; the demo uses synthetic returns and places no trades.

## Requirements

- Node.js 24 — the tested version (the code uses JSON module import attributes); not a strict minimum
- Python 3.13+ — the tested version; not a strict minimum

## Running locally

From the repository root:

```sh
npm start              # then open http://localhost:8000
```

The demo needs no credentials or external service. To use a different port, set `PORT` in your environment or in a local `.env` file.

## Tests

`npm test` runs the JavaScript and Python regression suites.

## In-event usability test

During the event, ask one first-time participant to try the tool while you observe. Do not explain the logo or the name beforehand. Use only the built-in sample data — nothing about the participant's real finances.

1. Show the entry screen and ask: "What do you think this product does?"
2. Ask them to pick the tuition-in-yen scenario, work through the questions, and reach the results.
3. At the results, ask them to explain the difference between "With a hedge" and "Without a hedge" in their own words.
4. Optionally, watch them try the same flow with only the keyboard or with a screen reader if they use one.
5. About an hour later, without showing the site, ask them to recall the product's name, its mark, and what it does.

### Log

| Timestamp | Participant (anonymous) | Task + access setup | Observed confusion or quote | What changed (before → after) | Retest observation |
|-----------|--------------------------|---------------------|------------------------------|--------------------------------|--------------------|
|           |                          |                     |                              |                                |                    |

## More

See [PLAN2.md](PLAN2.md) for the product plan, reference calculations, and acceptance criteria.
