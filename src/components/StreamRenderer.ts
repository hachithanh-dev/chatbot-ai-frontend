import { renderMarkdown } from './MarkdownRenderer';
import { scrollToBottom } from './ChatWindow';

/**
 * StreamRenderer — Production-grade typewriter streaming effect.
 *
 * Architecture inspired by ChatGPT/Gemini:
 * 1. SSE tokens arrive in bursts → pushed into a token queue.
 * 2. A constant-rate animation loop drains the queue char-by-char
 *    at a visually pleasing speed (configurable).
 * 3. Markdown is re-parsed at a throttled interval (not every char)
 *    to avoid layout thrashing from full innerHTML replacement.
 *
 * Key differences from the old approach:
 * - Old: accumulatedContent += chunk → rAF → innerHTML = renderMarkdown(all)
 *        → every SSE frame causes full DOM rebuild → janky.
 * - New: tokens buffer → animate draining at smooth rate → markdown batched
 *        render every RENDER_INTERVAL_MS → buttery smooth.
 */

// --- Configuration ---
const CHARS_PER_FRAME = 3;           // Characters revealed per animation tick
const ANIMATION_INTERVAL_MS = 16;    // ~60fps tick rate for typewriter
const RENDER_INTERVAL_MS = 80;       // Markdown re-parse interval (batch)
const FAST_CATCHUP_THRESHOLD = 100;  // If buffer > this, speed up to catch up
const FAST_CHARS_PER_FRAME = 12;     // Faster drain when buffer is large

export class StreamRenderer {
  private contentEl: HTMLElement;
  private tokenQueue: string[] = [];       // Pending characters to display
  private displayedContent = '';           // What the user sees (fully "typed")
  private fullContent = '';                // All tokens received so far
  private animationTimer: number | null = null;
  private renderTimer: number | null = null;
  private isDone = false;
  private lastRenderedLength = 0;
  private onComplete?: () => void;

  constructor(contentEl: HTMLElement) {
    this.contentEl = contentEl;
  }

  /**
   * Push new token(s) from SSE into the animation queue.
   * Called every time a CONTENT event arrives.
   */
  pushToken(text: string): void {
    this.fullContent += text;
    // Push each character individually for smooth typewriter
    for (const ch of text) {
      this.tokenQueue.push(ch);
    }
    // Start animation loop if not running
    this.ensureAnimating();
  }

  /**
   * Signal that the SSE stream is complete.
   * The renderer will finish draining the queue, then fire onComplete.
   */
  finish(callback?: () => void): void {
    this.isDone = true;
    this.onComplete = callback;
    // If queue is already empty, finalize now
    if (this.tokenQueue.length === 0) {
      this.finalize();
    }
    // Otherwise the animation loop will call finalize when queue empties
  }

  /**
   * Force-stop the renderer (e.g., on error).
   */
  destroy(): void {
    if (this.animationTimer !== null) {
      clearInterval(this.animationTimer);
      this.animationTimer = null;
    }
    if (this.renderTimer !== null) {
      clearInterval(this.renderTimer);
      this.renderTimer = null;
    }
  }

  /** Get the full accumulated content (for final render). */
  getFullContent(): string {
    return this.fullContent;
  }

  // --- Private methods ---

  private ensureAnimating(): void {
    if (this.animationTimer !== null) return;

    // Start the typewriter drain loop
    this.animationTimer = window.setInterval(() => {
      this.drainQueue();
    }, ANIMATION_INTERVAL_MS);

    // Start the batched markdown render loop
    if (this.renderTimer === null) {
      this.renderTimer = window.setInterval(() => {
        this.batchRender();
      }, RENDER_INTERVAL_MS);
    }
  }

  private drainQueue(): void {
    if (this.tokenQueue.length === 0) {
      if (this.isDone) {
        this.finalize();
      }
      return;
    }

    // Adaptive speed: if buffer is large, drain faster to catch up
    const charsThisTick = this.tokenQueue.length > FAST_CATCHUP_THRESHOLD
      ? FAST_CHARS_PER_FRAME
      : CHARS_PER_FRAME;

    const count = Math.min(charsThisTick, this.tokenQueue.length);
    for (let i = 0; i < count; i++) {
      this.displayedContent += this.tokenQueue.shift()!;
    }
  }

  private batchRender(): void {
    // Only re-render if content actually changed
    if (this.displayedContent.length === this.lastRenderedLength) return;
    this.lastRenderedLength = this.displayedContent.length;

    // Use requestAnimationFrame for paint-aligned rendering
    requestAnimationFrame(() => {
      this.contentEl.innerHTML = renderMarkdown(this.displayedContent);
      scrollToBottom();
    });
  }

  private finalize(): void {
    this.destroy();

    // Final flush: render the complete content
    requestAnimationFrame(() => {
      this.contentEl.innerHTML = renderMarkdown(this.fullContent);
      scrollToBottom();
      this.onComplete?.();
    });
  }
}
