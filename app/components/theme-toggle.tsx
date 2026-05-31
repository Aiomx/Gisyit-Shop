import { Moon, Sun } from "lucide-react";
import { useTheme } from "~/lib/theme";
import { Button } from "./ui/button";

/**
 * Theme toggle button component
 * Requirements 6.2: Toggle between dark and light modes
 */
export function ThemeToggle() {
    const { theme, toggleTheme } = useTheme();

    return (
        <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        >
            {theme === "dark" ? (
                <Sun className="h-5 w-5" />
            ) : (
                <Moon className="h-5 w-5" />
            )}
        </Button>
    );
}
