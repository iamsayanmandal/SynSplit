import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart3, Calendar, Repeat, TrendingUp, TrendingDown, Plus, Trash2, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useActiveGroup } from '../contexts/ActiveGroupContext';
import { useGroups, useExpenses, usePoolContributions, useRecurringExpenses } from '../hooks/hooks';
import { addRecurringExpense, deleteRecurringExpense, toggleRecurringExpense, addExpense, markRecurringAsAdded } from '../lib/firestore';
import { CATEGORY_META } from '../types';
import type { ExpenseCategory, SplitType } from '../types';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths } from 'date-fns';

type Tab = 'stats' | 'calendar' | 'recurring';

export default function Analytics() {
    const { user } = useAuth();
    const { groups } = useGroups();
    const { activeGroupId } = useActiveGroup();
    const activeGroup = groups.find((g) => g.id === activeGroupId) || null;
    const { expenses } = useExpenses(activeGroupId || undefined);
    const { contributions } = usePoolContributions(activeGroupId || undefined);
    const { recurringExpenses } = useRecurringExpenses(activeGroupId || undefined);

    const [tab, setTab] = useState<Tab>('stats');
    const [calMonth, setCalMonth] = useState(new Date());

    // ─── Recurring add modal state ───
    const [showAddRecurring, setShowAddRecurring] = useState(false);
    const [recAmount, setRecAmount] = useState('');
    const [recDesc, setRecDesc] = useState('');
    const [recCategory, setRecCategory] = useState<ExpenseCategory>('utilities');
    const [recDay, setRecDay] = useState('1');
    const [recSaving, setRecSaving] = useState(false);
    const [deletingRecurring, setDeletingRecurring] = useState<string | null>(null);

    const categories = Object.entries(CATEGORY_META) as [ExpenseCategory, typeof CATEGORY_META[ExpenseCategory]][];

    // ─── STATS ───
    const totalSpend = expenses.reduce((s, e) => s + e.amount, 0);
    const totalContributions = contributions.reduce((s, c) => s + c.amount, 0);

    const categoryBreakdown = useMemo(() => {
        const map: Record<string, number> = {};
        expenses.forEach((e) => {
            map[e.category] = (map[e.category] || 0) + e.amount;
        });
        return Object.entries(map)
            .sort(([, a], [, b]) => b - a)
            .map(([cat, amount]) => ({
                category: cat as ExpenseCategory,
                amount,
                percent: totalSpend > 0 ? (amount / totalSpend) * 100 : 0,
            }));
    }, [expenses, totalSpend]);

    const monthlySpend = useMemo(() => {
        const map: Record<string, number> = {};
        expenses.forEach((e) => {
            const key = format(new Date(e.createdAt), 'yyyy-MM');
            map[key] = (map[key] || 0) + e.amount;
        });
        return Object.entries(map)
            .sort(([a], [b]) => a.localeCompare(b))
            .slice(-6)
            .map(([month, amount]) => ({ month, amount, label: format(new Date(month + '-01'), 'MMM') }));
    }, [expenses]);

    const maxMonthly = Math.max(...monthlySpend.map((m) => m.amount), 1);

    const personBreakdown = useMemo(() => {
        if (!activeGroup) return [];
        const map: Record<string, number> = {};
        activeGroup.members.forEach((m) => { map[m.uid] = 0; });
        expenses.forEach((e) => {
            if (map[e.paidBy] !== undefined) map[e.paidBy] += e.amount;
        });
        return activeGroup.members
            .map((m) => ({ uid: m.uid, name: m.name, photoURL: m.photoURL, amount: map[m.uid] || 0 }))
            .sort((a, b) => b.amount - a.amount);
    }, [activeGroup, expenses]);

    // ─── CALENDAR ───
    const calDays = useMemo(() => {
        const start = startOfMonth(calMonth);
        const end = endOfMonth(calMonth);
        return eachDayOfInterval({ start, end });
    }, [calMonth]);

    const dayExpenseMap = useMemo(() => {
        const map: Record<string, number> = {};
        expenses.forEach((e) => {
            const key = format(new Date(e.createdAt), 'yyyy-MM-dd');
            map[key] = (map[key] || 0) + e.amount;
        });
        return map;
    }, [expenses]);

    const [selectedDay, setSelectedDay] = useState<Date | null>(null);
    const selectedDayExpenses = useMemo(() => {
        if (!selectedDay) return [];
        return expenses.filter((e) => isSameDay(new Date(e.createdAt), selectedDay));
    }, [expenses, selectedDay]);

    const calMonthTotal = useMemo(() => {
        return expenses
            .filter((e) => isSameMonth(new Date(e.createdAt), calMonth))
            .reduce((s, e) => s + e.amount, 0);
    }, [expenses, calMonth]);

    const maxDayExpense = Math.max(...Object.values(dayExpenseMap), 1);

    // ─── Recurring handlers ───
    const handleAddRecurring = async () => {
        if (!user || !activeGroupId || !recAmount || !recDesc) return;
        setRecSaving(true);
        await addRecurringExpense({
            groupId: activeGroupId,
            amount: parseFloat(recAmount),
            description: recDesc.trim(),
            category: recCategory,
            dayOfMonth: parseInt(recDay),
            usedBy: activeGroup?.members.map((m) => m.uid) || [],
            createdBy: user.uid,
            createdAt: Date.now(),
            active: true,
        });
        setRecAmount('');
        setRecDesc('');
        setRecCategory('utilities');
        setRecDay('1');
        setShowAddRecurring(false);
        setRecSaving(false);
    };

    const handleTriggerRecurring = async (rec: typeof recurringExpenses[0]) => {
        if (!user || !activeGroupId || !activeGroup) return;
        const monthKey = format(new Date(), 'yyyy-MM');
        const mode = activeGroup.mode;
        await addExpense({
            groupId: activeGroupId,
            amount: rec.amount,
            description: rec.description,
            category: rec.category,
            mode,
            paidBy: mode === 'pool' ? 'pool' : user.uid,
            usedBy: rec.usedBy,
            splitType: 'equal' as SplitType,
            createdAt: Date.now(),
            createdBy: user.uid,
        });
        await markRecurringAsAdded(rec.id, monthKey);
    };

    const currentMonthKey = format(new Date(), 'yyyy-MM');


    // ─── Padding days for calendar ───
    const firstDow = calDays[0]?.getDay() || 0;

    const tabs: { key: Tab; icon: typeof BarChart3; label: string }[] = [
        { key: 'stats', icon: BarChart3, label: 'Stats' },
        { key: 'calendar', icon: Calendar, label: 'Calendar' },
        { key: 'recurring', icon: Repeat, label: 'Recurring' },
    ];

    return (
        <div className="px-4 pt-6 pb-4 max-w-lg mx-auto">
            {/* Header */}
            <div className="mb-4">
                <h1 className="text-xl font-bold text-white">Analytics</h1>
                <p className="text-dark-400 text-xs mt-0.5">
                    {activeGroup ? activeGroup.name : 'No group selected'}
                </p>
            </div>

            {!activeGroup ? (
                <div className="glass-card p-8 text-center">
                    <p className="text-dark-400 text-sm">Select a group on the Home tab first</p>
                </div>
            ) : (
                <>
                    {/* Tab Switcher */}
                    <div className="flex gap-1 p-1 bg-dark-800/50 rounded-xl mb-5">
                        {tabs.map((t) => (
                            <button key={t.key} onClick={() => setTab(t.key)}
                                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all ${tab === t.key
                                    ? 'bg-accent text-white shadow-neon'
                                    : 'text-dark-400 hover:text-dark-200'
                                    }`}>
                                <t.icon className="w-3.5 h-3.5" />
                                {t.label}
                            </button>
                        ))}
                    </div>

                    <AnimatePresence mode="wait">
                        {/* ═══════════ STATS TAB ═══════════ */}
                        {tab === 'stats' && (
                            <motion.div key="stats" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}
                                className="space-y-5">

                                {/* KPI Cards */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="glass-card p-3.5">
                                        <p className="text-[10px] text-dark-500 uppercase tracking-wider mb-1">Total Spent</p>
                                        <p className="text-xl font-bold text-white">₹{totalSpend.toLocaleString('en-IN')}</p>
                                        <p className="text-[10px] text-dark-400 mt-0.5">{expenses.length} expenses</p>
                                    </div>
                                    <div className="glass-card p-3.5">
                                        <p className="text-[10px] text-dark-500 uppercase tracking-wider mb-1">
                                            {activeGroup.mode === 'pool' ? 'Pool Total' : 'Avg/Expense'}
                                        </p>
                                        <p className="text-xl font-bold text-white">
                                            ₹{activeGroup.mode === 'pool'
                                                ? totalContributions.toLocaleString('en-IN')
                                                : expenses.length > 0
                                                    ? Math.round(totalSpend / expenses.length).toLocaleString('en-IN')
                                                    : '0'
                                            }
                                        </p>
                                        <p className="text-[10px] text-dark-400 mt-0.5">
                                            {activeGroup.mode === 'pool' ? `${contributions.length} contributions` : 'per expense'}
                                        </p>
                                    </div>
                                </div>

                                {/* Category Breakdown */}
                                {categoryBreakdown.length > 0 && (
                                    <div>
                                        <h3 className="text-sm font-semibold text-white mb-2.5 flex items-center gap-1.5">
                                            <TrendingUp className="w-4 h-4 text-accent-light" />
                                            By Category
                                        </h3>
                                        <div className="space-y-2">
                                            {categoryBreakdown.map((item, i) => {
                                                const meta = CATEGORY_META[item.category] || CATEGORY_META.others;
                                                return (
                                                    <motion.div key={item.category} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                                                        transition={{ delay: i * 0.04 }} className="glass-card p-3">
                                                        <div className="flex items-center justify-between mb-1.5">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-sm">{meta.emoji}</span>
                                                                <span className="text-xs text-white font-medium">{meta.label}</span>
                                                            </div>
                                                            <span className="text-xs font-bold text-white">₹{item.amount.toLocaleString('en-IN')}</span>
                                                        </div>
                                                        <div className="h-1.5 bg-dark-800 rounded-full overflow-hidden">
                                                            <motion.div
                                                                initial={{ width: 0 }}
                                                                animate={{ width: `${item.percent}%` }}
                                                                transition={{ delay: 0.2 + i * 0.05, duration: 0.5, ease: 'easeOut' }}
                                                                className="h-full rounded-full"
                                                                style={{ backgroundColor: meta.color }}
                                                            />
                                                        </div>
                                                        <p className="text-[10px] text-dark-500 mt-1 text-right">{item.percent.toFixed(1)}%</p>
                                                    </motion.div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Monthly Trend */}
                                {monthlySpend.length > 1 && (
                                    <div>
                                        <h3 className="text-sm font-semibold text-white mb-2.5 flex items-center gap-1.5">
                                            <TrendingDown className="w-4 h-4 text-success-light" />
                                            Monthly Trend
                                        </h3>
                                        <div className="glass-card p-4">
                                            <div className="flex items-end gap-2 h-28">
                                                {monthlySpend.map((m, i) => (
                                                    <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                                                        <motion.div
                                                            initial={{ height: 0 }}
                                                            animate={{ height: `${(m.amount / maxMonthly) * 100}%` }}
                                                            transition={{ delay: 0.2 + i * 0.08, duration: 0.5, ease: 'easeOut' }}
                                                            className="w-full rounded-t-md bg-gradient-to-t from-accent/60 to-accent min-h-[4px]"
                                                        />
                                                        <span className="text-[9px] text-dark-500">{m.label}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Person-wise spending */}
                                {personBreakdown.length > 0 && activeGroup.mode === 'direct' && (
                                    <div>
                                        <h3 className="text-sm font-semibold text-white mb-2.5">Who Paid Most</h3>
                                        <div className="space-y-1.5">
                                            {personBreakdown.map((p, i) => (
                                                <div key={p.uid} className="glass-card px-3 py-2.5 flex items-center gap-2">
                                                    <span className="text-dark-500 text-xs font-bold w-5">#{i + 1}</span>
                                                    {p.photoURL ? (
                                                        <img src={p.photoURL} alt="" className="w-6 h-6 rounded-full" />
                                                    ) : (
                                                        <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center">
                                                            <span className="text-[9px] text-accent-light font-bold">{p.name.charAt(0)}</span>
                                                        </div>
                                                    )}
                                                    <span className="text-xs text-white font-medium flex-1 truncate">
                                                        {p.uid === user?.uid ? 'You' : p.name.split(' ')[0]}
                                                    </span>
                                                    <span className="text-xs font-bold text-accent-light">₹{p.amount.toLocaleString('en-IN')}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        )}

                        {/* ═══════════ CALENDAR TAB ═══════════ */}
                        {tab === 'calendar' && (
                            <motion.div key="calendar" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
                                {/* Month nav */}
                                <div className="flex items-center justify-between mb-3">
                                    <button onClick={() => { setCalMonth(subMonths(calMonth, 1)); setSelectedDay(null); }}
                                        className="p-2 rounded-lg hover:bg-dark-800 transition-colors">
                                        <ChevronLeft className="w-4 h-4 text-dark-300" />
                                    </button>
                                    <div className="text-center">
                                        <p className="text-sm font-semibold text-white">{format(calMonth, 'MMMM yyyy')}</p>
                                        <p className="text-[10px] text-dark-400">₹{calMonthTotal.toLocaleString('en-IN')} total</p>
                                    </div>
                                    <button onClick={() => { setCalMonth(addMonths(calMonth, 1)); setSelectedDay(null); }}
                                        className="p-2 rounded-lg hover:bg-dark-800 transition-colors">
                                        <ChevronRight className="w-4 h-4 text-dark-300" />
                                    </button>
                                </div>

                                {/* Day labels */}
                                <div className="grid grid-cols-7 gap-1 mb-1">
                                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                                        <div key={i} className="text-center text-[10px] text-dark-600 py-1">{d}</div>
                                    ))}
                                </div>

                                {/* Calendar grid */}
                                <div className="grid grid-cols-7 gap-1 mb-4">
                                    {/* Empty padding */}
                                    {Array.from({ length: firstDow }).map((_, i) => (
                                        <div key={`pad-${i}`} />
                                    ))}
                                    {calDays.map((day) => {
                                        const key = format(day, 'yyyy-MM-dd');
                                        const amount = dayExpenseMap[key] || 0;
                                        const isToday = isSameDay(day, new Date());
                                        const isSelected = selectedDay && isSameDay(day, selectedDay);
                                        const intensity = amount > 0 ? Math.min(amount / maxDayExpense, 1) : 0;

                                        return (
                                            <button
                                                key={key}
                                                onClick={() => setSelectedDay(isSelected ? null : day)}
                                                className={`relative aspect-square rounded-lg flex flex-col items-center justify-center transition-all
                                                    ${isSelected ? 'bg-accent/20 border border-accent/40' : ''}
                                                    ${isToday && !isSelected ? 'border border-dark-600' : ''}
                                                    ${!isSelected ? 'hover:bg-dark-800/50' : ''}
                                                `}
                                            >
                                                <span className={`text-xs ${isToday ? 'text-accent-light font-bold' : amount > 0 ? 'text-white' : 'text-dark-500'}`}>
                                                    {day.getDate()}
                                                </span>
                                                {amount > 0 && (
                                                    <div className="w-1.5 h-1.5 rounded-full mt-0.5"
                                                        style={{ backgroundColor: `rgba(139, 92, 246, ${0.3 + intensity * 0.7})` }}
                                                    />
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Selected day details */}
                                <AnimatePresence>
                                    {selectedDay && (
                                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                                            <div className="glass-card p-3 mb-2">
                                                <p className="text-xs font-semibold text-white mb-2">
                                                    {format(selectedDay, 'EEEE, dd MMM yyyy')}
                                                    <span className="text-dark-400 font-normal ml-1.5">
                                                        · ₹{selectedDayExpenses.reduce((s, e) => s + e.amount, 0).toLocaleString('en-IN')}
                                                    </span>
                                                </p>
                                                {selectedDayExpenses.length === 0 ? (
                                                    <p className="text-dark-500 text-xs">No expenses this day</p>
                                                ) : (
                                                    <div className="space-y-1.5">
                                                        {selectedDayExpenses.map((e) => {
                                                            const cat = CATEGORY_META[e.category as ExpenseCategory] || CATEGORY_META.others;
                                                            return (
                                                                <div key={e.id} className="flex items-center gap-2">
                                                                    <span className="text-sm">{cat.emoji}</span>
                                                                    <span className="text-xs text-dark-200 flex-1 truncate">{e.description}</span>
                                                                    <span className="text-xs font-bold text-white">₹{e.amount.toLocaleString('en-IN')}</span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        )}

                        {/* ═══════════ RECURRING TAB ═══════════ */}
                        {tab === 'recurring' && (
                            <motion.div key="recurring" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
                                {/* Add button */}
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-sm font-semibold text-white">Recurring Expenses</h3>
                                    <button onClick={() => setShowAddRecurring(true)}
                                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-accent/10 text-accent-light text-xs font-medium hover:bg-accent/20 transition-all">
                                        <Plus className="w-3.5 h-3.5" /> Add
                                    </button>
                                </div>

                                {recurringExpenses.length === 0 ? (
                                    <div className="glass-card p-8 text-center">
                                        <p className="text-2xl mb-2">🔄</p>
                                        <p className="text-white font-medium mb-1">No Recurring Expenses</p>
                                        <p className="text-dark-400 text-xs">Add recurring bills like Rent, WiFi, Subscriptions</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {recurringExpenses.map((rec) => {
                                            const meta = CATEGORY_META[rec.category] || CATEGORY_META.others;
                                            const alreadyAdded = rec.lastAdded === currentMonthKey;
                                            return (
                                                <div key={rec.id} className={`glass-card p-3.5 ${!rec.active ? 'opacity-50' : ''}`}>
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0"
                                                            style={{ backgroundColor: meta.color + '20' }}>
                                                            {meta.emoji}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium text-white truncate">{rec.description}</p>
                                                            <p className="text-[10px] text-dark-400">
                                                                Every {rec.dayOfMonth}{rec.dayOfMonth === 1 ? 'st' : rec.dayOfMonth === 2 ? 'nd' : rec.dayOfMonth === 3 ? 'rd' : 'th'} of month
                                                                · {rec.usedBy.length} members
                                                            </p>
                                                        </div>
                                                        <div className="text-right flex-shrink-0">
                                                            <p className="text-sm font-bold text-white">₹{rec.amount.toLocaleString('en-IN')}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-2.5 pt-2 border-t border-dark-800/40">
                                                        {!alreadyAdded && rec.active ? (
                                                            <button onClick={() => handleTriggerRecurring(rec)}
                                                                className="flex-1 py-1.5 rounded-lg bg-accent/10 text-accent-light text-xs font-medium hover:bg-accent/20 transition-all">
                                                                Add for {format(new Date(), 'MMM')}
                                                            </button>
                                                        ) : (
                                                            <span className="flex-1 text-[10px] text-success-light font-medium">
                                                                ✓ Added for {format(new Date(), 'MMM')}
                                                            </span>
                                                        )}
                                                        <button onClick={() => toggleRecurringExpense(rec.id, !rec.active)}
                                                            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${rec.active
                                                                ? 'bg-dark-800 text-dark-300 hover:bg-dark-700'
                                                                : 'bg-success/10 text-success-light hover:bg-success/20'
                                                                }`}>
                                                            {rec.active ? 'Pause' : 'Resume'}
                                                        </button>
                                                        <button onClick={() => setDeletingRecurring(rec.id)}
                                                            className="p-1.5 rounded-lg text-dark-500 hover:text-danger-light hover:bg-danger/10 transition-all">
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </>
            )}

            {/* ─── Add Recurring Modal ─── */}
            <AnimatePresence>
                {showAddRecurring && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center"
                        onClick={() => setShowAddRecurring(false)}>
                        <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            className="bg-dark-900 rounded-t-3xl sm:rounded-3xl p-6 w-full max-w-md border border-glass-border"
                            onClick={(e) => e.stopPropagation()}>
                            <div className="w-10 h-1 rounded-full bg-dark-600 mx-auto mb-4 sm:hidden" />
                            <h2 className="text-lg font-bold text-white mb-4">Add Recurring Expense</h2>
                            <div className="space-y-3 mb-4">
                                <div className="flex items-center gap-2">
                                    <span className="text-xl font-light text-dark-400">₹</span>
                                    <input type="number" value={recAmount} onChange={(e) => setRecAmount(e.target.value)}
                                        className="bg-transparent text-2xl font-bold text-white flex-1 focus:outline-none min-w-0"
                                        placeholder="0" autoFocus inputMode="decimal" />
                                </div>
                                <input type="text" value={recDesc} onChange={(e) => setRecDesc(e.target.value)}
                                    placeholder="e.g. Rent, WiFi, Netflix" className="input-dark text-sm" />
                                <div>
                                    <label className="text-xs text-dark-500 mb-1 block">Day of month</label>
                                    <select value={recDay} onChange={(e) => setRecDay(e.target.value)}
                                        className="input-dark text-sm w-full appearance-none cursor-pointer">
                                        {Array.from({ length: 28 }, (_, i) => (
                                            <option key={i + 1} value={i + 1}>{i + 1}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="grid grid-cols-5 gap-1.5">
                                    {categories.map(([key, meta]) => (
                                        <button key={key} onClick={() => setRecCategory(key)}
                                            className={`p-2 rounded-lg border text-center transition-all ${recCategory === key
                                                ? 'border-accent bg-accent/10' : 'border-transparent bg-dark-800/50'
                                                }`}>
                                            <span className="text-sm">{meta.emoji}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <button onClick={() => setShowAddRecurring(false)} className="btn-ghost flex-1 text-sm">Cancel</button>
                                <button onClick={handleAddRecurring}
                                    disabled={recSaving || !recAmount || parseFloat(recAmount) <= 0 || !recDesc.trim()}
                                    className="btn-primary flex-1 text-sm">
                                    {recSaving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" /> : 'Save'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ─── Delete Recurring Confirmation ─── */}
            <AnimatePresence>
                {deletingRecurring && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
                        onClick={() => setDeletingRecurring(null)}>
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="glass-card p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-full bg-danger/20 flex items-center justify-center">
                                    <AlertTriangle className="w-5 h-5 text-danger-light" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-white">Delete Recurring?</h3>
                                    <p className="text-dark-400 text-xs">This won't remove past expenses</p>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <button onClick={() => setDeletingRecurring(null)} className="btn-ghost flex-1 text-sm">Cancel</button>
                                <button onClick={async () => { await deleteRecurringExpense(deletingRecurring); setDeletingRecurring(null); }}
                                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-red-700 text-white text-sm font-semibold transition-all active:scale-95">
                                    Delete
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
