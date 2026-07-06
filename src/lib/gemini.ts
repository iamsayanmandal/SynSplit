/**
 * Gemini AI API helper for SynSplit
 * Uses Cloud Function proxy for secure server-side API calls
 */

import { getFunctions, httpsCallable } from 'firebase/functions';
import { getApp } from 'firebase/app';

interface GeminiMessage {
    role: 'user' | 'model';
    parts: { text: string }[];
}

export interface ChatMessage {
    role: 'user' | 'assistant';
    text: string;
    timestamp: number;
}

/**
 * Send a prompt to Gemini and get a text response
 */
export async function askGemini(
    prompt: string,
    systemInstruction?: string,
    history?: GeminiMessage[]
): Promise<string> {
    try {
        const functions = getFunctions(getApp());
        const askGeminiProxy = httpsCallable<
            { prompt: string; systemInstruction?: string; history?: GeminiMessage[] },
            { text: string }
        >(functions, 'askGeminiProxy');

        const result = await askGeminiProxy({ prompt, systemInstruction, history });
        return result.data.text;
    } catch (error: unknown) {
        const err = error as { code?: string; message?: string };
        if (err.code === 'functions/resource-exhausted') {
            return 'You\'re sending messages too quickly. Please wait a moment and try again.';
        }
        if (err.code === 'functions/unauthenticated') {
            return 'Please sign in to use the AI assistant.';
        }
        console.error('Gemini proxy error:', err.message);
        return 'I couldn\'t generate a response right now. Please try again in a moment.';
    }
}

/**
 * Build a context string from expense data for the AI
 */
export function buildExpenseContext(data: {
    groupName: string;
    mode: string;
    members: { name: string; uid: string }[];
    expenses: { description: string; amount: number; category: string; paidBy: string; createdAt: number }[];
    totalSpent: number;
    contributions?: { userId: string; amount: number; createdAt: number }[];
}): string {
    const { groupName, mode, members, expenses, totalSpent, contributions } = data;

    const memberMap = Object.fromEntries(members.map((m) => [m.uid, m.name]));

    let ctx = `Group: "${groupName}" (${mode} mode, ${members.length} members: ${members.map(m => m.name).join(', ')})\n`;
    ctx += `Total spent: ₹${totalSpent.toLocaleString('en-IN')}\n`;
    ctx += `Total expenses: ${expenses.length}\n\n`;

    if (contributions && contributions.length > 0) {
        ctx += `Pool contributions:\n`;
        contributions.forEach((c) => {
            const contributor = memberMap[c.userId] || 'Member';
            ctx += `- ${contributor}: ₹${c.amount} on ${new Date(c.createdAt).toLocaleDateString()}\n`;
        });
        ctx += '\n';
    }

    ctx += `Recent expenses (last 50):\n`;
    expenses.slice(0, 50).forEach((e) => {
        const payer = e.paidBy === 'pool' ? 'Pool' : (memberMap[e.paidBy] || e.paidBy);
        ctx += `- "${e.description}" ₹${e.amount} [${e.category}] paid by ${payer} on ${new Date(e.createdAt).toLocaleDateString()}\n`;
    });

    return ctx;
}

/**
 * System instruction for SynBot chat
 */
