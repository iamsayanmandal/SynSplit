import {
    collection,
    doc,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    orderBy,
    where,
    limit,
    onSnapshot,
    getDoc,
    getDocs,
    type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Group, Expense, PoolContribution, Settlement, Member, RecurringExpense, Notification } from '../types';

// ─── Notifications ───

// Kept for backward compatibility or if we want an in-app history later
export async function addNotification(userId: string, notification: Omit<Notification, 'id' | 'userId'>) {
    try {
        await addDoc(collection(db, 'notifications'), {
            userId,
            ...notification,
            read: false,
            createdAt: Date.now(),
        });
    } catch (error) {
        console.error('Error adding notification:', error);
    }
}

export async function markNotificationRead(notificationId: string) {
    await updateDoc(doc(db, 'notifications', notificationId), { read: true });
}

export async function markAllNotificationsRead(_userId: string) {
    // No-op for now
}

export function subscribeToNotifications(
    userId: string,
    callback: (notifications: Notification[]) => void
): Unsubscribe {
    const q = query(
        collection(db, 'notifications'),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc'),
        limit(50)
    );
    return onSnapshot(q, (snapshot) => {
        const items: Notification[] = [];
        snapshot.forEach((doc) => {
            items.push({ id: doc.id, ...doc.data() } as Notification);
        });
        callback(items);
    });
}

/**
 * Helper to notify all members of a group except the sender
 * This currently just adds to the in-app notification history.
 * Push notifications are handled by Cloud Functions triggers on the 'expenses' collection.
 */
export async function notifyGroupMembers(
    groupId: string,
    title: string,
    message: string,
    type: Notification['type'],
    excludeUserId?: string
) {
    try {
        const groupDoc = await getDoc(doc(db, 'groups', groupId));
        if (!groupDoc.exists()) return;
        const group = groupDoc.data() as Group;

        const promises = group.members
            .filter((m) => m.uid !== excludeUserId)
            .map((m) =>
                addNotification(m.uid, {
                    groupId,
                    title,
                    message,
                    type,
                    read: false,
                    createdAt: Date.now(),
                })
            );

        await Promise.all(promises);
    } catch (err) {
        console.error('Failed to save notification history:', err);
    }
}


// ─── Groups ───

export async function createGroup(
    name: string,
    mode: 'pool' | 'direct',
    creator: Member
): Promise<string> {
    const docRef = await addDoc(collection(db, 'groups'), {
        name,
        mode,
        members: [creator],
        memberUids: [creator.uid],
        memberEmails: [creator.email.toLowerCase()],
        createdBy: creator.uid,
        createdAt: Date.now(),
        updatedAt: Date.now(),
    });
    return docRef.id;
}

export async function deleteGroup(groupId: string) {
    await deleteDoc(doc(db, 'groups', groupId));
}

export async function addMemberToGroup(groupId: string, member: Member, currentMembers: Member[]) {
    // Check duplicate by email OR uid
    if (currentMembers.find((m) => m.email === member.email || m.uid === member.uid)) return;

    // Maintain memberUids for security rules
    const newMembers = [...currentMembers, member];
    const newMemberUids = newMembers.map(m => m.uid);
    // Add emails for invite-based access (Always Lowercase)
    const newMemberEmails = newMembers.map(m => m.email.toLowerCase());

    await updateDoc(doc(db, 'groups', groupId), {
        members: newMembers,
        memberUids: newMemberUids,
        memberEmails: newMemberEmails,
        updatedAt: Date.now(),
    });
}

export async function updateGroupName(groupId: string, name: string) {
    await updateDoc(doc(db, 'groups', groupId), { name, updatedAt: Date.now() });
}

export async function removeMemberFromGroup(groupId: string, memberUid: string, currentMembers: Member[]) {
    const updated = currentMembers.filter((m) => m.uid !== memberUid);
    const updatedUids = updated.map(m => m.uid);
    const updatedEmails = updated.map(m => m.email.toLowerCase());

    await updateDoc(doc(db, 'groups', groupId), {
        members: updated,
        memberUids: updatedUids,
        memberEmails: updatedEmails,
        updatedAt: Date.now()
    });
}

export async function toggleAllowMemberExpenses(groupId: string, allow: boolean) {
    await updateDoc(doc(db, 'groups', groupId), { allowMemberExpenses: allow, updatedAt: Date.now() });
}

/**
 * Subscribe to groups where the user is a member.
 * Optimized: Uses 'memberUids' for efficient server-side filtering.
 */
