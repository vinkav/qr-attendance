# Демонстрація через GitHub (без прив’язки картки)

Хмарний демо-варіант: **Neon** (PostgreSQL, безкоштовно, зазвичай без картки) + **Vercel** (сайт і API, Hobby — теж без картки). **Render не потрібен** (у нього часто вимагають банківську карту).

## Схема

```
GitHub → Neon: PostgreSQL
      → Vercel (проєкт 1): Express API
      → Vercel (проєкт 2): Next.js (проксі /api → API на Vercel)
```

На телефоні відкриваєте **https://ваш-сайт.vercel.app** — QR працює через HTTPS.

## 1. Код на GitHub

```bash
git add .
git commit -m "Prepare cloud demo deploy"
git push origin main
```

## 2. База даних на Neon

1. https://neon.tech → увійти через **GitHub**.
2. **New Project** → регіон на ваш вибір → Create.
3. На вкладці **Connection details** скопіюйте **Pooled connection** (рекомендовано для serverless) або звичайний `postgresql://...`.
4. Збережіть рядок — він буде `DATABASE_URL`.

> Якщо Neon колись попросить карту — можна лишити лише [локальний демо](#альтернатива-лише-локально) або Cloudflare Tunnel (нижче).

## 3. API на Vercel

1. https://vercel.com → **Add New → Project** → репозиторій `qr-attendance`.
2. **Root Directory:** `apps/api` (важливо).
3. **Environment Variables:**

   | Name | Value |
   |------|--------|
   | `DATABASE_URL` | рядок з Neon (pooled) |
   | `JWT_SECRET` | довгий випадковий рядок (напр. 32+ символів) |
   | `NODE_ENV` | `production` |

4. **Deploy** (перший build ~3–7 хв: Prisma + seed).
5. URL API, наприклад: `https://qr-attendance-api-xxx.vercel.app`
6. Перевірка: `https://ВАШ-API.vercel.app/health` → `{"ok":true,...}`

## 4. Сайт на Vercel

1. Ще один проєкт Vercel → той самий репозиторій.
2. **Root Directory:** `apps/web`
3. **Environment Variables:**

   | Name | Value |
   |------|--------|
   | `API_URL` | URL з кроку 3 (без `/` в кінці), напр. `https://qr-attendance-api-xxx.vercel.app` |

4. **Deploy**.
5. Відкрийте URL сайту (`https://...vercel.app`).

CORS для `*.vercel.app` уже дозволений у API; окремий `CORS_ORIGIN` для демо не обов’язковий.

## 5. Демонстрація

| Роль | Email | Пароль |
|------|-------|--------|
| Викладач | lecturer@edu.ua | demo1234 |
| Студент | student3@edu.ua | demo1234 |
| Адмін | admin@edu.ua | demo1234 |

**Сценарій:** викладач → QR на проекторі; студент на телефоні → той саме посилання Vercel → **Сканувати**.

Код курсу після seed: **PRG101**.

## 6. Оновлення

Push у `main` → обидва проєкти Vercel перезбираються. API знову виконає `db:seed` при build (демо-дані скидаються) — для захисту це зручно.

## Альтернатива: лише локально

Без хмари:

```powershell
npm run db:reset
npm run dev:api
npm run dev:web:https
```

Телефон у тій самій Wi‑Fi: `https://IP_ПК:3000`.

## Публічне HTTPS без хмари (Cloudflare Tunnel)

Якщо не хочете навіть Neon/Vercel:

1. Локально: `npm run dev:api` + `npm run dev:web:https`.
2. Встановіть [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/).
3. `cloudflared tunnel --url https://localhost:3000`
4. Відкрийте виданий `https://....trycloudflare.com` на телефоні.

> Тунель тимчасовий; для захисту на кілька днів зручніше Neon + Vercel.

## Render (необов’язково)

Файл `render.yaml` лишено для тих, у кого уже є акаунт Render. **Новий акаунт часто вимагає картку** — для демо краще Neon + Vercel.

## Обмеження free-тарифу

- Холодний старт serverless API на Vercel — перший запит може бути повільнішим.
- Не зберігайте реальні персональні дані на безкоштовному хостингу.
- Геолокація в приміщенні інколи неточна — є ручна відмітка викладачем.
