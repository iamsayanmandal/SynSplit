/**
 * Gemini AI API helper for SynSplit
 * Uses Google Generative AI (Gemini 2.5 Pro) for expense insights, predictions, and voice parsing
 */

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent';

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
            maxOutputTokens: 1024,
            topP: 0.95,
        },
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
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Empty response from Gemini');
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
            ctx += `- ${memberMap[c.userId] || c.userId}: ₹${c.amount} on ${new Date(c.createdAt).toLocaleDateString()}\n`;
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
export const SYNBOT_SYSTEM_INSTRUCTION = `You are SynBot, the AI assistant for SynSplit — an expense splitting app. You help users understand their spending patterns, answer questions about their expenses, and provide helpful financial insights.

Rules:
- Be concise and friendly. Use emojis sparingly (1-2 per response max).
- Format currency in Indian Rupees (₹).
- When asked about spending, reference actual expense data provided in context.
- For questions you cannot answer from the data, say so honestly.
- Keep responses under 150 words.
- Never make up expense data that isn't in the context.
- You can do math: calculate totals, averages, comparisons, predictions.
- Use markdown formatting for readability (bold, lists, etc).`;

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
