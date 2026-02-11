import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
    subscribeToGroups,
    subscribeToExpenses,
    subscribeToPoolContributions,
    subscribeToSettlements,
    migrateUserInGroups,
} from '../lib/firestore';
import { calculateNetBalances, calculateDebts } from '../lib/splitCalculator';
import type { Group, Expense, PoolContribution, Settlement, BalanceSummary, Debt } from '../types';

// ─── useGroups ───

export function useGroups() {
    const { user } = useAuth();
    const [groups, setGroups] = useState<Group[]>([]);
    const [loading, setLoading] = useState(true);
    const migratedRef = useRef(false);

    useEffect(() => {
        if (!user) {
            setGroups([]);
            setLoading(false);
            migratedRef.current = false;
            return;
        }
        setLoading(true);

        // One-time migration: update pre-added member records with real Firebase UID
        if (!migratedRef.current) {
            migratedRef.current = true;
            migrateUserInGroups({
                uid: user.uid,
                email: user.email || '',
                displayName: user.displayName || '',
                photoURL: user.photoURL || undefined,
            });
        }

        const unsubscribe = subscribeToGroups(user.uid, user.email || '', (groups) => {
            setGroups(groups);
            setLoading(false);
        });
        return unsubscribe;
    }, [user]);

    return { groups, loading };
}

// ─── useExpenses ───

export function useExpenses(groupId: string | undefined) {
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!groupId) {
            setExpenses([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        const unsubscribe = subscribeToExpenses(groupId, (expenses) => {
            setExpenses(expenses);
            setLoading(false);
        });
        return unsubscribe;
    }, [groupId]);

    return { expenses, loading };
}

// ─── usePoolContributions ───

export function usePoolContributions(groupId: string | undefined) {
    const [contributions, setContributions] = useState<PoolContribution[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!groupId) {
            setContributions([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        const unsubscribe = subscribeToPoolContributions(groupId, (contributions) => {
            setContributions(contributions);
            setLoading(false);
        });
        return unsubscribe;
    }, [groupId]);

    return { contributions, loading };
}

// ─── useSettlements ───

export function useSettlements(groupId: string | undefined) {
    const [settlements, setSettlements] = useState<Settlement[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!groupId) {
            setSettlements([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        const unsubscribe = subscribeToSettlements(groupId, (settlements) => {
            setSettlements(settlements);
            setLoading(false);
        });
        return unsubscribe;
    }, [groupId]);

    return { settlements, loading };
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
