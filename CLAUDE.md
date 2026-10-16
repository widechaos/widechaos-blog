# Website source and deployment

This repository owns the public website frontend and its content adapter. The `legacy-astro-2026-10-16` tag preserves the previous Astro implementation and its full history.

Read README.md, docs/deployment.md, and docs/content.md before changes. Deploy only committed, validated source through scripts/deploy.py. Never copy the whole content host, its environment files, credentials, private routes, operational evidence, or runtime databases into this repository.

Articles and the live work catalog remain on the existing content host. Code releases must not overwrite content/blog or content/site-catalog.json. examples/ is an isolated test fixture, never a production content input. Keep the continuous homepage, existing identity and slogans, one global language switch, and published-only translation pairing.

Run npm run check, npm run validate, npm test, and python -m unittest discover -s integration -p 'test_*.py'. Production adds only requirements-production.txt to its existing environment; never replace its framework dependencies or authentication.
