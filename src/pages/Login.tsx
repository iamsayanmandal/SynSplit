import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { motion } from 'framer-motion';

export default function Login() {
    const { signInWithGoogle } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleGoogleSignIn = async () => {
        setLoading(true);
        setError(null);
        try {
            await signInWithGoogle();
        } catch (err) {
            setError('Failed to sign in. Please try again.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen min-h-[100dvh] bg-dark-950 flex items-center justify-center p-4 relative overflow-hidden">
            {/* Background Orbs */}
            <div className="bg-orb w-72 h-72 bg-accent/30 top-[-10%] left-[-10%]" />
            <div className="bg-orb w-96 h-96 bg-purple-600/20 bottom-[-15%] right-[-15%]" style={{ animationDelay: '2s' }} />
            <div className="bg-orb w-48 h-48 bg-success/20 top-[40%] right-[10%]" style={{ animationDelay: '4s' }} />

            <motion.div
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="glass-card p-8 max-w-sm w-full relative z-10"
            >
                {/* Logo */}
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                    className="flex justify-center mb-6"
                >
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-accent to-purple-600 flex items-center justify-center shadow-neon animate-glow-pulse">
                        <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                        </svg>
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="text-center mb-8"
                >
                    <h1 className="text-3xl font-bold gradient-text mb-2">SynSplit</h1>
                    <p className="text-dark-300 text-sm">Smart Expense Manager for Groups</p>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="space-y-4"
                >
                    <button
                        onClick={handleGoogleSignIn}
                        disabled={loading}
                        className="w-full glass-card-hover !rounded-xl flex items-center justify-center gap-3 px-6 py-4 font-medium text-white transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                        {loading ? (
                            <span className="flex items-center gap-2">
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Signing in...
                            </span>
                        ) : (
                            'Continue with Google'
                        )}
                    </button>

                    {error && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-danger/10 border border-danger/20 text-danger-light px-4 py-3 rounded-xl text-sm text-center"
                        >
                            {error}
                        </motion.div>
                    )}
                </motion.div>

                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6 }}
                    className="mt-8 text-center text-xs text-dark-400 leading-relaxed"
                >
                    Track expenses, split bills & manage pool money with friends
                </motion.p>
            </motion.div>
        </div>
    );
}
