import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, Plus, Download, Search, MapPin, Pencil, Check, FileText } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useActiveGroup } from '../contexts/ActiveGroupContext';
import { useGroups, useExpenses } from '../hooks/hooks';
import { deleteExpense, updateExpense, getUserProfile } from '../lib/firestore';
import { exportGroupExpenses } from '../lib/pdfExport';
import { CATEGORY_META } from '../types';
import type { ExpenseCategory, Expense, Member } from '../types';
import { format, formatDistanceToNow } from 'date-fns';
import ConfirmDialog from '../components/ConfirmDialog';

const FORTY_EIGHT_HOURS = 48 * 60 * 60 * 1000;

export default function Expenses() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { groups } = useGroups();
    const { activeGroupId } = useActiveGroup();
    const { expenses } = useExpenses(activeGroupId || undefined);

    const activeGroup = groups.find((g) => g.id === activeGroupId);

    const [search, setSearch] = useState('');
    const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
    const [editAmount, setEditAmount] = useState('');
    const [editDesc, setEditDesc] = useState('');
    const [editCategory, setEditCategory] = useState<ExpenseCategory>('food');
    const [editSaving, setEditSaving] = useState(false);
    const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null);

    // Resolved users for removed members
    const [resolvedUsers, setResolvedUsers] = useState<Record<string, Partial<Member>>>({});

    // Filter State
    const [showFilters, setShowFilters] = useState(false);
    const [dateFilter, setDateFilter] = useState<'all' | 'thisMonth' | 'lastMonth' | 'custom'>('all');
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');
    const [memberFilter, setMemberFilter] = useState<string>('all');

    // Identify and fetch unknown users
    useEffect(() => {
        if (!activeGroup || expenses.length === 0) return;

        const currentMemberIds = new Set(activeGroup.members.map(m => m.uid));
        const unknownUids = new Set<string>();

        expenses.forEach(exp => {
            if (exp.paidBy !== 'pool' && !currentMemberIds.has(exp.paidBy) && !resolvedUsers[exp.paidBy]) {
                unknownUids.add(exp.paidBy);
            }
        });

        if (unknownUids.size > 0) {
            const fetchProfiles = async () => {
                const newResolved: Record<string, Partial<Member>> = {};
                await Promise.all(Array.from(unknownUids).map(async (uid) => {
                    const profile = await getUserProfile(uid);
                    if (profile) {
                        newResolved[uid] = profile;
                    } else {
                        newResolved[uid] = { name: 'Former Member', uid }; // Fallback if user deleted
                    }
                }));

                setResolvedUsers(prev => ({ ...prev, ...newResolved }));
            };
            fetchProfiles();
        }
    }, [expenses, activeGroup, resolvedUsers]);


    const filtered = expenses.filter((e) => {
        // 1. Text Search
        if (search.trim()) {
            const matchesDesc = e.description.toLowerCase().includes(search.toLowerCase());
            const matchesCat = CATEGORY_META[e.category as ExpenseCategory]?.label.toLowerCase().includes(search.toLowerCase());
            if (!matchesDesc && !matchesCat) return false;
        }

        // 2. Member Filter (Paid By)
        if (memberFilter !== 'all') {
            if (e.paidBy !== memberFilter) return false;
        }

        // 3. Date Filter
        const date = new Date(e.createdAt);
        const now = new Date();

        if (dateFilter === 'thisMonth') {
            if (date.getMonth() !== now.getMonth() || date.getFullYear() !== now.getFullYear()) return false;
        } else if (dateFilter === 'lastMonth') {
            const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            if (date.getMonth() !== lastMonth.getMonth() || date.getFullYear() !== lastMonth.getFullYear()) return false;
        } else if (dateFilter === 'custom' && customStart && customEnd) {
            const start = new Date(customStart);
            const end = new Date(customEnd);
            end.setHours(23, 59, 59, 999); // End of selected day
            if (date < start || date > end) return false;
        }

        return true;
    });

    const [showExportModal, setShowExportModal] = useState(false);
    const [exportPeriod, setExportPeriod] = useState<'current' | 'thisMonth' | 'lastMonth' | 'allTime' | 'custom'>('current');
    const [exportStart, setExportStart] = useState('');
    const [exportEnd, setExportEnd] = useState('');

    const handleExportClick = () => {
        if (!activeGroup || expenses.length === 0) return;
        setShowExportModal(true);
    };

    const confirmExport = () => {
        if (!activeGroup) return;

        let expensesToExport = expenses;
        let label = 'All Time';

        // Filter Logic for Export
        if (exportPeriod === 'current') {
            expensesToExport = filtered;
            label = 'Current Filtered View';
        } else if (exportPeriod === 'thisMonth') {
            const now = new Date();
            expensesToExport = expenses.filter(e => {
                const d = new Date(e.createdAt);
                return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
            });
            label = format(now, 'MMMM yyyy');
        } else if (exportPeriod === 'lastMonth') {
            const now = new Date();
            const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            expensesToExport = expenses.filter(e => {
                const d = new Date(e.createdAt);
                return d.getMonth() === lastMonth.getMonth() && d.getFullYear() === lastMonth.getFullYear();
            });
            label = format(lastMonth, 'MMMM yyyy');
        } else if (exportPeriod === 'allTime') {
            expensesToExport = expenses;
            label = 'All Time';
        } else if (exportPeriod === 'custom' && exportStart && exportEnd) {
            const start = new Date(exportStart);
            const end = new Date(exportEnd);
            end.setHours(23, 59, 59, 999);
            expensesToExport = expenses.filter(e => {
                const d = new Date(e.createdAt);
                return d >= start && d <= end;
            });
            label = `${format(start, 'dd MMM')} - ${format(end, 'dd MMM yyyy')}`;
        }

        // Sort by date desc
        expensesToExport.sort((a, b) => b.createdAt - a.createdAt);

        if (expensesToExport.length === 0) {
            alert(`No expenses found for ${label}`);
            return;
        }

        exportGroupExpenses(activeGroup.name, expensesToExport, activeGroup.members, label);
        setShowExportModal(false);
    };

    const getMemberName = (uid: string, expense?: Expense) => {
        if (uid === 'pool') return '💰 Pool';
        // 1. Current Member
        const member = activeGroup?.members.find((m) => m.uid === uid);
        if (member) return member.name;

        // 2. Resolved (Lazy Fetched)
        if (resolvedUsers[uid]) return resolvedUsers[uid].name || 'Unknown';

        // 3. Snapshot (Future proofing)
        if (expense?.payerName) return expense.payerName;

        return 'Unknown';
    };

    const getMemberPhoto = (uid: string, expense?: Expense) => {
        // 1. Current Member
        const member = activeGroup?.members.find((m) => m.uid === uid);
        if (member) return member.photoURL;

        // 2. Resolved (Lazy Fetched)
        if (resolvedUsers[uid]) return resolvedUsers[uid].photoURL;

        // 3. Snapshot
        if (expense?.payerPhoto) return expense.payerPhoto;

        return undefined;
    };

    const canEdit = (exp: Expense) => {
        return exp.createdBy === user?.uid && (Date.now() - exp.createdAt) < FORTY_EIGHT_HOURS;
    };

    const openEdit = (exp: Expense) => {
        setEditingExpense(exp);
        setEditAmount(exp.amount.toString());
        setEditDesc(exp.description);
        setEditCategory(exp.category);
    };

    const handleSaveEdit = async () => {
        if (!editingExpense || !user) return;
        setEditSaving(true);
        try {
            await updateExpense(editingExpense.id, {
                amount: parseFloat(editAmount),
                description: editDesc.trim(),
                category: editCategory,
            }, user.uid);
            setEditingExpense(null);
        } catch (err) {
            console.error('Edit failed:', err);
        } finally {
            setEditSaving(false);
        }
    };

    const handleConfirmDelete = async () => {
        if (!deletingExpense) return;
        await deleteExpense(deletingExpense.id, deletingExpense.groupId);
        setDeletingExpense(null);
    };

    const categories = Object.entries(CATEGORY_META) as [ExpenseCategory, typeof CATEGORY_META[ExpenseCategory]][];

    // Total for this group
    const total = expenses.reduce((s, e) => s + e.amount, 0);

    return (
        <div className="px-4 pt-6 pb-4 max-w-lg mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h1 className="text-xl font-bold text-white">Expenses</h1>
                    <p className="text-dark-400 text-xs">
                        {activeGroup ? `${activeGroup.name} · ₹${total.toLocaleString('en-IN')} total` : 'No group selected'}
                    </p>
                </div>
                <div className="flex gap-2">
                    {expenses.length > 0 && (
                        <button onClick={handleExportClick}
                            className="p-2.5 rounded-xl bg-dark-800 text-dark-200 hover:text-white hover:bg-dark-700 transition-colors"
                            title="Export PDF">
                            <Download className="w-5 h-5" />
                        </button>
                    )}
                    <button onClick={() => navigate('/add')}
                        className="p-2.5 rounded-xl bg-gradient-to-br from-accent to-purple-600 text-white shadow-neon">
                        <Plus className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Export Modal */}
            <AnimatePresence>
                {showExportModal && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setShowExportModal(false)}>
                        <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
                            className="bg-dark-900 rounded-2xl p-6 w-full max-w-sm border border-glass-border shadow-xl"
                            onClick={(e) => e.stopPropagation()}>

                            <div className="flex items-center gap-3 mb-4 text-white">
                                <div className="p-3 rounded-full bg-indigo-500/20 text-indigo-400">
                                    <FileText size={24} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold">Export Report</h3>
                                    <p className="text-dark-400 text-xs">Select data range for PDF</p>
                                </div>
                            </div>

                            <div className="space-y-2 mb-6">
                                {[
                                    { id: 'current', label: 'Current View', desc: 'Expenses currently shown in list' },
                                    { id: 'thisMonth', label: 'This Month', desc: `Expenses from ${format(new Date(), 'MMMM')}` },
                                    { id: 'lastMonth', label: 'Last Month', desc: `Expenses from ${format(new Date(new Date().setMonth(new Date().getMonth() - 1)), 'MMMM')}` },
                                    { id: 'allTime', label: 'All Time', desc: 'Entire expense history' },
                                    { id: 'custom', label: 'Custom Range', desc: 'Select specific dates' }
                                ].map((opt) => (
                                    <div key={opt.id}>
                                        <button
                                            onClick={() => setExportPeriod(opt.id as any)}
                                            className={`w-full text-left p-3 rounded-xl border transition-all ${exportPeriod === opt.id
                                                ? 'bg-indigo-500/10 border-indigo-500 text-white'
                                                : 'bg-dark-800 border-transparent text-dark-300 hover:bg-dark-700'
                                                }`}
                                        >
                                            <div className="font-medium text-sm">{opt.label}</div>
                                            <div className="text-[10px] opacity-60">{opt.desc}</div>
                                        </button>

                                        {/* Custom Date Inputs inside the button container if selected */}
                                        {opt.id === 'custom' && exportPeriod === 'custom' && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                className="mt-2 flex gap-2 overflow-hidden"
                                            >
                                                <input
                                                    type="date"
                                                    value={exportStart}
                                                    onChange={e => setExportStart(e.target.value)}
                                                    className="bg-dark-950 border border-dark-700 rounded-lg px-2 py-1.5 text-xs text-white flex-1"
                                                />
                                                <input
                                                    type="date"
                                                    value={exportEnd}
                                                    onChange={e => setExportEnd(e.target.value)}
                                                    className="bg-dark-950 border border-dark-700 rounded-lg px-2 py-1.5 text-xs text-white flex-1"
                                                />
                                            </motion.div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <div className="flex gap-3">
                                <button onClick={() => setShowExportModal(false)} className="btn-ghost flex-1 text-sm">Cancel</button>
                                <button onClick={confirmExport} className="btn-primary flex-1 text-sm bg-indigo-600 hover:bg-indigo-500">
                                    Download PDF
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Search & Filter Bar */}
            {expenses.length > 0 && (
                <div className="space-y-3 mb-4">
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <Search className="w-4 h-4 text-dark-500 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search expenses..."
                                className="input-dark !pl-10 text-sm w-full"
                            />
                        </div>
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`p-2.5 rounded-xl border transition-colors ${showFilters
                                ? 'bg-accent/10 border-accent text-accent-light'
                                : 'bg-dark-800 border-dark-700 text-dark-400 hover:text-white'}`}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>
                        </button>
                    </div>

                    {/* Advanced Filters Panel */}
                    <AnimatePresence>
                        {showFilters && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                            >
                                <div className="bg-dark-800/50 rounded-xl p-3 border border-dark-700/50 space-y-3">
                                    {/* Date Range */}
                                    <div>
                                        <label className="text-[10px] uppercase tracking-wider text-dark-500 font-bold mb-1.5 block">Date Range</label>
                                        <div className="flex flex-wrap gap-2 mb-2">
                                            {(['all', 'thisMonth', 'lastMonth'] as const).map((key) => (
                                                <button
                                                    key={key}
                                                    onClick={() => setDateFilter(key)}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${dateFilter === key
                                                        ? 'bg-accent/20 text-accent-light border border-accent/20'
                                                        : 'bg-dark-700/50 text-dark-400 hover:bg-dark-700'
                                                        }`}
                                                >
                                                    {key === 'all' ? 'All Time' : key === 'thisMonth' ? 'This Month' : 'Last Month'}
                                                </button>
                                            ))}
                                            <button
                                                onClick={() => setDateFilter('custom')}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${dateFilter === 'custom'
                                                    ? 'bg-accent/20 text-accent-light border border-accent/20'
                                                    : 'bg-dark-700/50 text-dark-400 hover:bg-dark-700'
                                                    }`}
                                            >
                                                Custom
                                            </button>
                                        </div>
                                        {dateFilter === 'custom' && (
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="date"
                                                    value={customStart}
                                                    onChange={(e) => setCustomStart(e.target.value)}
                                                    className="bg-dark-900 border border-dark-700 rounded-lg px-2 py-1.5 text-xs text-white flex-1"
                                                />
                                                <span className="text-dark-500">-</span>
                                                <input
                                                    type="date"
                                                    value={customEnd}
                                                    onChange={(e) => setCustomEnd(e.target.value)}
                                                    className="bg-dark-900 border border-dark-700 rounded-lg px-2 py-1.5 text-xs text-white flex-1"
                                                />
                                            </div>
                                        )}
                                    </div>

                                    {/* Member Filter */}
                                    <div>
                                        <label className="text-[10px] uppercase tracking-wider text-dark-500 font-bold mb-1.5 block">Paid By</label>
                                        <select
                                            value={memberFilter}
                                            onChange={(e) => setMemberFilter(e.target.value)}
                                            className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-accent/50"
                                        >
                                            <option value="all">Everyone</option>
                                            {activeGroup?.members.map(m => (
                                                <option key={m.uid} value={m.uid}>{m.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            )}

            {/* Expense List */}
            {!activeGroup ? (
                <div className="glass-card p-8 text-center">
                    <p className="text-dark-400 text-sm">Select a group on the Home tab first</p>
                </div>
            ) : filtered.length === 0 ? (
                <div className="glass-card p-8 text-center">
                    <p className="text-dark-400 font-medium">{search || memberFilter !== 'all' || dateFilter !== 'all' ? 'No matching expenses' : 'No expenses yet'}</p>
                    {!search && memberFilter === 'all' && dateFilter === 'all' && (
                        <button onClick={() => navigate('/add')} className="text-accent-light text-xs font-medium mt-2">
                            Add your first expense →
                        </button>
                    )}
                </div>
            ) : (
                <div className="space-y-2">
                    {filtered.map((exp, i) => {
                        const cat = CATEGORY_META[exp.category as ExpenseCategory] || CATEGORY_META.others;
                        const creatorPhoto = getMemberPhoto(exp.createdBy, exp);
                        const creatorName = getMemberName(exp.createdBy, exp);
                        const payerName = getMemberName(exp.paidBy, exp);
                        const isEditable = canEdit(exp);
                        const wasEdited = !!exp.editedAt;

                        return (
                            <motion.div
                                key={exp.id}
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.02 }}
                                className="glass-card p-3.5"
                            >
                                {/* Main row */}
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0"
                                        style={{ backgroundColor: cat.color + '20' }}>
                                        {cat.emoji}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-white truncate">{exp.description}</p>
                                        <p className="text-[11px] text-dark-400 mt-0.5">
                                            {exp.paidBy === 'pool' ? '💰 Pool' : `${payerName}`} · {format(new Date(exp.createdAt), 'dd MMM')}
                                        </p>
                                    </div>
                                    <p className="text-sm font-bold text-white flex-shrink-0">₹{exp.amount.toLocaleString('en-IN')}</p>
                                </div>

                                {/* Footer: creator + actions */}
                                <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-dark-800/40">
                                    <div className="flex items-center gap-1.5">
                                        {creatorPhoto ? (
                                            <img src={creatorPhoto} alt="" className="w-3.5 h-3.5 rounded-full" />
                                        ) : (
                                            <div className="w-3.5 h-3.5 rounded-full bg-dark-700 flex items-center justify-center">
                                                <span className="text-[7px] text-dark-300">{creatorName.charAt(0)}</span>
                                            </div>
                                        )}
                                        <span className="text-[10px] text-dark-500">
                                            {creatorName.split(' ')[0]}
                                        </span>
                                        {wasEdited && (
                                            <span className="text-[10px] text-dark-600">
                                                · edited {formatDistanceToNow(new Date(exp.editedAt!), { addSuffix: true })}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-0.5">
                                        {exp.location && (
                                            <a href={`https://www.google.com/maps?q=${exp.location.lat},${exp.location.lng}`}
                                                target="_blank" rel="noopener noreferrer"
                                                className="p-1 rounded-lg text-green-500 hover:text-green-400 hover:bg-green-500/10 transition-all"
                                                title="Open in Google Maps">
                                                <MapPin className="w-3 h-3" />
                                            </a>
                                        )}
                                        {isEditable && (
                                            <button onClick={() => openEdit(exp)}
                                                className="p-1 rounded-lg text-dark-500 hover:text-accent-light hover:bg-accent/10 transition-all">
                                                <Pencil className="w-3 h-3" />
                                            </button>
                                        )}
                                        {exp.createdBy === user?.uid && (
                                            <button onClick={() => setDeletingExpense(exp)}
                                                className="p-1 rounded-lg text-dark-500 hover:text-danger-light hover:bg-danger/10 transition-all">
                                                <Trash2 className="w-3 h-3" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            )}

            {/* Edit Modal */}
            <AnimatePresence>
                {editingExpense && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center" onClick={() => setEditingExpense(null)}>
                        <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            className="bg-dark-900 rounded-t-3xl sm:rounded-3xl p-6 w-full max-w-md border border-glass-border"
                            onClick={(e) => e.stopPropagation()}>
                            <div className="w-10 h-1 rounded-full bg-dark-600 mx-auto mb-4 sm:hidden" />
                            <h2 className="text-lg font-bold text-white mb-4">Edit Expense</h2>
                            <div className="space-y-3 mb-4">
                                <div className="flex items-center gap-2">
                                    <span className="text-xl font-light text-dark-400">₹</span>
                                    <input type="number" value={editAmount} onChange={(e) => setEditAmount(e.target.value)}
                                        className="bg-transparent text-2xl font-bold text-white flex-1 focus:outline-none min-w-0" autoFocus inputMode="decimal" />
                                </div>
                                <input type="text" value={editDesc} onChange={(e) => setEditDesc(e.target.value)}
                                    placeholder="Description (optional)" className="input-dark text-sm" />
                                <div className="grid grid-cols-3 gap-1.5">
                                    {categories.map(([key, meta]) => (
                                        <button key={key} onClick={() => setEditCategory(key)}
                                            className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-left transition-all ${editCategory === key
                                                ? 'border-accent bg-accent/10 text-white' : 'border-transparent bg-dark-800/50 text-dark-400'
                                                }`}>
                                            <span className="text-base">{meta.emoji}</span>
                                            <span className="text-[11px] font-medium truncate">{meta.label}</span>
                                        </button>
                                    ))}
                                </div>
                                {/* Location — read only */}
                                {editingExpense?.location && (
                                    <a href={`https://www.google.com/maps?q=${editingExpense.location.lat},${editingExpense.location.lng}`}
                                        target="_blank" rel="noopener noreferrer"
                                        className="flex items-center gap-2 text-xs text-green-400 hover:text-green-300 transition-colors py-1">
                                        <MapPin className="w-3.5 h-3.5" />
                                        📍 View Location on Google Maps
                                    </a>
                                )}
                            </div>
                            <div className="flex gap-3">
                                <button onClick={() => setEditingExpense(null)} className="btn-ghost flex-1 text-sm">Cancel</button>
                                <button onClick={handleSaveEdit} disabled={editSaving || !editAmount || parseFloat(editAmount) <= 0}
                                    className="btn-primary flex-1 text-sm flex items-center justify-center gap-1.5">
                                    {editSaving ? (
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <><Check className="w-4 h-4" /> Save</>
                                    )}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <ConfirmDialog
                isOpen={!!deletingExpense}
                onClose={() => setDeletingExpense(null)}
                onConfirm={handleConfirmDelete}
                title="Delete Expense?"
                message={`Are you sure you want to delete "${deletingExpense?.description}"? This cannot be undone.`}
                confirmText="Delete"
                type="danger"
            />
        </div>
    );
}
