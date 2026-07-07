import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();

const db = admin.firestore();

// ─── Interfaces ───

interface ExpenseData {
    amount: number;
    description: string;
    groupId: string;
    paidBy: string;
    usedBy: string[];
    splitType: string;
    splitDetails?: Record<string, number>;
    createdBy?: string;
}

interface SettlementData {
    fromUser: string;
    toUser: string;
    amount: number;
    groupId?: string;
}

// ─── Helpers ───

function calculateShare(expense: ExpenseData, userId: string): number {
    const { amount, splitType, splitDetails, usedBy } = expense;

    if (!usedBy.includes(userId)) return 0;

    switch (splitType) {
        case 'equal':
            return Math.round((amount / usedBy.length) * 100) / 100;
        case 'unequal':
            return (splitDetails && splitDetails[userId]) ? splitDetails[userId] : 0;
        case 'percentage':
            return Math.round((amount * ((splitDetails && splitDetails[userId]) ? splitDetails[userId] : 0)) / 100 * 100) / 100;
        case 'share': {
            const details = splitDetails || {};
            const totalShares = Object.values(details).reduce((a: number, b: number) => a + b, 0);
            const userShare = details[userId] || 0;
            return totalShares ? Math.round((amount * userShare) / totalShares * 100) / 100 : 0;
        }
        default:
            return 0;
    }
}

async function getTokens(userId: string): Promise<string[]> {
    const tokens: string[] = [];
    const tokensSnap = await db.collection('users').doc(userId).collection('fcmTokens').get();
    tokensSnap.forEach(doc => {
        const data = doc.data();
        if (data.token) tokens.push(data.token);
    });
    return tokens;
}

/**
 * Batch-fetch FCM tokens for multiple users in parallel.
 * Eliminates N+1 sequential queries.
 */
async function getBatchTokens(userIds: string[]): Promise<Map<string, string[]>> {
    const results = await Promise.all(
        userIds.map(async (uid) => ({ uid, tokens: await getTokens(uid) }))
    );
    const tokenMap = new Map<string, string[]>();
    results.forEach(({ uid, tokens }) => tokenMap.set(uid, tokens));
    return tokenMap;
}

/**
 * Remove stale/invalid FCM tokens directly using userId and token to avoid collectionGroup queries.
 */
async function deleteUserTokens(tokensToDelete: { uid: string; token: string }[]) {
    if (tokensToDelete.length === 0) return;
    const batch = db.batch();
    tokensToDelete.forEach(({ uid, token }) => {
        const ref = db.collection('users').doc(uid).collection('fcmTokens').doc(token);
        batch.delete(ref);
    });
    await batch.commit();
    console.log(`[CLEANUP] Batch-removed ${tokensToDelete.length} stale FCM tokens.`);
}

async function getUserName(uid: string, groupId?: string): Promise<string> {
    const doc = await db.collection('users').doc(uid).get();
    if (doc.exists && doc.data()?.displayName) {
        return doc.data()?.displayName;
    }

    if (groupId) {
        const groupDoc = await db.collection('groups').doc(groupId).get();
        if (groupDoc.exists) {
            const members = groupDoc.data()?.members || [];
            const member = members.find((m: { uid: string; name: string }) => m.uid === uid);
            if (member && member.name) {
                return member.name;
            }
        }
    }

    return 'Someone';
}

// ─── Notification Logic ───

async function sendExpenseNotification(expense: ExpenseData) {
    console.log(`[DEBUG] Processing Expense: ${expense.description} (${expense.amount})`);

    const { paidBy, usedBy, createdBy } = expense;

    const payerId = paidBy === 'pool' ? (createdBy || '') : paidBy;
    const payerName = await getUserName(payerId, expense.groupId);

    // 2. Identify Recipients (Participants excluding Payer and Creator, Unique)
    const uniqueRecipients = [...new Set(usedBy.filter(uid => uid !== paidBy && uid !== createdBy))];

    if (uniqueRecipients.length === 0) {
        console.log('[DEBUG] No recipients to notify (payer/creator is only user or empty).');
        return;
    }

    // Batch-fetch all tokens in parallel (instead of N+1 sequential queries)
    const tokenMap = await getBatchTokens(uniqueRecipients);

    const messages: admin.messaging.Message[] = [];
    const tokenToUserMap = new Map<string, string>();

    for (const uid of uniqueRecipients) {
        const share = calculateShare(expense, uid);
        const formattedShare = share.toFixed(2).replace(/\.00$/, '');
        const formattedTotal = expense.amount.toFixed(2).replace(/\.00$/, '');

        const userTokens = tokenMap.get(uid) || [];
        const uniqueTokens = [...new Set(userTokens)];

        for (const token of uniqueTokens) {
            tokenToUserMap.set(token, uid);
            messages.push({
                token: token,
                notification: {
                    title: `New Expense by ${payerName}`,
                    body: `New expense added by ${payerName} • ${expense.description}\nTotal: ₹${formattedTotal} • Your Share: ₹${formattedShare}`,
                },
                webpush: {
                    fcmOptions: {
                        link: '/expenses'
                    }
                }
            });
        }
    }

    if (messages.length === 0) {
        console.log('[DEBUG] No tokens found for recipients.');
        return;
    }

    console.log(`[DEBUG] Sending ${messages.length} personalized messages...`);
    const response = await admin.messaging().sendEach(messages);
    console.log(`[DEBUG] Success: ${response.successCount}, Failure: ${response.failureCount}`);

    // Auto-cleanup stale tokens on failure
    if (response.failureCount > 0) {
        const tokensToDelete: { token: string; uid: string }[] = [];
        response.responses.forEach((r, i) => {
            const msg = messages[i] as admin.messaging.TokenMessage;
            if (!r.success) {
                console.error(`[ERROR] Failed to send to ${msg.token}:`, r.error);
                // Only cleanup tokens with permanent errors
                if (r.error?.code === 'messaging/invalid-registration-token' ||
                    r.error?.code === 'messaging/registration-token-not-registered') {
                    const uid = tokenToUserMap.get(msg.token);
                    if (uid) {
                        tokensToDelete.push({ token: msg.token, uid });
                    }
                }
            }
        });
        if (tokensToDelete.length > 0) {
            await deleteUserTokens(tokensToDelete);
        }
    }
}

