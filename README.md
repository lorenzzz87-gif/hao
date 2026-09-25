# NOW

NOW turns a few free hours into a nearby real-world plan. V1 is built around one measurable loop: discover or create a plan, join, chat, check in, and count a Successful Meet.

## Repository

- `apps/mobile`: Expo SDK 55 mobile application.
- `supabase`: local database configuration, migrations, seed data, and pgTAP tests.
- `docs/contracts`: stable product and server contracts.
- `docs/llm-wiki`: durable architecture decisions and project memory.

## Local setup

1. Copy `apps/mobile/.env.example` to `apps/mobile/.env.local`.
2. Run `npm --prefix apps/mobile install`.
3. Start Supabase with `npx supabase start`.
4. Fill the local URL and publishable key shown by `npx supabase status`.
5. Run `npm run mobile`.

For local-only phone authentication, use `+15555550100` with code `123456`. Hosted environments must configure a real SMS provider and must not reuse this test number mapping.

Only `EXPO_PUBLIC_` values are bundled into the client. Never put a Supabase secret key, service-role key, or AI provider key in the mobile environment.

## Quality checks

```sh
npm run check
npx supabase db reset
npx supabase test db
```

The database commands require Docker Desktop.
