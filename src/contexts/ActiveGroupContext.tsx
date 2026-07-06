import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { useAuth } from './AuthContext';

interface ActiveGroupContextType {
    activeGroupId: string | null;
    setActiveGroupId: (id: string | null) => void;
}

const ActiveGroupContext = createContext<ActiveGroupContextType>({
    activeGroupId: null,
    setActiveGroupId: () => { },
});

export function ActiveGroupProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const storageKey = user ? `synsplit_active_group_${user.uid}` : null;

    const [activeGroupId, setActiveGroupId] = useState<string | null>(() => {
        if (!storageKey) return null;
        return localStorage.getItem(storageKey) || null;
    });

    // Re-read from storage when user changes (login/logout/switch)
    useEffect(() => {
        if (storageKey) {
            setActiveGroupId(localStorage.getItem(storageKey) || null);
        } else {
            setActiveGroupId(null);
        }
    }, [storageKey]);

    useEffect(() => {
        if (!storageKey) return;
        if (activeGroupId) {
            localStorage.setItem(storageKey, activeGroupId);
        } else {
            localStorage.removeItem(storageKey);
        }
    }, [activeGroupId, storageKey]);

    return (
        <ActiveGroupContext.Provider value={{ activeGroupId, setActiveGroupId }}>
            {children}
        </ActiveGroupContext.Provider>
    );
}

export function useActiveGroup() {
    return useContext(ActiveGroupContext);
}
