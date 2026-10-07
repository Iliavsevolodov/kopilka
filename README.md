# KOPILKA

KOPILKA — персональная финансовая операционная система: от учёта к пониманию, прогнозированию и финансовым решениям.

## Foundation

Первый рабочий срез включает Next.js App Router, TypeScript, Supabase SSR Auth, onboarding, счета, доходы/расходы/переводы, RLS, атомарную PostgreSQL-функцию для транзакций, dashboard, safe-to-spend, PWA shell и unit tests финансового ядра.

### Главный инвариант

- Expense уменьшает капитал.
- Income увеличивает капитал.
- Transfer между своими счетами не меняет общий капитал и не входит в доходы/расходы.
- Recurring template не является фактической transaction до подтверждения.

## Стек

Next.js 16, React 19, TypeScript, Tailwind CSS 4, Supabase/PostgreSQL/Auth/RLS, Zod, date-fns, Vitest.

## Структура

```text
app/                 App Router, server actions, UI
components/          application shell and reusable UI
lib/finance/         pure financial domain functions
lib/data/            server-side aggregation
lib/supabase/        SSR/browser clients
lib/validation/      Zod validation
supabase/schema.sql  schema, RLS, transaction RPC
public/sw.js         privacy-conscious PWA shell cache
```

## Деньги

Все суммы хранятся как integer minor units: 1 ₽ = 100. Пользовательский ввод парсится строково без арифметики вида `0.1 + 0.2`.

## Формулы

```text
Cash Flow = Income - Expenses
Savings Rate = (Income - Expenses) / Income * 100
Safe To Spend = max(0, Liquid Balance - Upcoming Obligations - Reserved Goals - Emergency Reserve)
```

## Environment

```bash
cp .env.example .env.local
```

Обязательные переменные:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Секретные ключи никогда не должны иметь префикс NEXT_PUBLIC_.

## Supabase

`supabase/schema.sql` — source-of-truth Foundation schema. Перед применением нужно подтвердить, какой из существующих Supabase проектов относится именно к этому репозиторию. После применения обязательно проверить security/performance advisors и затем оформить schema в migration history.

## Local development

```bash
npm install
npm run dev
```

## Quality

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

GitHub Actions выполняет все проверки и после успешного запуска фиксирует сгенерированный package-lock.json в feature branch.

## Roadmap

1. Foundation — auth, onboarding, accounts, transactions, transfer, dashboard, safe-to-spend, PWA.
2. Planning — budgets, goals, recurring confirmation, calendar.
3. Analytics — categories, trends, heatmap, bubble, Sankey.
4. Forecasting — 7/30/90 days, 6/12 months, cash-gap, confidence.
5. Intelligence — financial score, twin, anomalies, insights.
6. AI — structured tools and purchase analysis.
7. Premium — feature flags, subscriptions, export/import.
