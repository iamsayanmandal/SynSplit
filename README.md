# SynSplit 💸

A modern, lightweight expense splitting app built with React + Firebase. Split bills with friends, manage pool money, and settle debts — all from a beautiful mobile-first UI.

**Live:** [sayansplit.web.app](https://sayansplit.web.app)

## Features

- 🔐 **Google Sign-In** — one-tap authentication
- 👥 **Groups** — create groups, add members by Gmail, admin-based management
- 💳 **Direct Mode** — track who paid and split equally
- 💰 **Pool Mode** — monthly pool fund with contributions
- 📊 **Settle Tab** — per-member breakdown, who owes whom, one-tap settle
- 📝 **Expense Management** — add, edit (48hr window), delete with confirmation
- 🔍 **Search** — filter expenses by description or category
- 👑 **Admin Controls** — edit group name, remove members, control expense permissions
- 📜 **History** — pool contribution and settlement history
- 🎨 **Premium UI** — dark glassmorphism, smooth animations, mobile-first

## Tech Stack

- **Frontend:** React 18, TypeScript, Vite
- **Styling:** Tailwind CSS
- **Backend:** Firebase (Firestore, Auth, Hosting)
- **Animations:** Framer Motion
- **Icons:** Lucide React
- **AI (coming soon):** Gemini API

## Getting Started

### Prerequisites
- Node.js 18+
- Firebase project with Firestore & Auth enabled

### Setup

```bash
# Clone
git clone https://github.com/sayanmandal/SynSplit.git
cd SynSplit

# Install
npm install

# Configure environment
cp .env.example .env
# Fill in your Firebase and Gemini API keys in .env

# Run
npm run dev
```

### Deploy to Firebase

```bash
npm run build
firebase deploy --only hosting
```

## Project Structure

```
src/
├── components/     # Reusable UI components
├── contexts/       # React contexts (Auth, ActiveGroup)
├── hooks/          # Custom hooks (useGroups, useExpenses, etc.)
├── lib/            # Core logic (firestore, splitCalculator)
├── pages/          # Page components (Dashboard, Expenses, Settle, Profile)
├── types.ts        # TypeScript interfaces
└── firebase.ts     # Firebase config
```

## Roadmap

- [ ] Analytics Dashboard with calendar view
- [ ] Recurring expenses (rent, WiFi)
- [ ] @SynBot AI search (Gemini-powered)
- [ ] Voice-to-expense
- [ ] Expense predictions
- [ ] Offline mode with auto-sync

---

Developed by [Sayan Mandal](https://sayanmandal.in)
