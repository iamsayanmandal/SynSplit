import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Home, Receipt, ArrowLeftRight, BarChart3, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import SynBot from './SynBot';
import ThemeBackground from './ThemeBackground';

const navItems = [
    { to: '/', icon: Home, label: 'Home' },
    { to: '/expenses', icon: Receipt, label: 'Expenses' },
    { to: '/settle', icon: ArrowLeftRight, label: 'Settle' },
    { to: '/analytics', icon: BarChart3, label: 'Analytics' },
    { to: '/profile', icon: User, label: 'Profile' },
];

export default function Layout() {
    const location = useLocation();

    return (
        <div className="min-h-screen min-h-[100dvh] bg-dark-950 flex flex-col relative">
            {/* Theme Backdrop Visuals */}
            <ThemeBackground />

            <main className="flex-1 pb-20 overflow-y-auto relative z-10">
                <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                        key={location.pathname}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.2, ease: 'easeOut' }}
                        className="h-full"
                        style={{ backfaceVisibility: 'hidden', transform: 'translate3d(0,0,0)' }}
                    >
                        <Outlet />
                    </motion.div>
                </AnimatePresence>
            </main>

            {/* SynBot floating AI assistant */}
            <SynBot />

            <nav className="fixed bottom-0 left-0 right-0 z-50">
                <div className="bg-dark-900/80 backdrop-blur-xl border-t border-glass-border">
                    <div className="text-center py-1 flex items-center justify-center gap-2">
                        <a
                            href="https://sayanmandal.in"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[9px] text-accent-light/60 hover:text-accent-light transition-colors underline underline-offset-2 decoration-accent-light/30"
                        >
                            Developed by Sayan Mandal
                        </a>
                        <span className="text-[9px] text-dark-600">•</span>
                        <NavLink
                            to="/privacy"
                            className="text-[9px] text-dark-400 hover:text-accent-light transition-colors underline underline-offset-2 decoration-dark-600"
                        >
                            Privacy Policy
                        </NavLink>
                    </div>
                    <div className="max-w-lg mx-auto flex items-center justify-around px-2 py-1.5">
                        {navItems.map((item) => (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                end={item.to === '/'}
                                className={({ isActive }) =>
                                    `flex flex-col items-center gap-0.5 px-3.5 py-1.5 rounded-xl relative transition-colors duration-200 ${isActive ? 'text-white' : 'text-dark-400 hover:text-dark-200'}`
                                }
                            >
                                {({ isActive }) => (
                                    <>
                                        <item.icon className={`w-5 h-5 transition-all duration-300 ${isActive ? 'text-accent-light scale-105' : 'text-dark-400'}`} />
                                        <span className={`text-[10px] font-bold transition-all duration-300 ${isActive ? 'text-white' : 'text-dark-500'}`}>
                                            {item.label}
                                        </span>
                                        {isActive && (
                                            <motion.div
                                                layoutId="activeTabPill"
                                                className="absolute inset-y-1 inset-x-1 bg-accent/10 border border-accent/20 rounded-xl -z-10"
                                                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                                                style={{ transform: 'translate3d(0,0,0)', willChange: 'transform' }}
                                            />
                                        )}
                                    </>
                                )}
                            </NavLink>
                        ))}
                    </div>
                </div>
                <div className="bg-dark-900/80 backdrop-blur-xl h-[env(safe-area-inset-bottom)]" />
            </nav>
        </div>
    );
}
