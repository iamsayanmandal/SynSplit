import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { createGroup } from '../lib/firestore';
import type { ExpenseMode } from '../types';

interface Props {
    open: boolean;
    onClose: () => void;
}

export default function CreateGroup({ open, onClose }: Props) {
    const { user } = useAuth();
    const [name, setName] = useState('');
    const [mode, setMode] = useState<ExpenseMode>('direct');
    const [loading, setLoading] = useState(false);

    const handleCreate = async () => {
        if (!name.trim() || !user) return;
        setLoading(true);
        try {
            await createGroup(name.trim(), mode, {
                uid: user.uid,
                name: user.displayName || 'User',
                email: user.email || '',
                photoURL: user.photoURL || null,
            });
            setName('');
            setMode('direct');
            onClose();
        } catch (err) {
            console.error('Failed to create group:', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[70] bg-black/60 flex items-end sm:items-center justify-center p-4 sm:p-0 pb-safe sm:pb-0"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="bg-dark-900 rounded-t-3xl sm:rounded-3xl p-6 w-full max-w-md border border-glass-border"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Handle bar */}
                        <div className="w-10 h-1 rounded-full bg-dark-600 mx-auto mb-4 sm:hidden" />

                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-white">Create Group</h2>
                            <button onClick={onClose} className="p-2 rounded-lg hover:bg-dark-800 transition-colors">
                                <X className="w-5 h-5 text-dark-400" />
                            </button>
                        </div>

                        {/* Group Name */}
                        <div className="mb-5">
                            <label className="block text-sm font-medium text-dark-300 mb-2">Group Name</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g., Roommates, Trip to Goa..."
                                className="input-dark"
                                autoFocus
                            />
                        </div>

                        {/* Mode Selection */}
                        <div className="mb-6">
                            <label className="block text-sm font-medium text-dark-300 mb-2">Expense Mode</label>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => setMode('direct')}
                                    className={`p-4 rounded-xl border-2 transition-all duration-300 text-left ${mode === 'direct'
                                        ? 'border-success bg-success/10'
                                        : 'border-glass-border bg-dark-800/50 hover:border-dark-500'
                                        }`}
                                >
                                    <span className="text-2xl block mb-2">💳</span>
                                    <p className="text-sm font-semibold text-white">Direct</p>
                                    <p className="text-xs text-dark-400 mt-1">Pay when you spend</p>
                                </button>
                                <button
                                    onClick={() => setMode('pool')}
                                    className={`p-4 rounded-xl border-2 transition-all duration-300 text-left ${mode === 'pool'
                                        ? 'border-accent bg-accent/10'
                                        : 'border-glass-border bg-dark-800/50 hover:border-dark-500'
                                        }`}
                                >
                                    <span className="text-2xl block mb-2">💰</span>
                                    <p className="text-sm font-semibold text-white">Pool Money</p>
                                    <p className="text-xs text-dark-400 mt-1">Monthly pool fund</p>
                                </button>
                            </div>
                        </div>

                        <button
                            onClick={handleCreate}
                            disabled={!name.trim() || loading}
                            className="btn-primary w-full text-sm"
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Creating...
                                </span>
                            ) : (
                                'Create Group'
                            )}
                        </button>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