async function sendSettlementNotification(settlement: SettlementData) {
    const { fromUser, toUser, amount } = settlement;

    const payerName = await getUserName(fromUser, settlement.groupId);
    const tokens = await getTokens(toUser);

    if (tokens.length === 0) return;

    const messages: admin.messaging.Message[] = tokens.map(token => ({
        token,
        notification: {
            title: 'Payment Received',
            body: `${payerName} paid you ₹${amount}`,
        },
        webpush: {
            fcmOptions: {
                link: '/settle'
            }
        }
    }));

    const response = await admin.messaging().sendEach(messages);
    console.log(`[DEBUG] Sent settlement notification to ${toUser}`);

    // Auto-cleanup stale tokens
    if (response.failureCount > 0) {
        const tokensToDelete: { token: string; uid: string }[] = [];
        response.responses.forEach((r, i) => {
            const msg = messages[i] as admin.messaging.TokenMessage;
            if (!r.success && (
                r.error?.code === 'messaging/invalid-registration-token' ||
                r.error?.code === 'messaging/registration-token-not-registered'
            )) {
                tokensToDelete.push({ token: msg.token, uid: toUser });
            }
        });
        if (tokensToDelete.length > 0) {
            await deleteUserTokens(tokensToDelete);
        }
    }
}

// ─── Triggers ───

export const onExpenseCreate = functions.firestore
    .document('expenses/{expenseId}')
    .onCreate(async (snap) => {
        const expense = snap.data() as ExpenseData;
        if (expense) await sendExpenseNotification(expense);
    });

export const onSettlementCreate = functions.firestore
    .document('settlements/{settlementId}')
    .onCreate(async (snap) => {
        const settlement = snap.data() as SettlementData;
        if (settlement) await sendSettlementNotification(settlement);
    });

// ─── Gemini AI Proxy ───

// Rate limiter: track calls per user
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10; // max calls per window
const RATE_WINDOW_MS = 60 * 1000; // 1 minute

export const askGeminiProxy = functions.https.onCall(async (data, context) => {
    // 1. Authentication check
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
    }

    const uid = context.auth.uid;

    // 2. Rate limiting
    const now = Date.now();
    const userRate = rateLimitMap.get(uid);
    if (userRate) {
        if (now < userRate.resetAt) {
            if (userRate.count >= RATE_LIMIT) {
                throw new functions.https.HttpsError('resource-exhausted', 'Rate limit exceeded. Please wait a moment.');
            }
            userRate.count++;
        } else {
            rateLimitMap.set(uid, { count: 1, resetAt: now + RATE_WINDOW_MS });
        }
    } else {
        rateLimitMap.set(uid, { count: 1, resetAt: now + RATE_WINDOW_MS });
    }

    // 3. Input validation
    const { prompt, systemInstruction, history } = data;
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
        throw new functions.https.HttpsError('invalid-argument', 'Prompt is required.');
    }
    if (prompt.length > 10000) {
        throw new functions.https.HttpsError('invalid-argument', 'Prompt too long.');
    }

    // 4. Get API key from environment
    const apiKey = process.env.GEMINI_API_KEY || (functions.config().gemini?.key);
    if (!apiKey) {
        console.error('[GEMINI] API key not configured.');
        throw new functions.https.HttpsError('internal', 'AI service not configured.');
    }

    // 5. Call Gemini API
    const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

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

    try {
        const response = await fetch(`${API_URL}?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            console.error('[GEMINI] API error:', response.status);
            throw new functions.https.HttpsError('internal', 'AI service error.');
        }

        const result = (await response.json()) as any;
        const candidate = result?.candidates?.[0];

        if (candidate?.finishReason === 'SAFETY') {
            return { text: "I couldn't generate a response for this query. Please try rephrasing your question." };
        }

        const text = candidate?.content?.parts?.[0]?.text;
        if (!text) {
            return { text: "I couldn't generate insights right now. Please try again in a moment." };
        }

        return { text };
    } catch (error: unknown) {
        if (error instanceof functions.https.HttpsError) throw error;
        console.error('[GEMINI] Unexpected error:', error);
        throw new functions.https.HttpsError('internal', 'AI service unavailable.');
    }
});
