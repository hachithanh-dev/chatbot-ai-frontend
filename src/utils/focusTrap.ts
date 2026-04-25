/**
 * Focus Trap Utility — Shared A11y helper.
 *
 * Traps keyboard focus inside a container element (modal, dialog).
 * Supports Tab cycling, Escape to close, and auto-focus first element.
 */

type FocusTrapCleanup = () => void;

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
  ).filter(el => !el.hasAttribute('disabled') && !el.closest('[aria-hidden]'));
}

/**
 * Activate focus trap inside a container.
 * Returns a cleanup function to release the trap.
 *
 * @param container - The element to trap focus inside
 * @param onEscape  - Optional callback when Escape is pressed
 */
export function activateFocusTrap(
  container: HTMLElement,
  onEscape?: () => void
): FocusTrapCleanup {
  const focusable = getFocusableElements(container);
  if (focusable.length > 0) {
    focusable[0].focus();
  }

  const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && onEscape) {
      e.preventDefault();
      onEscape();
      return;
    }

    if (e.key !== 'Tab') return;

    const focusableNow = getFocusableElements(container);
    if (focusableNow.length === 0) return;

    const first = focusableNow[0];
    const last = focusableNow[focusableNow.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  document.addEventListener('keydown', handleKeydown);

  return () => document.removeEventListener('keydown', handleKeydown);
}
