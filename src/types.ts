// ─── Enums & Literals ───

export type SplitType = 'equal' | 'unequal' | 'percentage' | 'share';
export type ExpenseMode = 'pool' | 'direct';
export type ExpenseCategory =
    | 'food'
    | 'rent'
    | 'gas'
    | 'internet'
    | 'travel'
    | 'groceries'
    | 'entertainment'
    | 'utilities'
    | 'others';

export const CATEGORY_META: Record<ExpenseCategory, { label: string; emoji: string; color: string }> = {
    food: { label: 'Food', emoji: '🍕', color: '#f97316' },
    rent: { label: 'Rent', emoji: '🏠', color: '#6366f1' },
    gas: { label: 'Gas', emoji: '⛽', color: '#eab308' },
    internet: { label: 'Internet', emoji: '📶', color: '#3b82f6' },
    travel: { label: 'Travel', emoji: '✈️', color: '#8b5cf6' },
    groceries: { label: 'Groceries', emoji: '🛒', color: '#10b981' },
    entertainment: { label: 'Entertainment', emoji: '🎬', color: '#ec4899' },
    utilities: { label: 'Utilities', emoji: '💡', color: '#14b8a6' },
    others: { label: 'Others', emoji: '📦', color: '#64748b' },
};

// ─── Core Interfaces ───

export interface Member {
    uid: string;
    name: string;
    email: string;
    photoURL?: string;
}

export interface Group {
    id: string;
    name: string;
    members: Member[];
    createdBy: string;
    createdAt: number;
    updatedAt: number;
    /** Pool mode or direct mode — can change anytime */
    mode: ExpenseMode;
    /** Pool mode: whether non-admin members can add expenses (default: false) */
    allowMemberExpenses?: boolean;
}

export interface Expense {
    id: string;
    groupId: string;
    amount: number;
    description: string;
    category: ExpenseCategory;
    mode: ExpenseMode;
    paidBy: string;          // uid of who paid
    /** UIDs of members who share this expense */
    usedBy: string[];
    splitType: SplitType;
    /** Custom split data — keys are uid, values depend on splitType */
    splitDetails?: Record<string, number>;
    createdAt: number;
    createdBy: string;
    editedAt?: number;
    editedBy?: string;
}

export interface PoolContribution {
    id: string;
    groupId: string;
    userId: string;
    amount: number;
    month: string;          // "2026-02" format
    createdAt: number;
}

export interface Settlement {
    id: string;
    groupId: string;
    fromUser: string;       // uid — who pays
    toUser: string;         // uid — who receives
    amount: number;
    createdAt: number;
}

export interface Debt {
    from: string;
    to: string;
    amount: number;
}

export interface BalanceSummary {
    uid: string;
    name: string;
    photoURL?: string;
    totalPaid: number;
    totalUsed: number;
    netBalance: number;     // positive = gets back, negative = owes
}

export interface RecurringExpense {
    id: string;
    groupId: string;
    amount: number;
    description: string;
    category: ExpenseCategory;
    /** Day of month to auto-add (1-28) */
    dayOfMonth: number;
    /** UIDs of members who share this expense */
    usedBy: string[];
    createdBy: string;
    createdAt: number;
    /** Whether this recurring expense is active */
    active: boolean;
    /** Last time this was auto-added (month string like "2026-02") */
    lastAdded?: string;
}
