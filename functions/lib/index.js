"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onSettlementCreate = exports.onExpenseCreate = void 0;
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
            return amount / usedBy.length;
        case 'unequal':
            return (splitDetails && splitDetails[userId]) ? splitDetails[userId] : 0;
        case 'percentage':
            return (amount * ((splitDetails && splitDetails[userId]) ? splitDetails[userId] : 0)) / 100;
        case 'share': {
            const details = splitDetails || {};
            const totalShares = Object.values(details).reduce((a, b) => a + b, 0);
            const userShare = details[userId] || 0;
            return totalShares ? (amount * userShare) / totalShares : 0;
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
 * Remove stale/invalid FCM tokens after failed send attempts.
 */
async function cleanupStaleTokens(failedTokens, allMessages) {
    const batch = db.batch();
    let cleanupCount = 0;
    for (const [_index, msg] of allMessages.entries()) {
        const tokenMsg = msg;
        if (failedTokens.includes(tokenMsg.token)) {
            // Search all users for this token and delete it
            const usersSnap = await db.collectionGroup('fcmTokens')
                .where('token', '==', tokenMsg.token).get();
            usersSnap.forEach(doc => {
                batch.delete(doc.ref);
                cleanupCount++;
            });
        }
    }
    if (cleanupCount > 0) {
        await batch.commit();
        console.log(`[CLEANUP] Removed ${cleanupCount} stale FCM tokens.`);
    }
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
    const { paidBy, usedBy } = expense;
    const payerName = await getUserName(paidBy, expense.groupId);
    // 2. Identify Recipients (Participants excluding Payer, Unique)
    const uniqueRecipients = [...new Set(usedBy.filter(uid => uid !== paidBy))];
    if (uniqueRecipients.length === 0) {
        console.log('[DEBUG] No recipients to notify (payer is only user or empty).');
        return;
    }
    // Batch-fetch all tokens in parallel (instead of N+1 sequential queries)
    const tokenMap = await getBatchTokens(uniqueRecipients);
    const messages = [];
    for (const uid of uniqueRecipients) {
        const share = calculateShare(expense, uid);
        const formattedShare = share.toFixed(2).replace(/\.00$/, '');
        const formattedTotal = expense.amount.toFixed(2).replace(/\.00$/, '');
        const userTokens = tokenMap.get(uid) || [];
        const uniqueTokens = [...new Set(userTokens)];
        for (const token of uniqueTokens) {
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
        const failedTokens = [];
        response.responses.forEach((r, i) => {
            var _a, _b;
            const msg = messages[i];
            if (!r.success) {
                console.error(`[ERROR] Failed to send to ${msg.token}:`, r.error);
                // Only cleanup tokens with permanent errors
                if (((_a = r.error) === null || _a === void 0 ? void 0 : _a.code) === 'messaging/invalid-registration-token' ||
                    ((_b = r.error) === null || _b === void 0 ? void 0 : _b.code) === 'messaging/registration-token-not-registered') {
                    failedTokens.push(msg.token);
                }
            }
        });
        if (failedTokens.length > 0) {
            await cleanupStaleTokens(failedTokens, messages);
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
        const failedTokens = [];
        response.responses.forEach((r, i) => {
            var _a, _b;
            const msg = messages[i];
            if (!r.success && (((_a = r.error) === null || _a === void 0 ? void 0 : _a.code) === 'messaging/invalid-registration-token' ||
                ((_b = r.error) === null || _b === void 0 ? void 0 : _b.code) === 'messaging/registration-token-not-registered')) {
                failedTokens.push(msg.token);
            }
        });
        if (failedTokens.length > 0) {
            await cleanupStaleTokens(failedTokens, messages);
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
//# sourceMappingURL=index.js.map