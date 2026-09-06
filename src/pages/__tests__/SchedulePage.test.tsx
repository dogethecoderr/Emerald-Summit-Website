import type { ReactNode } from 'react';
import { describe, expect, test, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import SchedulePage from '../SchedulePage';
import { MOCK_SESSIONS } from '../../models/sessions';

vi.mock('../../hooks/useRequireProfile', () => ({
  useRequireRole: () => ({ ready: true, redirect: null, roleName: 'participant' }),
}));

vi.mock('../../context/ScheduleContext', () => ({
  useSchedule: () => ({
    mySchedule: [],
    setMySchedule: vi.fn(),
    spectating: [],
    setSpectating: vi.fn(),
  }),
}));

vi.mock('../../components/AppShell', () => ({
  default: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));

vi.mock('../../components/PageHeader', () => ({
  default: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

vi.mock('@hello-pangea/dnd', () => ({
  DragDropContext: ({ children }: { children: ReactNode }) => <>{children}</>,
  Droppable: ({
    children,
  }: {
    children: (
      provided: { innerRef: () => void; droppableProps: object; placeholder: null },
      snapshot: { isDraggingOver: boolean },
    ) => ReactNode;
  }) => <>{children({ innerRef: () => {}, droppableProps: {}, placeholder: null }, { isDraggingOver: false })}</>,
  Draggable: ({
    children,
  }: {
    children: (
      provided: {
        innerRef: () => void;
        draggableProps: { style: object };
        dragHandleProps: object;
      },
      snapshot: { isDragging: boolean },
    ) => ReactNode;
  }) => <>{children({ innerRef: () => {}, draggableProps: { style: {} }, dragHandleProps: {} }, { isDragging: false })}</>,
}));

describe('SchedulePage volunteer availability', () => {
  test('shows a 10-person volunteer bar for every event and lets an open event be claimed', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <SchedulePage />
      </MemoryRouter>,
    );

    expect(screen.getAllByText('Volunteer team')).toHaveLength(MOCK_SESSIONS.length);

    const openingTitle = screen.getByRole('heading', {
      name: 'Opening Keynote: Innovate, Imagine, Impact',
    });
    const openingCard = openingTitle.closest('.glass');
    expect(openingCard).not.toBeNull();

    const card = within(openingCard as HTMLElement);
    expect(card.getByText('8/10')).toBeInTheDocument();

    await user.click(
      card.getByRole('button', {
        name: 'Volunteer for Opening Keynote: Innovate, Imagine, Impact',
      }),
    );

    expect(card.getByText("You're volunteering")).toBeInTheDocument();
    expect(card.getByText('9/10')).toBeInTheDocument();
    expect(
      card.getByRole('button', {
        name: 'Stop volunteering for Opening Keynote: Innovate, Imagine, Impact',
      }),
    ).toBeInTheDocument();
  });

  test('marks a fully assigned volunteer team as unavailable', () => {
    render(
      <MemoryRouter>
        <SchedulePage />
      </MemoryRouter>,
    );

    const workshopTitle = screen.getByRole('heading', {
      name: 'Visual Storytelling & Brand Design',
    });
    const workshopCard = workshopTitle.closest('.glass');
    expect(workshopCard).not.toBeNull();

    const card = within(workshopCard as HTMLElement);
    expect(card.getByText('Volunteer team full')).toBeInTheDocument();
    expect(
      card.getByRole('button', {
        name: 'Volunteer for Visual Storytelling & Brand Design',
      }),
    ).toBeDisabled();
  });
});
