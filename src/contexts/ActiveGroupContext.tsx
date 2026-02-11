import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

interface ActiveGroupContextType {
    activeGroupId: string | null;
    setActiveGroupId: (id: string | null) => void;
}

const ActiveGroupContext = createContext<ActiveGroupContextType>({
    activeGroupId: null,
    setActiveGroupId: () => { },
});

export function ActiveGroupProvider({ children }: { children: ReactNode }) {
    const [activeGroupId, setActiveGroupId] = useState<string | null>(() => {
        return localStorage.getItem('synsplit_active_group') || null;
    });

    useEffect(() => {
        if (activeGroupId) {
            localStorage.setItem('synsplit_active_group', activeGroupId);
        } else {
            localStorage.removeItem('synsplit_active_group');
        }
    }, [activeGroupId]);

    return (
        <ActiveGroupContext.Provider value={{ activeGroupId, setActiveGroupId }}>
            {children}
        </ActiveGroupContext.Provider>
    );
}

export function useActiveGroup() {
    return useContext(ActiveGroupContext);
}
