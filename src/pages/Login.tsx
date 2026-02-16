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
        <div className="min-h-screen bg-dark-950 flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-sm bg-dark-900 rounded-3xl p-8 border border-glass-border shadow-soft"
            >
                <div className="flex flex-col items-center mb-10">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent to-purple-600 flex items-center justify-center mb-6 shadow-glow">
                        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2">SynSplit</h1>
                    <p className="text-dark-400">Smart Expense Manager</p>
                </div>

                {error && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-6"
                    >
                        <p className="text-red-400 text-sm text-center">{error}</p>
                    </motion.div>
                )}

                <button
                    onClick={handleGoogleSignIn}
                    disabled={loading}
                    className="w-full bg-dark-800 hover:bg-dark-700 text-white font-medium py-4 px-6 rounded-xl border border-glass-border transition-all duration-300 flex items-center justify-center gap-3 relative overflow-hidden group"
                >
                    {loading ? (
                        <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                        <>
                            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-6 h-6" />
                            <span>Continue with Google</span>
                        </>
                    )}
                </button>
            </motion.div>
        </div>
    );
}
