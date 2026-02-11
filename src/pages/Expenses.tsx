import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Pencil, Trash2, Check, Search, AlertTriangle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useActiveGroup } from '../contexts/ActiveGroupContext';
import { useGroups, useExpenses } from '../hooks/hooks';
import { deleteExpense, updateExpense } from '../lib/firestore';
import { CATEGORY_META } from '../types';
import type { ExpenseCategory, Expense } from '../types';
import { format, formatDistanceToNow } from 'date-fns';

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

    const filtered = search.trim()
        ? expenses.filter((e) =>
            e.description.toLowerCase().includes(search.toLowerCase()) ||
            CATEGORY_META[e.category as ExpenseCategory]?.label.toLowerCase().includes(search.toLowerCase())
        )
        : expenses;

    const getMemberName = (uid: string) => {
        if (uid === 'pool') return '💰 Pool';
        return activeGroup?.members.find((m) => m.uid === uid)?.name || uid;
    };

    const getMemberPhoto = (uid: string) => {
        return activeGroup?.members.find((m) => m.uid === uid)?.photoURL;
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
                <button onClick={() => navigate('/add')}
                    className="p-2.5 rounded-xl bg-gradient-to-br from-accent to-purple-600 text-white shadow-neon">
                    <Plus className="w-5 h-5" />
                </button>
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
                        const creatorPhoto = getMemberPhoto(exp.createdBy);
                        const creatorName = getMemberName(exp.createdBy);
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
                                            {exp.paidBy === 'pool' ? '💰 Pool' : `${getMemberName(exp.paidBy)}`} · {format(new Date(exp.createdAt), 'dd MMM')}
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
                                    placeholder="Description" className="input-dark text-sm" />
                                <div className="grid grid-cols-5 gap-1.5">
                                    {categories.map(([key, meta]) => (
                                        <button key={key} onClick={() => setEditCategory(key)}
                                            className={`p-2 rounded-lg border text-center transition-all ${editCategory === key
                                                ? 'border-accent bg-accent/10' : 'border-transparent bg-dark-800/50'
                                                }`}>
                                            <span className="text-sm">{meta.emoji}</span>
                                        </button>
                                    ))}
                                </div>
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

            {/* Delete Confirmation Modal */}
            <AnimatePresence>
                {deletingExpense && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
                        onClick={() => setDeletingExpense(null)}>
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="glass-card p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-full bg-danger/20 flex items-center justify-center flex-shrink-0">
                                    <AlertTriangle className="w-5 h-5 text-danger-light" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-white">Delete Expense?</h3>
                                    <p className="text-dark-400 text-xs">This cannot be undone</p>
                                </div>
                            </div>
                            <div className="glass-card p-3 mb-5 border border-danger/10">
                                <p className="text-sm text-white font-medium">{deletingExpense.description}</p>
                                <p className="text-lg font-bold text-danger-light">₹{deletingExpense.amount.toLocaleString('en-IN')}</p>
                            </div>
                            <div className="flex gap-3">
                                <button onClick={() => setDeletingExpense(null)} className="btn-ghost flex-1 text-sm">Cancel</button>
                                <button onClick={handleConfirmDelete}
                                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-red-700 text-white text-sm font-semibold hover:shadow-danger/20 transition-all active:scale-95">
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
