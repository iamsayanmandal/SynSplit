import { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart3, Calendar, Map, TrendingUp, MapPin, Sparkles, Loader, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { useActiveGroup } from '../contexts/ActiveGroupContext';
import { useGroups, useExpenses, usePoolContributions } from '../hooks/hooks';
import { CATEGORY_META } from '../types';
import type { ExpenseCategory } from '../types';
import { buildExpenseContext, generatePredictions } from '../lib/gemini';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths, subDays } from 'date-fns';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const MAP_PLATFORMS = {
    'carto-dark': {
        name: 'Carto Dark',
        url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        options: {
            attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
            subdomains: 'abcd',
            maxZoom: 20
        }
    },
    'carto-light': {
        name: 'Carto Light',
        url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
        options: {
            attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
            subdomains: 'abcd',
            maxZoom: 20
        }
    },
    'osm': {
        name: 'OpenStreetMap',
        url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        options: {
            attribution: '&copy; OpenStreetMap contributors',
            maxZoom: 19
        }
    },
    'google-road': {
        name: 'Google Maps',
        url: 'https://mt1.google.com/vt/lyrs=m&x={x}/{y}&z={z}',
        options: {
            attribution: '&copy; Google Maps',
            maxZoom: 22
        }
    },
    'google-sat': {
        name: 'Google Satellite',
        url: 'https://mt1.google.com/vt/lyrs=y&x={x}/{y}&z={z}',
        options: {
            attribution: '&copy; Google Maps',
            maxZoom: 22
        }
    }
};

type Tab = 'stats' | 'calendar' | 'map';
type MapPlatformKey = keyof typeof MAP_PLATFORMS;

