# SynSplit 

A modern, lightweight expense-splitting app built with React and Firebase. Split bills with friends, manage pool money, and settle debts — all from a beautiful mobile-first UI.

**Live:** [https://synsplit.sayanmandal.in](https://synsplit.sayanmandal.in/)

## Features

- **Expense Splitting** — Pool and Direct modes supporting equal, unequal, percentage, and share-based splits
- **SynBot AI** — intelligent chatbot powered by Google Gemini for deep spending insights
- **Interactive Analytics** — visualize financial data using pie charts, bar graphs, and calendar heatmaps
- **AI Predictions** — proactive spending forecasts and personalized savings suggestions
- **Recurring Expenses** — automate your monthly tracking with an auto-add feature
- **Debt Optimization** — streamline repayment paths and easily track settlements
- **Push Notifications** — real-time mobile alerts powered by Firebase Cloud Messaging
- **PDF Export** — generate and download comprehensive expense reports instantly
- **Location Tagging** — attach GPS coordinates to expenses to track where you spend
- **Google Sign-In** — seamless and secure one-tap authentication
- **Offline Support** — full functionality without internet access as a Progressive Web App (PWA)
- **Real-Time Sync** — instant data updates across all your devices using Firestore
- **Premium UI** — modern dark mode glassmorphism interface featuring smooth animations
- **Group Management** — create groups and oversee them with robust admin controls
- **Member Permissions** — customizable access and role settings specifically for pool mode

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

- [ ] Expense predictions
- [ ] Offline mode with auto-sync

---

Developed by [Sayan Mandal](https://sayanmandal.in/)
