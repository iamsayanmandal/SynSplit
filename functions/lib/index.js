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
            return (splitDetails === null || splitDetails === void 0 ? void 0 : splitDetails[userId]) || 0;
        case 'percentage':
            return (amount * ((splitDetails === null || splitDetails === void 0 ? void 0 : splitDetails[userId]) || 0)) / 100;
        case 'share':
            // Sum total shares
            const totalShares = Object.values(splitDetails || {}).reduce((a, b) => a + b, 0);
            const userShare = (splitDetails === null || splitDetails === void 0 ? void 0 : splitDetails[userId]) || 0;
            return totalShares ? (amount * userShare) / totalShares : 0;
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
async function getUserName(uid, groupId) {
    var _a, _b, _c;
    // 1. Try fetching from global user profile
    const doc = await db.collection('users').doc(uid).get();
    if (doc.exists && ((_a = doc.data()) === null || _a === void 0 ? void 0 : _a.displayName)) {
        return (_b = doc.data()) === null || _b === void 0 ? void 0 : _b.displayName;
    }
    // 2. Fallback: Try fetching from the group member list
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
    // 1. Get Payer Name
    const payerName = await getUserName(paidBy, expense.groupId);
    // 2. Identify Recipients (Participants excluding Payer)
    const recipients = usedBy.filter(uid => uid !== paidBy);
    if (recipients.length === 0) {
        console.log('[DEBUG] No recipients to notify (payer is only user or empty).');
        return;
    }
    const messages = [];
    // 3. Create Personalized Messages
    for (const uid of recipients) {
        const share = calculateShare(expense, uid);
        const formattedShare = share.toFixed(2).replace(/\.00$/, '');
        const formattedTotal = expense.amount.toFixed(2).replace(/\.00$/, '');
        const userTokens = await getTokens(uid);
        for (const token of userTokens) {
            messages.push({
                token: token,
                notification: {
                    title: `New Expense by ${payerName}`,
                    body: `${expense.description}\nTotal: ₹${formattedTotal} • Your Share: ₹${formattedShare}`,
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
    // 4. Send Batch
    console.log(`[DEBUG] Sending ${messages.length} personalized messages...`);
    const response = await admin.messaging().sendEach(messages);
    console.log(`[DEBUG] Success: ${response.successCount}, Failure: ${response.failureCount}`);
    if (response.failureCount > 0) {
        response.responses.forEach((r, i) => {
            const msg = messages[i];
            if (!r.success)
                console.error(`[ERROR] Failed to send to ${msg.token}:`, r.error);
        });
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
    await admin.messaging().sendEach(messages);
    console.log(`[DEBUG] Sent settlement notification to ${toUser}`);
}
// ─── Triggers ───
exports.onExpenseCreate = functions.firestore
    .document('expenses/{expenseId}')
    .onCreate(async (snap, context) => {
    const expense = snap.data();
    if (expense)
        await sendExpenseNotification(expense);
});
exports.onSettlementCreate = functions.firestore
    .document('settlements/{settlementId}')
    .onCreate(async (snap, context) => {
    const settlement = snap.data();
    if (settlement)
        await sendSettlementNotification(settlement);
});
//# sourceMappingURL=index.js.map