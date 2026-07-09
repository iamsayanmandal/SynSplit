import React, { createContext, useContext, useState, useEffect } from 'react';

export type Theme = 'smoke' | 'jaguar' | 'pink';

interface ThemeContextType {
    theme: Theme;
    setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setThemeState] = useState<Theme>(() => {
        const saved = localStorage.getItem('synsplit_theme') as Theme;
        return saved === 'smoke' || saved === 'jaguar' || saved === 'pink' ? saved : 'smoke';
    });

    const setTheme = (newTheme: Theme) => {
        setThemeState(newTheme);
        localStorage.setItem('synsplit_theme', newTheme);
        document.documentElement.setAttribute('data-theme', newTheme);
    };

    // Initialize theme on mount
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
    }, [theme]);

    return (
        <ThemeContext.Provider value={{ theme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
}
