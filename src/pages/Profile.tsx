import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, Plus, UserPlus, ChevronDown, ChevronUp, Trash2, Crown, X, Wallet, Pencil, Check, ToggleLeft, ToggleRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useActiveGroup } from '../contexts/ActiveGroupContext';
import { useGroups } from '../hooks/hooks';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { deleteGroup, addMemberToGroup, addPoolContribution, updateGroupName, removeMemberFromGroup, toggleAllowMemberExpenses } from '../lib/firestore';
import CreateGroup from '../components/CreateGroup';
import type { Member } from '../types';

export default function Profile() {
    const { user } = useAuth();
    const { groups, loading } = useGroups();
    const { activeGroupId, setActiveGroupId } = useActiveGroup();

    const [showCreate, setShowCreate] = useState(false);
    const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

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

    const isAdmin = (groupCreatedBy: string) => groupCreatedBy === user?.uid;

    const handleSignOut = async () => {
        await signOut(auth);
    };

    const handleDelete = async (groupId: string) => {
        if (window.confirm('Delete this group and all its data?')) {
            await deleteGroup(groupId);
            if (activeGroupId === groupId) {
                const remaining = groups.filter((g) => g.id !== groupId);
                setActiveGroupId(remaining.length > 0 ? remaining[0].id : null);
            }
        }
    };

    const handleRemoveMember = async (groupId: string, memberUid: string, memberName: string) => {
        if (window.confirm(`Remove ${memberName} from this group?`)) {
            const group = groups.find((g) => g.id === groupId);
            if (group) {
                await removeMemberFromGroup(groupId, memberUid, group.members);
            }
        }
    };

    const handleSaveName = async (groupId: string) => {
        if (!editNameValue.trim()) return;
        await updateGroupName(groupId, editNameValue.trim());
        setEditingNameFor(null);
    };

    const handleToggleAllowExpenses = async (groupId: string, current: boolean) => {
        await toggleAllowMemberExpenses(groupId, !current);
    };

    const handleAddMember = async () => {
        if (!memberName.trim() || !memberEmail.trim() || !addingMemberTo) return;
        const group = groups.find((g) => g.id === addingMemberTo);
        if (!group) return;
        setAddingMember(true);
        try {
            const newMember: Member = {
                uid: memberEmail.trim().replace(/[^a-zA-Z0-9]/g, '_'),
                name: memberName.trim(),
                email: memberEmail.trim(),
            };
            await addMemberToGroup(group.id, newMember, group.members);
            setMemberName('');
            setMemberEmail('');
            setAddingMemberTo(null);
        } catch (err) {
            console.error('Failed to add member:', err);
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
                className="glass-card p-5 flex items-center gap-4 mb-5">
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
            </motion.div>

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
                                                <span className="text-base">{g.mode === 'pool' ? '💰' : '💳'}</span>
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

            {/* Sign Out */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }} className="mt-5">
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

            {/* Add Member Modal */}
            <AnimatePresence>
                {addingMemberTo && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center"
                        onClick={() => setAddingMemberTo(null)}>
                        <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            className="bg-dark-900 rounded-t-3xl sm:rounded-3xl p-6 w-full max-w-md border border-glass-border"
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
                        className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center"
                        onClick={() => setAddingPoolTo(null)}>
                        <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            className="bg-dark-900 rounded-t-3xl sm:rounded-3xl p-6 w-full max-w-md border border-glass-border"
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
