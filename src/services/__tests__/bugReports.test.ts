import { beforeEach, describe, expect, test, vi } from 'vitest';

const sb = vi.hoisted(() => ({
  upload: vi.fn(),
  remove: vi.fn(),
  rpc: vi.fn(),
  invoke: vi.fn(),
  bucket: vi.fn(),
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: 'user-1' } } }) },
    storage: {
      from: (bucket: string) => {
        sb.bucket(bucket);
        return { upload: sb.upload, remove: sb.remove };
      },
    },
    rpc: sb.rpc,
    functions: { invoke: sb.invoke },
  },
  isSupabaseConfigured: true,
}));

import { noteRoute, redactUrl, resetDiagnostics } from '../../lib/diagnostics';
import { reportAsMarkdown, reportErrorMessage, screenshotProblem, submitReport, type BugReport } from '../bugReports';

const png = (name = 'shot.png', size = 10) => new File([new Uint8Array(size)], name, { type: 'image/png' });

beforeEach(() => {
  vi.clearAllMocks();
  resetDiagnostics();
  vi.spyOn(crypto, 'randomUUID').mockReturnValue('11111111-2222-3333-4444-555555555555');
  sb.upload.mockResolvedValue({ error: null });
  sb.remove.mockResolvedValue({ error: null });
  sb.rpc.mockResolvedValue({ data: [{ id: 'x', ticket_no: 42 }], error: null });
  sb.invoke.mockResolvedValue({ data: { ok: true, sent_copy: true }, error: null });
});

describe('submitReport', () => {
  test("uploads screenshots into the caller's report folder, then submits with the browser context", async () => {
    noteRoute('/schedule');
    noteRoute('/account');
    const result = await submitReport({ kind: 'bug', name: ' Ada ', description: ' It broke ', screenshots: [png(), png('b.jpg')], emailCopy: true });

    expect(sb.bucket).toHaveBeenCalledWith('bug_report_screenshots');
    expect(sb.upload.mock.calls.map((c) => c[0])).toEqual([
      'user-1/11111111-2222-3333-4444-555555555555/1.png',
      'user-1/11111111-2222-3333-4444-555555555555/2.png',
    ]);
    const [name, args] = sb.rpc.mock.calls[0];
    expect(name).toBe('submit_bug_report');
    expect(args).toMatchObject({
      p_id: '11111111-2222-3333-4444-555555555555',
      p_kind: 'bug',
      p_name: 'Ada',
      p_description: 'It broke',
      p_email_copy: true,
    });
    expect(args.p_screenshots).toHaveLength(2);
    expect(args.p_client.app).toBe('website');
    expect(args.p_client.route_history.map((r: { path: string }) => r.path)).toEqual(['/schedule', '/account']);
    expect(sb.invoke).toHaveBeenCalledWith('bug-report-email', { body: { report_id: '11111111-2222-3333-4444-555555555555' } });
    expect(result).toEqual({ ticketNo: 42, emailed: true });
  });

  test('a refused submit removes the uploaded screenshots and throws', async () => {
    sb.rpc.mockResolvedValue({ data: null, error: { message: 'too_many_reports' } });
    await expect(submitReport({ kind: 'bug', name: 'A', description: 'B', screenshots: [png()], emailCopy: false })).rejects.toBeTruthy();
    expect(sb.remove).toHaveBeenCalledWith(['user-1/11111111-2222-3333-4444-555555555555/1.png']);
    expect(sb.invoke).not.toHaveBeenCalled();
  });

  test('the report still counts as sent when the email fails', async () => {
    sb.invoke.mockResolvedValue({ data: null, error: new Error('boom') });
    expect(await submitReport({ kind: 'feedback', name: 'A', description: 'B', screenshots: [], emailCopy: true }))
      .toEqual({ ticketNo: 42, emailed: false });
    sb.invoke.mockRejectedValue(new Error('offline'));
    expect(await submitReport({ kind: 'feedback', name: 'A', description: 'B', screenshots: [], emailCopy: false }))
      .toEqual({ ticketNo: 42, emailed: null });
  });

  test('refuses files that are not images or are over 10 MB', async () => {
    expect(screenshotProblem(new File(['x'], 'notes.txt', { type: 'text/plain' }))).toMatch(/isn't an image/);
    expect(screenshotProblem(png('big.png', 10 * 1024 * 1024 + 1))).toMatch(/over 10 MB/);
    expect(screenshotProblem(png())).toBeNull();
  });
});

describe('reportErrorMessage', () => {
  test("turns the server's codes into words", () => {
    expect(reportErrorMessage({ message: 'too_many_reports' })).toMatch(/last hour/);
    expect(reportErrorMessage(new Error('name_required'))).toBe('Please add your name.');
    expect(reportErrorMessage('weird')).toMatch(/couldn't send/);
  });
});

describe('redactUrl', () => {
  test('hides secret query values and keeps the rest', () => {
    expect(redactUrl('/rest/v1/rpc/x?select=*&token=abc')).toBe('/rest/v1/rpc/x?select=*&token=[hidden]');
    expect(redactUrl('https://abc.supabase.co/storage/v1/object/sign/b/p.png?token=secret')).toBe('abc.supabase.co/storage/v1/object/sign/b/p.png?token=[hidden]');
  });
});

describe('reportAsMarkdown', () => {
  test('includes the description, screenshots and both data blocks', () => {
    const report = {
      id: 'r', ticket_no: 7, user_id: 'u', kind: 'bug', reporter_name: 'Ada', description: 'Schedule is empty',
      screenshots: ['u/r/1.png'], email_copy: true, client: { page: '/schedule' }, snapshot: { profile: { role: 'participant' } },
      status: 'open', resolved_at: null, emailed_at: null, email_error: null, created_at: '2026-11-14T00:00:00Z',
    } satisfies BugReport;
    const md = reportAsMarkdown(report, ['https://signed/1']);
    expect(md).toContain('# Bug report #7');
    expect(md).toContain('Schedule is empty');
    expect(md).toContain('[Screenshot 1](https://signed/1)');
    expect(md).toContain('"page": "/schedule"');
    expect(md).toContain('"role": "participant"');
  });
});
