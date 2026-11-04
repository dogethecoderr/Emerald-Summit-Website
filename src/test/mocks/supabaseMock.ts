import { vi } from 'vitest';

export interface MockUserRecord {
  id: string;
  name?: string;
  role?: string;
  email?: string;
  phone?: string;
  discipline?: string | null;
  bio?: string;
  profile_setup_complete?: boolean;
  checked_in_at?: string | null;
  created_at?: string;
  updated_at?: string;
  [key: string]: any;
}

/** Shared front-desk RPC contract, including the server's atomic scan result. */
export function createCheckInRpcHandler(users: MockUserRecord[], directoryUsers = users) {
  return async (name: string, args: Record<string, unknown> = {}) => {
    if (name === 'fetch_attendee_directory') {
      return {
        data: directoryUsers.map((user) => ({
          id: user.id, full_name: user.name, email: user.email,
          role: user.role, present: Boolean(user.checked_in_at),
          checked_in_at: user.checked_in_at ?? null,
        })),
        error: null,
      };
    }
    const user = users.find((item) => item.id === args.p_attendee_id);
    if (name === 'scan_summit_checkin') {
      if (!user) return { data: [{ attendee_found: false, already_checked_in: false }], error: null };
      const alreadyCheckedIn = Boolean(user.checked_in_at);
      if (!alreadyCheckedIn) user.checked_in_at = new Date().toISOString();
      return {
        data: [{
          attendee_found: true, already_checked_in: alreadyCheckedIn,
          full_name: user.name, email: user.email, role: user.role,
          checked_in_at: user.checked_in_at,
        }],
        error: null,
      };
    }
    if (name === 'mark_summit_checkin') {
      if (!user) return { data: null, error: { message: 'Participant not found' } };
      user.checked_in_at = args.p_present ? new Date().toISOString() : null;
      return { data: null, error: null };
    }
    throw new Error(`Unexpected check-in RPC: ${name}`);
  };
}

export function createMockSupabase(initialUsers: MockUserRecord[] = []) {
  const users = initialUsers.map((u) => ({ ...u }));

  const client = {
    from: vi.fn((table: string) => {
      let filterColumn: string | null = null;
      let filterValue: any = null;
      let updatePayload: Partial<MockUserRecord> | null = null;

      const builder: any = {
        select: vi.fn((_columns?: string) => builder),
        update: vi.fn((payload: Partial<MockUserRecord>) => {
          updatePayload = payload;
          return builder;
        }),
        eq: vi.fn((column: string, value: any) => {
          filterColumn = column;
          filterValue = value;
          return builder;
        }),
        single: vi.fn(async () => {
          if (table !== 'users') {
            return { data: null, error: { message: `Table ${table} not found` } };
          }
          const user = users.find((u) => filterColumn ? u[filterColumn] === filterValue : false);
          if (!user) {
            return { data: null, error: { message: 'User not found', code: 'PGRST116' } };
          }
          if (updatePayload) {
            Object.assign(user, updatePayload);
            return { data: { ...user }, error: null };
          }
          return { data: { ...user }, error: null };
        }),
        maybeSingle: vi.fn(async () => {
          if (table !== 'users') {
            return { data: null, error: null };
          }
          const user = users.find((u) => filterColumn ? u[filterColumn] === filterValue : false);
          if (!user) {
            return { data: null, error: null };
          }
          if (updatePayload) {
            Object.assign(user, updatePayload);
            return { data: { ...user }, error: null };
          }
          return { data: { ...user }, error: null };
        }),
      };
      return builder;
    }),
  };

  return { client, users };
}
