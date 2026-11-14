import { beforeEach, describe, expect, test, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mocks = vi.hoisted(() => ({ gallery: vi.fn(), create: vi.fn() }));

vi.mock('../../services/sessionPhotos', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../services/sessionPhotos')>(),
  fetchHomeGallery: mocks.gallery,
}));
vi.mock('../../services/summitContent', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../services/summitContent')>(),
  createDiscipline: mocks.create,
}));
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

import PhotoSlideshow from '../home/PhotoSlideshow';
import LinksCard from '../home/LinksCard';
import NewDisciplineDialog from '../verse/NewDisciplineDialog';

beforeEach(() => vi.clearAllMocks());

describe('Home photo slideshow', () => {
  test('shows nothing while the bucket is empty', async () => {
    mocks.gallery.mockResolvedValue([]);
    const { container } = render(<PhotoSlideshow />);
    await waitFor(() => expect(mocks.gallery).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  test('moves to the next photo every 5 seconds and loads only the current and next', async () => {
    vi.useFakeTimers();
    mocks.gallery.mockResolvedValue(['a', 'b', 'c'].map((n) => ({ name: n, url: `https://cdn/${n}.jpg` })));
    const { container } = render(<PhotoSlideshow />);
    await act(async () => {}); // let the bucket listing resolve
    expect(screen.getByRole('button', { name: 'Photo 1 of 3' })).toHaveAttribute('aria-current', 'true');
    expect([...container.querySelectorAll('img')].map((i) => i.getAttribute('src'))).toEqual(['https://cdn/a.jpg', 'https://cdn/b.jpg']);
    await act(async () => { vi.advanceTimersByTime(5000); });
    expect(screen.getByRole('button', { name: 'Photo 2 of 3' })).toHaveAttribute('aria-current', 'true');
    vi.useRealTimers();
  });
});

describe('Home links', () => {
  test("are the app's three", () => {
    render(<LinksCard />);
    expect(screen.getByRole('link', { name: /Summit website/ })).toHaveAttribute('href', 'https://sites.google.com/view/ehs-academic-foundation/programs/emerald-summit');
    expect(screen.getByRole('link', { name: /Instagram/ })).toHaveAttribute('target', '_blank');
    expect(screen.getByRole('link', { name: /Contact/ })).toHaveAttribute('href', 'mailto:president@ehsacademics.org');
  });
});

describe('New discipline', () => {
  test('checks the id and name with the app wording', async () => {
    const user = userEvent.setup();
    render(<NewDisciplineDialog open onOpenChange={vi.fn()} />);
    await user.type(screen.getByLabelText('Id (slug)'), 'Health Verse');
    await user.click(screen.getByRole('button', { name: /Create discipline/ }));
    expect(screen.getByRole('alert')).toHaveTextContent('Id must be lowercase letters, numbers, or _.');
    await user.clear(screen.getByLabelText('Id (slug)'));
    await user.type(screen.getByLabelText('Id (slug)'), 'healthverse');
    await user.click(screen.getByRole('button', { name: /Create discipline/ }));
    expect(screen.getByRole('alert')).toHaveTextContent('Name is required.');
    expect(mocks.create).not.toHaveBeenCalled();
  });

  test('creates it and closes', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    mocks.create.mockResolvedValue(undefined);
    render(<NewDisciplineDialog open onOpenChange={onOpenChange} />);
    await user.type(screen.getByLabelText('Id (slug)'), 'HealthVerse');
    await user.type(screen.getByLabelText('Name'), 'HealthVerse');
    await user.type(screen.getByLabelText('Tagline'), 'Medicine & public health');
    await user.click(screen.getByRole('button', { name: /Create discipline/ }));
    expect(mocks.create).toHaveBeenCalledWith({ id: 'healthverse', name: 'HealthVerse', tagline: 'Medicine & public health', icon: 'category' });
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  test('a taken id says so', async () => {
    const user = userEvent.setup();
    mocks.create.mockRejectedValue(new Error('duplicate key'));
    render(<NewDisciplineDialog open onOpenChange={vi.fn()} />);
    await user.type(screen.getByLabelText('Id (slug)'), 'techverse');
    await user.type(screen.getByLabelText('Name'), 'TechVerse');
    await user.click(screen.getByRole('button', { name: /Create discipline/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not create. The id may already be taken.');
  });
});
