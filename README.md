# Expense Tracker (React + TypeScript + Chakra UI)

Full-screen ChatGPT-style UI scaffolded for an Expense Tracker. The current build focuses on a minimal chat interface that you can later connect to OpenAI. The chat view is the only page rendered.

### Tech stack
- React (Vite) + TypeScript
- Chakra UI v3 (system provider + tokens)
- Yarn

### Features (current)
- Full-page chat layout with header
- Message bubbles (user right-aligned, assistant left-aligned)
- Enter to send; Shift+Enter for newline
- Auto-scroll to latest message
- Disabled state while “sending”
- Accessible labels and semantic elements

### Project structure
- `src/main.tsx`: App entry; wraps the app with Chakra v3 system provider
- `src/App.tsx`: Renders the chat page as the sole view
- `src/pages/Chat.tsx`: ChatGPT-like UI and local chat logic (placeholder assistant response)
- `src/index.css`, `src/App.css`: Minimal global styles; Chakra handles theming

### Getting started
1) Install dependencies
```
yarn
```

2) Start dev server
```
yarn dev
```

3) Build for production
```
yarn build
```

4) Preview production build
```
yarn preview
```

### Environment variables
- Copy `.env.example` to `.env` and set values
- Only variables prefixed with `VITE_` are exposed to the client
- Access them via the typed helper `env` from `src/config/env.ts`

Available keys:
```
VITE_APP_NAME=Expense Tracker
VITE_APP_ENV=development
# VITE_OPENAI_API_KEY=
VITE_USE_OPENAI=false
VITE_OPENAI_MODEL=gpt-5
```

Notes:
- Do not use real secrets in client env; prefer a backend proxy.
- `.env`, `.env.*` are ignored by git (see `.gitignore`), while `.env.example` remains tracked.

To enable OpenAI in the UI, set:
```
VITE_USE_OPENAI=true
VITE_OPENAI_API_KEY=sk-...
```

### Connecting to OpenAI (later)
Replace the placeholder assistant message inside `handleSend` in `src/pages/Chat.tsx` with your API call.

Basic approach:
1) Add a backend endpoint or use the OpenAI SDK from the server to avoid CORS and key exposure.
2) From `handleSend`, `fetch` your backend with the user message.
3) Stream or return the assistant response and append it to state.

Where to modify:
```ts
// src/pages/Chat.tsx (inside handleSend)
// TODO: replace this block with your API call
const assistantMessage: ChatMessage = {
  id: generateMessageId(),
  role: 'assistant',
  content: "Thanks! I'm a placeholder for now. You can wire me up to OpenAI later.",
}
```

### Notes on Chakra v3
- Provider: the app uses `createSystem(defaultConfig, {})` passed via `<ChakraProvider value={system} />`
- Spacing prop: `spacing` → `gap`
- Boolean props: `isDisabled` → `disabled`

### Conventions
- React components are standard function components (no `React.FC`)
- Prefer TypeScript and strong typing
- Keep components modular and DRY
- Handle errors gracefully when wiring API calls

### License
MIT (or your preferred license)
