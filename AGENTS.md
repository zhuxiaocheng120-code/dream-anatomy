# Repository Guidelines

## Project Structure & Module Organization

This repository is currently a blank starting point. As code is added, keep the layout predictable:

- `src/` for application source code and reusable modules.
- `tests/` for automated tests that mirror the `src/` structure.
- `assets/` for static files such as images, icons, fixtures, or sample data.
- `docs/` for design notes, API references, or longer contributor documentation.

Prefer small modules. Group files by feature when a feature has related components, tests, or assets.

## Build, Test, and Development Commands

No build system or package manager configuration is present yet. When tooling is introduced, document the commands here. Common examples:

- `npm install` or `pnpm install`: install project dependencies.
- `npm run dev`: start a local development server.
- `npm test`: run the automated test suite.
- `npm run build`: create a production build.
- `npm run lint`: check formatting and code quality.

If a command requires environment variables or setup, document that before the command.

## Coding Style & Naming Conventions

Follow the conventions of the selected language and framework. Until tooling is added, use consistent formatting, descriptive names, and small functions.

- Use `camelCase` for JavaScript/TypeScript variables and functions.
- Use `PascalCase` for classes and UI components.
- Use `kebab-case` for filenames unless a framework expects another pattern.
- Keep configuration files at the repository root when possible.

Add a formatter or linter early, and avoid mixing unrelated style changes into feature commits.

## Testing Guidelines

Place tests in `tests/` or next to source files using a suffix such as `.test.ts`, `.spec.ts`, or the equivalent for the chosen language. Tests should cover expected behavior, edge cases, and bug fixes.

Before opening a pull request, run the full test suite plus relevant lint or build commands.

## Commit & Pull Request Guidelines

This workspace has no Git history yet, so no existing commit convention is available. Use concise, imperative messages such as `Add login form` or `Fix date parsing`.

Pull requests should include a summary, testing notes, linked issues when relevant, and screenshots or recordings for visible UI changes. Keep each pull request focused on one logical change.

## Security & Configuration Tips

Do not commit secrets, API keys, local credentials, or generated dependency folders. Store local configuration in ignored files such as `.env.local`, and provide `.env.example` when configuration is required.
