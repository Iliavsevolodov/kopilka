# Аудит репозитория — 8 октября 2026

## Исходное состояние

- `main` на `158e4e4`: только `.gitignore`.
- `feature/foundation` на `481eedb`: Next.js/Supabase Foundation, 44 исходных файла; сохранён как основа новой ветки `feature/local-app`.
- Есть auth actions, SSR adapters, упрощённый onboarding, форма и список операций, SQL schema с RLS/RPC, pure financial functions, manifest и shell service worker.
- Нет dashboard route, счетов, плана, профиля, бюджетов, целей, графиков и локального режима. Навигация ссылалась на отсутствующие страницы. Корневая страница блокировала работу без Supabase.
- Нет `package-lock.json`. CI пытался генерировать и коммитить зависимости после запуска, имел избыточные права записи.
- TODO/FIXME не обнаружены, но отсутствие пометок не означает завершённость функций.

## Найденные проблемы

1. TypeScript: `profile` из Supabase мог быть null в агрегаторе dashboard.
2. TypeScript 7 не совместим с установленным typescript-eslint; ESLint 10 не соответствовал peer requirements плагинов Next. Зафиксированы совместимые TypeScript 5.9.3 и ESLint 9.39.5. Перед последующим обновлением повторно проверять весь toolchain.
3. Vitest не настраивал alias `@`, поэтому исходные тесты не запускались.
4. `applyTransactionToBalances` не применял adjustment и не проверял целочисленные суммы/overflow.
5. Auth callback допускал protocol-relative redirect. Запрещены `//` и backslash.
6. Не было PNG PWA icons; offline кеш открывал только информационную страницу.
7. UI и данные были полностью связаны с отсутствующим сервером. По уточнению пользователя сервер не подключается.

## Реализованный подход

Local repository отделён от UI и чистых financial functions. Сохранён прежний Supabase/SQL код как заготовка; он не был применён или объявлен готовым. Основные страницы работают без env, auth requests и серверных financial data. Auth UI без настроенного backend показывает честное уведомление о локальном режиме.

Созданы работающие end-to-end сценарии, изолированный demo seed, пагинация интерфейса, экспорт/backup, подтверждения удаления, темизация и offline shell. Разные валюты не суммируются. Точные денежные значения хранятся в integer minor units, расчётный прогноз маркируется как приблизительный.

## Приёмка

- TypeScript, ESLint, production build.
- 43 unit/domain integration проверки.
- 5 Playwright сценариев, включая полный финансовый цикл, изоляцию demo, backup, темы, manifest и offline expense.
- Восемь маршрутов на шести ширинах: 375 / 390 / 430 / 768 / 1024 / 1440.
- Визуальная проверка desktop/mobile/light/dark по скриншотам в `docs/screenshots`.

Локальная проверка использовала Chromium 153, полученный через пакет браузера из-за недоступности стандартного CDN Playwright. Путь к браузеру не фиксируется в репозитории. CI использует штатную установку Playwright.

## Открытые задачи

Нет серверного deploy, Supabase/RLS verification, реальных auth flows, платежей, LLM, banking, native-device проверки. Полная исходная спецификация шире текущего этапа. Настоящая многопользовательская production готовность требует отдельного Cloud Foundation этапа и нагрузочной/безопасностной проверки.