export default function Analytics() {

    const { groups } = useGroups();
    const { activeGroupId } = useActiveGroup();
    const activeGroup = groups.find((g) => g.id === activeGroupId) || null;
    const { expenses } = useExpenses(activeGroupId || undefined);
    const { contributions } = usePoolContributions(activeGroupId || undefined);

    const [tab, setTab] = useState<Tab>('stats');
    const [calMonth, setCalMonth] = useState(new Date());

    // ─── AI Insights State ───
    const [aiInsights, setAiInsights] = useState<string | null>(null);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiError, setAiError] = useState<string | null>(null);

    // ─── Leaflet Map States & Refs ───
    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstance = useRef<any>(null);
    const [mapPlatform, setMapPlatform] = useState<MapPlatformKey>(() => {
        return (localStorage.getItem('synsplit_map_platform') as MapPlatformKey) || 'carto-dark';
    });

    // Geotagged Expenses Filter
    const geoExpenses = useMemo(() => {
        return expenses.filter(e => e.location && typeof e.location.lat === 'number' && typeof e.location.lng === 'number');
    }, [expenses]);

    // Map Initialization
    useEffect(() => {
        if (tab !== 'map' || !mapRef.current) return;

        // Clean up previous instance and reset the DOM container to prevent already-initialized errors
        if (mapRef.current) {
            const container = mapRef.current;
            if ((container as any)._leaflet_id || container.innerHTML !== '') {
                if (mapInstance.current) {
                    mapInstance.current.remove();
                    mapInstance.current = null;
                }
                container.innerHTML = '';
                delete (container as any)._leaflet_id;
            }
        }

        // Center on average coords or fallback to India
        let center: [number, number] = [20.5937, 78.9629];
        let zoom = 5;

        if (geoExpenses.length > 0) {
            const sumLat = geoExpenses.reduce((sum, e) => sum + e.location!.lat, 0);
            const sumLng = geoExpenses.reduce((sum, e) => sum + e.location!.lng, 0);
            center = [sumLat / geoExpenses.length, sumLng / geoExpenses.length];
            zoom = 12;
        }

        const platformConfig = MAP_PLATFORMS[mapPlatform];

        // Create map with selected tile layer
        const map = L.map(mapRef.current, {
            center: center,
            zoom: zoom,
            zoomControl: true,
            layers: [
                L.tileLayer(platformConfig.url, platformConfig.options)
            ]
        });

        mapInstance.current = map;

        // Sizing bug fix for tab/motion containers
        setTimeout(() => {
            map.invalidateSize();
        }, 150);
        setTimeout(() => {
            map.invalidateSize();
        }, 400);

        // Add Circle Markers for each expense
        geoExpenses.forEach(exp => {
            const cat = CATEGORY_META[exp.category as ExpenseCategory] || CATEGORY_META.others;
            const marker = L.circleMarker([exp.location!.lat, exp.location!.lng], {
                radius: 8,
                fillColor: cat.color,
                color: '#fff',
                weight: 1.5,
                opacity: 1,
                fillOpacity: 0.8
            }).addTo(map);

            const popupContent = `
                <div style="font-family: system-ui, sans-serif; color: #fff; padding: 4px; line-height: 1.4; width: 140px;">
                    <div style="font-weight: 700; font-size: 12px; margin-bottom: 2px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${exp.description}</div>
                    <div style="font-size: 11px; color: #94a3b8; display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
                        <span style="color: ${cat.color}; font-weight: 600;">${cat.label}</span>
                        <span style="font-weight: bold; color: #fff;">₹${exp.amount}</span>
                    </div>
                </div>
            `;

            marker.bindPopup(popupContent, {
                closeButton: false,
                className: 'dark-popup'
            });
        });

        if (geoExpenses.length > 1) {
            const bounds = L.latLngBounds(geoExpenses.map(e => [e.location!.lat, e.location!.lng]));
            map.fitBounds(bounds, { padding: [40, 40] });
        }
    }, [tab, mapPlatform, geoExpenses]);

    // ─── Fetch AI Predictions handler ───
    const fetchAiInsights = async () => {
        if (!activeGroup || expenses.length === 0) return;
        setAiLoading(true);
        setAiError(null);

        try {
            const ctx = buildExpenseContext({
                groupName: activeGroup.name,
                mode: activeGroup.mode,
                members: activeGroup.members,
                expenses: expenses,
                totalSpent: expenses.reduce((s, e) => s + e.amount, 0),
                contributions: contributions,
            });

            const res = await generatePredictions(ctx);
            setAiInsights(res);
        } catch (err) {
            console.error('Failed to get insights:', err);
            setAiError('Could not connect to AI advisor. Try again in a moment.');
        } finally {
            setAiLoading(false);
        }
    };

    // ─── Stats computations ───
    const stats = useMemo(() => {
        const totalSpent = expenses.reduce((s, e) => s + e.amount, 0);
        const totalContributions = contributions.reduce((s, c) => s + c.amount, 0);
        const poolBalance = totalContributions - totalSpent;

        // Breakdown by category
        const byCat: Record<string, number> = {};
        expenses.forEach((e) => {
            byCat[e.category] = (byCat[e.category] || 0) + e.amount;
        });

        const catList = Object.entries(byCat)
            .map(([category, amount]) => ({
                category: category as ExpenseCategory,
                amount,
                percent: totalSpent ? Math.round((amount / totalSpent) * 100) : 0,
            }))
            .sort((a, b) => b.amount - a.amount);

        // Daily spending trend (last 7 days)
        const dailyTrend: Record<string, number> = {};
        const last7Days = Array.from({ length: 7 }, (_, i) => {
            const d = subDays(new Date(), i);
            return format(d, 'yyyy-MM-dd');
        }).reverse();

        last7Days.forEach((day) => {
            dailyTrend[day] = 0;
        });

        expenses.forEach((e) => {
            const dayKey = format(new Date(e.createdAt), 'yyyy-MM-dd');
            if (dayKey in dailyTrend) {
                dailyTrend[dayKey] += e.amount;
            }
        });

        const trendList = Object.entries(dailyTrend).map(([date, amount]) => ({
            label: format(new Date(date), 'dd MMM'),
            amount,
        }));

        return {
            totalSpent,
            totalContributions,
            poolBalance,
            categoryBreakdown: catList,
            trend: trendList,
        };
    }, [expenses, contributions]);

    // ─── Calendar computations ───
    const startOfCal = startOfMonth(calMonth);
    const endOfCal = endOfMonth(calMonth);
    const calDays = eachDayOfInterval({ start: startOfCal, end: endOfCal });


    const getDayExpenses = (day: Date) => {
        return expenses.filter((e) => isSameDay(new Date(e.createdAt), day));
    };



    // Total for active view


    const firstDow = calDays[0]?.getDay() || 0;

    const tabs: { key: Tab; icon: typeof BarChart3; label: string }[] = [
        { key: 'stats', icon: BarChart3, label: 'Stats' },
        { key: 'calendar', icon: Calendar, label: 'Calendar' },
        { key: 'map', icon: Map, label: 'Expenses Map' },
    ];

    return (
        <div className="px-4 pt-6 pb-4 max-w-lg mx-auto">
            {/* Header */}
            <div className="mb-4">
                <h1 className="text-xl font-bold text-white">Analytics</h1>
                <p className="text-dark-400 text-xs mt-0.5">
                    {activeGroup ? activeGroup.name : 'No group selected'}
                </p>
            </div>

            {!activeGroup ? (
                <div className="glass-card p-8 text-center">
                    <p className="text-dark-400 text-sm">Select a group on the Home tab first</p>
                </div>
            ) : (
                <>
                    {/* Navigation Tabs */}
                    <div className="flex bg-dark-900/60 p-1.5 rounded-xl border border-glass-border mb-4">
                        {tabs.map((t) => {
                            const Icon = t.icon;
                            const active = tab === t.key;
                            return (
                                <button key={t.key} onClick={() => setTab(t.key)}
                                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-semibold transition-all duration-300 ${active
                                        ? 'bg-gradient-to-r from-accent to-purple-600 text-white shadow-neon scale-[1.02]'
                                        : 'text-dark-400 hover:text-white'
                                        }`}>
                                    <Icon className="w-3.5 h-3.5" />
                                    {t.label}
                                </button>
                            );
                        })}
                    </div>

                    {/* Tab Panels */}
                    <AnimatePresence mode="wait">
                        {/* ═══════════ STATS TAB ═══════════ */}
                        {tab === 'stats' && (
                            <motion.div key="stats" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-4">
                                {/* Pool Balance / Total spent stats */}
                                {activeGroup.mode === 'pool' ? (
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="glass-card p-4">
                                            <p className="text-[10px] text-dark-500 uppercase tracking-wider mb-1 font-bold">Pool Collected</p>
                                            <p className="text-2xl font-black text-white">₹{stats.totalContributions.toLocaleString('en-IN')}</p>
                                        </div>
                                        <div className="glass-card p-4">
                                            <p className="text-[10px] text-dark-500 uppercase tracking-wider mb-1 font-bold">Pool Spent</p>
                                            <p className="text-2xl font-black text-danger-light">₹{stats.totalSpent.toLocaleString('en-IN')}</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="glass-card p-4 flex items-center justify-between">
                                        <div>
                                            <p className="text-[10px] text-dark-500 uppercase tracking-wider mb-1 font-bold">Group Total Spent</p>
                                            <p className="text-2xl font-black text-white">₹{stats.totalSpent.toLocaleString('en-IN')}</p>
                                        </div>
                                        <div className="p-3 rounded-xl bg-accent/10 text-accent-light">
                                            <BarChart3 className="w-6 h-6" />
                                        </div>
                                    </div>
                                )}

                                {/* Category Breakdown */}
                                <div className="glass-card p-4">
                                    <h3 className="text-xs uppercase tracking-wider text-dark-500 font-bold mb-3 flex items-center gap-1.5">
                                        <TrendingUp className="w-4 h-4 text-accent-light" />
                                        By Category
                                    </h3>
                                    <div className="space-y-2">
                                        {stats.categoryBreakdown.length === 0 ? (
                                            <p className="text-xs text-dark-500 text-center py-4">No expenses recorded yet</p>
                                        ) : (
                                            stats.categoryBreakdown.map((item, i) => {
                                                const meta = CATEGORY_META[item.category] || CATEGORY_META.others;
                                                return (
                                                    <motion.div key={item.category} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                                                        transition={{ delay: i * 0.04 }} className="glass-card p-3">
                                                        <div className="flex items-center justify-between mb-1.5">
                                                            <div className="flex items-center gap-2">
                                                                <meta.icon className="w-3.5 h-3.5" style={{ color: meta.color }} />
                                                                <span className="text-xs text-white font-medium">{meta.label}</span>
                                                            </div>
                                                            <span className="text-xs font-bold text-white">₹{item.amount.toLocaleString('en-IN')}</span>
                                                        </div>
                                                        <div className="h-1.5 bg-dark-800 rounded-full overflow-hidden">
                                                            <motion.div
                                                                initial={{ width: 0 }}
                                                                animate={{ width: `${item.percent}%` }}
                                                                transition={{ delay: 0.2 + i * 0.05, duration: 0.5, ease: 'easeOut' }}
                                                                className="h-full rounded-full"
                                                                style={{ backgroundColor: meta.color }}
                                                            />
                                                        </div>
                                                    </motion.div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>

                                {/* AI Smart predictions section */}
                                <div className="glass-card p-4 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-2 text-dark-800/20">
                                        <Sparkles className="w-20 h-20 rotate-12" />
                                    </div>
                                    <div className="relative">
                                        <div className="flex items-center gap-1.5 mb-2">
                                            <Sparkles className="w-4 h-4 text-purple-400" />
                                            <h3 className="text-xs uppercase tracking-wider text-purple-400 font-bold">SynBot Advisor</h3>
                                        </div>
                                        <p className="text-xs text-dark-300 leading-relaxed mb-4">
                                            Analyze your spending layout, split patterns, and balance forecasts.
                                        </p>

                                        {aiInsights ? (
                                            <div className="p-3.5 rounded-xl bg-dark-800/80 border border-purple-500/20 text-xs text-dark-200 font-normal leading-relaxed whitespace-pre-line">
                                                {aiInsights}
                                            </div>
                                        ) : aiError ? (
                                            <div className="p-3.5 rounded-xl bg-danger/10 border border-danger/20 text-xs text-danger-light">
                                                {aiError}
                                            </div>
                                        ) : null}

                                        {(expenses.length > 0) && (
                                            <button onClick={fetchAiInsights} disabled={aiLoading}
                                                className="mt-3 w-full py-2 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-medium text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all">
                                                {aiLoading ? (
                                                    <>
                                                        <Loader className="w-3.5 h-3.5 animate-spin" />
                                                        Consulting SynBot...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Sparkles className="w-3.5 h-3.5" />
                                                        {aiInsights ? 'Refresh Insights' : 'Generate Smart Insights'}
                                                    </>
                                                )}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {/* ═══════════ CALENDAR TAB ═══════════ */}
                        {tab === 'calendar' && (
                            <motion.div key="calendar" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
                                {/* Selector */}
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-sm font-semibold text-white">{format(calMonth, 'MMMM yyyy')}</h3>
                                    <div className="flex gap-1.5">
                                        <button onClick={() => setCalMonth(subMonths(calMonth, 1))} className="p-1.5 rounded-lg bg-dark-800 text-dark-300 hover:text-white">
                                            <ChevronLeft size={16} />
                                        </button>
                                        <button onClick={() => setCalMonth(addMonths(calMonth, 1))} className="p-1.5 rounded-lg bg-dark-800 text-dark-300 hover:text-white">
                                            <ChevronRight size={16} />
                                        </button>
                                    </div>
                                </div>

                                {/* Calendar Stats */}
                                {(() => {
                                    const calMonthExpenses = expenses.filter(e => isSameMonth(new Date(e.createdAt), calMonth));
                                    const totalSpentThisMonth = calMonthExpenses.reduce((sum, e) => sum + e.amount, 0);
                                    
                                    const activeDays = new Set(calMonthExpenses.map(e => format(new Date(e.createdAt), 'yyyy-MM-dd'))).size;
                                    const avgDailySpend = activeDays > 0 ? totalSpentThisMonth / activeDays : 0;

                                    return (
                                        <div className="flex gap-2 mb-4">
                                            <div className="flex-1 p-3 rounded-xl bg-dark-900/60 border border-glass-border">
                                                <p className="text-[10px] text-dark-400 font-medium uppercase tracking-wider mb-1">Total Spent</p>
                                                <p className="text-sm font-bold text-white">₹{totalSpentThisMonth.toLocaleString('en-IN')}</p>
                                            </div>
                                            <div className="flex-1 p-3 rounded-xl bg-dark-900/60 border border-glass-border">
                                                <p className="text-[10px] text-dark-400 font-medium uppercase tracking-wider mb-1">Avg Daily Spend</p>
                                                <p className="text-sm font-bold text-white">₹{avgDailySpend.toLocaleString('en-IN', { maximumFractionDigits: 1 })} <span className="text-[10px] text-dark-500 font-normal lowercase">/ active day</span></p>
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* Calendar grid */}
                                <div className="grid grid-cols-7 gap-1 text-center mb-2">
                                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, index) => (
                                        <span key={index} className="text-[10px] font-bold text-dark-600 uppercase py-1">{d}</span>
                                    ))}
                                    {/* Offset */}
                                    {Array.from({ length: firstDow }).map((_, idx) => (
                                        <div key={`offset-${idx}`} className="p-2" />
                                    ))}
                                    {/* Day Blocks */}
                                    {calDays.map((day) => {
                                        const dayExp = getDayExpenses(day);
                                        const totalAmt = dayExp.reduce((s, e) => s + e.amount, 0);
                                        const isToday = isSameDay(day, new Date());
                                        return (
                                            <div key={day.toISOString()}
                                                className={`p-1.5 rounded-xl border flex flex-col justify-between items-center aspect-square ${isToday ? 'border-accent/40 bg-accent/5' : 'border-transparent bg-dark-900/40'}`}>
                                                <span className={`text-[10px] font-medium leading-none ${isToday ? 'text-accent-light' : 'text-dark-400'}`}>
                                                    {format(day, 'd')}
                                                </span>
                                                {totalAmt > 0 ? (
                                                    <span className="text-[8px] font-black text-white bg-dark-800/80 px-1 rounded truncate w-full text-center">
                                                        ₹{totalAmt >= 1000 ? `${(totalAmt / 1000).toFixed(1)}k` : totalAmt}
                                                    </span>
                                                ) : (
                                                    <span className="h-2" />
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </motion.div>
                        )}

                        {/* ═══════════ MAP TAB ═══════════ */}
                        {tab === 'map' && (
                            <motion.div key="map" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-4">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                    <div>
                                        <h3 className="text-sm font-semibold text-white">Expense Locations</h3>
                                        <p className="text-[10px] text-dark-500">Geotagged group expenses mapped below</p>
                                    </div>
                                    
                                    {geoExpenses.length > 0 && (
                                        <div className="flex flex-wrap gap-1 bg-dark-900/60 p-1 rounded-xl border border-glass-border">
                                            {(Object.keys(MAP_PLATFORMS) as MapPlatformKey[]).map((plat) => (
                                                <button
                                                    key={plat}
                                                    type="button"
                                                    onClick={() => {
                                                        setMapPlatform(plat);
                                                        localStorage.setItem('synsplit_map_platform', plat);
                                                    }}
                                                    className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all duration-200 ${
                                                        mapPlatform === plat
                                                            ? 'bg-accent text-white shadow-lg shadow-accent/20'
                                                            : 'text-dark-400 hover:text-white hover:bg-dark-800/40'
                                                    }`}
                                                >
                                                    {MAP_PLATFORMS[plat].name}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {geoExpenses.length === 0 ? (
                                    <div className="glass-card p-8 text-center">
                                        <div className="w-10 h-10 rounded-full bg-dark-800 flex items-center justify-center mx-auto mb-3">
                                            <MapPin className="w-5 h-5 text-dark-400" />
                                        </div>
                                        <p className="text-white font-medium mb-1">No Location Data</p>
                                        <p className="text-dark-400 text-xs">Add locations to your expenses when on trips to see them here.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="relative rounded-2xl border border-glass-border overflow-hidden bg-dark-900/60 p-1">
                                            {/* Leaflet Custom Style Overrides */}
                                            <style>{`
                                                .leaflet-popup-content-wrapper {
                                                    background: #0f172a !important;
                                                    border: 1px solid #334155 !important;
                                                    border-radius: 12px !important;
                                                    box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.3) !important;
                                                    padding: 4px !important;
                                                }
                                                .leaflet-popup-tip {
                                                    background: #0f172a !important;
                                                    border: 1px solid #334155 !important;
                                                }
                                                .leaflet-container {
                                                    background: #0a0e1a !important;
                                                    z-index: 10;
                                                }
                                            `}</style>
                                            <div ref={mapRef} className="w-full h-80 rounded-xl overflow-hidden" />
                                        </div>

                                        {/* Geotagged Expenses List (Platform Fallbacks) */}
                                        <div className="space-y-2.5">
                                            <h4 className="text-xs font-semibold text-dark-300 px-1">Location Details & Navigation</h4>
                                            <div className="grid gap-2 sm:grid-cols-2">
                                                {geoExpenses.map((exp) => {
                                                    const cat = CATEGORY_META[exp.category as ExpenseCategory] || CATEGORY_META.others;
                                                    const CatIcon = cat.icon;
                                                    const formattedDate = format(new Date(exp.createdAt), 'MMM dd, yyyy');
                                                    
                                                    return (
                                                        <div 
                                                            key={exp.id} 
                                                            className="glass-card p-3 flex flex-col justify-between hover:border-dark-700 transition-all duration-300"
                                                        >
                                                            <div className="flex items-start justify-between gap-2 mb-2">
                                                                <div className="flex items-center gap-2.5 min-w-0">
                                                                    <div 
                                                                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                                                                        style={{ backgroundColor: `${cat.color}15`, color: cat.color }}
                                                                    >
                                                                        <CatIcon className="w-4 h-4" />
                                                                    </div>
                                                                    <div className="min-w-0">
                                                                        <p className="text-xs font-semibold text-white truncate">{exp.description}</p>
                                                                        <p className="text-[10px] text-dark-500">{formattedDate}</p>
                                                                    </div>
                                                                </div>
                                                                <span className="text-xs font-bold text-white whitespace-nowrap">₹{exp.amount}</span>
                                                            </div>

                                                            <div className="flex items-center justify-between border-t border-dark-800/60 pt-2 mt-1">
                                                                <span className="text-[9px] text-dark-400 flex items-center gap-1">
                                                                    <MapPin className="w-2.5 h-2.5 text-accent" />
                                                                    {exp.location!.lat.toFixed(4)}, {exp.location!.lng.toFixed(4)}
                                                                </span>
                                                                
                                                                <div className="flex items-center gap-1 flex-wrap">
                                                                    <a 
                                                                        href={`https://www.google.com/maps?q=${exp.location!.lat},${exp.location!.lng}`}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="p-1 px-1.5 rounded bg-dark-800 hover:bg-dark-700 text-dark-300 hover:text-white text-[9px] font-medium transition-colors flex items-center gap-0.5 border border-dark-800"
                                                                        title="Open in Google Maps"
                                                                    >
                                                                        Google
                                                                        <ExternalLink className="w-2 h-2" />
                                                                    </a>
                                                                    <a 
                                                                        href={`https://maps.apple.com/?q=${exp.location!.lat},${exp.location!.lng}`}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="p-1 px-1.5 rounded bg-dark-800 hover:bg-dark-700 text-dark-300 hover:text-white text-[9px] font-medium transition-colors flex items-center gap-0.5 border border-dark-800"
                                                                        title="Open in Apple Maps"
                                                                    >
                                                                        Apple
                                                                        <ExternalLink className="w-2 h-2" />
                                                                    </a>
                                                                    <a 
                                                                        href={`https://www.openstreetmap.org/?mlat=${exp.location!.lat}&mlon=${exp.location!.lng}`}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="p-1 px-1.5 rounded bg-dark-800 hover:bg-dark-700 text-dark-300 hover:text-white text-[9px] font-medium transition-colors flex items-center gap-0.5 border border-dark-800"
                                                                        title="Open in OpenStreetMap"
                                                                    >
                                                                        OSM
                                                                        <ExternalLink className="w-2 h-2" />
                                                                    </a>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </>
            )}
        </div>
    );
}
