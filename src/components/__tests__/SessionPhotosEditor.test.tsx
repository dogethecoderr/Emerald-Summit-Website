import { beforeEach, describe, expect, test, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const photos = vi.hoisted(() => ({
  fetch: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
}));

vi.mock('../../services/sessionPhotos', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../services/sessionPhotos')>(),
  fetchSessionPhotos: photos.fetch,
  uploadSessionPhoto: photos.upload,
  deleteSessionPhoto: photos.remove,
}));

const toastError = vi.hoisted(() => vi.fn());
vi.mock('sonner', () => ({ toast: { error: toastError, success: vi.fn() } }));

import SessionPhotosEditor from '../session/SessionPhotosEditor';

const A = { name: 'p_1.jpg', url: 'https://cdn/s1/p_1.jpg' };
const B = { name: 'p_2.jpg', url: 'https://cdn/s1/p_2.jpg' };

beforeEach(() => {
  vi.clearAllMocks();
  photos.fetch.mockResolvedValue([A, B]);
});

const imgs = (container: HTMLElement) => [...container.querySelectorAll('img')].map((i) => i.getAttribute('src'));

describe('SessionPhotosEditor', () => {
  test('a new session asks to be saved first', () => {
    render(<SessionPhotosEditor hero={null} onHeroChange={vi.fn()} />);
    expect(screen.getByText('Save the session first, then reopen it to add photos.')).toBeInTheDocument();
    expect(photos.fetch).not.toHaveBeenCalled();
  });

  test("shows the hero once and keeps it out of the gallery", async () => {
    const { container } = render(<SessionPhotosEditor sessionId="s1" hero={B.url} onHeroChange={vi.fn()} />);
    await waitFor(() => expect(imgs(container)).toEqual([B.url, A.url]));
    expect(screen.getByRole('button', { name: /Replace/ })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Remove' })).toHaveLength(1);
  });

  test('setting a hero uploads the photo and hands its URL to the form', async () => {
    const onHeroChange = vi.fn();
    const C = { name: 'p_3.jpg', url: 'https://cdn/s1/p_3.jpg' };
    photos.upload.mockResolvedValue(C);
    const { container } = render(<SessionPhotosEditor sessionId="s1" hero={null} onHeroChange={onHeroChange} />);
    await waitFor(() => expect(photos.fetch).toHaveBeenCalledWith('s1'));
    const input = container.querySelectorAll<HTMLInputElement>('input[type=file]')[0];
    await userEvent.upload(input, new File(['x'], 'c.jpg', { type: 'image/jpeg' }));
    await waitFor(() => expect(onHeroChange).toHaveBeenCalledWith(C.url));
    expect(photos.upload).toHaveBeenCalledWith('s1', expect.any(File));
  });

  test('adding to the gallery does not change the hero', async () => {
    const onHeroChange = vi.fn();
    const C = { name: 'p_3.jpg', url: 'https://cdn/s1/p_3.jpg' };
    photos.upload.mockResolvedValue(C);
    const { container } = render(<SessionPhotosEditor sessionId="s1" hero={null} onHeroChange={onHeroChange} />);
    await waitFor(() => expect(imgs(container)).toHaveLength(2));
    const input = container.querySelectorAll<HTMLInputElement>('input[type=file]')[1];
    await userEvent.upload(input, new File(['x'], 'c.jpg', { type: 'image/jpeg' }));
    await waitFor(() => expect(imgs(container)).toContain(C.url));
    expect(onHeroChange).not.toHaveBeenCalled();
  });

  test("a refused upload says the user may not manage the session", async () => {
    photos.upload.mockRejectedValue(new Error('new row violates row-level security policy'));
    const { container } = render(<SessionPhotosEditor sessionId="s1" hero={null} onHeroChange={vi.fn()} />);
    const input = container.querySelectorAll<HTMLInputElement>('input[type=file]')[1];
    await userEvent.upload(input, new File(['x'], 'c.jpg', { type: 'image/jpeg' }));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Could not upload. You may not manage this session.'));
  });

  test('removing a gallery photo deletes the file', async () => {
    photos.remove.mockResolvedValue(undefined);
    const { container } = render(<SessionPhotosEditor sessionId="s1" hero={null} onHeroChange={vi.fn()} />);
    await waitFor(() => expect(imgs(container)).toHaveLength(2));
    await userEvent.click(screen.getAllByRole('button', { name: 'Remove' })[0]);
    expect(photos.remove).toHaveBeenCalledWith('s1', A.name);
    await waitFor(() => expect(imgs(container)).toEqual([B.url]));
  });
});
