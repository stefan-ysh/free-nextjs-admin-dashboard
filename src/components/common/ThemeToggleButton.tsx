import React from "react";
import { useTheme } from "../../context/ThemeContext";
import { Sun, Moon } from 'lucide-react'

export const ThemeToggleButton: React.FC = () => {
  const { toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="relative flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <Sun className="w-5 h-5 hidden dark:block text-foreground/70" />
      <Moon className="w-5 h-5block dark:hidden text-foreground/70" />
    </button>
  );
};
