import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, Plus, UserPlus, ChevronDown, ChevronUp, Trash2, Crown, X, Wallet, Pencil, Check, ToggleLeft, ToggleRight, ExternalLink, FileText, Shield, Coins, CreditCard, Send, Bell, Download } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useActiveGroup } from '../contexts/ActiveGroupContext';
import { useGroups } from '../hooks/hooks';
import { signOut } from 'firebase/auth';
import { auth, db } from '../firebase';
import { deleteGroup, addMemberToGroup, addPoolContribution, updateGroupName, removeMemberFromGroup, toggleAllowMemberExpenses, getUserByEmail } from '../lib/firestore';
import { sanitizeInput } from '../lib/splitCalculator';
import CreateGroup from '../components/CreateGroup';
import ConfirmDialog from '../components/ConfirmDialog';
import type { Member, Expense } from '../types';
import SyncStatusIndicator from '../components/SyncStatusIndicator';
import { requestPermissionAndSaveToken } from '../lib/messaging';
import { collection, query, where, onSnapshot, doc, setDoc } from 'firebase/firestore';

export default function Profile() {
    const { user } = useAuth();
    const { groups, loading } = useGroups();
    const { activeGroupId, setActiveGroupId } = useActiveGroup();

    const [showCreate, setShowCreate] = useState(false);

    // ─── Monthly Expenses Tracking (All Groups) ───
    const [allExpenses, setAllExpenses] = useState<Expense[]>([]);

    useEffect(() => {
        if (groups.length === 0) {
            setAllExpenses([]);
            return;
        }

        const groupIds = groups.map((g) => g.id);
        
        // Query expenses matching this user's groups
        const q = query(
            collection(db, 'expenses'),
            where('groupId', 'in', groupIds)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const items: Expense[] = [];
            snapshot.forEach((doc) => {
                items.push({ id: doc.id, ...doc.data() } as Expense);
            });
            setAllExpenses(items);
        });

        return unsubscribe;
    }, [groups]);

    const monthlyStats = useMemo(() => {
        if (!user) return { totalShare: 0, totalPaid: 0 };
        const startOfCurrentMonth = new Date();
        startOfCurrentMonth.setDate(1);
        startOfCurrentMonth.setHours(0, 0, 0, 0);
        const startMs = startOfCurrentMonth.getTime();

        let totalShare = 0;
        let totalPaid = 0;

        // Filter current month's expenses
        const thisMonthExpenses = allExpenses.filter((e) => (e.createdAt || 0) >= startMs);

        thisMonthExpenses.forEach((exp) => {
            // Amount paid by this user
            if (exp.paidBy === user.uid) {
                totalPaid += exp.amount;
            }

            // User's split share
            if (exp.usedBy.includes(user.uid)) {
                let share = 0;
                const { amount, splitType, splitDetails, usedBy } = exp;
                switch (splitType) {
                    case 'equal':
                        share = amount / usedBy.length;
                        break;
                    case 'unequal':
                        share = (splitDetails && splitDetails[user.uid]) ? splitDetails[user.uid] : 0;
                        break;
                    case 'percentage':
                        share = (amount * ((splitDetails && splitDetails[user.uid]) ? splitDetails[user.uid] : 0)) / 100;
                        break;
                    case 'share': {
                        const details = splitDetails || {};
                        const totalShares = Object.values(details).reduce((a: number, b: number) => a + b, 0);
                        const userShare = details[user.uid] || 0;
                        share = totalShares ? (amount * userShare) / totalShares : 0;
                        break;
                    }
                }
                totalShare += share;
            }
        });

        return {
            totalShare: Math.round(totalShare * 100) / 100,
            totalPaid: Math.round(totalPaid * 100) / 100,
        };
    }, [allExpenses, user]);

    // ─── Telegram Settings State ───
    const [telegramChatId, setTelegramChatId] = useState('');
    const [telegramNotificationsEnabled, setTelegramNotificationsEnabled] = useState(false);
    const [savingTelegram, setSavingTelegram] = useState(false);
    const [isTelegramMinimized, setIsTelegramMinimized] = useState(true);

    useEffect(() => {
        if (!user) return;
        const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.data();
                setTelegramChatId(data.telegramChatId || '');
                setTelegramNotificationsEnabled(data.telegramNotificationsEnabled || false);
                if (data.telegramChatId) {
                    setIsTelegramMinimized(true);
                } else {
                    setIsTelegramMinimized(false);
                }
            } else {
                setIsTelegramMinimized(false);
            }
        });
        return unsubscribe;
    }, [user]);

    const handleSaveTelegram = async () => {
        if (!user) return;
        setSavingTelegram(true);
        try {
            await setDoc(doc(db, 'users', user.uid), {
                telegramChatId: telegramChatId.trim(),
                telegramNotificationsEnabled,
            }, { merge: true });
            setIsTelegramMinimized(true);
            alert('Telegram integration settings updated successfully!');
        } catch (err) {
            console.error('Failed to save Telegram settings:', err);
            alert('Failed to save settings. Please try again.');
        } finally {
            setSavingTelegram(false);
        }
    };

    // ─── PWA Install State ───
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

    // ─── Notification Permission State ───
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
    const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
    const [showTerms, setShowTerms] = useState(false);

    // Add member state
    const [addingMemberTo, setAddingMemberTo] = useState<string | null>(null);
    const [memberName, setMemberName] = useState('');
    const [memberEmail, setMemberEmail] = useState('');
    const [addingMember, setAddingMember] = useState(false);

    // Pool money state
    const [addingPoolTo, setAddingPoolTo] = useState<string | null>(null);
    const [poolAmount, setPoolAmount] = useState('');
    const [addingPool, setAddingPool] = useState(false);
    const [poolForMember, setPoolForMember] = useState<string>(''); // uid of member contributing

    // Edit name state
    const [editingNameFor, setEditingNameFor] = useState<string | null>(null);
    const [editNameValue, setEditNameValue] = useState('');

    // Confirmation Dialog State
    const [confirmDialog, setConfirmDialog] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        confirmText: string;
        type: 'danger' | 'warning' | 'info';
        onConfirm: () => Promise<void>;
    }>({
        isOpen: false,
        title: '',
        message: '',
        confirmText: '',
        type: 'danger',
        onConfirm: async () => { },
    });
    const [confirmLoading, setConfirmLoading] = useState(false);

    const isAdmin = (groupCreatedBy: string) => groupCreatedBy === user?.uid;

    const handleSignOut = async () => {
        try {
            await signOut(auth);
        } catch (error) {
            console.error('Error signing out:', error);
        }
    };

    const handleDelete = (groupId: string) => {
        setConfirmDialog({
            isOpen: true,
            title: 'Delete Group',
            message: 'Are you sure you want to delete this group? This action cannot be undone and all data will be lost.',
            confirmText: 'Delete Group',
            type: 'danger',
            onConfirm: async () => {
                setConfirmLoading(true);
                try {
                    await deleteGroup(groupId);
                    if (activeGroupId === groupId) {
                        const remaining = groups.filter((g) => g.id !== groupId);
                        setActiveGroupId(remaining.length > 0 ? remaining[0].id : null);
                    }
                    setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                } catch (error) {
                    console.error('Failed to delete group:', error);
                } finally {
                    setConfirmLoading(false);
                }
            }
        });
    };

    const handleRemoveMember = (groupId: string, memberUid: string, memberName: string) => {
        setConfirmDialog({
            isOpen: true,
            title: 'Remove Member',
            message: `Are you sure you want to remove ${memberName} from this group?`,
            confirmText: 'Remove',
            type: 'danger',
            onConfirm: async () => {
                setConfirmLoading(true);
                try {
                    const group = groups.find((g) => g.id === groupId);
                    if (group) {
                        await removeMemberFromGroup(groupId, memberUid, group.members);
                    }
                    setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                } catch (error) {
                    console.error('Failed to remove member:', error);
                } finally {
                    setConfirmLoading(false);
                }
            }
        });
    };

    const handleSaveName = async (groupId: string) => {
        const sanitized = sanitizeInput(editNameValue);
        if (!sanitized) return;
        await updateGroupName(groupId, sanitized);
        setEditingNameFor(null);
    };

    const handleToggleAllowExpenses = async (groupId: string, current: boolean) => {
        await toggleAllowMemberExpenses(groupId, !current);
    };

    const handleAddMember = async () => {
        const sanitizedName = sanitizeInput(memberName);
        const trimmedEmail = memberEmail.trim();
        if (!sanitizedName || !trimmedEmail || !addingMemberTo) return;
        const group = groups.find((g) => g.id === addingMemberTo);
        if (!group) return;
        setAddingMember(true);
        try {
            // DIRECT ADD: Seamlessly add by email even if user doesn't exist yet
            const safeId = trimmedEmail.replace(/[^a-zA-Z0-9]/g, '_');

            // Optional: Try to link to real user if they exist
            const realUser = await getUserByEmail(trimmedEmail);

            const memberToAdd: Member = realUser || {
                uid: `invite_${safeId}`,
                name: sanitizedName,
                email: memberEmail.trim(),
                photoURL: null
            };

            // Check if already in group (by UID or Email)
            if (group.members.some(m => m.uid === memberToAdd.uid || m.email === memberToAdd.email)) {
                alert("This user is already in the group.");
                return;
            }

            await addMemberToGroup(group.id, memberToAdd, group.members);
            setMemberName('');
            setMemberEmail('');
            setAddingMemberTo(null);

            if (!realUser) {
                alert(`Added ${memberName}!\n\nThey will see this group automatically when they sign in with ${memberEmail}.`);
            }
        } catch (err) {
            console.error('Failed to add member:', err);
            alert("Failed to add member. Please try again.");
        } finally {
            setAddingMember(false);
        }
    };

    const handleAddPoolMoney = async () => {
        if (!poolAmount || !addingPoolTo || !user || !poolForMember) return;
        const amount = parseFloat(poolAmount);
        if (amount <= 0) return;
        setAddingPool(true);
        try {
            const now = new Date();
            await addPoolContribution({
                groupId: addingPoolTo,
                userId: poolForMember, // Use selected member instead of always current user
                amount,
                month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
                createdBy: user.uid,
                createdAt: Date.now(),
            });
            setPoolAmount('');
            setPoolForMember('');
            setAddingPoolTo(null);
        } catch (err) {
            console.error('Failed to add pool money:', err);
        } finally {
            setAddingPool(false);
        }
    };

    const toggleExpand = (groupId: string) => {
        setExpandedGroup(expandedGroup === groupId ? null : groupId);
    };

    return (
        <div className="px-4 pt-6 pb-4 max-w-lg mx-auto">
            {/* User Card */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="glass-card p-5 flex items-center gap-4 mb-4">
                {user?.photoURL ? (
                    <img src={user.photoURL} alt="" className="w-14 h-14 rounded-2xl border-2 border-dark-700" />
                ) : (
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-accent to-purple-600 flex items-center justify-center">
                        <span className="text-2xl text-white font-bold">{user?.displayName?.charAt(0) || '?'}</span>
                    </div>
                )}
                <div className="flex-1 min-w-0">
                    <h2 className="text-lg font-bold text-white truncate">{user?.displayName || 'User'}</h2>
                    <p className="text-dark-400 text-sm truncate">{user?.email}</p>
                </div>
                <div className="flex-shrink-0">
                    <SyncStatusIndicator />
                </div>
            </motion.div>

            {/* Monthly Spending Stats Grid */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.02 }}
                className="grid grid-cols-2 gap-3 mb-5">
                <div className="glass-card p-4 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-3 opacity-10">
                        <Wallet className="w-10 h-10 text-accent-light" />
                    </div>
                    <p className="text-[10px] text-dark-400 font-bold uppercase tracking-wider">Your Share (This Month)</p>
                    <p className="text-xl font-bold text-white mt-1.5">₹{monthlyStats.totalShare}</p>
                    <p className="text-[9px] text-dark-500 mt-1">Across all {groups.length} groups</p>
                </div>
                <div className="glass-card p-4 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-3 opacity-10">
                        <Coins className="w-10 h-10 text-success-light" />
                    </div>
                    <p className="text-[10px] text-dark-400 font-bold uppercase tracking-wider">You Paid (This Month)</p>
                    <p className="text-xl font-bold text-success-light mt-1.5">₹{monthlyStats.totalPaid}</p>
                    <p className="text-[9px] text-dark-500 mt-1">Total cash outflow</p>
                </div>
            </motion.div>

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

            {/* Your Groups */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 }}>
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-white">Your Groups ({groups.length})</h3>
                    <button onClick={() => setShowCreate(true)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gradient-to-r from-accent to-purple-600 text-white text-xs font-medium shadow-neon">
                        <Plus className="w-3.5 h-3.5" /> New Group
                    </button>
                </div>

                {loading ? (
                    <div className="space-y-2">
                        {[1, 2].map((i) => <div key={i} className="glass-card p-4 h-16 shimmer" />)}
                    </div>
                ) : groups.length === 0 ? (
                    <div className="glass-card p-6 text-center">
                        <p className="text-dark-400 text-sm mb-3">No groups yet. Create one to start!</p>
                        <button onClick={() => setShowCreate(true)} className="btn-primary text-sm !py-2.5 !px-5">
                            Create Your First Group
                        </button>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {groups.map((g, i) => {
                            const admin = isAdmin(g.createdBy);
                            const expanded = expandedGroup === g.id;
                            const isActive = g.id === activeGroupId;
                            const isEditingName = editingNameFor === g.id;

                            return (
                                <motion.div key={g.id}
                                    initial={{ opacity: 0, y: 6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.03 }}
                                    className={`glass-card overflow-hidden border-2 transition-all ${isActive ? 'border-accent/40' : 'border-transparent'}`}
                                >
                                    {/* Group Header */}
                                    <div className="p-3.5 flex items-center gap-3">
                                        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => { setActiveGroupId(g.id); toggleExpand(g.id); }}>
                                            <div className="flex items-center gap-2">
                                                {g.mode === 'pool' ? (
                                                    <Coins className="w-4 h-4 text-accent-light flex-shrink-0" />
                                                ) : (
                                                    <CreditCard className="w-4 h-4 text-success-light flex-shrink-0" />
                                                )}
                                                {isEditingName ? (
                                                    <div className="flex items-center gap-1.5 flex-1" onClick={(e) => e.stopPropagation()}>
                                                        <input type="text" value={editNameValue} onChange={(e) => setEditNameValue(e.target.value)}
                                                            className="bg-dark-800 text-sm text-white rounded-lg px-2 py-1 border border-accent/30 focus:outline-none focus:border-accent flex-1 min-w-0"
                                                            autoFocus onKeyDown={(e) => e.key === 'Enter' && handleSaveName(g.id)} />
                                                        <button onClick={() => handleSaveName(g.id)} className="p-1 rounded-lg bg-accent/20 text-accent-light hover:bg-accent/30">
                                                            <Check className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button onClick={() => setEditingNameFor(null)} className="p-1 rounded-lg text-dark-400 hover:text-white">
                                                            <X className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <h4 className="text-sm font-semibold text-white truncate">{g.name}</h4>
                                                        {admin && <Crown className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />}
                                                        {admin && (
                                                            <button onClick={(e) => { e.stopPropagation(); setEditingNameFor(g.id); setEditNameValue(g.name); }}
                                                                className="p-0.5 rounded text-dark-600 hover:text-accent-light transition-colors">
                                                                <Pencil className="w-3 h-3" />
                                                            </button>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                            {!isEditingName && (
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="text-[10px] text-dark-400">{g.members.length} member{g.members.length !== 1 ? 's' : ''}</span>
                                                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${g.mode === 'pool' ? 'bg-accent/15 text-accent-light' : 'bg-success/15 text-success-light'}`}>
                                                        {g.mode === 'pool' ? 'Pool' : 'Direct'}
                                                    </span>
                                                    {isActive && (
                                                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-accent/20 text-accent-light">Active</span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <button onClick={() => toggleExpand(g.id)}
                                            className="p-1.5 rounded-lg text-dark-500 hover:text-white hover:bg-dark-800 transition-all">
                                            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                        </button>
                                    </div>

                                    {/* Expanded: Members + Actions */}
                                    <AnimatePresence>
                                        {expanded && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                transition={{ duration: 0.2 }}
                                                className="overflow-hidden"
                                            >
                                                <div className="px-3.5 pb-3.5 pt-0">
                                                    {/* Members List */}
                                                    <p className="text-[10px] text-dark-500 uppercase tracking-wider mb-1.5">Members</p>
                                                    <div className="space-y-1 mb-3">
                                                        {g.members.map((m) => (
                                                            <div key={m.uid} className="flex items-center gap-2 py-1">
                                                                {m.photoURL ? (
                                                                    <img src={m.photoURL} alt="" className="w-6 h-6 rounded-full" />
                                                                ) : (
                                                                    <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center">
                                                                        <span className="text-[9px] text-accent-light font-medium">{m.name.charAt(0)}</span>
                                                                    </div>
                                                                )}
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-xs text-white truncate">
                                                                        {m.name}
                                                                        {m.uid === g.createdBy && <span className="text-yellow-400 ml-1 text-[9px]">👑</span>}
                                                                        {m.uid === user?.uid && <span className="text-dark-500 ml-1 text-[9px]">(You)</span>}
                                                                    </p>
                                                                    <p className="text-[10px] text-dark-500 truncate">{m.email}</p>
                                                                </div>
                                                                {/* Remove button — admin only, can't remove self (admin) */}
                                                                {admin && m.uid !== g.createdBy && (
                                                                    <button onClick={() => handleRemoveMember(g.id, m.uid, m.name)}
                                                                        className="p-1 rounded-lg text-dark-600 hover:text-danger-light hover:bg-danger/10 transition-all">
                                                                        <X className="w-3 h-3" />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>

                                                    {/* Admin Actions */}
                                                    {admin && (
                                                        <>
                                                            <div className="flex flex-wrap gap-2 mb-2">
                                                                <button onClick={() => setAddingMemberTo(g.id)}
                                                                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-accent/10 border border-accent/20 text-accent-light text-xs font-medium hover:bg-accent/20 transition-all">
                                                                    <UserPlus className="w-3.5 h-3.5" /> Add Member
                                                                </button>
                                                                {g.mode === 'pool' && (
                                                                    <button onClick={() => setAddingPoolTo(g.id)}
                                                                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-success/10 border border-success/20 text-success-light text-xs font-medium hover:bg-success/20 transition-all">
                                                                        <Wallet className="w-3.5 h-3.5" /> Add Pool Money
                                                                    </button>
                                                                )}
                                                                <button onClick={() => handleDelete(g.id)}
                                                                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-danger/10 border border-danger/20 text-danger-light text-xs font-medium hover:bg-danger/20 transition-all">
                                                                    <Trash2 className="w-3.5 h-3.5" /> Delete
                                                                </button>
                                                            </div>

                                                            {/* Pool mode: allow member expenses toggle */}
                                                            {g.mode === 'pool' && (
                                                                <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-dark-800/50 border border-glass-border">
                                                                    <div>
                                                                        <p className="text-xs text-white font-medium">Allow members to add expenses</p>
                                                                        <p className="text-[10px] text-dark-500">Let non-admin members add pool expenses</p>
                                                                    </div>
                                                                    <button onClick={() => handleToggleAllowExpenses(g.id, g.allowMemberExpenses || false)}
                                                                        className="text-accent-light transition-all">
                                                                        {g.allowMemberExpenses ? (
                                                                            <ToggleRight className="w-7 h-7 text-success-light" />
                                                                        ) : (
                                                                            <ToggleLeft className="w-7 h-7 text-dark-500" />
                                                                        )}
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </motion.div>

            {/* Telegram Integration Card */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
                className="glass-card p-5 mt-4">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <Send className="w-4 h-4 text-accent-light" />
                        <h3 className="text-sm font-bold text-white">Telegram Notifications</h3>
                    </div>
                    {isTelegramMinimized && telegramChatId && (
                        <button
                            onClick={() => setIsTelegramMinimized(false)}
                            className="text-xs text-accent-light hover:underline font-semibold"
                        >
                            Edit
                        </button>
                    )}
                </div>

                {isTelegramMinimized && telegramChatId ? (
                    // Minimized Connected state
                    <div className="space-y-3 mt-2">
                        <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-success/5 border border-success/20">
                            <div>
                                <p className="text-xs text-white font-medium flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-success animate-pulse" /> Connected
                                </p>
                                <p className="text-[10px] text-dark-400 mt-0.5">Chat ID: {telegramChatId}</p>
                            </div>
                            <button
                                onClick={async () => {
                                    const nextEnabled = !telegramNotificationsEnabled;
                                    setTelegramNotificationsEnabled(nextEnabled);
                                    if (user) {
                                        await setDoc(doc(db, 'users', user.uid), {
                                            telegramNotificationsEnabled: nextEnabled,
                                        }, { merge: true });
                                    }
                                }}
                                className="text-accent-light transition-all"
                            >
                                {telegramNotificationsEnabled ? (
                                    <ToggleRight className="w-7 h-7 text-success-light" />
                                ) : (
                                    <ToggleLeft className="w-7 h-7 text-dark-500" />
                                )}
                            </button>
                        </div>
                        <p className="text-[9px] text-accent-light bg-accent/5 py-1.5 px-2.5 rounded-lg border border-accent/15">
                            📣 Telegram notifications are coming soon! Saving your Chat ID prepares your account for the launch.
                        </p>
                    </div>
                ) : (
                    // Expanded Form state
                    <>
                        <p className="text-[11px] text-dark-400 mb-4 leading-relaxed">
                            Link your Telegram ID to receive split and settlement alerts directly on Telegram.
                        </p>
                        <div className="space-y-3.5">
                            <div>
                                <label className="text-[10px] text-dark-500 font-bold uppercase tracking-wider block mb-1">Telegram Chat ID / User ID</label>
                                <input
                                    type="text"
                                    value={telegramChatId}
                                    onChange={(e) => setTelegramChatId(e.target.value)}
                                    placeholder="e.g. 123456789"
                                    className="input-dark text-xs"
                                />
                                <div className="mt-2 text-[10px] text-dark-400 leading-relaxed bg-dark-800/40 p-2 rounded-lg border border-glass-border">
                                    💡 Need your Chat ID? Open Telegram and send any message to{' '}
                                    <a
                                        href="https://t.me/raw_info_bot?start=ChatID"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-accent-light hover:underline font-semibold"
                                    >
                                        @raw_info_bot ↗
                                    </a>
                                    . It will instantly reply with your Chat ID. Copy and paste it here!
                                </div>
                            </div>
                            <div className="flex items-center justify-between py-2 px-1 rounded-lg bg-dark-800/20 border border-glass-border/30">
                                <div>
                                    <p className="text-xs text-white font-medium">Enable Telegram Alerts</p>
                                    <p className="text-[10px] text-dark-500">Forward notification updates to Telegram</p>
                                </div>
                                <button
                                    onClick={() => setTelegramNotificationsEnabled(!telegramNotificationsEnabled)}
                                    className="text-accent-light transition-all"
                                >
                                    {telegramNotificationsEnabled ? (
                                        <ToggleRight className="w-7 h-7 text-success-light" />
                                    ) : (
                                        <ToggleLeft className="w-7 h-7 text-dark-500" />
                                    )}
                                </button>
                            </div>
                            
                            <p className="text-[9px] text-accent-light bg-accent/5 py-1.5 px-2.5 rounded-lg border border-accent/15">
                                📣 Note: Telegram notifications are coming soon! Saving your Chat ID prepares your account.
                            </p>

                            <div className="flex gap-2">
                                {telegramChatId && (
                                    <button
                                        onClick={() => setIsTelegramMinimized(true)}
                                        className="w-1/3 border border-glass-border hover:bg-dark-800 text-white text-xs py-2 rounded-xl"
                                    >
                                        Cancel
                                    </button>
                                )}
                                <button
                                    onClick={handleSaveTelegram}
                                    disabled={savingTelegram}
                                    className={`btn-primary text-xs py-2 ${telegramChatId ? 'w-2/3' : 'w-full'}`}
                                >
                                    {savingTelegram ? 'Saving...' : 'Save Settings'}
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </motion.div>

            {/* Feedback & Suggestions */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }} className="mt-4">
                <a
                    href="https://forms.gle/fRdrU42JVmUbKTsr8"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-accent/10 to-purple-600/10 border border-accent/20 text-accent-light font-medium text-sm flex items-center justify-center gap-2 hover:from-accent/20 hover:to-purple-600/20 transition-all active:scale-[0.98]"
                >
                    <ExternalLink className="w-4 h-4" />
                    Feedback & Suggestions
                </a>
            </motion.div>

            {/* Terms & Conditions */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="mt-3">
                <button
                    onClick={() => setShowTerms(!showTerms)}
                    className="w-full py-3 rounded-xl bg-dark-800/50 border border-glass-border text-dark-300 font-medium text-sm flex items-center justify-center gap-2 hover:bg-dark-800 transition-all"
                >
                    <FileText className="w-4 h-4" />
                    Terms & Conditions
                    <ChevronDown className={`w-4 h-4 transition-transform ${showTerms ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence>
                    {showTerms && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                        >
                            <div className="glass-card p-4 mt-2 space-y-3">
                                <div className="flex items-center gap-2 mb-2">
                                    <Shield className="w-5 h-5 text-accent-light" />
                                    <h3 className="text-sm font-bold text-white">Terms & Conditions</h3>
                                </div>
                                <div className="text-[11px] text-dark-300 space-y-2.5 leading-relaxed">
                                    <p>
                                        <span className="text-white font-medium">1. Nature of Service:</span> SynSplit is a free, personal project developed by Sayan Mandal. It is provided "as-is" with no warranties of any kind.
                                    </p>
                                    <p>
                                        <span className="text-white font-medium">2. Data Usage:</span> No user data will be sold, shared, or used for commercial purposes. Data may be used solely to monitor active users and improve the application.
                                    </p>
                                    <p>
                                        <span className="text-white font-medium">3. User Responsibility:</span> Users are solely responsible for the accuracy of their expense data. The developer (Sayan Mandal) is not liable for any financial discrepancies, data loss, or decisions made based on this application.
                                    </p>
                                    <p>
                                        <span className="text-white font-medium">4. Service Availability:</span> The developer reserves the right to block any user, modify, or shut down this project at any time without prior notice.
                                    </p>
                                    <p>
                                        <span className="text-white font-medium">5. Changes to Terms:</span> These Terms & Conditions may be updated at any time. Continued use of SynSplit constitutes acceptance of the current and any future terms.
                                    </p>
                                    <p>
                                        <span className="text-white font-medium">6. Limitation of Liability:</span> Sayan Mandal and any associated parties are not responsible for any direct, indirect, or consequential damages arising from the use of this application.
                                    </p>
                                    <p className="text-dark-500 pt-1 border-t border-dark-700/50">
                                        By using SynSplit, you agree to all the above terms and any future modifications.
                                    </p>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>

            {/* Sign Out */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mt-3">
                <button onClick={handleSignOut}
                    className="w-full py-3 rounded-xl border border-danger/30 text-danger-light font-medium text-sm flex items-center justify-center gap-2 hover:bg-danger/10 transition-all">
                    <LogOut className="w-4 h-4" />
                    Sign Out
                </button>
            </motion.div>

            {/* Footer */}
            <div className="text-center py-5">
                <p className="text-dark-600 text-xs">
                    Developed by{' '}
                    <a href="https://sayanmandal.in" target="_blank" rel="noopener noreferrer"
                        className="text-accent-light/70 hover:underline">Sayan Mandal</a>
                </p>
            </div>

            {/* Create Group Modal */}
            <CreateGroup open={showCreate} onClose={() => setShowCreate(false)} />

            {/* Confirm Dialog */}
            <ConfirmDialog
                isOpen={confirmDialog.isOpen}
                onClose={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmDialog.onConfirm}
                title={confirmDialog.title}
                message={confirmDialog.message}
                confirmText={confirmDialog.confirmText}
                type={confirmDialog.type}
                isLoading={confirmLoading}
            />

            {/* Add Member Modal */}
            <AnimatePresence>
                {addingMemberTo && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[70] bg-black/60 flex items-end sm:items-center justify-center"
                        onClick={() => setAddingMemberTo(null)}>
                        <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            className="bg-dark-900 rounded-t-3xl sm:rounded-3xl p-6 pb-10 sm:pb-6 w-full max-w-md border border-glass-border"
                            onClick={(e) => e.stopPropagation()}>
                            <div className="w-10 h-1 rounded-full bg-dark-600 mx-auto mb-4 sm:hidden" />
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-bold text-white">Add Member</h2>
                                <button onClick={() => setAddingMemberTo(null)} className="p-1.5 rounded-lg hover:bg-dark-800 transition-colors">
                                    <X className="w-4 h-4 text-dark-400" />
                                </button>
                            </div>
                            <div className="space-y-3 mb-5">
                                <input type="text" value={memberName} onChange={(e) => setMemberName(e.target.value)}
                                    placeholder="Name" className="input-dark" autoFocus />
                                <input type="email" value={memberEmail} onChange={(e) => setMemberEmail(e.target.value)}
                                    placeholder="Gmail ID (e.g. user@gmail.com)" className="input-dark" />
                            </div>
                            <button onClick={handleAddMember} disabled={!memberName.trim() || !memberEmail.trim() || addingMember}
                                className="btn-primary w-full text-sm">
                                {addingMember ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Adding...
                                    </span>
                                ) : 'Add Member'}
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Add Pool Money Modal */}
            <AnimatePresence>
                {addingPoolTo && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[70] bg-black/60 flex items-end sm:items-center justify-center"
                        onClick={() => setAddingPoolTo(null)}>
                        <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            className="bg-dark-900 rounded-t-3xl sm:rounded-3xl p-6 pb-10 sm:pb-6 w-full max-w-md border border-glass-border"
                            onClick={(e) => e.stopPropagation()}>
                            <div className="w-10 h-1 rounded-full bg-dark-600 mx-auto mb-4 sm:hidden" />
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-bold text-white">Add Pool Money</h2>
                                <button onClick={() => setAddingPoolTo(null)} className="p-1.5 rounded-lg hover:bg-dark-800 transition-colors">
                                    <X className="w-4 h-4 text-dark-400" />
                                </button>
                            </div>
                            <p className="text-dark-400 text-xs mb-3">
                                Adding money to <span className="text-white font-medium">{groups.find(g => g.id === addingPoolTo)?.name}</span>
                            </p>

                            {/* Member selector — who is contributing? */}
                            <div className="mb-4">
                                <p className="text-xs text-dark-400 mb-2 font-medium">Who gave this money?</p>
                                <div className="flex flex-wrap gap-2">
                                    {groups.find(g => g.id === addingPoolTo)?.members.map((m) => (
                                        <button key={m.uid} onClick={() => setPoolForMember(m.uid)}
                                            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all border ${poolForMember === m.uid
                                                ? 'bg-accent/20 text-accent-light border-accent/40 shadow-sm shadow-accent/10'
                                                : 'bg-dark-800/60 text-dark-300 border-glass-border hover:bg-dark-700'
                                                }`}>
                                            {m.name}
                                            {m.uid === user?.uid && <span className="text-[10px] text-dark-500 ml-1">(You)</span>}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex items-center gap-2 mb-5">
                                <span className="text-xl text-dark-400">₹</span>
                                <input type="number" value={poolAmount} onChange={(e) => setPoolAmount(e.target.value)}
                                    placeholder="0" inputMode="decimal" autoFocus
                                    className="bg-transparent text-2xl font-bold text-white flex-1 focus:outline-none placeholder:text-dark-700 min-w-0" />
                            </div>
                            <button onClick={handleAddPoolMoney} disabled={!poolAmount || parseFloat(poolAmount) <= 0 || !poolForMember || addingPool}
                                className="btn-primary w-full text-sm">
                                {addingPool ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Adding...
                                    </span>
                                ) : poolForMember ? `Add Money for ${groups.find(g => g.id === addingPoolTo)?.members.find(m => m.uid === poolForMember)?.name || 'Member'}` : 'Select a member first'}
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
