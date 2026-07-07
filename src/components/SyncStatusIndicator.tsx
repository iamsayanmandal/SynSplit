import { useEffect, useState } from 'react';
import { Cloud, CloudOff, CloudLightning } from 'lucide-react';
import { useGroupData } from '../contexts/GroupDataContext';

export default function SyncStatusIndicator() {
    const { isSyncing } = useGroupData();
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    if (!isOnline) {
        return (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400 animate-pulse cursor-help" title="Offline mode: changes saved locally, waiting for network connection.">
                <CloudOff className="w-3.5 h-3.5 flex-shrink-0 text-orange-400" />
                <span className="text-[10px] font-bold tracking-wide uppercase hidden xs:inline">Offline</span>
            </div>
        );
    }

    if (isSyncing) {
        return (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-accent/15 border border-accent/30 text-accent-light cursor-help animate-pulse" title="Syncing changes with Firestore server...">
                <CloudLightning className="w-3.5 h-3.5 flex-shrink-0 animate-bounce text-accent-light" />
                <span className="text-[10px] font-bold tracking-wide uppercase hidden xs:inline">Syncing</span>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 cursor-help" title="All changes successfully saved to Firestore.">
            <Cloud className="w-3.5 h-3.5 flex-shrink-0 text-green-400" />
            <span className="text-[10px] font-bold tracking-wide uppercase hidden xs:inline">Synced</span>
        </div>
    );
}
