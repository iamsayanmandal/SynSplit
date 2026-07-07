"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.askGeminiProxy = exports.onSettlementCreate = exports.onExpenseCreate = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();
const db = admin.firestore();
// ─── Helpers ───
function calculateShare(expense, userId) {
    const { amount, splitType, splitDetails, usedBy } = expense;
    if (!usedBy.includes(userId))
        return 0;
    switch (splitType) {
        case 'equal':
            return Math.round((amount / usedBy.length) * 100) / 100;
        case 'unequal':
            return (splitDetails && splitDetails[userId]) ? splitDetails[userId] : 0;
        case 'percentage':
            return Math.round((amount * ((splitDetails && splitDetails[userId]) ? splitDetails[userId] : 0)) / 100 * 100) / 100;
        case 'share': {
            const details = splitDetails || {};
            const totalShares = Object.values(details).reduce((a, b) => a + b, 0);
            const userShare = details[userId] || 0;
            return totalShares ? Math.round((amount * userShare) / totalShares * 100) / 100 : 0;
        }
        default:
            return 0;
    }
}
async function getTokens(userId) {
    const tokens = [];
    const tokensSnap = await db.collection('users').doc(userId).collection('fcmTokens').get();
    tokensSnap.forEach(doc => {
        const data = doc.data();
        if (data.token)
            tokens.push(data.token);
    });
    return tokens;
}
/**
 * Batch-fetch FCM tokens for multiple users in parallel.
 * Eliminates N+1 sequential queries.
 */
async function getBatchTokens(userIds) {
    const results = await Promise.all(userIds.map(async (uid) => ({ uid, tokens: await getTokens(uid) })));
    const tokenMap = new Map();
    results.forEach(({ uid, tokens }) => tokenMap.set(uid, tokens));
    return tokenMap;
}
/**
 * Remove stale/invalid FCM tokens directly using userId and token to avoid collectionGroup queries.
 */
async function deleteUserTokens(tokensToDelete) {
    if (tokensToDelete.length === 0)
        return;
    const batch = db.batch();
    tokensToDelete.forEach(({ uid, token }) => {
        const ref = db.collection('users').doc(uid).collection('fcmTokens').doc(token);
        batch.delete(ref);
    });
    await batch.commit();
    console.log(`[CLEANUP] Batch-removed ${tokensToDelete.length} stale FCM tokens.`);
}
async function getUserName(uid, groupId) {
    var _a, _b, _c;
    const doc = await db.collection('users').doc(uid).get();
    if (doc.exists && ((_a = doc.data()) === null || _a === void 0 ? void 0 : _a.displayName)) {
        return (_b = doc.data()) === null || _b === void 0 ? void 0 : _b.displayName;
    }
    if (groupId) {
        const groupDoc = await db.collection('groups').doc(groupId).get();
        if (groupDoc.exists) {
            const members = ((_c = groupDoc.data()) === null || _c === void 0 ? void 0 : _c.members) || [];
            const member = members.find((m) => m.uid === uid);
            if (member && member.name) {
                return member.name;
            }
        }
    }
    return 'Someone';
}
// ─── Notification Logic ───
async function sendExpenseNotification(expense) {
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
    const messages = [];
    const tokenToUserMap = new Map();
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
        const tokensToDelete = [];
        response.responses.forEach((r, i) => {
            var _a, _b;
            const msg = messages[i];
            if (!r.success) {
                console.error(`[ERROR] Failed to send to ${msg.token}:`, r.error);
                // Only cleanup tokens with permanent errors
                if (((_a = r.error) === null || _a === void 0 ? void 0 : _a.code) === 'messaging/invalid-registration-token' ||
                    ((_b = r.error) === null || _b === void 0 ? void 0 : _b.code) === 'messaging/registration-token-not-registered') {
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
async function sendSettlementNotification(settlement) {
    const { fromUser, toUser, amount } = settlement;
    const payerName = await getUserName(fromUser, settlement.groupId);
    const tokens = await getTokens(toUser);
    if (tokens.length === 0)
        return;
    const messages = tokens.map(token => ({
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
        const tokensToDelete = [];
        response.responses.forEach((r, i) => {
            var _a, _b;
            const msg = messages[i];
            if (!r.success && (((_a = r.error) === null || _a === void 0 ? void 0 : _a.code) === 'messaging/invalid-registration-token' ||
                ((_b = r.error) === null || _b === void 0 ? void 0 : _b.code) === 'messaging/registration-token-not-registered')) {
                tokensToDelete.push({ token: msg.token, uid: toUser });
            }
        });
        if (tokensToDelete.length > 0) {
            await deleteUserTokens(tokensToDelete);
        }
    }
}
// ─── Triggers ───
exports.onExpenseCreate = functions.firestore
    .document('expenses/{expenseId}')
    .onCreate(async (snap) => {
    const expense = snap.data();
    if (expense)
        await sendExpenseNotification(expense);
});
exports.onSettlementCreate = functions.firestore
    .document('settlements/{settlementId}')
    .onCreate(async (snap) => {
    const settlement = snap.data();
    if (settlement)
        await sendSettlementNotification(settlement);
});
// ─── Gemini AI Proxy ───
// Rate limiter: track calls per user
const rateLimitMap = new Map();
const RATE_LIMIT = 10; // max calls per window
const RATE_WINDOW_MS = 60 * 1000; // 1 minute
exports.askGeminiProxy = functions.https.onCall(async (data, context) => {
    var _a, _b, _c, _d, _e;
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
        }
        else {
            rateLimitMap.set(uid, { count: 1, resetAt: now + RATE_WINDOW_MS });
        }
    }
    else {
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
    const apiKey = process.env.GEMINI_API_KEY || ((_a = functions.config().gemini) === null || _a === void 0 ? void 0 : _a.key);
    if (!apiKey) {
        console.error('[GEMINI] API key not configured.');
        throw new functions.https.HttpsError('internal', 'AI service not configured.');
    }
    // 5. Call Gemini API
    const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
    const body = {
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
        const result = (await response.json());
        const candidate = (_b = result === null || result === void 0 ? void 0 : result.candidates) === null || _b === void 0 ? void 0 : _b[0];
        if ((candidate === null || candidate === void 0 ? void 0 : candidate.finishReason) === 'SAFETY') {
            return { text: "I couldn't generate a response for this query. Please try rephrasing your question." };
        }
        const text = (_e = (_d = (_c = candidate === null || candidate === void 0 ? void 0 : candidate.content) === null || _c === void 0 ? void 0 : _c.parts) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.text;
        if (!text) {
            return { text: "I couldn't generate insights right now. Please try again in a moment." };
        }
        return { text };
    }
    catch (error) {
        if (error instanceof functions.https.HttpsError)
            throw error;
        console.error('[GEMINI] Unexpected error:', error);
        throw new functions.https.HttpsError('internal', 'AI service unavailable.');
    }
});
//# sourceMappingURL=index.js.map