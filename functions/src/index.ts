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
            return amount / usedBy.length;
        case 'unequal':
            return (splitDetails && splitDetails[userId]) ? splitDetails[userId] : 0;
        case 'percentage':
            return (amount * ((splitDetails && splitDetails[userId]) ? splitDetails[userId] : 0)) / 100;
        case 'share': {
            // Sum total shares
            const details = splitDetails || {};
            const totalShares = Object.values(details).reduce((a: number, b: number) => a + b, 0);
            const userShare = details[userId] || 0;
            return totalShares ? (amount * userShare) / totalShares : 0;
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

async function getUserName(uid: string, groupId?: string): Promise<string> {
    // 1. Try fetching from global user profile
    const doc = await db.collection('users').doc(uid).get();
    if (doc.exists && doc.data()?.displayName) {
        return doc.data()?.displayName;
    }

    // 2. Fallback: Try fetching from the group member list
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

    const { paidBy, usedBy } = expense;

    // 1. Get Payer Name
    const payerName = await getUserName(paidBy, expense.groupId);

    // 2. Identify Recipients (Participants excluding Payer)
    const recipients = usedBy.filter(uid => uid !== paidBy);

    if (recipients.length === 0) {
        console.log('[DEBUG] No recipients to notify (payer is only user or empty).');
        return;
    }

    const messages: admin.messaging.Message[] = [];

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
            const msg = messages[i] as admin.messaging.TokenMessage;
            if (!r.success) console.error(`[ERROR] Failed to send to ${msg.token}:`, r.error);
        });
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

    await admin.messaging().sendEach(messages);
    console.log(`[DEBUG] Sent settlement notification to ${toUser}`);
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
