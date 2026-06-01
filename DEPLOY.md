# Демонстрація через GitHub (безкоштовно)

GitHub сам по собі не хостить Node.js і PostgreSQL, але репозиторій можна підключити до **Vercel** (сайт + HTTPS) і **Render** (API + база). Це займає ~15–20 хвилин, після чого ви отримаєте публічне посилання для захисту/демо.

## Схема

```
GitHub (код) → Render: API + PostgreSQL
            → Vercel: Next.js (проксі /api → Render)
```

На телефоні відкриваєте **https://ваш-проєкт.vercel.app** — камера QR працює (HTTPS).

## 1. Код на GitHub

Якщо ще не запушено:

```bash
git add .
git commit -m "Prepare cloud demo deploy"
git push origin main
```

Репозиторій: https://github.com/vinkav/qr-attendance

## 2. API + база на Render

1. Увійдіть на https://render.com (через GitHub).
2. **New → Blueprint** → підключіть репозиторій `qr-attendance`.
3. Render знайде `render.yaml` і створить:
   - PostgreSQL (free)
   - Web Service `qr-attendance-api`
4. Дочекайтесь статусу **Live** (перший build ~5–10 хв, виконає seed).
5. Скопіюйте URL API, наприклад: `https://qr-attendance-api.onrender.com`
6. Перевірка: відкрийте `https://ВАШ-API.onrender.com/health` — має бути `{"ok":true,...}`.

> Free-тариф Render «засинає» після бездіяльності; перший запит після паузи може йти 30–60 с.

## 3. Сайт на Vercel

1. https://vercel.com → **Add New → Project** → імпорт з GitHub `qr-attendance`.
2. **Root Directory:** `apps/web`
3. **Environment Variables:**

   | Name | Value |
   |------|--------|
   | `API_URL` | `https://ВАШ-API.onrender.com` (без `/` в кінці) |

4. **Deploy**.
5. URL сайту: `https://qr-attendance-xxx.vercel.app` (або власний піддомен).

## 4. Демонстрація

| Роль | Email | Пароль |
|------|-------|--------|
| Викладач | lecturer@edu.ua | demo1234 |
| Студент | student3@edu.ua | demo1234 |
| Адмін | admin@edu.ua | demo1234 |

**Сценарій:**

1. Викладач → вхід → Дашборд / Курси → активна сесія → **QR на проектор**.
2. Студент на телефоні → той саме посилання Vercel → вхід → **Сканувати**.
3. Викладач бачить оновлення списку присутніх.

Код курсу «Програмування» після seed: **PRG101** (кабінет студента → запис на курс).

## 5. Оновлення після змін у коді

- Push у `main` на GitHub.
- Render і Vercel перезбирають проєкт автоматично.

## Альтернатива (лише локально)

Якщо хмара не потрібна: `npm run dev:api` + `npm run dev:web:https` на ПК, телефон у тій самій Wi‑Fi.

## Обмеження демо на free-тарифі

- Render API може «прокидатися» після простою.
- Геолокація на телефоні залежить від GPS; у приміщенні інколи потрібна ручна відмітка викладачем.
- Не зберігайте реальні персональні дані на безкоштовному хостингу.
