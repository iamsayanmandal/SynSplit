import { useMemo, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Wallet, Plus, ChevronDown, Clock, ArrowRightLeft, Coins, Download, Bell } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useActiveGroup } from '../contexts/ActiveGroupContext';
import { useGroupData } from '../contexts/GroupDataContext';
import { calculateSplit } from '../lib/splitCalculator';
import { getUserProfile } from '../lib/firestore';
import { CATEGORY_META } from '../types';
import type { ExpenseCategory, Member } from '../types';
import { format } from 'date-fns';
import SyncStatusIndicator from '../components/SyncStatusIndicator';
import { requestPermissionAndSaveToken } from '../lib/messaging';

export default function Dashboard() {
    const { user } = useAuth();
    const { groups, groupsLoading: loading, activeGroup, expenses, contributions, settlements, debts } = useGroupData();
    const { activeGroupId, setActiveGroupId } = useActiveGroup();
    const navigate = useNavigate();

    // PWA Install State
    const [deferredPrompt, setDeferredPrompt] = useState<any>((window as any).deferredPrompt);
    const [isStandalone, setIsStandalone] = useState(
        window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone
    );

    useEffect(() => {
        const handlePromptAvailable = () => {
            setDeferredPrompt((window as any).deferredPrompt);
        };
        const handleStatusChanged = () => {
            setDeferredPrompt(null);
            setIsStandalone(window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone);
        };
        window.addEventListener('pwa-install-prompt-available', handlePromptAvailable);
        window.addEventListener('pwa-install-status-changed', handleStatusChanged);
        return () => {
            window.removeEventListener('pwa-install-prompt-available', handlePromptAvailable);
            window.removeEventListener('pwa-install-status-changed', handleStatusChanged);
        };
    }, []);

    const handleInstallPWA = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            (window as any).deferredPrompt = null;
            setDeferredPrompt(null);
        }
    };

    // Notification Permission State
    const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(
        typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default'
    );

    const handleRequestNotificationPermission = async () => {
        if (!user) return;
        try {
            const permission = await Notification.requestPermission();
            setNotificationPermission(permission);
            if (permission === 'granted') {
                await requestPermissionAndSaveToken(user.uid);
            }
        } catch (e) {
            console.error('Failed to request notification permission:', e);
        }
    };

    // Auto-select first group
    useEffect(() => {
        if (!loading && groups.length > 0 && !activeGroupId) {
            setActiveGroupId(groups[0].id);
        }
        if (!loading && groups.length > 0 && activeGroupId && !groups.find((g) => g.id === activeGroupId)) {
            setActiveGroupId(groups[0].id);
        }
    }, [loading, groups, activeGroupId, setActiveGroupId]);

    const isPool = activeGroup?.mode === 'pool';

    // Pool stats: total contributed, total spent from pool, remaining
    const poolStats = useMemo(() => {
        const totalCollected = contributions.reduce((s, c) => s + c.amount, 0);
        const totalSpent = expenses.filter((e) => e.mode === 'pool').reduce((s, e) => s + e.amount, 0);
        return { totalCollected, totalSpent, balance: totalCollected - totalSpent };
    }, [contributions, expenses]);

    // Direct stats: uses splitCalculator for accurate share calculation
    const directStats = useMemo(() => {
        if (!user) return { totalSpend: 0, youPaid: 0, youGet: 0, youOwe: 0 };
        let totalSpend = 0;
        let youPaid = 0;
        let yourShare = 0;
        expenses.forEach((exp) => {
            totalSpend += exp.amount;
            if (exp.paidBy === user.uid) youPaid += exp.amount;
            // Use splitCalculator for accurate split
            const splits = calculateSplit(exp.amount, exp.splitType, exp.usedBy, exp.splitDetails);
            if (splits[user.uid]) yourShare += splits[user.uid];
        });
        // Factor in settlements
        const settledNet = settlements.reduce((s, st) => {
            if (st.fromUser === user.uid) return s - st.amount;
            if (st.toUser === user.uid) return s + st.amount;
            return s;
        }, 0);
        const net = youPaid - yourShare + settledNet;
        return {
            totalSpend,
            youPaid,
            youGet: Math.max(0, Math.round(net * 100) / 100),
            youOwe: Math.max(0, Math.round(-net * 100) / 100),
        };
    }, [expenses, settlements, user]);

    const recentExpenses = expenses.slice(0, 4);
    const firstName = user?.displayName?.split(' ')[0] || 'there';

    // Resolved users for members not currently in group (e.g. invite UIDs or former members)
    const [resolvedUsers, setResolvedUsers] = useState<Record<string, Partial<Member>>>({});

    useEffect(() => {
        if (!activeGroup || expenses.length === 0) return;

        const currentMemberIds = new Set(activeGroup.members.map(m => m.uid));
        const unknownUids = new Set<string>();

        expenses.forEach(exp => {
            // Check paidBy
            if (exp.paidBy !== 'pool' && !currentMemberIds.has(exp.paidBy) && !resolvedUsers[exp.paidBy]) {
                unknownUids.add(exp.paidBy);
            }
            // Check createdBy
            if (!currentMemberIds.has(exp.createdBy) && !resolvedUsers[exp.createdBy]) {
                unknownUids.add(exp.createdBy);
            }
            // Check usedBy
            exp.usedBy.forEach(uid => {
                if (!currentMemberIds.has(uid) && !resolvedUsers[uid]) {
                    unknownUids.add(uid);
                }
            });
        });

        if (unknownUids.size > 0) {
            const fetchProfiles = async () => {
                const newResolved: Record<string, Partial<Member>> = {};
                await Promise.all(Array.from(unknownUids).map(async (uid) => {
                    const profile = await getUserProfile(uid);
                    if (profile) {
                        newResolved[uid] = profile;
                    } else {
                        if (uid.startsWith('invite_')) {
                            const raw = uid.substring(7).split('_')[0];
                            const clean = raw.charAt(0).toUpperCase() + raw.slice(1);
                            newResolved[uid] = { name: clean, uid };
                        } else {
                            newResolved[uid] = { name: 'Former Member', uid };
                        }
                    }
                }));
                setResolvedUsers(prev => ({ ...prev, ...newResolved }));
            };
            fetchProfiles();
        }
    }, [expenses, activeGroup, resolvedUsers]);

    const getMemberName = (uid: string) => {
        if (uid === 'pool') return 'Pool';
        if (uid === user?.uid) return 'You';
        
        const member = activeGroup?.members.find((m) => m.uid === uid);
        if (member) return member.name;

        if (resolvedUsers[uid]) return resolvedUsers[uid].name || 'Unknown';
        return 'Unknown';
    };

    const getMemberPhoto = (uid: string) => {
        if (uid === user?.uid) return user.photoURL;
        
        const member = activeGroup?.members.find((m) => m.uid === uid);
        if (member) return member.photoURL;

        if (resolvedUsers[uid]) return resolvedUsers[uid].photoURL;
        return undefined;
    };

    if (loading) {
        return (
            <div className="px-4 pt-6 max-w-lg mx-auto">
                <div className="h-8 w-40 rounded shimmer mb-6" />
                <div className="grid grid-cols-2 gap-3 mb-6">
                    {[1, 2, 3, 4].map((i) => <div key={i} className="glass-card p-4 h-20 shimmer" />)}
                </div>
            </div>
        );
    }

    return (
        <div className="px-4 pt-6 pb-4 max-w-lg mx-auto">
            {/* Greeting */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between mb-4">
                <div>
                    <p className="text-dark-400 text-sm">Welcome back</p>
                    <h1 className="text-2xl font-bold text-white">{firstName} 👋</h1>
                </div>
                <div className="flex items-center gap-3">
                    <SyncStatusIndicator />
                    {user?.photoURL ? (
                        <img src={user.photoURL} alt="" className="w-10 h-10 rounded-xl border border-glass-border" />
                    ) : (
                        <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center">
                            <span className="text-accent-light font-bold">{firstName.charAt(0)}</span>
                        </div>
                    )}
                </div>
            </motion.div>

            {/* Group Switcher */}
            {groups.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 }} className="mb-4">
                    <div className="relative">
                        <select
                            value={activeGroupId || ''}
                            onChange={(e) => setActiveGroupId(e.target.value)}
                            className="w-full appearance-none bg-dark-800/70 border border-glass-border rounded-xl px-4 py-3 pr-10 text-white font-semibold text-sm focus:outline-none focus:border-accent/50 transition-colors cursor-pointer"
                        >
                            {groups.map((g) => (
                                <option key={g.id} value={g.id}>
                                    [{g.mode === 'pool' ? 'Pool' : 'Direct'}] {g.name} · {g.members.length} members
                                </option>
                            ))}
                        </select>
                        <ChevronDown className="w-4 h-4 text-dark-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                    {activeGroup && (
                        <div className="flex items-center gap-3 mt-2 px-1">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full ${isPool ? 'bg-accent/20 text-accent-light' : 'bg-success/20 text-success-light'}`}>
                                {isPool ? 'Pool Mode' : 'Direct Mode'}
                            </span>
                            <span className="text-[10px] text-dark-500 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {format(new Date(activeGroup.createdAt), 'dd MMM yyyy')}
                            </span>
                        </div>
                    )}
                </motion.div>
            )}

            {/* PWA Install Nudge */}
            {!isStandalone && deferredPrompt && (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                    className="glass-card p-4 border border-accent/25 bg-accent/5 mb-4 flex items-center gap-3 justify-between">
                    <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                            <Download className="w-4 h-4 text-accent-light flex-shrink-0" /> Install SynSplit App
                        </h3>
                        <p className="text-[11px] text-dark-300 mt-1">
                            Add to home screen for quick offline access and full-screen experience.
                        </p>
                    </div>
                    <button onClick={handleInstallPWA}
                        className="px-3 py-2 rounded-lg bg-gradient-to-r from-accent to-purple-600 hover:from-accent-hover hover:to-purple-700 text-white text-xs font-bold shadow-md shadow-accent/20 transition-all flex-shrink-0">
                        Install
                    </button>
                </motion.div>
            )}

            {/* Notification Permission Nudge */}
            {notificationPermission === 'default' && (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                    className="glass-card p-4 border border-warning/25 bg-warning/5 mb-4 flex items-center gap-3 justify-between">
                    <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                            <Bell className="w-4 h-4 text-warning flex-shrink-0" /> Enable Push Alerts
                        </h3>
                        <p className="text-[11px] text-dark-300 mt-1">
                            Never miss an expense or settlement. Grant permission to get instant updates.
                        </p>
                    </div>
                    <button onClick={handleRequestNotificationPermission}
                        className="px-3 py-2 rounded-lg bg-warning/10 border border-warning/20 hover:bg-warning/20 text-warning text-xs font-bold transition-all flex-shrink-0">
                        Enable
                    </button>
                </motion.div>
            )}

            {/* No groups CTA */}
            {groups.length === 0 && (
                <div className="glass-card p-8 text-center mb-5">
                    <p className="text-white font-semibold mb-1">No groups yet</p>
                    <p className="text-dark-400 text-sm mb-4">Create a group to start tracking</p>
                    <button onClick={() => navigate('/profile')} className="btn-primary text-sm">Create Group</button>
                </div>
            )}

            {/* Stats Cards */}
            {activeGroup && (
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="mb-5">
                    {isPool ? (
                        <div className="grid grid-cols-3 gap-2.5">
                            <div className="glass-card p-3.5 text-center">
                                <Wallet className="w-4 h-4 text-accent-light mx-auto mb-1" />
                                <p className="text-[10px] text-dark-400 uppercase tracking-wider mb-0.5">Collected</p>
                                <p className="text-lg font-bold text-white">₹{poolStats.totalCollected.toLocaleString('en-IN')}</p>
                            </div>
                            <div className="glass-card p-3.5 text-center">
                                <TrendingDown className="w-4 h-4 text-danger-light mx-auto mb-1" />
                                <p className="text-[10px] text-dark-400 uppercase tracking-wider mb-0.5">Spent</p>
                                <p className="text-lg font-bold text-danger-light">₹{poolStats.totalSpent.toLocaleString('en-IN')}</p>
                            </div>
                            <div className="glass-card p-3.5 text-center">
                                <TrendingUp className="w-4 h-4 text-success-light mx-auto mb-1" />
                                <p className="text-[10px] text-dark-400 uppercase tracking-wider mb-0.5">Left</p>
                                <p className={`text-lg font-bold ${poolStats.balance >= 0 ? 'text-success-light' : 'text-danger-light'}`}>
                                    ₹{poolStats.balance.toLocaleString('en-IN')}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-2.5">
                            <div className="glass-card p-3.5">
                                <div className="flex items-center gap-1.5 mb-1">
                                    <Wallet className="w-3.5 h-3.5 text-accent-light" />
                                    <span className="text-[10px] text-dark-400 uppercase tracking-wider">Total Spent</span>
                                </div>
                                <p className="text-lg font-bold text-white">₹{directStats.totalSpend.toLocaleString('en-IN')}</p>
                            </div>
                            <div className="glass-card p-3.5">
                                <div className="flex items-center gap-1.5 mb-1">
                                    <ArrowRightLeft className="w-3.5 h-3.5 text-blue-400" />
                                    <span className="text-[10px] text-dark-400 uppercase tracking-wider">You Paid</span>
                                </div>
                                <p className="text-lg font-bold text-white">₹{directStats.youPaid.toLocaleString('en-IN')}</p>
                            </div>
                            <div className="glass-card p-3.5">
                                <div className="flex items-center gap-1.5 mb-1">
                                    <TrendingUp className="w-3.5 h-3.5 text-success-light" />
                                    <span className="text-[10px] text-dark-400 uppercase tracking-wider">You Get</span>
                                </div>
                                <p className="text-lg font-bold text-success-light">₹{directStats.youGet.toLocaleString('en-IN')}</p>
                            </div>
                            <div className="glass-card p-3.5">
                                <div className="flex items-center gap-1.5 mb-1">
                                    <TrendingDown className="w-3.5 h-3.5 text-danger-light" />
                                    <span className="text-[10px] text-dark-400 uppercase tracking-wider">You Owe</span>
                                </div>
                                <p className="text-lg font-bold text-danger-light">₹{directStats.youOwe.toLocaleString('en-IN')}</p>
                            </div>
                        </div>
                    )}
                </motion.div>
            )}

            {/* Big Add Expense CTA */}
            {activeGroup && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="mb-5">
                    <button onClick={() => navigate('/add')}
                        className="w-full py-4 rounded-2xl bg-gradient-to-r from-accent to-purple-600 text-white font-semibold text-base flex items-center justify-center gap-2 shadow-neon hover:shadow-accent/30 transition-all active:scale-[0.98]">
                        <Plus className="w-5 h-5" /> Add Expense
                    </button>
                </motion.div>
            )}

            {/* Who owes whom — works for both pool and direct */}
            {activeGroup && debts.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-5">
                    <h2 className="text-sm font-semibold text-white mb-2">
                        {isPool ? 'Pool Settlements' : 'Who owes whom'}
                    </h2>
                    <div className="space-y-1.5">
                        {debts.map((d, i) => {
                            const fromIsYou = d.from === user?.uid;
                            const toIsYou = d.to === user?.uid;
                            return (
                                <div key={i} className="glass-card px-3.5 py-2.5 flex items-center gap-2">
                                    <p className="text-xs text-dark-200 flex-1">
                                        <span className={`font-semibold ${fromIsYou ? 'text-danger-light' : 'text-white'}`}>
                                            {getMemberName(d.from).split(' ')[0]}
                                        </span>
                                        <span className="text-dark-500 mx-1.5">→</span>
                                        <span className={`font-semibold ${toIsYou ? 'text-success-light' : 'text-white'}`}>
                                            {getMemberName(d.to).split(' ')[0]}
                                        </span>
                                    </p>
                                    <p className="text-xs font-bold text-warning-light">₹{d.amount.toFixed(2)}</p>
                                </div>
                            );
                        })}
                    </div>
                </motion.div>
            )}

            {/* Recent Expenses */}
            {activeGroup && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.13 }} className="mb-5">
                    <div className="flex items-center justify-between mb-2">
                        <h2 className="text-sm font-semibold text-white">Recent Transactions</h2>
                        {expenses.length > 4 && (
                            <button onClick={() => navigate('/expenses')} className="text-xs text-accent-light font-medium">
                                See all →
                            </button>
                        )}
                    </div>
                    {recentExpenses.length === 0 ? (
                        <div className="glass-card p-5 text-center">
                            <p className="text-dark-400 text-sm">No transactions yet</p>
                        </div>
                    ) : (
                        <div className="space-y-1.5">
                            {recentExpenses.map((exp) => {
                                const cat = CATEGORY_META[exp.category as ExpenseCategory] || CATEGORY_META.others;
                                const payerName = getMemberName(exp.paidBy);
                                const payerPhoto = exp.paidBy === 'pool' ? null : getMemberPhoto(exp.paidBy);


                                return (
                                    <div key={exp.id} className="glass-card px-3.5 py-3 flex flex-col gap-2 relative overflow-hidden">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                                                style={{ backgroundColor: cat.color + '20' }}>
                                                <cat.icon className="w-4 h-4" style={{ color: cat.color }} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-white truncate">{exp.description}</p>
                                                <p className="text-[11px] text-dark-500">
                                                    {format(new Date(exp.createdAt), 'dd MMM · h:mm a')}
                                                </p>
                                            </div>
                                            <p className="text-sm font-bold text-white flex-shrink-0">₹{exp.amount.toLocaleString('en-IN')}</p>
                                        </div>

                                        {/* Payer & Split Info Row */}
                                        <div className="pt-1.5 border-t border-dark-800/40 flex items-center justify-between gap-2 text-[10px] text-dark-400">
                                            <div className="flex items-center gap-1.5 min-w-0">
                                                <span className="text-dark-500">Paid by:</span>
                                                {exp.paidBy === 'pool' ? (
                                                    <span className="w-3.5 h-3.5 rounded-full bg-accent/20 flex items-center justify-center border border-accent/30">
                                                        <Coins className="w-2 h-2 text-accent-light" />
                                                    </span>
                                                ) : payerPhoto ? (
                                                    <img src={payerPhoto} alt="" className="w-3.5 h-3.5 rounded-full border border-dark-700 object-cover" />
                                                ) : (
                                                    <img src={`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(payerName)}`} alt="" className="w-3.5 h-3.5 rounded-full border border-dark-700" />
                                                )}
                                                <span className="font-semibold text-white truncate max-w-[80px]">{payerName}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 flex-shrink-0">
                                                <span className="text-dark-500">Split:</span>
                                                <div className="flex -space-x-1.5 overflow-hidden">
                                                    {exp.usedBy.map((uid) => {
                                                        const name = getMemberName(uid);
                                                        const photo = getMemberPhoto(uid);
                                                        return photo ? (
                                                            <img key={uid} src={photo} alt={name} title={name} className="inline-block w-3.5 h-3.5 rounded-full border border-dark-900 object-cover" />
                                                        ) : (
                                                            <img key={uid} src={`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`} alt={name} title={name} className="inline-block w-3.5 h-3.5 rounded-full border border-dark-900" />
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </motion.div>
            )}

            {/* Footer */}
            <div className="text-center py-3 border-t border-glass-border">
                <p className="text-dark-500 text-xs">
                    Developed by{' '}
                    <a href="https://sayanmandal.in" target="_blank" rel="noopener noreferrer"
                        className="text-accent-light hover:underline font-medium">Sayan Mandal</a>
                </p>
            </div>
        </div>
    );
}
