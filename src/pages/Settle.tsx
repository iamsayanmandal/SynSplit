import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingDown, TrendingUp, Check, Users, History, Wallet } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useGroupData } from '../contexts/GroupDataContext';
import { calculateSplit } from '../lib/splitCalculator';
import { addSettlement } from '../lib/firestore';
import { format } from 'date-fns';

export default function Settle() {
    const { user } = useAuth();
    const { activeGroup, expenses, contributions, settlements, debts } = useGroupData();

    const isPool = activeGroup?.mode === 'pool';

    const [settlingDebt, setSettlingDebt] = useState<{ from: string; to: string; amount: number } | null>(null);
    const [settled, setSettled] = useState(false);
    const [showPoolHistory, setShowPoolHistory] = useState(false);
    const [showSettleHistory, setShowSettleHistory] = useState(false);

    const getMemberName = (uid: string) => {
        if (uid === 'pool') return '💰 Pool';
        if (uid === user?.uid) return 'You';
        return activeGroup?.members.find((m) => m.uid === uid)?.name || uid;
    };

    // Per-member breakdown: added (paid/contributed), used (share), left (net)
    const memberBreakdown = useMemo(() => {
        if (!activeGroup) return [];

        const data: Record<string, { added: number; used: number }> = {};
        activeGroup.members.forEach((m) => {
            data[m.uid] = { added: 0, used: 0 };
        });

        if (isPool) {
            contributions.forEach((c) => {
                if (data[c.userId]) data[c.userId].added += c.amount;
            });
            expenses.forEach((exp) => {
                if (exp.mode === 'pool') {
                    const splits = calculateSplit(exp.amount, exp.splitType, exp.usedBy, exp.splitDetails);
                    for (const [uid, amount] of Object.entries(splits)) {
                        if (data[uid]) data[uid].used += amount;
                    }
                }
            });
        } else {
            expenses.forEach((exp) => {
                if (data[exp.paidBy]) data[exp.paidBy].added += exp.amount;
                const splits = calculateSplit(exp.amount, exp.splitType, exp.usedBy, exp.splitDetails);
                for (const [uid, amount] of Object.entries(splits)) {
                    if (data[uid]) data[uid].used += amount;
                }
            });
        }

        settlements.forEach((s) => {
            if (data[s.fromUser]) data[s.fromUser].added += s.amount;
            if (data[s.toUser]) data[s.toUser].used += s.amount;
        });

        return activeGroup.members.map((m) => {
            const d = data[m.uid];
            const added = Math.round(d.added * 100) / 100;
            const used = Math.round(d.used * 100) / 100;
            const left = Math.round((added - used) * 100) / 100;
            return { uid: m.uid, name: m.name, photoURL: m.photoURL, added, used, left };
        });
    }, [activeGroup, contributions, expenses, settlements, isPool]);

    // User-centric debts
    const userDebts = useMemo(() => {
        if (!user) return { youOwe: [], youGet: [], others: [] };
        return {
            youOwe: debts.filter((d) => d.from === user.uid),
            youGet: debts.filter((d) => d.to === user.uid),
            others: debts.filter((d) => d.from !== user.uid && d.to !== user.uid),
        };
    }, [debts, user]);

    const handleSettle = async () => {
        if (!settlingDebt || !activeGroup?.id) return;
        await addSettlement({
            groupId: activeGroup.id,
            fromUser: settlingDebt.from,
            toUser: settlingDebt.to,
            amount: settlingDebt.amount,
            createdAt: Date.now(),
        });
        setSettled(true);
        setTimeout(() => {
            setSettlingDebt(null);
            setSettled(false);
        }, 1500);
    };

    return (
        <div className="px-4 pt-6 pb-4 max-w-lg mx-auto">
            {/* Header */}
            <div className="mb-5">
                <h1 className="text-xl font-bold text-white">Settle Up</h1>
                <p className="text-dark-400 text-xs mt-0.5">
                    {activeGroup ? `${activeGroup.name} · ${isPool ? 'Pool' : 'Direct'} mode` : 'No group selected'}
                </p>
            </div>

            {!activeGroup ? (
                <div className="glass-card p-8 text-center">
                    <p className="text-dark-400 text-sm">Select a group on the Home tab first</p>
                </div>
            ) : (
                <>
                    {/* ── Per-Member Breakdown ── */}
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
                        <h2 className="text-sm font-semibold text-white mb-2.5 flex items-center gap-1.5">
                            <Users className="w-4 h-4 text-accent-light" />
                            Member Breakdown
                        </h2>

                        {/* Table header */}
                        <div className="flex items-center px-3 py-1.5 mb-1">
                            <span className="flex-1 text-[10px] text-dark-500 uppercase tracking-wider">Member</span>
                            <span className="w-20 text-[10px] text-dark-500 uppercase tracking-wider text-right">
                                {isPool ? 'Added' : 'Paid'}
                            </span>
                            <span className="w-20 text-[10px] text-dark-500 uppercase tracking-wider text-right">Used</span>
                            <span className="w-20 text-[10px] text-dark-500 uppercase tracking-wider text-right">Balance</span>
                        </div>

                        <div className="space-y-1">
                            {memberBreakdown.map((m, i) => {
                                const isYou = m.uid === user?.uid;
                                return (
                                    <motion.div
                                        key={m.uid}
                                        initial={{ opacity: 0, x: -8 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: i * 0.03 }}
                                        className={`glass-card px-3 py-2.5 flex items-center ${isYou ? 'border border-accent/20' : ''}`}
                                    >
                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                            {m.photoURL ? (
                                                <img src={m.photoURL} alt="" className="w-6 h-6 rounded-full flex-shrink-0" />
                                            ) : (
                                                <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                                                    <span className="text-[9px] text-accent-light font-bold">{m.name.charAt(0)}</span>
                                                </div>
                                            )}
                                            <span className={`text-xs font-medium truncate ${isYou ? 'text-accent-light' : 'text-white'}`}>
                                                {isYou ? 'You' : m.name.split(' ')[0]}
                                            </span>
                                        </div>
                                        <span className="w-20 text-xs text-right text-dark-200 font-medium">
                                            ₹{m.added.toLocaleString('en-IN')}
                                        </span>
                                        <span className="w-20 text-xs text-right text-dark-200 font-medium">
                                            ₹{m.used.toLocaleString('en-IN')}
                                        </span>
                                        <span className={`w-20 text-xs text-right font-bold ${m.left > 0 ? 'text-success-light' : m.left < 0 ? 'text-danger-light' : 'text-dark-400'
                                            }`}>
                                            {m.left > 0 ? '+' : ''}₹{m.left.toLocaleString('en-IN')}
                                        </span>
                                    </motion.div>
                                );
                            })}
                        </div>
                    </motion.div>

                    {/* ── Settlement Section ── */}
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
                        {debts.length === 0 ? (
                            <div className="glass-card p-6 text-center mb-5">
                                <p className="text-2xl mb-2">✨</p>
                                <p className="text-white font-semibold mb-0.5">All Settled!</p>
                                <p className="text-dark-400 text-sm">No pending debts in {activeGroup.name}</p>
                            </div>
                        ) : (
                            <div className="space-y-4 mb-5">
                                {/* You Owe */}
                                {userDebts.youOwe.length > 0 && (
                                    <div>
                                        <p className="text-xs text-danger-light font-semibold mb-2 flex items-center gap-1">
                                            <TrendingDown className="w-3.5 h-3.5" /> You Owe
                                        </p>
                                        <div className="space-y-1.5">
                                            {userDebts.youOwe.map((d, i) => (
                                                <div key={`owe-${i}`} className="glass-card p-3.5 flex items-center gap-3 border border-danger/10">
                                                    <div className="flex-1">
                                                        <p className="text-sm text-white">
                                                            Pay <span className="font-bold">{getMemberName(d.to)}</span>
                                                        </p>
                                                        <p className="text-lg font-bold text-danger-light">₹{d.amount.toFixed(2)}</p>
                                                    </div>
                                                    <button onClick={() => setSettlingDebt(d)}
                                                        className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-success to-emerald-600 text-white text-sm font-semibold shadow-lg hover:shadow-success/20 transition-all active:scale-95">
                                                        Settle
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* You Get Back */}
                                {userDebts.youGet.length > 0 && (
                                    <div>
                                        <p className="text-xs text-success-light font-semibold mb-2 flex items-center gap-1">
                                            <TrendingUp className="w-3.5 h-3.5" /> You Get Back
                                        </p>
                                        <div className="space-y-1.5">
                                            {userDebts.youGet.map((d, i) => (
                                                <div key={`get-${i}`} className="glass-card p-3.5 flex items-center gap-3 border border-success/10">
                                                    <div className="flex-1">
                                                        <p className="text-sm text-white">
                                                            From <span className="font-bold">{getMemberName(d.from)}</span>
                                                        </p>
                                                        <p className="text-lg font-bold text-success-light">₹{d.amount.toFixed(2)}</p>
                                                    </div>
                                                    <button onClick={() => setSettlingDebt(d)}
                                                        className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-success to-emerald-600 text-white text-sm font-semibold shadow-lg hover:shadow-success/20 transition-all active:scale-95">
                                                        Settle
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Others */}
                                {userDebts.others.length > 0 && (
                                    <div>
                                        <p className="text-xs text-dark-500 font-semibold mb-2">Between Others</p>
                                        <div className="space-y-1.5">
                                            {userDebts.others.map((d, i) => (
                                                <div key={`other-${i}`} className="glass-card p-3.5 flex items-center gap-3">
                                                    <div className="flex-1">
                                                        <p className="text-sm text-white">
                                                            <span className="font-semibold">{getMemberName(d.from)}</span>
                                                            <span className="text-dark-500 mx-1.5">→</span>
                                                            <span className="font-semibold">{getMemberName(d.to)}</span>
                                                        </p>
                                                        <p className="text-sm font-bold text-warning-light">₹{d.amount.toFixed(2)}</p>
                                                    </div>
                                                    <button onClick={() => setSettlingDebt(d)}
                                                        className="px-3 py-2 rounded-xl bg-dark-700 text-dark-300 text-xs font-medium hover:bg-dark-600 transition-all">
                                                        Settle
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </motion.div>

                    {/* ── History Sections ── */}
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
                        className="space-y-3">

                        {/* Pool Contribution History (pool mode only) */}
                        {isPool && contributions.length > 0 && (
                            <div>
                                <button onClick={() => setShowPoolHistory(!showPoolHistory)}
                                    className="w-full flex items-center justify-between py-2 text-sm font-semibold text-white">
                                    <span className="flex items-center gap-1.5">
                                        <Wallet className="w-4 h-4 text-accent-light" />
                                        Pool Contributions ({contributions.length})
                                    </span>
                                    <span className="text-dark-500 text-xs">{showPoolHistory ? 'Hide' : 'Show'}</span>
                                </button>
                                <AnimatePresence>
                                    {showPoolHistory && (
                                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                            <div className="space-y-1 pb-2">
                                                {contributions.map((c) => (
                                                    <div key={c.id} className="glass-card px-3 py-2 flex items-center gap-2">
                                                        <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                                                            <span className="text-[9px] text-accent-light font-bold">
                                                                {getMemberName(c.userId).charAt(0)}
                                                            </span>
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-xs text-white truncate">{getMemberName(c.userId)}</p>
                                                            <p className="text-[10px] text-dark-500">{format(new Date(c.createdAt), 'dd MMM yyyy, h:mm a')}</p>
                                                        </div>
                                                        <p className="text-xs font-bold text-success-light">+₹{c.amount.toLocaleString('en-IN')}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        )}

                        {/* Settlement History */}
                        {settlements.length > 0 && (
                            <div>
                                <button onClick={() => setShowSettleHistory(!showSettleHistory)}
                                    className="w-full flex items-center justify-between py-2 text-sm font-semibold text-white">
                                    <span className="flex items-center gap-1.5">
                                        <History className="w-4 h-4 text-success-light" />
                                        Settlement History ({settlements.length})
                                    </span>
                                    <span className="text-dark-500 text-xs">{showSettleHistory ? 'Hide' : 'Show'}</span>
                                </button>
                                <AnimatePresence>
                                    {showSettleHistory && (
                                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                            <div className="space-y-1 pb-2">
                                                {settlements.map((s) => (
                                                    <div key={s.id} className="glass-card px-3 py-2 flex items-center gap-2">
                                                        <div className="w-6 h-6 rounded-full bg-success/20 flex items-center justify-center flex-shrink-0">
                                                            <Check className="w-3 h-3 text-success-light" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-xs text-white truncate">
                                                                {getMemberName(s.fromUser)} → {getMemberName(s.toUser)}
                                                            </p>
                                                            <p className="text-[10px] text-dark-500">{format(new Date(s.createdAt), 'dd MMM yyyy, h:mm a')}</p>
                                                        </div>
                                                        <p className="text-xs font-bold text-warning-light">₹{s.amount.toFixed(2)}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        )}
                    </motion.div>
                </>
            )}

            {/* Settle Confirmation Modal */}
            <AnimatePresence>
                {settlingDebt && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
                        onClick={() => { if (!settled) setSettlingDebt(null); }}>
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="glass-card p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
                            {settled ? (
                                <div className="text-center py-4">
                                    <div className="w-14 h-14 rounded-full bg-success/20 mx-auto mb-3 flex items-center justify-center">
                                        <Check className="w-7 h-7 text-success-light" />
                                    </div>
                                    <p className="text-white font-semibold">Settled! ✨</p>
                                </div>
                            ) : (
                                <>
                                    <h3 className="text-lg font-bold text-white mb-3">Confirm Settlement</h3>
                                    <p className="text-dark-300 text-sm mb-5">
                                        Mark <span className="text-white font-bold">₹{settlingDebt.amount.toFixed(2)}</span> from{' '}
                                        <span className="text-white font-semibold">{getMemberName(settlingDebt.from)}</span> to{' '}
                                        <span className="text-white font-semibold">{getMemberName(settlingDebt.to)}</span> as settled?
                                    </p>
                                    <div className="flex gap-3">
                                        <button onClick={() => setSettlingDebt(null)} className="btn-ghost flex-1 text-sm">Cancel</button>
                                        <button onClick={handleSettle} className="btn-primary flex-1 text-sm">Confirm</button>
                                    </div>
                                </>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
