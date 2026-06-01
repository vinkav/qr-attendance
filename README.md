# QR Відвідуваність

Система автоматизованого обліку відвідуваності з динамічними QR-кодами, перевіркою геолокації (формула Гаверсину) та прив'язкою пристрою студента.

## Стек

- **Frontend:** Next.js 15 (український інтерфейс, PWA manifest)
- **Backend:** Node.js + Express + Prisma
- **БД:** PostgreSQL
- **Безпека:** JWT, TOTP-подібні QR-токени (оновлення ~20 с), геозона, device fingerprint

## Структура

```
apps/api   — REST API
apps/web   — веб-портал (викладач + студент)
```

## Вимоги

- Node.js 20+
- PostgreSQL 14+

## Швидкий старт

### 1. Клонування та залежності

```bash
git clone https://github.com/vinkav/qr-attendance.git
cd qr-attendance
npm install
```

### 2. Налаштування

Скопіюйте `.env.example` у `.env` у корені проєкту **і** у `apps/api` (Prisma читає змінні з папки API):

```bash
copy .env.example .env
copy .env.example apps\api\.env
```

Відредагуйте обидва файли: `DATABASE_URL`, `JWT_SECRET`.

Створіть базу в PostgreSQL, наприклад:

```sql
CREATE DATABASE qr_attendance;
```

### 3. Міграції та початкові дані

```bash
npm run db:generate
cd apps/api && npx prisma db push && npm run db:seed
cd ../..
```

### 4. Запуск

У двох терміналах:

```bash
npm run dev:api
npm run dev:web
```

- Веб: http://localhost:3000  
- API: http://localhost:4000  

**Скан QR з телефона** (потрібен HTTPS):

```bash
npm run dev:api
npm run dev:web:https
```

- ПК: https://localhost:3000  
- Телефон (та сама Wi‑Fi): `https://ВАШ_IP:3000/student/scan` — прийміть попередження про сертифікат  

### Початкові облікові записи (після seed)

| Роль | Email | Пароль |
|------|-------|--------|
| Адміністратор | admin@edu.ua | demo1234 |
| Викладач | lecturer@edu.ua | demo1234 |
| Студент | student1@edu.ua … student5@edu.ua | demo1234 |

## Сценарій використання

1. **Викладач** входить → створює курс → додає студентів за email → **Почати пару** (GPS аудиторії).
2. Відкриває **QR на проектор** — код оновлюється автоматично.
3. **Студент** входить → **Сканувати** → дозволяє камеру та геолокацію → сканує QR.
4. Викладач бачить список присутніх (оновлення кожні 3 с).
5. Після пари — **Закрити сесію** → **Завантажити CSV**.

## API (основне)

| Метод | Шлях | Опис |
|-------|------|------|
| POST | `/api/auth/login` | Вхід |
| POST | `/api/courses` | Створити курс |
| POST | `/api/sessions` | Почати сесію |
| GET | `/api/sessions/:id/qr` | Поточний QR-токен |
| POST | `/api/attendance/scan` | Відмітка студента |
| GET | `/api/sessions/:id/report.csv` | Звіт CSV |

## Демонстрація в інтернеті (з GitHub)

Публічне HTTPS-посилання для захисту роботи: **Vercel** (фронт) + **Render** (API + БД). Покроково: [DEPLOY.md](./DEPLOY.md).

## Публікація на GitHub

```bash
git init
git add .
git commit -m "Initial commit: QR attendance system"
git branch -M main
git remote add origin https://github.com/vinkav/qr-attendance.git
git push -u origin main
```

Не комітьте файл `.env` — він у `.gitignore`.

## Обмеження MVP

- Device binding — fingerprint у браузері (не IMEI).
- GPS у приміщенні може мати похибку; радіус за замовчуванням 80 м.
- Redis не використовується; захист від replay — таблиця `UsedQrWindow` у PostgreSQL.

## Ліцензія

MIT — див. `LICENSE`.
