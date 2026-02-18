import { motion, AnimatePresence } from 'framer-motion';
import { X, Wallet } from 'lucide-react';
import { useEffect } from 'react';

export interface NotificationPayload {
    title: string;
    body: string;
    data?: Record<string, string>;
}

interface NotificationToastProps {
    notification: NotificationPayload | null;
    onClose: () => void;
}

export default function NotificationToast({ notification, onClose }: NotificationToastProps) {
    useEffect(() => {
        if (notification) {
            const timer = setTimeout(onClose, 5000); // Auto close after 5s
            return () => clearTimeout(timer);
        }
    }, [notification, onClose]);

    return (
        <AnimatePresence>
            {notification && (
                <motion.div
                    initial={{ opacity: 0, y: -50, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -20, scale: 0.95 }}
                    className="fixed top-4 left-4 right-4 z-[9999] md:left-auto md:right-4 md:w-96"
                >
                    <div className="bg-dark-800/90 backdrop-blur-xl border border-white/10 p-4 rounded-2xl shadow-2xl shadow-purple-500/10 flex gap-4 relative overflow-hidden">
                        {/* Valid decorative glow */}
                        <div className="absolute top-0 right-0 w-24 h-24 bg-accent-500/20 blur-3xl -mr-10 -mt-10" />

                        <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-accent-500 flex items-center justify-center text-white shadow-lg">
                            <Wallet size={24} />
                        </div>

                        <div className="flex-1 min-w-0 z-10">
                            <h4 className="text-white font-semibold text-sm mb-1 leading-tight">
                                {notification.title}
                            </h4>
                            <p className="text-dark-200 text-xs leading-relaxed whitespace-pre-line">
                                {notification.body}
                            </p>
                        </div>

                        <button
                            onClick={onClose}
                            className="flex-shrink-0 text-dark-400 hover:text-white transition-colors self-start"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
