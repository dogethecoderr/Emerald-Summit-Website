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
