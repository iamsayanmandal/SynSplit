import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Check, Mic, MicOff, MapPin, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useActiveGroup } from '../contexts/ActiveGroupContext';
import { useGroups } from '../hooks/hooks';
import { addExpense } from '../lib/firestore';
import { parseVoiceExpense } from '../lib/gemini';
import { CATEGORY_META } from '../types';
import type { ExpenseCategory, SplitType, ExpenseMode } from '../types';

export default function AddExpense() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { groups } = useGroups();
    const { activeGroupId } = useActiveGroup();

    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [groupId, setGroupId] = useState(activeGroupId || '');
    const [category, setCategory] = useState<ExpenseCategory>('food');
    const [paidBy, setPaidBy] = useState(user?.uid || '');
    const [usedBy, setUsedBy] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);

    // Voice input state
    const [isListening, setIsListening] = useState(false);
    const [voiceParsing, setVoiceParsing] = useState(false);

    // Location state
    const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [gettingLocation, setGettingLocation] = useState(false);

    const getLocation = () => {
        if (!navigator.geolocation) {
            alert('Geolocation is not supported by your browser.');
            return;
        }
        setGettingLocation(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                setGettingLocation(false);
            },
            (err) => {
                console.error('Location error:', err);
                alert('Could not get your location. Please enable location access.');
                setGettingLocation(false);
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    };

    const startVoice = useCallback(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert('Voice input not supported in this browser.');
            return;
        }
        const recognition = new SpeechRecognition();
        recognition.lang = 'en-IN';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => setIsListening(true);
        recognition.onend = () => setIsListening(false);
        recognition.onerror = () => setIsListening(false);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        recognition.onresult = async (event: any) => {
            const transcript = event.results[0][0].transcript;
            setVoiceParsing(true);
            try {
                const parsed = await parseVoiceExpense(transcript);
                if (parsed.amount) setAmount(parsed.amount.toString());
                if (parsed.description) setDescription(parsed.description);
                if (parsed.category && parsed.category in CATEGORY_META) {
                    setCategory(parsed.category as ExpenseCategory);
                }
            } catch (err) {
                console.error('Voice parse error:', err);
                setDescription(transcript);
            } finally {
                setVoiceParsing(false);
            }
        };

        recognition.start();
    }, []);

    const selectedGroup = useMemo(() => groups.find((g) => g.id === groupId), [groups, groupId]);

    // When groups load and we have an activeGroupId, pre-select the group & its members
    useEffect(() => {
        if (groups.length > 0 && activeGroupId && !groupId) {
            handleGroupChange(activeGroupId);
        } else if (groups.length > 0 && groupId) {
            const grp = groups.find((g) => g.id === groupId);
            if (grp && usedBy.length === 0) {
                setUsedBy(grp.members.map((m) => m.uid));
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [groups]);

    // Auto-select first group and its members
    const handleGroupChange = (id: string) => {
        setGroupId(id);
        const grp = groups.find((g) => g.id === id);
        if (grp) {
            setUsedBy(grp.members.map((m) => m.uid));
            if (grp.members.find((m) => m.uid === user?.uid)) {
                setPaidBy(user?.uid || '');
            }
        }
    };

    const toggleUsedBy = (uid: string) => {
        setUsedBy((prev) =>
            prev.includes(uid) ? prev.filter((u) => u !== uid) : [...prev, uid]
        );
    };

    const handleSubmit = async () => {
        if (!user || !amount || !groupId || usedBy.length === 0) return;
        setLoading(true);
        try {
            const mode: ExpenseMode = selectedGroup?.mode || 'direct';
            await addExpense({
                groupId,
                amount: parseFloat(amount),
                description: description.trim() || CATEGORY_META[category].label,
                category,
                mode,
                paidBy: mode === 'pool' ? 'pool' : paidBy,
                usedBy,
                splitType: 'equal' as SplitType,
                ...(location ? { location } : {}),
                createdAt: 0, // Will be overridden by firestore.ts
                createdBy: user.uid,
            });
            navigate('/');
        } catch (err) {
            console.error('Failed to add expense:', err);
        } finally {
            setLoading(false);
        }
    };

    const canSubmit = parseFloat(amount) > 0 && groupId && usedBy.length > 0;
    const categories = Object.entries(CATEGORY_META) as [ExpenseCategory, typeof CATEGORY_META[ExpenseCategory]][];

    // Pool mode restriction: only admin can add unless allowMemberExpenses is on
    const isAdmin = selectedGroup?.createdBy === user?.uid;
    const isPoolRestricted = selectedGroup?.mode === 'pool' && !isAdmin && !selectedGroup?.allowMemberExpenses;

    return (
        <div className="min-h-screen min-h-[100dvh] bg-dark-950 md:flex md:items-center md:justify-center md:py-12">
            <div className="w-full max-w-lg mx-auto pb-32 md:pb-0">
                {/* Header */}
                <div className="px-4 pt-6 pb-3">
                    <div className="flex items-center gap-3">
                        <button onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-dark-800 transition-colors">
                            <ArrowLeft className="w-5 h-5 text-dark-300" />
                        </button>
                        <h1 className="text-xl font-bold text-white flex-1">Add Expense</h1>
                        <button onClick={startVoice} disabled={isListening || voiceParsing}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-medium text-sm transition-all ${isListening ? 'bg-danger/30 text-danger-light animate-pulse border border-danger/40'
                                : voiceParsing ? 'bg-accent/20 text-accent-light border border-accent/30'
                                    : 'bg-gradient-to-r from-accent/20 to-purple-600/20 text-accent-light border border-accent/30 hover:from-accent/30 hover:to-purple-600/30'
                                }`}>
                            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                            <span>{isListening ? 'Stop' : voiceParsing ? 'Parsing...' : 'Voice'}</span>
                        </button>
                    </div>
                    {(isListening || voiceParsing) && (
                        <p className={`text-xs mt-2 font-medium ${isListening ? 'text-danger-light animate-pulse' : 'text-accent-light'}`}>
                            {isListening ? '🎤 Listening... speak now' : '✨ Parsing with AI...'}
                        </p>
                    )}
                </div>

                {/* Form — All in one view */}
                {isPoolRestricted ? (
                    <div className="px-4 pb-6 max-w-lg mx-auto">
                        <div className="glass-card p-8 text-center">
                            <p className="text-3xl mb-3">🔒</p>
                            <p className="text-white font-semibold mb-1">Admin Only</p>
                            <p className="text-dark-400 text-sm">
                                Only the group admin can add expenses in pool mode.
                            </p>
                            <p className="text-dark-500 text-xs mt-3">
                                Ask your admin to enable "Allow members to add expenses" in group settings.
                            </p>
                        </div>
                    </div>
                ) : (
                    <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="px-4 pb-6 max-w-lg mx-auto space-y-5"
                    >
                        {/* Row 1: Amount + Description */}
                        <div className="glass-card p-4 space-y-3">
                            <label className="text-xs text-dark-400 font-medium uppercase tracking-wider">Amount & Description</label>
                            <div className="flex items-center gap-2">
                                <span className="text-2xl font-light text-dark-400">₹</span>
                                <input
                                    type="number"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    placeholder="0"
                                    className="bg-transparent text-3xl font-bold text-white flex-1 focus:outline-none placeholder:text-dark-700 min-w-0"
                                    autoFocus
                                    inputMode="decimal"
                                />
                            </div>
                            <input
                                type="text"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Description (optional)"
                                className="input-dark text-sm"
                            />

                            {/* Location (optional) */}
                            {!location ? (
                                <button onClick={getLocation} disabled={gettingLocation} type="button"
                                    className="flex items-center gap-2 text-xs text-dark-400 hover:text-accent-light transition-colors py-1">
                                    <MapPin className="w-3.5 h-3.5" />
                                    {gettingLocation ? 'Getting location...' : '📍 Add Location (optional)'}
                                </button>
                            ) : (
                                <div className="flex items-center gap-2 py-1">
                                    <MapPin className="w-3.5 h-3.5 text-green-400" />
                                    <span className="text-xs text-green-400 flex-1">📍 Location saved</span>
                                    <button onClick={() => setLocation(null)} type="button"
                                        className="p-0.5 rounded hover:bg-dark-700 transition-colors">
                                        <X className="w-3 h-3 text-dark-400" />
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Row 2: Group + Category */}
                        <div className="glass-card p-4 space-y-3">
                            <label className="text-xs text-dark-400 font-medium uppercase tracking-wider">Group & Category</label>

                            {/* Group Select */}
                            <select
                                value={groupId}
                                onChange={(e) => handleGroupChange(e.target.value)}
                                className="input-dark text-sm w-full appearance-none cursor-pointer"
                            >
                                <option value="">Select a group</option>
                                {groups.map((g) => (
                                    <option key={g.id} value={g.id}>
                                        {g.name} ({g.members.length} members · {g.mode})
                                    </option>
                                ))}
                            </select>

                            {/* Category Grid */}
                            <div className="grid grid-cols-4 gap-1.5">
                                {categories.map(([key, meta]) => (
                                    <button
                                        key={key}
                                        onClick={() => setCategory(key)}
                                        className={`p-2.5 rounded-xl border transition-all duration-200 text-center ${category === key
                                            ? 'border-accent bg-accent/10'
                                            : 'border-transparent bg-dark-800/50 hover:border-dark-600'
                                            }`}
                                    >
                                        <span className="text-lg block">{meta.emoji}</span>
                                        <span className="text-[10px] font-medium text-dark-300 leading-tight block mt-0.5">{meta.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Row 3: Who paid + Who's included */}
                        {selectedGroup && (
                            <motion.div
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="glass-card p-4 space-y-3"
                            >
                                <label className="text-xs text-dark-400 font-medium uppercase tracking-wider">Who's involved?</label>

                                {/* Pool mode — no "Paid by" needed */}
                                {selectedGroup.mode === 'pool' ? (
                                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent/10 border border-accent/20">
                                        <span className="text-base">💰</span>
                                        <p className="text-xs text-accent-light font-medium">Paid from Pool Money</p>
                                    </div>
                                ) : (
                                    /* Direct mode — show "Paid by" */
                                    <div>
                                        <p className="text-xs text-dark-500 mb-1.5">Paid by</p>
                                        <div className="flex gap-2 flex-wrap">
                                            {selectedGroup.members.map((m) => (
                                                <button
                                                    key={m.uid}
                                                    onClick={() => setPaidBy(m.uid)}
                                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${paidBy === m.uid
                                                        ? 'bg-accent text-white'
                                                        : 'bg-dark-800 text-dark-300 hover:bg-dark-700'
                                                        }`}
                                                >
                                                    {m.photoURL ? (
                                                        <img src={m.photoURL} alt="" className="w-4 h-4 rounded-full" />
                                                    ) : (
                                                        <span className="w-4 h-4 rounded-full bg-dark-600 flex items-center justify-center text-[9px]">{m.name.charAt(0)}</span>
                                                    )}
                                                    {m.name.split(' ')[0]}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Used By / Split between */}
                                <div>
                                    <p className="text-xs text-dark-500 mb-1.5">Split between</p>
                                    <div className="flex gap-2 flex-wrap">
                                        {selectedGroup.members.map((m) => (
                                            <button
                                                key={m.uid}
                                                onClick={() => toggleUsedBy(m.uid)}
                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${usedBy.includes(m.uid)
                                                    ? 'bg-success/20 text-success-light border border-success/30'
                                                    : 'bg-dark-800 text-dark-400 hover:bg-dark-700'
                                                    }`}
                                            >
                                                {usedBy.includes(m.uid) && <Check className="w-3 h-3" />}
                                                {m.name.split(' ')[0]}
                                            </button>
                                        ))}
                                    </div>
                                    {usedBy.length > 0 && parseFloat(amount) > 0 && (
                                        <p className="text-xs text-dark-500 mt-2">
                                            Each pays: <span className="text-accent-light font-semibold">₹{(parseFloat(amount) / usedBy.length).toFixed(2)}</span>
                                        </p>
                                    )}
                                </div>
                            </motion.div>
                        )}

                        {/* Submit */}
                        <button
                            onClick={handleSubmit}
                            disabled={!canSubmit || loading}
                            className="btn-primary w-full flex items-center justify-center gap-2 !py-3.5"
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    <Check className="w-5 h-5" />
                                    Add Expense
                                </>
                            )}
                        </button>
                    </motion.div>
                )}
            </div>
        </div>
    );
}