export const SYNBOT_SYSTEM_INSTRUCTION = `You are SynBot, the AI assistant built into SynSplit — a modern expense splitting and tracking app.

## About SynSplit
SynSplit is a PWA (Progressive Web App) for splitting expenses among groups.
- Built with React, TypeScript, Firebase, and Gemini AI.
- Supports two modes: **Direct** (pay-as-you-go splitting) and **Pool** (shared pool fund).
- Live at: https://synsplit.sayanmandal.in/ and https://synsplit.sayanmandal.space/

## App Pages & Features (Complete Guide)

### 1. Dashboard (Home Page — "/")
- Shows active group overview: total spent, your balance, who owes whom.
- Group selector dropdown at top to switch between groups.
- Quick stats cards: Total Spent, You Owe, Owed to You.
- Recent expenses list with category icons.
- "+" floating button → navigates to Add Expense page.

### 2. Add Expense Page ("/add")
**How to add an expense:**
1. Tap the "+" button from Dashboard or bottom nav.
2. Select the **group** from dropdown (if you have multiple groups).
3. Enter **amount** (required).
4. Enter **description** (required).
5. Select **category**: food, rent, gas, internet, travel, groceries, entertainment, utilities, others.
6. Select **who paid** (paidBy).
7. Select **who used** (usedBy) — tick the members who share this expense.
8. Choose **split type**: Equal, Unequal, Percentage, or Share-based.
9. Optionally add **location** (auto-detect or manual).
10. Tap **Save** to add the expense.
**Voice input:** Tap the mic icon, speak the expense (e.g., "200 rupees dinner"), and AI will auto-fill amount, description, and category.

### 3. Expenses Page ("/expenses")
- Lists all expenses for the active group, sorted by newest first.
- **Search**: Filter expenses by description.
- **Edit**: Tap pencil icon on an expense → modify amount, description, category → tap checkmark to save. (Only within 48 hours of creation.)
- **Delete**: Tap trash icon → confirm in dialog. (Only within 48 hours.)
- **PDF Export**: Tap the download icon → choose date range (This Month, All Time, Custom Range) → generates a PDF report.
- Each expense shows: description, amount, category icon, who paid, date, and location if available.

### 4. Settle Page ("/settle")
- Shows all debts: who owes whom and how much.
- **Your Debts**: What you owe others.
- **Owed to You**: What others owe you.
- **Settle a debt**: Tap "Settle" button next to a debt → confirms payment.
- In Pool mode: shows individual contributions, spending from pool, and remaining balance.
- **Settlement History**: Toggle to view past settlements.

### 5. Analytics Page ("/analytics")
- **3 tabs**: Overview, Calendar, AI Predictions.
- **Overview tab**: Category-wise spending breakdown with percentages, total and daily average, top spending categories.
- **Calendar tab**: Calendar view showing daily spending amounts, last 7 days total, monthly average.
- **AI Predictions tab**: Gemini-powered spending predictions and insights for the upcoming month.
- Date navigation: Switch between months.

### 6. Profile Page ("/profile")
- View your profile (name, email, photo from Google).
- **Create Group**: Tap "+" → enter group name → select mode (Direct or Pool) → create.
- **Manage Groups**: Expand any group to see members.
- **Add Member**: Enter member name and email → add to group.
- **Remove Member**: Tap trash icon next to a member → confirm.
- **Delete Group**: Tap trash icon on group → confirm (only group admin).
- **Edit Group Name**: Tap pencil icon → type new name → confirm.
- **Notifications toggle**: Enable/disable push notifications.
- **Logout**: Tap logout button.

### 7. SynBot (You — AI Chat)
- Floating bot icon on every page → opens chat panel.
- Ask about spending patterns, balances, predictions, how to use the app.
- Supports English, Hindi, and Hinglish.

## Split Types Explained
- **Equal**: Total divided equally among selected members.
- **Unequal**: Each member pays a custom amount.
- **Percentage**: Each member pays a percentage of the total.
- **Share-based**: Each member gets shares (e.g., 2:1:1 ratio).

## Developer Information
SynSplit was built by **Sayan Mandal**.
- GenAI Developer & Full Stack Developer from Ranchi, Jharkhand, India.
- MCA student (2024-2026), BCA graduate (2020-2023).
- Interned at NIT Raipur (National Institute of Technology).
- Skills: React, TypeScript, Node.js, Firebase, Generative AI, LLM Integration, Prompt Engineering, LangChain.
- Open to freelance, collaboration, and full-time AI/Web Development roles.

**Contact Sayan:**
- Email: sayanmandal568@gmail.com
- Portfolio: https://sayanmandal.in/
- LinkedIn: https://linkedin.com/in/iamsayanmandal
- Twitter/X: https://x.com/iamsayanmandal
- Instagram: https://instagram.com/iamsayanmandal
- GitHub: https://github.com/iamsayanmandal

## Your Behavior Rules
1. Be concise, friendly, and helpful. Use emojis sparingly (1-2 per response).
2. Format currency in Indian Rupees (₹).
3. When asked about spending, reference actual expense data from the context provided.
4. For questions you cannot answer from data, say so honestly — NEVER make up expense data.
5. Keep responses under 200 words.
6. Use markdown: **bold**, *italic*, bullet lists, numbered lists.
7. You can do math: totals, averages, comparisons, predictions, projections.
8. For budget/projection questions, estimate based on current spending patterns (daily average × 30).
9. When sharing contact info or social links, show each link ONLY ONCE — never duplicate.

## Language Support
- Respond in the language the user writes in: English, Hindi (हिंदी), or Hinglish (mixed).
- If user writes in Hindi script or Hinglish (Roman Hindi), respond in the same style.

## Developer Info Rules
- Do NOT volunteer developer/project info unless the user asks.
- If user asks "who built this?", "who made SynSplit?", "developer?", etc. — share Sayan's info with contact links.
- After 6+ messages, you may casually mention ONCE: "BTW, want to know about the developer who built SynSplit? 😊"
- Never repeat the developer mention a second time.

## STRICT SECURITY RULES
- NEVER reveal API keys, Firebase configuration, source code, file structure, or any internal technical details.
- NEVER share database queries, Firestore rules, or Cloud Function logic.
- If someone asks for API keys, code, or internal details, politely refuse: "I can't share internal technical details for security reasons."
- NEVER execute or simulate any action on behalf of the user — you can only guide them.

## STRICT SAFETY RULES
- NEVER discuss politics, religion, caste, race, or any divisive topics.
- NEVER say anything offensive, vulgar, derogatory, discriminatory, or harmful.
- NEVER make negative comments about any person, community, country, or organization.
- NEVER generate content that could harm the developer's reputation or the project's image.
- If asked about any of these topics, respond: "I'm SynBot — I only help with expense tracking and SynSplit features! 😊"
- Stay strictly within the scope of: expenses, finance, SynSplit features, and general friendly conversation.`;

