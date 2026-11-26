import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { isSectionJumping, jumpToSection, SECTION_JUMP_EVENT } from '../jumpToSection';

beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = '<section id="faq"></section>';
  document.getElementById('faq')!.scrollIntoView = vi.fn();
});
afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

test('scrolls smoothly, holds the scroll-driven sections while it travels, and releases them on landing', () => {
  const landed = vi.fn();
  window.addEventListener(SECTION_JUMP_EVENT, landed);
  jumpToSection('faq');
  expect(document.getElementById('faq')!.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
  expect(isSectionJumping()).toBe(true);
  // Still scrolling: nothing lands between scroll events.
  window.dispatchEvent(new Event('scroll'));
  vi.advanceTimersByTime(100);
  window.dispatchEvent(new Event('scroll'));
  vi.advanceTimersByTime(100);
  expect(isSectionJumping()).toBe(true);
  expect(landed).not.toHaveBeenCalled();
  window.dispatchEvent(new Event('scrollend'));
  expect(isSectionJumping()).toBe(false);
  expect(landed).toHaveBeenCalledTimes(1);
  window.removeEventListener(SECTION_JUMP_EVENT, landed);
});

test('the reader taking over with the wheel releases the sections at once', () => {
  jumpToSection('faq');
  window.dispatchEvent(new Event('wheel'));
  expect(isSectionJumping()).toBe(false);
});

test('never stays held, even if no scroll event ever comes', () => {
  jumpToSection('faq');
  vi.advanceTimersByTime(5000);
  expect(isSectionJumping()).toBe(false);
});
