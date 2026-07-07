import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
    subscribeToGroups,
    subscribeToExpenses,
    subscribeToPoolContributions,
    subscribeToSettlements,
    subscribeToRecurringExpenses,
} from '../lib/firestore';
import { calculateNetBalances, calculateDebts } from '../lib/splitCalculator';
import type { Group, Expense, PoolContribution, Settlement, BalanceSummary, Debt, RecurringExpense } from '../types';

// ─── useGroups ───

export function useGroups() {
    const { user } = useAuth();
    const [groups, setGroups] = useState<Group[]>([]);
    const [loading, setLoading] = useState(true);
    const [hasPendingWrites, setHasPendingWrites] = useState(false);

    useEffect(() => {
        if (!user) {
            setGroups([]);
            setLoading(false);
            setHasPendingWrites(false);
            return;
        }
        setLoading(true);

        const unsubscribe = subscribeToGroups(user.uid, user.email || '', (groups, metadata) => {
            setGroups(groups);
            setLoading(false);
            if (metadata) {
                setHasPendingWrites(metadata.hasPendingWrites);
            }
        });
        return unsubscribe;
    }, [user]);

    return { groups, loading, hasPendingWrites };
}

// ─── useExpenses ───

export function useExpenses(groupId: string | undefined) {
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [loading, setLoading] = useState(true);
    const [hasPendingWrites, setHasPendingWrites] = useState(false);

    useEffect(() => {
        if (!groupId) {
            setExpenses([]);
            setLoading(false);
            setHasPendingWrites(false);
            return;
        }
        setLoading(true);
        const unsubscribe = subscribeToExpenses(groupId, (expenses, metadata) => {
            setExpenses(expenses);
            setLoading(false);
            if (metadata) {
                setHasPendingWrites(metadata.hasPendingWrites);
            }
        });
        return unsubscribe;
    }, [groupId]);

    return { expenses, loading, hasPendingWrites };
}

// ─── usePoolContributions ───

export function usePoolContributions(groupId: string | undefined) {
    const [contributions, setContributions] = useState<PoolContribution[]>([]);
    const [loading, setLoading] = useState(true);
    const [hasPendingWrites, setHasPendingWrites] = useState(false);

    useEffect(() => {
        if (!groupId) {
            setContributions([]);
            setLoading(false);
            setHasPendingWrites(false);
            return;
        }
        setLoading(true);
        const unsubscribe = subscribeToPoolContributions(groupId, (contributions, metadata) => {
            setContributions(contributions);
            setLoading(false);
            if (metadata) {
                setHasPendingWrites(metadata.hasPendingWrites);
            }
        });
        return unsubscribe;
    }, [groupId]);

    return { contributions, loading, hasPendingWrites };
}

// ─── useSettlements ───

export function useSettlements(groupId: string | undefined) {
    const [settlements, setSettlements] = useState<Settlement[]>([]);
    const [loading, setLoading] = useState(true);
    const [hasPendingWrites, setHasPendingWrites] = useState(false);

    useEffect(() => {
        if (!groupId) {
            setSettlements([]);
            setLoading(false);
            setHasPendingWrites(false);
            return;
        }
        setLoading(true);
        const unsubscribe = subscribeToSettlements(groupId, (settlements, metadata) => {
            setSettlements(settlements);
            setLoading(false);
            if (metadata) {
                setHasPendingWrites(metadata.hasPendingWrites);
            }
        });
        return unsubscribe;
    }, [groupId]);

    return { settlements, loading, hasPendingWrites };
}

// ─── useBalances (derived — no extra re-renders) ───

export function useBalances(
    group: Group | null,
    expenses: Expense[],
    contributions: PoolContribution[],
    settlements: Settlement[]
): { balances: BalanceSummary[]; debts: Debt[] } {
    return useMemo(() => {
        if (!group) return { balances: [], debts: [] };
        const balances = calculateNetBalances(expenses, contributions, settlements, group.members);
        const debts = calculateDebts(balances);
        return { balances, debts };
    }, [group, expenses, contributions, settlements]);
}

// ─── useRecurringExpenses ───

export function useRecurringExpenses(groupId: string | undefined) {
    const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!groupId) {
            setRecurringExpenses([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        const unsubscribe = subscribeToRecurringExpenses(groupId, (items) => {
            setRecurringExpenses(items);
            setLoading(false);
        });
        return unsubscribe;
    }, [groupId]);

    return { recurringExpenses, loading };
}
