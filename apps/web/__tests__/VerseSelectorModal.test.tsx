'use client';

import { act, fireEvent, render, screen } from '@testing-library/react';
import { VerseSelectorModal } from '../components/modals/VerseSelectorModal';

describe('VerseSelectorModal', () => {
  const baseProps = {
    isOpen: true,
    chapterName: 'Genesis 1',
    totalVerses: 31,
    readVerseNumbers: new Set<number>([1, 2, 3]),
    onMarkFull: jest.fn(),
    onSaveRange: jest.fn(),
    onClose: jest.fn(),
    onExited: jest.fn(),
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it('closes when Escape is pressed', () => {
    render(<VerseSelectorModal {...baseProps} />);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(baseProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('saves the default range without forcing an immediate unmount', () => {
    render(<VerseSelectorModal {...baseProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'save selection' }));

    expect(baseProps.onSaveRange).toHaveBeenCalledWith(1, 31);
    expect(baseProps.onClose).not.toHaveBeenCalled();
  });

  it('keeps the dialog mounted through the exit transition and then notifies onExited', () => {
    const { rerender } = render(<VerseSelectorModal {...baseProps} />);

    act(() => {
      jest.advanceTimersByTime(50);
    });

    expect(screen.getByRole('dialog')).toBeInTheDocument();

    rerender(<VerseSelectorModal {...baseProps} isOpen={false} />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(199);
    });

    expect(baseProps.onExited).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(1);
    });

    expect(baseProps.onExited).toHaveBeenCalledTimes(1);
  });
});
