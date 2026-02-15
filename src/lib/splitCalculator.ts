import type { SplitType, Debt, BalanceSummary, Expense, PoolContribution, Member, Settlement } from '../types';

// ─── Split Calculators ───

/**
 * Calculate how much each member owes for an expense.
 * Returns a map of uid → amount owed.
 */
export function calculateSplit(
    amount: number,
    splitType: SplitType,
    members: string[],
    splitDetails?: Record<string, number>
): Record<string, number> {
    switch (splitType) {
        case 'equal':
            return calculateEqualSplit(amount, members);
        case 'unequal':
            return splitDetails ?? {};
        case 'percentage':
            return calculatePercentageSplit(amount, splitDetails ?? {});
        case 'share':
            return calculateShareSplit(amount, splitDetails ?? {});
        default:
            return calculateEqualSplit(amount, members);
    }
}

function calculateEqualSplit(amount: number, members: string[]): Record<string, number> {
    if (members.length === 0) return {};
    const share = Math.round((amount / members.length) * 100) / 100;
    const result: Record<string, number> = {};
    members.forEach((uid) => {
        result[uid] = share;
    });
    // Adjust rounding difference to first member
    const diff = amount - share * members.length;
    if (diff !== 0) {
        result[members[0]] = Math.round((result[members[0]] + diff) * 100) / 100;
    }
    return result;
}

function calculatePercentageSplit(
    amount: number,
    percentages: Record<string, number>
): Record<string, number> {
    const result: Record<string, number> = {};
    for (const [uid, pct] of Object.entries(percentages)) {
        result[uid] = Math.round((amount * pct) / 100 * 100) / 100;
    }
    return result;
}

function calculateShareSplit(
    amount: number,
    shares: Record<string, number>
): Record<string, number> {
    const totalShares = Object.values(shares).reduce((a, b) => a + b, 0);
    if (totalShares === 0) return {};
    const result: Record<string, number> = {};
    for (const [uid, share] of Object.entries(shares)) {
        result[uid] = Math.round((amount * share) / totalShares * 100) / 100;
    }
    return result;
}

// ─── Debt Calculation ───

/**
 * Calculate net balances from expenses, contributions and settlements.
 */
export function calculateNetBalances(
    expenses: Expense[],
    contributions: PoolContribution[],
    settlements: Settlement[],
    members: Member[]
): BalanceSummary[] {
    const paid: Record<string, number> = {};
    const used: Record<string, number> = {};

    // Initialize
    members.forEach((m) => {
        paid[m.uid] = 0;
        used[m.uid] = 0;
    });

    // Process expenses
    expenses.forEach((exp) => {
        paid[exp.paidBy] = (paid[exp.paidBy] || 0) + exp.amount;

        const splitAmounts = calculateSplit(exp.amount, exp.splitType, exp.usedBy, exp.splitDetails);
        for (const [uid, amount] of Object.entries(splitAmounts)) {
            used[uid] = (used[uid] || 0) + amount;
        }
    });

    // Process pool contributions (counts as "paid")
    contributions.forEach((c) => {
        paid[c.userId] = (paid[c.userId] || 0) + c.amount;
    });

    // Process settlements
    settlements.forEach((s) => {
        paid[s.fromUser] = (paid[s.fromUser] || 0) + s.amount;
        used[s.toUser] = (used[s.toUser] || 0) + s.amount;
    });

    return members.map((m) => ({
        uid: m.uid,
        name: m.name,
        photoURL: m.photoURL,
        totalPaid: Math.round((paid[m.uid] || 0) * 100) / 100,
        totalUsed: Math.round((used[m.uid] || 0) * 100) / 100,
        netBalance: Math.round(((paid[m.uid] || 0) - (used[m.uid] || 0)) * 100) / 100,
    }));
}

/**
 * Calculate simplified debts from net balances.
 * Uses greedy algorithm matching largest debtor with largest creditor.
 */
export function calculateDebts(balances: BalanceSummary[]): Debt[] {
    const debtors = balances
        .filter((b) => b.netBalance < -0.01)
        .map((b) => ({ uid: b.uid, amount: Math.abs(b.netBalance) }))
        .sort((a, b) => b.amount - a.amount);

    const creditors = balances
        .filter((b) => b.netBalance > 0.01)
        .map((b) => ({ uid: b.uid, amount: b.netBalance }))
        .sort((a, b) => b.amount - a.amount);

    const debts: Debt[] = [];
    let i = 0;
    let j = 0;

    while (i < debtors.length && j < creditors.length) {
        const amount = Math.min(debtors[i].amount, creditors[j].amount);
        if (amount > 0.01) {
            debts.push({
                from: debtors[i].uid,
                to: creditors[j].uid,
                amount: Math.round(amount * 100) / 100,
            });
        }
        debtors[i].amount -= amount;
        creditors[j].amount -= amount;
        if (debtors[i].amount < 0.01) i++;
        if (creditors[j].amount < 0.01) j++;
    }

    return debts;
}