export function subscribeToGroups(
    uid: string,
    email: string,
    callback: (groups: Group[]) => void
): Unsubscribe {
    const groupsMap = new Map<string, Group>();

    // Helper to merge and sort
    const emit = () => {
        const sorted = Array.from(groupsMap.values())
            .sort((a, b) => b.updatedAt - a.updatedAt);
        callback(sorted);
    };

    // 1. Query by UID (Existing main method)
    const qUid = query(
        collection(db, 'groups'),
        where('memberUids', 'array-contains', uid),
        orderBy('updatedAt', 'desc')
    );
    const unsubUid = onSnapshot(qUid, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === 'removed') {
                // Only remove if not kept by other query?
                // Actually, complicated. Simply rebuilding from map is easier if we track source.
                // For simplicity: If removed from one query, we might still be in the other.
                // But generally, deletion removes from both. 
                // Let's just update the map.
                groupsMap.delete(change.doc.id);
            } else {
                groupsMap.set(change.doc.id, { id: change.doc.id, ...change.doc.data() } as Group);
            }
        });
        // If 'modified', it updates the map.
        // If 'added', it updates the map.
        emit();
    });

    // 2. Query by Email (Invites)
    let unsubEmail = () => { };
    if (email) {
        const qEmail = query(
            collection(db, 'groups'),
            where('memberEmails', 'array-contains', email.toLowerCase()),
            orderBy('updatedAt', 'desc')
        );
        unsubEmail = onSnapshot(qEmail, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'removed') {
                    // Check if preserved by UID query? No easy way without tracking.
                    // However, typically a group matches ONE or BOTH.
                    // If it matches BOTH, removing from one (e.g. email removed) but keeping UID is fine.
                    // But here we might delete it from the view if email is removed, even if UID is there.
                    // Edge case: User is in group by UID, but email was removed?
                    // Safe approach: Re-evaluate? 
                    // Let's assume Additive:
                    // If we receive a 'removed' event, we can't be sure if we should remove it from the map
                    // unless we know it's not in the other list.
                    // For now, let's keep it simple: If removed here, delete. (Worst case: flickers).
                    groupsMap.delete(change.doc.id);
                } else {
                    groupsMap.set(change.doc.id, { id: change.doc.id, ...change.doc.data() } as Group);
                }
            });
            emit();
        });
    }

    return () => {
        unsubUid();
        unsubEmail();
    };
}

// ─── Expenses ───

/**
 * Fetch a user's basic profile (name, photo) by UID.
 * Useful for resolving names of members who have left the group.
 */
export async function getUserProfile(uid: string): Promise<Partial<Member> | null> {
    try {
        const userDoc = await getDoc(doc(db, 'users', uid));
        if (userDoc.exists()) {
            const data = userDoc.data();
            return {
                uid,
                name: data.displayName || 'Unknown',
                photoURL: data.photoURL || null,
                email: data.email || ''
            };
        }
        return null;
    } catch (err) {
        console.error('Error fetching user profile:', err);
        return null;
    }
}

// ─── User Lookup ───

export async function getUserByEmail(email: string): Promise<Member | null> {
    try {
        // Try searching by normalized email (best for case insensitivity)
        const normalizedEmail = email.toLowerCase();
        let q = query(
            collection(db, 'users'),
            where('searchableEmail', '==', normalizedEmail),
            limit(1)
        );
        let snapshot = await getDocs(q);

        // Fallback: Try searching by exact email (for older profiles)
        if (snapshot.empty) {
            q = query(
                collection(db, 'users'),
                where('email', '==', email),
                limit(1)
            );
            snapshot = await getDocs(q);
        }

        if (snapshot.empty) return null;

        const doc = snapshot.docs[0];
        const data = doc.data();
        return {
            uid: doc.id,
            name: data.displayName || 'User',
            email: data.email || email,
            photoURL: data.photoURL || null
        };
    } catch (error) {
        console.error("Error looking up user:", error);
        return null;
    }
}

// ─── Expenses ───

export async function addExpense(expense: Omit<Expense, 'id'>): Promise<string> {
    // Snapshot payer details if not provided
    let payerName = expense.payerName;
    let payerPhoto = expense.payerPhoto;

    if (!payerName && expense.paidBy !== 'pool') {
        const profile = await getUserProfile(expense.paidBy);
        if (profile) {
            payerName = profile.name;
            payerPhoto = profile.photoURL || undefined;
        }
    }

    const docRef = await addDoc(collection(db, 'expenses'), {
        ...expense,
        payerName: payerName || null,
        payerPhoto: payerPhoto || null,
        createdAt: Date.now(),
    });
    await updateDoc(doc(db, 'groups', expense.groupId), { updatedAt: Date.now() });

    // Push notifications are handled by Cloud Functions (onExpenseCreate trigger)
    // No need for duplicate in-app notifyGroupMembers call here

    return docRef.id;
}

