export function trackCategoryUsage(userId: string, category: string) {
    if (!userId || !category) return;
    try {
        const key = `synsplit_category_usage_${userId}`;
        const saved = localStorage.getItem(key);
        const usage: Record<string, number> = saved ? JSON.parse(saved) : {};
        usage[category] = (usage[category] || 0) + 1;
        localStorage.setItem(key, JSON.stringify(usage));
    } catch (e) {
        console.error('Failed to track category usage', e);
    }
}

export function sortCategoriesByUsage(userId: string | undefined, categories: string[]): string[] {
    if (!userId) return categories;
    try {
        const key = `synsplit_category_usage_${userId}`;
        const saved = localStorage.getItem(key);
        if (!saved) return categories;
        
        const usage: Record<string, number> = JSON.parse(saved);
        
        // Sort descending by usage count. If equal, preserve original order.
        return [...categories].sort((a, b) => {
            const countA = usage[a] || 0;
            const countB = usage[b] || 0;
            return countB - countA;
        });
    } catch (e) {
        console.error('Failed to sort categories', e);
        return categories;
    }
}