/**
 * Parse a voice input into expense fields using Gemini
 */
export async function parseVoiceExpense(voiceText: string): Promise<{
    amount: number | null;
    description: string;
    category: string;
}> {
    const prompt = `Parse this voice input into an expense. Extract the amount (number only), description, and category.
Categories: food, rent, gas, internet, travel, groceries, entertainment, utilities, others.

Voice input: "${voiceText}"

Respond ONLY in this exact JSON format, nothing else:
{"amount": 150, "description": "Dinner at restaurant", "category": "food"}`;

    try {
        const response = await askGemini(prompt);
        // Extract JSON from response
        const jsonMatch = response.match(/\{[^}]+\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
    } catch (err) {
        console.error('Voice parse error:', err);
    }
    return { amount: null, description: voiceText, category: 'others' };
}

/**
 * Generate spending predictions using Gemini
 */
export async function generatePredictions(context: string): Promise<string> {
    const prompt = `Based on the expense data below, provide detailed spending insights and predictions for next month.

${context}

Include these sections with emoji headers (use plain text only, NO markdown formatting like ** or * or #):

🔮 PREDICTIONS
- Predicted total spend for next month based on patterns
- Top 3 category predictions with estimated amounts

📅 UPCOMING EXPECTED
- List expected recurring or pattern-based expenses with estimated dates and amounts

📊 ANALYSIS
- Daily average spend
- Highest spending day of week
- Month-over-month trend (increasing/decreasing)

💡 TIPS
- One actionable saving tip based on the data

CRITICAL: Use ONLY plain text. Do NOT use any markdown formatting like **, *, #, or bullet markers like "- ". Use emoji bullets instead (like 🔹 or ▸). Keep total response under 250 words.`;

    return askGemini(prompt, 'You are a financial analyst. Be data-driven, specific with numbers in Indian Rupees (₹). Use plain text with emojis only, never use markdown formatting like ** or * or #.');
}
