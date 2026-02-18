import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, X, Send, Sparkles } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useGroupData } from '../contexts/GroupDataContext';
import { askGemini, buildExpenseContext, SYNBOT_SYSTEM_INSTRUCTION } from '../lib/gemini';
import type { ChatMessage } from '../lib/gemini';

export default function SynBot() {
    const { user } = useAuth();
    const { activeGroup, expenses, contributions } = useGroupData();

    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, open]);

    // Focus input when drawer opens
    useEffect(() => {
        if (open && inputRef.current) {
            setTimeout(() => inputRef.current?.focus(), 400);
        }
    }, [open]);

    // Welcome message when first opened
    useEffect(() => {
        if (open && messages.length === 0) {
            setMessages([{
                role: 'assistant',
                text: `Hey ${user?.displayName?.split(' ')[0] || 'there'}! 👋 I'm SynBot — your expense assistant.\n\nAsk me anything about your spending, like:\n• "How much did we spend on food?"\n• "Who paid the most?"\n• "What's my average daily spending?"`,
                timestamp: Date.now(),
            }]);
        }
    }, [open, messages.length, user?.displayName]);

    const handleSend = async () => {
        if (!input.trim() || loading) return;
        const userMsg: ChatMessage = { role: 'user', text: input.trim(), timestamp: Date.now() };
        setMessages((prev) => [...prev, userMsg]);
        setInput('');
        setLoading(true);

        try {
            // Build context from current expense data
            const context = activeGroup
                ? buildExpenseContext({
                    groupName: activeGroup.name,
                    mode: activeGroup.mode,
                    members: activeGroup.members.map((m) => ({ name: m.name, uid: m.uid })),
                    expenses: expenses.map((e) => ({
                        description: e.description,
                        amount: e.amount,
                        category: e.category,
                        paidBy: e.paidBy,
                        createdAt: e.createdAt,
                    })),
                    totalSpent: expenses.reduce((s, e) => s + e.amount, 0),
                    contributions: contributions.map((c) => ({
                        userId: c.userId,
                        amount: c.amount,
                        createdAt: c.createdAt,
                    })),
                })
                : 'No group selected.';

            // Build conversation history for Gemini
            const history = messages
                .filter((m) => m.role !== 'assistant' || messages.indexOf(m) > 0)
                .map((m) => ({
                    role: (m.role === 'assistant' ? 'model' : 'user') as 'user' | 'model',
                    parts: [{ text: m.text }],
                }));

            const prompt = `[Expense Data Context]\n${context}\n\n[User Question]\n${userMsg.text}`;
            const response = await askGemini(prompt, SYNBOT_SYSTEM_INSTRUCTION, history.slice(-6));

            setMessages((prev) => [...prev, {
                role: 'assistant',
                text: response,
                timestamp: Date.now(),
            }]);
        } catch (err) {
            console.error('SynBot error:', err);
            setMessages((prev) => [...prev, {
                role: 'assistant',
                text: 'Sorry, I ran into an issue. Please try again! 🔧',
                timestamp: Date.now(),
            }]);
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    // Quick prompts
    const quickPrompts = [
        '💰 Total spending?',
        '🍕 Food expenses?',
        '👤 Who paid most?',
        '📊 Monthly breakdown?',
    ];

    return (
        <>
            {/* FAB Button */}
            <AnimatePresence>
                {!open && (
                    <motion.button
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setOpen(true)}
                        className="fixed bottom-24 right-4 z-40 w-12 h-12 rounded-2xl bg-gradient-to-br from-accent to-purple-600 text-white shadow-neon flex items-center justify-center"
                    >
                        <Bot className="w-5 h-5" />
                    </motion.button>
                )}
            </AnimatePresence>

            {/* Chat Drawer */}
            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[60] bg-black/50"
                        onClick={() => setOpen(false)}
                    >
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            className="absolute right-0 top-0 bottom-0 w-full max-w-sm bg-dark-950 border-l border-glass-border flex flex-col"
                            style={{ height: '100dvh' }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between px-4 py-3 border-b border-glass-border flex-shrink-0">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-accent to-purple-600 flex items-center justify-center">
                                        <Sparkles className="w-4 h-4 text-white" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-white">SynBot</h3>
                                        <p className="text-[10px] text-dark-400">AI Expense Assistant • Gemini 2.5 Pro</p>
                                    </div>
                                </div>
                                <button onClick={() => setOpen(false)}
                                    className="p-1.5 rounded-lg hover:bg-dark-800 transition-colors">
                                    <X className="w-4 h-4 text-dark-400" />
                                </button>
                            </div>

                            {/* Messages — takes all available space */}
                            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
                                {messages.map((msg, i) => (
                                    <motion.div
                                        key={i}
                                        initial={{ opacity: 0, y: 6 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                    >
                                        <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${msg.role === 'user'
                                            ? 'bg-accent text-white rounded-br-md'
                                            : 'bg-dark-800/80 text-dark-200 rounded-bl-md border border-glass-border'
                                            }`}>
                                            {msg.text}
                                        </div>
                                    </motion.div>
                                ))}

                                {loading && (
                                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                        className="flex justify-start">
                                        <div className="bg-dark-800/80 border border-glass-border rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-1.5">
                                            <div className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce" style={{ animationDelay: '0ms' }} />
                                            <div className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce" style={{ animationDelay: '150ms' }} />
                                            <div className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce" style={{ animationDelay: '300ms' }} />
                                        </div>
                                    </motion.div>
                                )}
                            </div>

                            {/* Quick Prompts */}
                            {messages.length <= 1 && (
                                <div className="px-4 pb-2 flex gap-1.5 flex-wrap flex-shrink-0">
                                    {quickPrompts.map((prompt) => (
                                        <button key={prompt} onClick={() => { setInput(prompt.slice(2).trim()); inputRef.current?.focus(); }}
                                            className="px-2.5 py-1.5 rounded-full bg-dark-800/50 border border-glass-border text-[10px] text-dark-300 font-medium hover:bg-dark-700 transition-all">
                                            {prompt}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Input — always visible at bottom */}
                            <div className="px-3 py-3 border-t border-glass-border flex-shrink-0">
                                <div className="flex items-center gap-2">
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        placeholder="Ask SynBot anything..."
                                        className="flex-1 bg-dark-800/50 border border-glass-border rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-dark-500 focus:outline-none focus:border-accent/40"
                                        disabled={loading}
                                        autoComplete="off"
                                    />
                                    <button
                                        onClick={handleSend}
                                        disabled={!input.trim() || loading}
                                        className="p-2.5 rounded-xl bg-gradient-to-r from-accent to-purple-600 text-white disabled:opacity-30 transition-all active:scale-95"
                                    >
                                        <Send className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
