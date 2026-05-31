"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Theme = "dark" | "light";

interface ThemeContextValue {
    theme: Theme;
    setTheme: (theme: Theme) => void;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const THEME_STORAGE_KEY = "store-theme";

/**
 * Get the initial theme from localStorage or default to dark
 * Requirements 6.1: Default to dark theme
 */
function getInitialTheme(): Theme {
    if (typeof window === "undefined") {
        return "dark";
    }

    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark") {
        return stored;
    }

    return "dark";
}

/**
 * Apply theme to document by setting data-theme attribute and dark class
 * Requirements 6.2: Switch between dark and light modes using CSS variables
 */
function applyTheme(theme: Theme): void {
    if (typeof document === "undefined") return;

    document.documentElement.setAttribute("data-theme", theme);
    
    // Also toggle .dark class for Tailwind dark: variants
    if (theme === "dark") {
        document.documentElement.classList.add("dark");
    } else {
        document.documentElement.classList.remove("dark");
    }
}

/**
 * Persist theme preference to localStorage
 * Requirements 6.3: Persist the preference and apply it on subsequent visits
 */
function persistTheme(theme: Theme): void {
    if (typeof window === "undefined") return;

    localStorage.setItem(THEME_STORAGE_KEY, theme);
}

interface ThemeProviderProps {
    children: ReactNode;
    defaultTheme?: Theme;
}

export function ThemeProvider({ children, defaultTheme = "dark" }: ThemeProviderProps) {
    const [theme, setThemeState] = useState<Theme>(defaultTheme);
    const [mounted, setMounted] = useState(false);

    // Initialize theme from localStorage on mount
    useEffect(() => {
        const initialTheme = getInitialTheme();
        setThemeState(initialTheme);
        applyTheme(initialTheme);
        setMounted(true);
    }, []);

    const setTheme = (newTheme: Theme) => {
        setThemeState(newTheme);
        applyTheme(newTheme);
        persistTheme(newTheme);
    };

    const toggleTheme = () => {
        const newTheme = theme === "dark" ? "light" : "dark";
        setTheme(newTheme);
    };

    // Prevent flash of wrong theme
    if (!mounted) {
        return (
            <ThemeContext.Provider value={{ theme: defaultTheme, setTheme, toggleTheme }}>
                {children}
            </ThemeContext.Provider>
        );
    }

    return (
        <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme(): ThemeContextValue {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error("useTheme must be used within a ThemeProvider");
    }
    return context;
}
