import { beforeEach, describe, expect, test, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const submit = vi.hoisted(() => vi.fn());

vi.mock('../../services/bugReports', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../services/bugReports')>();
  return { ...real, submitReport: submit };
});

import ReportDialog from '../ReportDialog';

function open() {
  return render(<ReportDialog open onOpenChange={() => {}} defaultName="Ada Lovelace" email="ada@example.com" />);
}

beforeEach(() => {
  submit.mockReset();
  URL.createObjectURL = vi.fn(() => `blob:${Math.random()}`);
  URL.revokeObjectURL = vi.fn();
});

describe('ReportDialog', () => {
  test('fills in the name, asks for a description, and offers an emailed copy by default', async () => {
    open();
    expect(screen.getByLabelText('Your name')).toHaveValue('Ada Lovelace');
    expect(screen.getByRole('checkbox', { name: 'Email me a copy' })).toHaveAttribute('data-state', 'checked');
    expect(screen.getByText('To ada@example.com, including everything listed above.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Send report' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Please describe the bug.');
    expect(submit).not.toHaveBeenCalled();
  });

  test('requires a name', async () => {
    open();
    await userEvent.clear(screen.getByLabelText('Your name'));
    await userEvent.type(screen.getByLabelText('What went wrong?'), 'Broken');
    await userEvent.click(screen.getByRole('button', { name: 'Send report' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Please add your name.');
  });

  test('sends the report with screenshots and shows the ticket number', async () => {
    submit.mockResolvedValue({ ticketNo: 12, emailed: true });
    open();
    await userEvent.click(screen.getByRole('radio', { name: /Feedback/ }));
    await userEvent.type(screen.getByLabelText('Your feedback'), 'Love it');
    const shot = new File(['x'], 'a.png', { type: 'image/png' });
    await userEvent.upload(screen.getByTestId('report-file-input'), shot);
    expect(screen.getByAltText('Screenshot 1')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Email me a copy' }));

    await userEvent.click(screen.getByRole('button', { name: 'Send report' }));
    await waitFor(() => expect(screen.getByText('Your ticket number is #12.')).toBeInTheDocument());
    expect(submit).toHaveBeenCalledWith({ kind: 'feedback', name: 'Ada Lovelace', description: 'Love it', screenshots: [shot], emailCopy: false });
  });

  test('lists what is attached, and says phone and student ID are not', async () => {
    open();
    await userEvent.click(screen.getByRole('button', { name: /What else is sent/ }));
    expect(screen.getByText(/The sessions on your day/)).toBeInTheDocument();
    expect(screen.getByText(/Not your phone number or student ID/)).toBeInTheDocument();
  });

  test("shows the server's refusal in words", async () => {
    submit.mockRejectedValue({ message: 'too_many_reports' });
    open();
    await userEvent.type(screen.getByLabelText('What went wrong?'), 'Again');
    await userEvent.click(screen.getByRole('button', { name: 'Send report' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/last hour/));
  });
});
