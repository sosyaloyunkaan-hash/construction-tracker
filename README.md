# Construction Site Progress Tracker

A mobile-first web app for tracking construction site progress per building, floor, room, discipline, and activity.

## Quick Start

### 1. Install Node.js
Download and install from https://nodejs.org (LTS version)

### 2. Install dependencies
Open a terminal in this folder and run:
```
npm install
```

### 3. Start the app
```
npm run dev
```

Then open http://localhost:3000 in your browser.

---

## Engineer Login Credentials

| Engineer | Password |
|---|---|
| Ahmed Al Mansouri | ahmed123 |
| Sara Khalid | sara123 |
| Khalid Ibrahim | khalid123 |
| Fatima Al Zahra | fatima123 |
| Omar Saeed | omar123 |

---

## Engineer Discipline Access

| Engineer | Disciplines |
|---|---|
| Ahmed Al Mansouri | MEP only |
| Sara Khalid | Finishing only |
| Khalid Ibrahim | Civil only |
| Fatima Al Zahra | MEP + Finishing |
| Omar Saeed | All (MEP, Finishing, Civil, External Works) |

---

## How It Works

1. Engineer logs in with their name + password
2. Step-by-step form: Building → Floor → Room → Discipline → Activity → Update
3. Engineers with one discipline skip the discipline selection step
4. Discipline restriction is enforced — unauthorized disciplines show a warning
5. Progress slider drives status automatically (0% = Not Started, 1–99% = Ongoing, 100% = Completed)
6. "Hold" button can be toggled at any progress except 100%
7. Before submitting, the last recorded update for that exact location is shown
8. Update Log tab shows all submissions in reverse chronological order with search and filter

---

## Database

SQLite database (`construction.db`) is created automatically on first run with all seed data.

To reset the database, delete `construction.db` and restart the app.

---

## Deploy to Railway

1. Push this folder to a GitHub repo
2. Create a new project on railway.app → Deploy from GitHub
3. Set `JWT_SECRET` in environment variables
4. Deploy — Railway handles the Node.js server automatically
