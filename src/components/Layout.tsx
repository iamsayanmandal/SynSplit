import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Home, Receipt, ArrowLeftRight, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const navItems = [
    { to: '/', icon: Home, label: 'Home' },
    { to: '/expenses', icon: Receipt, label: 'Expenses' },
    { to: '/settle', icon: ArrowLeftRight, label: 'Settle' },
    { to: '/profile', icon: User, label: 'Profile' },
];

export default function Layout() {
    const location = useLocation();

    return (
        <div className="min-h-screen min-h-[100dvh] bg-dark-950 flex flex-col">
            <main className="flex-1 pb-20 overflow-y-auto">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={location.pathname}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.2, ease: 'easeOut' }}
                        className="h-full"
                    >
                        <Outlet />
                    </motion.div>
                </AnimatePresence>
            </main>

            <nav className="fixed bottom-0 left-0 right-0 z-50">
                <div className="bg-dark-900/80 backdrop-blur-xl border-t border-glass-border">
                    <div className="max-w-lg mx-auto flex items-center justify-around px-2 py-2">
                        {navItems.map((item) => (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                end={item.to === '/'}
                                className={({ isActive }) =>
                                    `flex flex-col items-center gap-0.5 px-3 py-1 relative ${isActive ? 'text-accent' : 'text-dark-400'}`
                                }
                            >
                                {({ isActive }) => (
                                    <>
                                        <item.icon className={`w-5 h-5 transition-all duration-300 ${isActive ? 'text-accent' : 'text-dark-400'}`} />
                                        <span className={`text-[10px] font-medium transition-all duration-300 ${isActive ? 'text-accent' : 'text-dark-500'}`}>
                                            {item.label}
                                        </span>
                                        {isActive && (
                                            <motion.div
                                                layoutId="activeTab"
                                                className="absolute -top-2 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-accent"
                                                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
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
