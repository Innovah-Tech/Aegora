import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

const STORAGE_KEY = 'aegora-theme';

export default function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState('light');

  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const initial = saved || 'light';
      setTheme(initial);
      document.documentElement.classList.remove('light', 'dark');
      document.documentElement.classList.add(initial);
    } catch {}
  }, []);

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch {}
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(next);
  };

  if (!mounted) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle dark mode"
      aria-pressed={theme === 'dark'}
      className="px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 shadow-sm hover:shadow-md"
    >
      {theme === 'dark' ? (
        <>
          <Sun className="w-4 h-4 text-yellow-500" />
          <span className="hidden sm:inline">Light</span>
        </>
      ) : (
        <>
          <Moon className="w-4 h-4 text-blue-600" />
          <span className="hidden sm:inline">Dark</span>
        </>
      )}
    </button>
  );
}


