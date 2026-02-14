"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onSettlementCreate = exports.onExpenseCreate = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();
// Helper to send notifications to a list of users
async function sendToGroup(groupId, title, message, excludeUserId, link) {
    try {
        const db = admin.firestore();
        // 1. Get Group Members
        const groupDoc = await db.collection('groups').doc(groupId).get();
        if (!groupDoc.exists)
            return;
        const group = groupDoc.data();
        if (!group || !group.members)
            return;
        const members = group.members;
        // 2. Filter out the sender
        const recipientUids = members
            .map(m => m.uid)
            .filter(uid => uid !== excludeUserId);
        if (recipientUids.length === 0)
            return;
        // 3. Get FCM Tokens for these users
        const tokens = [];
        for (const uid of recipientUids) {
            const tokensSnap = await db.collection('users').doc(uid).collection('fcmTokens').get();
            tokensSnap.forEach(doc => {
                const data = doc.data();
                if (data.token) {
                    tokens.push(data.token);
                }
            });
        }
        if (tokens.length === 0) {
            console.log('No registered tokens for users in group:', groupId);
            return;
        }
        // 4. Send Multicast Message
        const payload = {
            tokens: tokens,
            notification: {
                title: title,
                body: message,
            },
            webpush: {
                fcmOptions: {
                    link: link || '/'
                }
            }
        };
        const response = await admin.messaging().sendMulticast(payload);
        console.log(`Sent ${response.successCount} notifications, failed: ${response.failureCount}`);
        // Optional: Cleanup invalid tokens
        if (response.failureCount > 0) {
            const failedTokens = [];
            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    failedTokens.push(tokens[idx]);
                }
            });
            // We could delete failedTokens from Firestore here to keep it clean
        }
    }
    catch (error) {
        console.error('Error sending group notification:', error);
    }
}
// Trigger: New Expense
exports.onExpenseCreate = functions.firestore
    .document('expenses/{expenseId}')
    .onCreate(async (snap, context) => {
    const expense = snap.data();
    if (!expense)
        return;
    await sendToGroup(expense.groupId, 'New Expense', `${expense.description} - ₹${expense.amount}`, expense.paidBy, '/expenses');
});
// Trigger: New Settlement
exports.onSettlementCreate = functions.firestore
    .document('settlements/{settlementId}')
    .onCreate(async (snap, context) => {
    const settlement = snap.data();
    if (!settlement)
        return;
    await sendToGroup(settlement.groupId, 'New Settlement', `Settlement payment of ₹${settlement.amount}`, settlement.fromUser, '/settle');
});
//# sourceMappingURL=index.js.map