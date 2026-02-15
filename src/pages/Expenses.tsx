import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Pencil, Trash2, Check, Search, AlertTriangle, MapPin, Download } from 'lucide-react';
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


    const filtered = search.trim()
        ? expenses.filter((e) =>
            e.description.toLowerCase().includes(search.toLowerCase()) ||
            CATEGORY_META[e.category as ExpenseCategory]?.label.toLowerCase().includes(search.toLowerCase())
        )
        : expenses;

    const handleExport = () => {
        if (!activeGroup || expenses.length === 0) return;
        exportGroupExpenses(activeGroup.name, expenses, activeGroup.members);
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
                        <button onClick={handleExport}
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

            {/* Search */}
            {expenses.length > 3 && (
                <div className="relative mb-4">
                    <Search className="w-4 h-4 text-dark-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search expenses..."
                        className="input-dark !pl-10 text-sm"
                    />
                </div>
            )}

            {/* Expense List */}
            {!activeGroup ? (
                <div className="glass-card p-8 text-center">
                    <p className="text-dark-400 text-sm">Select a group on the Home tab first</p>
                </div>
            ) : filtered.length === 0 ? (
                <div className="glass-card p-8 text-center">
                    <p className="text-dark-400 font-medium">{search ? 'No matching expenses' : 'No expenses yet'}</p>
                    {!search && (
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
