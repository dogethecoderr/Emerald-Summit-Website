import { describe, test, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AnnouncementsPanel from '../AnnouncementsPanel';
import AnnouncementComposer from '../AnnouncementComposer';
import type { Announcement } from '../../models/announcements';

const create = vi.fn().mockResolvedValue(undefined);
const update = vi.fn().mockResolvedValue(undefined);

vi.mock('../../context/AnnouncementsContext', () => ({
  useAnnouncements: () => ({
    announcements: [],
    loading: false,
    error: null,
    canManage: true,
    live: true,
    configured: true,
    refresh: vi.fn(),
    create,
    update,
    remove: vi.fn(),
    togglePinned: vi.fn(),
  }),
}));

vi.mock('../../services/announcements', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/announcements')>();
  return {
    ...actual,
    uploadAttachment: vi.fn(async (file: File) => ({
      id: `att-${file.name}`,
      title: file.name,
      type: file.type.startsWith('image/') ? 'Image' : 'File',
      url: `https://cdn.example.com/${file.name}`,
      mimeType: file.type,
      bytes: file.size,
    })),
    removeAttachmentFile: vi.fn(async () => {}),
  };
});

const announcement: Announcement = {
  id: 'a1',
  title: 'Buses leave at 4',
  body: 'Meet by the gym doors.',
  category: 'Logistics',
  date: 'Jun 29',
  pinned: false,
  author: 'Summit Admin',
  audience: 'Everyone',
  attachments: [
    {
      id: 'att-1',
      title: 'Campus map',
      type: 'PDF',
      url: 'https://cdn.example.com/map.pdf',
      bytes: 430080,
    },
    {
      id: 'att-2',
      title: 'Kickoff clip',
      type: 'Video',
      url: 'https://cdn.example.com/clip.mp4',
    },
  ],
};

describe('AnnouncementsPanel admin controls', () => {
  test('hides every management control from non-admins', () => {
    render(
      <AnnouncementsPanel announcements={[announcement]} canManage={false} />,
    );
    expect(screen.queryByRole('button', { name: /new/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /edit/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /delete/i })).toBeNull();
  });

  test('shows compose, edit, pin, and delete to admins', async () => {
    const onCompose = vi.fn();
    const onEdit = vi.fn();
    render(
      <AnnouncementsPanel
        announcements={[announcement]}
        canManage
        onCompose={onCompose}
        onEdit={onEdit}
        onDelete={vi.fn()}
        onTogglePin={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /new/i }));
    expect(onCompose).toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: /edit/i }));
    expect(onEdit).toHaveBeenCalledWith(announcement);

    expect(screen.getByRole('button', { name: /^pin$/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /delete/i })).toBeTruthy();
  });

  test('plays media inline and lists documents as download rows', () => {
    const { container } = render(
      <AnnouncementsPanel announcements={[announcement]} />,
    );
    expect(container.querySelector('video')).toBeTruthy();

    const pdfRow = screen.getByText('Campus map').closest('a');
    expect(pdfRow?.getAttribute('href')).toBe('https://cdn.example.com/map.pdf');
    expect(screen.getByText(/420 KB/)).toBeTruthy();
  });
});

describe('AnnouncementComposer', () => {
  beforeEach(() => {
    create.mockClear();
    update.mockClear();
  });

  test('requires a title and body before posting', async () => {
    render(<AnnouncementComposer open onOpenChange={vi.fn()} />);
    const post = screen.getByRole('button', { name: /post announcement/i });
    expect(post).toBeDisabled();

    await userEvent.type(screen.getByLabelText('Title'), 'Track sign-ups close');
    expect(post).toBeDisabled();

    await userEvent.type(screen.getByLabelText('Message'), 'Friday at noon.');
    expect(post).toBeEnabled();
  });

  test('accepts a dropped file and posts it as an attachment', async () => {
    const onOpenChange = vi.fn();
    render(<AnnouncementComposer open onOpenChange={onOpenChange} />);

    await userEvent.type(screen.getByLabelText('Title'), 'Photos are up');
    await userEvent.type(screen.getByLabelText('Message'), 'From the kickoff.');

    const file = new File(['binary'], 'kickoff.png', { type: 'image/png' });
    const dropzone = screen.getByText(/drag files here/i).closest('div')!;
    fireEvent.drop(dropzone, { dataTransfer: { files: [file] } });

    await screen.findByText('kickoff.png');

    await userEvent.click(
      screen.getByRole('button', { name: /post announcement/i }),
    );

    await waitFor(() => expect(create).toHaveBeenCalled());
    const draft = create.mock.calls[0][0];
    expect(draft.title).toBe('Photos are up');
    expect(draft.attachments).toHaveLength(1);
    expect(draft.attachments[0]).toMatchObject({
      title: 'kickoff.png',
      type: 'Image',
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  test('highlights the dropzone while a file is dragged over it', () => {
    render(<AnnouncementComposer open onOpenChange={vi.fn()} />);
    const dropzone = screen.getByText(/drag files here/i).closest('div')!;

    fireEvent.dragEnter(dropzone);
    expect(screen.getByText(/drop to attach/i)).toBeTruthy();

    fireEvent.dragLeave(dropzone);
    expect(screen.getByText(/drag files here/i)).toBeTruthy();
  });

  test('opens prefilled when editing and saves through update', async () => {
    render(
      <AnnouncementComposer open onOpenChange={vi.fn()} editing={announcement} />,
    );

    expect(screen.getByLabelText('Title')).toHaveValue('Buses leave at 4');
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(update).toHaveBeenCalled());
    expect(update.mock.calls[0][0]).toBe('a1');
  });
});
