import { createContext, useContext, type ReactNode } from 'react';
import { useActiveGroup } from './ActiveGroupContext';
import { useGroups, useExpenses, usePoolContributions, useSettlements, useBalances } from '../hooks/hooks';
import type { Group, Expense, PoolContribution, Settlement, BalanceSummary, Debt } from '../types';

interface GroupDataContextType {
    groups: Group[];
    groupsLoading: boolean;
    activeGroup: Group | null;
    expenses: Expense[];
    expensesLoading: boolean;
    contributions: PoolContribution[];
    contributionsLoading: boolean;
    settlements: Settlement[];
    settlementsLoading: boolean;
    balances: BalanceSummary[];
    debts: Debt[];
}

const GroupDataContext = createContext<GroupDataContextType>({
    groups: [],
    groupsLoading: true,
    activeGroup: null,
    expenses: [],
    expensesLoading: true,
    contributions: [],
    contributionsLoading: true,
    settlements: [],
    settlementsLoading: true,
    balances: [],
    debts: [],
});

/**
 * Provides shared group data (expenses, contributions, settlements, balances)
 * to all child components via a single set of Firestore listeners.
 * Eliminates duplicate subscriptions from SynBot, Dashboard, Expenses, etc.
 */
export function GroupDataProvider({ children }: { children: ReactNode }) {
    const { activeGroupId } = useActiveGroup();
    const { groups, loading: groupsLoading } = useGroups();

    const activeGroup = groups.find((g) => g.id === activeGroupId) || null;

    const { expenses, loading: expensesLoading } = useExpenses(activeGroupId || undefined);
    const { contributions, loading: contributionsLoading } = usePoolContributions(activeGroupId || undefined);
    const { settlements, loading: settlementsLoading } = useSettlements(activeGroupId || undefined);
    const { balances, debts } = useBalances(activeGroup, expenses, contributions, settlements);

    return (
        <GroupDataContext.Provider value={{
            groups,
            groupsLoading,
            activeGroup,
            expenses,
            expensesLoading,
            contributions,
            contributionsLoading,
            settlements,
            settlementsLoading,
            balances,
            debts,
        }}>
            {children}
        </GroupDataContext.Provider>
    );
}

export function useGroupData() {
    return useContext(GroupDataContext);
}
