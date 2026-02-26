# Contributing

## Pull Request Title Format
Use Conventional Commits for PR titles. Examples:
- `feat: add calendar sharing`
- `fix: handle timezone parsing`
- `refactor: simplify schedule sync`
- `docs: update setup instructions`
- `chore: update tooling`

## Preferred Labels
Please apply the following labels when relevant:
- `needs-review`
- `work-in-progress`
- `bug`
- `enhancement`

## Before Opening a PR
Run the following locally and resolve issues where possible:
```bash
pnpm lint
pnpm build
```
Warnings are acceptable if they already exist, but avoid introducing new ones.
