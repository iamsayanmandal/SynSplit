import React, { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function PwaInstallBanner() {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [isInstalled, setIsInstalled] = useState(false);

    useEffect(() => {
        // Check if already in standalone mode (installed)
        if (window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone) {
            setIsInstalled(true);
            return;
        }

        const handleBeforeInstallPrompt = () => {
            const prompt = (window as any).deferredPrompt;
            if (prompt) {
                setDeferredPrompt(prompt);
                setIsVisible(true);
            }
        };

        const handleAppInstalled = () => {
            setIsInstalled(true);
            setIsVisible(false);
            setDeferredPrompt(null);
        };

        window.addEventListener('pwa-install-prompt-available', handleBeforeInstallPrompt);
        window.addEventListener('pwa-install-status-changed', handleAppInstalled);

        // Initial check in case event already fired
        if ((window as any).deferredPrompt) {
            handleBeforeInstallPrompt();
        }

        return () => {
            window.removeEventListener('pwa-install-prompt-available', handleBeforeInstallPrompt);
            window.removeEventListener('pwa-install-status-changed', handleAppInstalled);
        };
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;
        
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        
        if (outcome === 'accepted') {
            setIsVisible(false);
            setDeferredPrompt(null);
        }
    };

    const handleDismiss = () => {
        setIsVisible(false);
    };

    if (isInstalled) return null;

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 0, y: -50 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -50 }}
                    className="fixed top-4 left-4 right-4 z-[100] md:left-auto md:w-96"
                >
                    <div className="bg-gradient-to-r from-accent to-purple-600 rounded-2xl shadow-glow p-4 flex items-center justify-between text-white border border-white/20 backdrop-blur-lg">
                        <div className="flex items-center gap-3">
                            <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md">
                                <Download className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h3 className="font-bold text-sm">Install SynSplit App</h3>
                                <p className="text-xs text-white/80">Add to home screen for the best experience</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleInstallClick}
                                className="bg-white text-accent px-4 py-1.5 rounded-xl text-sm font-bold active:scale-95 transition-transform shadow-sm"
                            >
                                Install
                            </button>
                            <button
                                onClick={handleDismiss}
                                className="p-1.5 text-white/70 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
