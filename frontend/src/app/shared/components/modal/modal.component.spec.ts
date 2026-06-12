import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';

import { ModalComponent } from './modal.component';

/**
 * Unit coverage for TASK-0011 (modal dialog a11y):
 *  - the dialog carries role="dialog", aria-modal="true" and aria-labelledby
 *    pointing at the title heading,
 *  - opening the modal moves focus into the dialog,
 *  - closing (destroying) the modal returns focus to the previously focused trigger,
 *  - Escape emits `closed`,
 *  - Tab/Shift+Tab cycle within the dialog (focus trap).
 *
 * Note: this vitest setup compiles components with runtime JIT (no Angular
 * compiler transform), so signal-input bindings from a host template are not
 * available. The component is therefore created directly and its `title`
 * input signal is replaced on the instance; content is appended into the
 * projected content slot, which the focus trap reads live from the DOM.
 */

describe('ModalComponent (a11y)', () => {
  let fixture: ComponentFixture<ModalComponent>;
  let trigger: HTMLButtonElement;

  beforeAll(() => {
    try {
      TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
    } catch {
      // already initialized by another spec
    }
  });

  beforeEach(() => {
    TestBed.resetTestingModule();
    // Simulate the element that triggered the modal (e.g. the "Neu" button).
    trigger = document.createElement('button');
    trigger.id = 'trigger';
    trigger.textContent = 'Öffnen';
    document.body.appendChild(trigger);
  });

  afterEach(() => {
    fixture?.destroy();
    trigger.remove();
  });

  /** Creates the modal while `trigger` is focused, mirroring a click-opened dialog. */
  async function openModal(): Promise<HTMLElement> {
    trigger.focus();
    fixture = TestBed.createComponent(ModalComponent);
    // JIT metadata for signal inputs is unavailable; replace the input signal directly.
    (fixture.componentInstance as unknown as { title: () => string }).title = signal('Testdialog');
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture.nativeElement.querySelector('[role="dialog"]') as HTMLElement;
  }

  /** Appends focusable content into the modal body (stand-in for projected form content). */
  function addContent(dialog: HTMLElement): { input: HTMLInputElement; button: HTMLButtonElement } {
    const slot = dialog.querySelector('.p-6') as HTMLElement;
    const input = document.createElement('input');
    input.id = 'content-input';
    const button = document.createElement('button');
    button.id = 'content-button';
    button.textContent = 'OK';
    slot.append(input, button);
    return { input, button };
  }

  function pressKey(target: Element, key: string, shiftKey = false): KeyboardEvent {
    const event = new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true });
    target.dispatchEvent(event);
    return event;
  }

  it('renders role="dialog" with aria-modal and aria-labelledby pointing at the title', async () => {
    const dialog = await openModal();

    expect(dialog).not.toBeNull();
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('tabindex')).toBe('-1');

    const labelledBy = dialog.getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();
    const titleEl = dialog.querySelector(`#${labelledBy}`);
    expect(titleEl?.tagName).toBe('H2');
    expect(titleEl?.textContent?.trim()).toBe('Testdialog');
  });

  it('moves focus into the dialog when it opens', async () => {
    const dialog = await openModal();

    expect(document.activeElement).not.toBe(trigger);
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('returns focus to the previously focused trigger when it closes', async () => {
    const dialog = await openModal();
    expect(dialog.contains(document.activeElement)).toBe(true);

    fixture.destroy();

    expect(document.activeElement).toBe(trigger);
  });

  it('emits closed on Escape and stops the event from reaching document handlers', async () => {
    const dialog = await openModal();
    const onClosed = vi.fn();
    fixture.componentInstance.closed.subscribe(onClosed);
    const documentListener = vi.fn();
    document.addEventListener('keydown', documentListener);

    pressKey(dialog, 'Escape');

    expect(onClosed).toHaveBeenCalledTimes(1);
    expect(documentListener).not.toHaveBeenCalled();
    document.removeEventListener('keydown', documentListener);
  });

  it('traps Tab: cycles from the last focusable element back to the first', async () => {
    const dialog = await openModal();
    const { button } = addContent(dialog);
    const closeButton = dialog.querySelector('button[aria-label="Schließen"]') as HTMLButtonElement;

    button.focus();
    const event = pressKey(button, 'Tab');

    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(closeButton);
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('traps Shift+Tab: cycles from the first focusable element back to the last', async () => {
    const dialog = await openModal();
    const { button } = addContent(dialog);
    const closeButton = dialog.querySelector('button[aria-label="Schließen"]') as HTMLButtonElement;

    closeButton.focus();
    const event = pressKey(closeButton, 'Tab', true);

    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(button);
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('does not wrap when tabbing between elements in the middle of the dialog', async () => {
    const dialog = await openModal();
    const { input } = addContent(dialog);

    input.focus();
    const event = pressKey(input, 'Tab');

    // Browser default tabbing handles the move; the trap must not interfere.
    expect(event.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(input);
  });
});
