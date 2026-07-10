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
    | 'room_rent'
    | 'breakfast'
    | 'lunch'
    | 'dinner'
    | 'tea'
    | 'snack'
    | 'auto'
    | 'car_rent'
    | 'cab'
    | 'others'
    | (string & {});

import { Pizza, Home, Fuel, Wifi, Plane, ShoppingCart, Film, Lightbulb, Package, Coffee, Utensils, Car, Tag } from 'lucide-react';

export const CATEGORY_META: Record<string, { label: string; icon: React.ComponentType<any>; color: string }> = {
    food: { label: 'Food', icon: Pizza, color: '#f97316' },
    rent: { label: 'Rent', icon: Home, color: '#6366f1' },
    gas: { label: 'Gas', icon: Fuel, color: '#eab308' },
    internet: { label: 'Internet', icon: Wifi, color: '#3b82f6' },
    travel: { label: 'Travel', icon: Plane, color: '#8b5cf6' },
    groceries: { label: 'Groceries', icon: ShoppingCart, color: '#10b981' },
    entertainment: { label: 'Entertainment', icon: Film, color: '#ec4899' },
    utilities: { label: 'Utilities', icon: Lightbulb, color: '#14b8a6' },
    room_rent: { label: 'Room Rent', icon: Home, color: '#818cf8' },
    breakfast: { label: 'Breakfast', icon: Coffee, color: '#fb923c' },
    lunch: { label: 'Lunch', icon: Utensils, color: '#ef4444' },
    dinner: { label: 'Dinner', icon: Utensils, color: '#be123c' },
    tea: { label: 'Tea', icon: Coffee, color: '#d97706' },
    snack: { label: 'Snack', icon: Pizza, color: '#f59e0b' },
    auto: { label: 'Auto', icon: Car, color: '#10b981' },
    car_rent: { label: 'Car Rent', icon: Car, color: '#059669' },
    cab: { label: 'CAB', icon: Car, color: '#34d399' },
    others: { label: 'Others', icon: Package, color: '#64748b' },
};

export function getCategoryMeta(cat: string) {
    if (cat in CATEGORY_META) return CATEGORY_META[cat];
    return { label: cat, icon: Tag, color: '#94a3b8' };
}

// ─── Core Interfaces ───

export interface Member {
    uid: string;
    name: string;
    email: string;
    photoURL?: string | null;
}

export interface Group {
    id: string;
    name: string;
    members: Member[];
    /** Array of UIDs for security rules (faster lookup) */
    memberUids: string[];
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
    /** Optional GPS coordinates captured at time of expense */
    location?: { lat: number; lng: number };
    createdAt: number;
    createdBy: string;
    editedAt?: number;
    editedBy?: string;
    /** Snapshot of payer details at time of expense (for removed members) */
    payerName?: string;
    payerPhoto?: string;
}

export interface PoolContribution {
    id: string;
    groupId: string;
    userId: string;
    amount: number;
    month: string;          // "2026-02" format
    createdBy?: string;
    createdAt: number;
}

export interface Settlement {
    id: string;
    groupId: string;
    fromUser: string;       // uid — who pays
    toUser: string;         // uid — who receives
    amount: number;
    createdBy?: string;
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
    photoURL?: string | null;
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

export interface Notification {
    id: string;
    userId: string;
    groupId?: string;
    title: string;
    message: string;
    type: 'expense' | 'settlement' | 'info' | 'warning';
    read: boolean;
    createdAt: number;
    link?: string;
}
