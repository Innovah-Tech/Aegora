// Accessibility enhancements and utilities
import { useEffect, useRef } from 'react';

/**
 * Hook to manage focus trap for modals
 */
export function useFocusTrap(isActive) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    const container = containerRef.current;
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTab = (e) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    container.addEventListener('keydown', handleTab);
    firstElement?.focus();

    return () => {
      container.removeEventListener('keydown', handleTab);
    };
  }, [isActive]);

  return containerRef;
}

/**
 * Hook to announce messages to screen readers
 */
export function useAriaLive() {
  const announce = (message, priority = 'polite') => {
    const liveRegion = document.getElementById('aria-live-region');
    if (liveRegion) {
      liveRegion.setAttribute('aria-live', priority);
      liveRegion.textContent = message;
      setTimeout(() => {
        liveRegion.textContent = '';
      }, 1000);
    }
  };

  return { announce };
}

/**
 * Component to render ARIA live region
 */
export function AriaLiveRegion() {
  return (
    <div
      id="aria-live-region"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
    />
  );
}

/**
 * Keyboard navigation utilities
 */
export const keyboardShortcuts = {
  ESC: 'Escape',
  ENTER: 'Enter',
  SPACE: ' ',
  ARROW_UP: 'ArrowUp',
  ARROW_DOWN: 'ArrowDown',
  ARROW_LEFT: 'ArrowLeft',
  ARROW_RIGHT: 'ArrowRight',
};

/**
 * Hook for keyboard shortcuts
 */
export function useKeyboardShortcut(keys, callback, deps = []) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (Array.isArray(keys)) {
        const allPressed = keys.every(key => 
          key === 'meta' ? event.metaKey :
          key === 'ctrl' ? event.ctrlKey :
          key === 'shift' ? event.shiftKey :
          key === 'alt' ? event.altKey :
          event.key === key
        );
        if (allPressed) {
          event.preventDefault();
          callback(event);
        }
      } else if (event.key === keys) {
        callback(event);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [keys, callback, ...deps]);
}

/**
 * Accessible button component with proper ARIA attributes
 */
export function AccessibleButton({
  children,
  onClick,
  disabled,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
  className = '',
  ...props
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel || (typeof children === 'string' ? children : undefined)}
      aria-describedby={ariaDescribedBy}
      className={`focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

/**
 * Accessible input component
 */
export function AccessibleInput({
  label,
  id,
  error,
  required,
  helpText,
  className = '',
  ...props
}) {
  const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
  const errorId = error ? `${inputId}-error` : undefined;
  const helpId = helpText ? `${inputId}-help` : undefined;
  const describedBy = [errorId, helpId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="w-full">
      <label
        htmlFor={inputId}
        className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
      >
        {label}
        {required && (
          <span className="text-red-500 ml-1" aria-label="required">
            *
          </span>
        )}
      </label>
      {helpText && (
        <p id={helpId} className="text-sm text-gray-500 dark:text-gray-400 mb-2">
          {helpText}
        </p>
      )}
      <input
        id={inputId}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={describedBy}
        aria-required={required}
        className={`
          w-full px-4 py-2 border rounded-lg
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
          ${error 
            ? 'border-red-300 dark:border-red-600 bg-red-50 dark:bg-red-900/20' 
            : 'border-gray-300 dark:border-gray-600'
          }
          ${className}
        `}
        {...props}
      />
      {error && (
        <p id={errorId} className="mt-1 text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export default {
  useFocusTrap,
  useAriaLive,
  useKeyboardShortcut,
  keyboardShortcuts,
};

