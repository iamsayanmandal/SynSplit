import {
    collection,
    doc,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    orderBy,
    where,
    onSnapshot,
    type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Group, Expense, PoolContribution, Settlement, Member, RecurringExpense } from '../types';

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
    await updateDoc(doc(db, 'groups', groupId), {
        members: [...currentMembers, member],
        updatedAt: Date.now(),
    });
}

export async function updateGroupName(groupId: string, name: string) {
    await updateDoc(doc(db, 'groups', groupId), { name, updatedAt: Date.now() });
}

export async function removeMemberFromGroup(groupId: string, memberUid: string, currentMembers: Member[]) {
    const updated = currentMembers.filter((m) => m.uid !== memberUid);
    await updateDoc(doc(db, 'groups', groupId), { members: updated, updatedAt: Date.now() });
}

export async function toggleAllowMemberExpenses(groupId: string, allow: boolean) {
    await updateDoc(doc(db, 'groups', groupId), { allowMemberExpenses: allow, updatedAt: Date.now() });
}

/**
 * Subscribe to groups where the user is a member.
 * Matches by uid OR email (handles pre-added members who haven't logged in yet).
 * When a match is found by email but uid differs, auto-migrates the member record.
 */
export function subscribeToGroups(
    uid: string,
    email: string,
    callback: (groups: Group[]) => void
): Unsubscribe {
    const q = query(collection(db, 'groups'), orderBy('updatedAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
        const groups: Group[] = [];
        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const members: Member[] = data.members || [];
            const isMember = members.some(
                (m) => m.uid === uid || (m.email && m.email.toLowerCase() === email.toLowerCase())
            );
            if (isMember) {
                groups.push({ id: docSnap.id, ...data } as Group);
            }
        });
        callback(groups);
    });
}

/**
 * When user logs in, update their member records in all groups to use their real Firebase UID.
 * This handles the case where admin added them by email before they signed up.
 */
export async function migrateUserInGroups(user: { uid: string; email: string; displayName: string; photoURL?: string }) {
    const q = query(collection(db, 'groups'), orderBy('updatedAt', 'desc'));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
        for (const docSnap of snapshot.docs) {
            const data = docSnap.data();
            const members: Member[] = data.members || [];
            let needsUpdate = false;
            const updatedMembers = members.map((m) => {
                // Match by email but UID doesn't match — needs migration
                if (m.email && m.email.toLowerCase() === user.email.toLowerCase() && m.uid !== user.uid) {
                    needsUpdate = true;
                    return {
                        ...m,
                        uid: user.uid,
                        name: user.displayName || m.name,
                        photoURL: user.photoURL || m.photoURL,
                    };
                }
                // Match by UID — update name/photo if changed
                if (m.uid === user.uid && (!m.photoURL || m.name !== user.displayName)) {
                    needsUpdate = true;
                    return {
                        ...m,
                        name: user.displayName || m.name,
                        photoURL: user.photoURL || m.photoURL,
                    };
                }
                return m;
            });
            if (needsUpdate) {
                await updateDoc(doc(db, 'groups', docSnap.id), { members: updatedMembers });
            }
        }
        // One-time migration — unsubscribe after processing
        unsubscribe();
    });
}

// ─── Expenses ───

export async function addExpense(expense: Omit<Expense, 'id'>): Promise<string> {
    const docRef = await addDoc(collection(db, 'expenses'), {
        ...expense,
        createdAt: Date.now(),
    });
    await updateDoc(doc(db, 'groups', expense.groupId), { updatedAt: Date.now() });
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
        where('groupId', '==', groupId)
    );
    return onSnapshot(q, (snapshot) => {
        const expenses: Expense[] = [];
        snapshot.forEach((doc) => {
            expenses.push({ id: doc.id, ...doc.data() } as Expense);
        });
        expenses.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        callback(expenses);
    });
}

// ─── Pool Contributions ───

export async function addPoolContribution(contribution: Omit<PoolContribution, 'id'>): Promise<string> {
    const docRef = await addDoc(collection(db, 'pool_contributions'), {
        ...contribution,
        createdAt: Date.now(),
    });
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
