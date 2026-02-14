# Universal React Monorepo

Build React components once, run on web, iOS, and Android. A Turborepo + NativeWind monorepo template with shared UI.

![Demo](./universal-react-monorepo-demo.png)

> **New to monorepos?** Follow the [step-by-step guide](https://www.gurselcakar.com/monorepo) that built this template.

## Getting Started

**Prerequisites:** Node.js 18+, pnpm 10+, and optionally Xcode/Android Studio for mobile.

```bash
git clone https://github.com/gurselcakar/universal-react-monorepo.git
cd universal-react-monorepo
pnpm install
pnpm dev              # Start all apps
```

Run individually:

```bash
pnpm --filter web dev       # Next.js → localhost:3000
pnpm --filter mobile dev    # Expo Metro bundler
```

Other commands: `pnpm build`, `pnpm lint`, `pnpm typecheck`

## Tech Stack

| Layer | Technology |
|-------|------------|
| Web | Next.js 16 |
| Mobile | Expo SDK 54 (React Native) |
| Shared UI | React Native + NativeWind |
| Build | Turborepo, pnpm workspaces, TypeScript |

Components in `packages/ui/` are written once with React Native + NativeWind. On web, `react-native-web` renders them as HTML. On mobile, Expo renders them natively.

## Project Structure

```
├── apps/
│   ├── mobile/     # Expo React Native app
│   └── web/        # Next.js web app
├── packages/
│   └── ui/         # Shared component library
└── turbo.json      # Turborepo config
```

## Author

Built by [Gürsel Çakar](https://x.com/gurselcakar). Check out my games: [Hukora](https://hukora.com) and [Arithmego](https://arithmego.com).
