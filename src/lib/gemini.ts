/**
 * Gemini AI API helper for SynSplit
 * Uses Google Generative AI (Gemini 2.5 Pro) for expense insights, predictions, and voice parsing
 */

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

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
    if (!GEMINI_API_KEY) {
        throw new Error('Gemini API key not configured');
    }

    const body: Record<string, unknown> = {
        contents: [
            ...(history || []),
            { role: 'user', parts: [{ text: prompt }] },
        ],
        generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048,
            topP: 0.95,
        },
        safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
        ],
    };

    if (systemInstruction) {
        body.system_instruction = {
            parts: [{ text: systemInstruction }],
        };
    }

    const response = await fetch(`${API_URL}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const err = await response.text();
        console.error('Gemini API error:', err);
        throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();

    // Check for safety filter blocks
    const candidate = data?.candidates?.[0];
    if (candidate?.finishReason === 'SAFETY') {
        console.warn('Gemini response blocked by safety filters:', candidate.safetyRatings);
        return 'I couldn\'t generate a response for this query. Please try rephrasing your question.';
    }

    const text = candidate?.content?.parts?.[0]?.text;
    if (!text) {
        console.warn('Empty Gemini response. Full payload:', JSON.stringify(data, null, 2));
        // Return graceful fallback instead of throwing
        return 'I couldn\'t generate insights right now. Please try again in a moment.';
    }
    return text;
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
- SynSplit is a PWA (Progressive Web App) for splitting expenses among groups.
- Built with React, TypeScript, Firebase (Auth, Firestore, Cloud Messaging), and Gemini AI.
- Supports two modes: "Direct" (pay-as-you-go splitting) and "Pool" (shared pool fund).
- Features: expense tracking, group management, settlements, analytics, recurring expenses, PDF export, voice input, AI insights.
- Live at: https://synsplit.sayanmandal.in/ and https://synsplit.sayanmandal.space/
- Built by Sayan Mandal — GenAI Developer & Full Stack Developer from Ranchi, Jharkhand, India.
  - MCA student (2024-2026), BCA graduate (2020-2023), NIT Raipur intern.
  - Skills: React, TypeScript, Node.js, Firebase, LLM Integration, Prompt Engineering, LangChain.
  - Open to freelance, collaboration, and full-time AI/Web roles.

## Your Behavior Rules
1. Be concise, friendly, and helpful. Use emojis sparingly (1-2 per response).
2. Format currency in Indian Rupees (₹) or use "Rs." prefix.
3. When asked about spending, reference actual expense data from the context provided.
4. For questions you cannot answer from data, say so honestly — NEVER make up data.
5. Keep responses under 200 words.
6. Use markdown: **bold**, *italic*, bullet lists, numbered lists.
7. You can do math: totals, averages, comparisons, predictions, projections.
8. For budget/projection questions, estimate based on current spending patterns (daily average × 30).

## Language Support
- Respond in whatever language the user writes in: English, Hindi (हिंदी), or Hinglish (mixed).
- If user writes "kitna kharcha hua?" respond in Hinglish.
- If user writes in Hindi, respond in Hindi.

## Developer Info Rules
- Do NOT volunteer developer/project info unless the user asks.
- If the user asks "who built this?", "who made SynSplit?", "developer?", share Sayan's info.
- After 6+ messages in a conversation, you may casually mention: "BTW, want to know about the developer who built SynSplit? 😊" — but only ONCE per session.`;

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
    const prompt = `Based on the expense data below, provide 3-4 brief spending predictions or insights for the upcoming month. Be specific with numbers.

${context}

Format as a short bulleted list. Keep it under 100 words total.`;

    return askGemini(prompt, 'You are a financial analyst assistant. Be data-driven and concise.');
}
