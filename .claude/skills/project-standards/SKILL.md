---
name: project-standards
description: Constraints every spec and design for this project must respect (hosting, data, privacy, accessibility). Use when writing or reviewing a spec, design or implementation plan.
---

# Project standards

Constraints for anything designed or built in this project. Treat them as requirements. If a design can't meet one, flag it as a concern; don't work around it.

## Architecture

- The app runs entirely in the browser. No backend, no server-side code, no database.
- Built with React.

## Data and privacy

- All user data is stored in the browser's localStorage and stays on the user's machine.
- No network calls to external services, no analytics or tracking.
- No sync across machines or browsers.

## Accessibility and usability

- Usable with a keyboard alone.
- Controls have accessible labels and sufficient colour contrast.

## Quality

- Behaviour that matters is covered by automated tests.