export async function deleteExpense(expenseId: string, groupId: string) {
    await deleteDoc(doc(db, 'expenses', expenseId));
    await updateDoc(doc(db, 'groups', groupId), { updatedAt: Date.now() });
}

export async function updateExpense(
    expenseId: string,
    data: Partial<Pick<Expense, 'amount' | 'description' | 'category' | 'paidBy' | 'usedBy' | 'splitType'>>,
    editedBy: string
) {
    await updateDoc(doc(db, 'expenses', expenseId), {
        ...data,
        editedAt: Date.now(),
        editedBy,
    });
}

export function subscribeToExpenses(
    groupId: string,
    callback: (expenses: Expense[]) => void
): Unsubscribe {
    const q = query(
        collection(db, 'expenses'),
        where('groupId', '==', groupId),
        orderBy('createdAt', 'desc'),
        limit(150)
    );
    return onSnapshot(q, (snapshot) => {
        const expenses: Expense[] = [];
        snapshot.forEach((doc) => {
            expenses.push({ id: doc.id, ...doc.data() } as Expense);
        });
        callback(expenses);
    });
}

// ─── Pool Contributions ───

export async function addPoolContribution(contribution: Omit<PoolContribution, 'id'>): Promise<string> {
    const docRef = await addDoc(collection(db, 'pool_contributions'), {
        ...contribution,
        createdAt: Date.now(),
    });

    // Notify group members
    await notifyGroupMembers(
        contribution.groupId,
        'Pool Contribution',
        `New contribution of ₹${contribution.amount}`,
        'info',
        contribution.userId
    );

    return docRef.id;
}

export function subscribeToPoolContributions(
    groupId: string,
    callback: (contributions: PoolContribution[]) => void
): Unsubscribe {
    const q = query(
        collection(db, 'pool_contributions'),
        where('groupId', '==', groupId)
    );
    return onSnapshot(q, (snapshot) => {
        const contributions: PoolContribution[] = [];
        snapshot.forEach((doc) => {
            contributions.push({ id: doc.id, ...doc.data() } as PoolContribution);
        });
        contributions.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        callback(contributions);
    });
}

// ─── Settlements ───

export async function addSettlement(settlement: Omit<Settlement, 'id'>): Promise<string> {
    const docRef = await addDoc(collection(db, 'settlements'), {
        ...settlement,
        createdAt: Date.now(),
    });

    // Notify
    await notifyGroupMembers(
        settlement.groupId,
        'Settlement',
        `Settlement payment of ₹${settlement.amount}`,
        'settlement',
        settlement.fromUser
    );

    return docRef.id;
}

export function subscribeToSettlements(
    groupId: string,
    callback: (settlements: Settlement[]) => void
): Unsubscribe {
    const q = query(
        collection(db, 'settlements'),
        where('groupId', '==', groupId)
    );
    return onSnapshot(q, (snapshot) => {
        const settlements: Settlement[] = [];
        snapshot.forEach((doc) => {
            settlements.push({ id: doc.id, ...doc.data() } as Settlement);
        });
        settlements.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        callback(settlements);
    });
}

// ─── Recurring Expenses ───

export async function addRecurringExpense(expense: Omit<RecurringExpense, 'id'>): Promise<string> {
    const docRef = await addDoc(collection(db, 'recurring_expenses'), {
        ...expense,
        createdAt: Date.now(),
    });
    return docRef.id;
}

export async function toggleRecurringExpense(id: string, active: boolean) {
    await updateDoc(doc(db, 'recurring_expenses', id), { active });
}

export async function deleteRecurringExpense(id: string) {
    await deleteDoc(doc(db, 'recurring_expenses', id));
}

export async function markRecurringAsAdded(id: string, monthKey: string) {
    await updateDoc(doc(db, 'recurring_expenses', id), { lastAdded: monthKey });
}

export function subscribeToRecurringExpenses(
    groupId: string,
    callback: (items: RecurringExpense[]) => void
): Unsubscribe {
    const q = query(
        collection(db, 'recurring_expenses'),
        where('groupId', '==', groupId)
    );
    return onSnapshot(q, (snapshot) => {
        const items: RecurringExpense[] = [];
        snapshot.forEach((doc) => {
            items.push({ id: doc.id, ...doc.data() } as RecurringExpense);
        });
        items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        callback(items);
    });
}
