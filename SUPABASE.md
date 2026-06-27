# Supabase Backend Integration Guide: TERMINUS

This guide details how to replace the in-memory array database processor in **TERMINUS** with a live, real-time relational PostgreSQL database on Supabase.

---

## 1. Create a Supabase Project

1. Go to [Supabase](https://supabase.com) and log in.
2. Click **New Project** and select/create an organization.
3. Configure your database parameters:
   - **Name**: `terminus-erp`
   - **Database Password**: *Save this securely*
   - **Region**: Select a region close to your primary operators (e.g., `Singapore` or `Mumbai` for Bangladesh).
4. Wait for the database instance to provision.

---

## 2. Initialize Database Tables (SQL Schema)

Open the **SQL Editor** in the Supabase Dashboard, click **New Query**, paste the following script, and click **Run**:

```sql
-- 1. WORKSPACES
create table workspaces (
  id text primary key, -- WS-123
  name text not null,
  niche text not null,
  currency text not null default 'Tk',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. PRODUCTS (ERP Catalog)
create table products (
  id text primary key, -- SKU-XXX
  name text not null,
  price numeric not null check (price >= 0),
  cost numeric not null check (cost >= 0),
  stock integer not null default 0 check (stock >= 0),
  category text not null,
  workspace_id text not null references workspaces(id) on delete cascade,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. CUSTOMERS (CRM directory)
create table customers (
  id text primary key, -- C-XXX
  name text not null,
  phone text not null,
  address text not null,
  district text not null check (district in ('inside', 'outside')),
  fraud_flag boolean not null default false,
  return_rate numeric not null default 0 check (return_rate between 0 and 100),
  blacklisted boolean not null default false,
  workspace_id text not null references workspaces(id) on delete cascade,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (phone, workspace_id) -- Relational constraint: unique phone per workspace tenant
);

-- 4. ORDERS (Checkout slips)
create table orders (
  id text primary key, -- TJ-XXX
  date text not null, -- ISO/formatted timestamp
  customer_id text not null references customers(id) on delete restrict,
  subtotal numeric not null check (subtotal >= 0),
  shipping numeric not null check (shipping >= 0),
  discount numeric not null default 0 check (discount >= 0),
  total numeric not null check (total >= 0),
  status text not null check (status in ('Pending', 'Confirmed', 'Dispatched', 'Delivered', 'Returned')),
  tracking text not null default '',
  courier text not null check (courier in ('Pathao', 'Steadfast', 'RedX', 'None')),
  workspace_id text not null references workspaces(id) on delete cascade,
  is_archived boolean not null default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4.1 ORDER ITEMS (Junction table to resolve item lists)
create table order_items (
  id uuid default gen_random_uuid() primary key,
  order_id text not null references orders(id) on delete cascade,
  product_id text not null references products(id) on delete restrict,
  quantity integer not null check (quantity > 0)
);

-- 5. LEADS (Abandoned cart sessions)
create table leads (
  id text primary key, -- L-XXX
  name text not null,
  phone text not null,
  items text not null,
  value numeric not null check (value >= 0),
  date text not null,
  workspace_id text not null references workspaces(id) on delete cascade,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
```

---

## 3. Install the Supabase JS Client

Install the client package in your terminal:

```bash
npm install @supabase/supabase-js
```

---

## 4. Initialize the Client

Create a file named `src/lib/supabase.ts` (or place this directly in your codebase):

```typescript
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

Add your credentials inside `.env.local` in your root folder:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 5. Migrating local React State to Supabase Queries

To complete the synchronization, swap out the local React hooks with async database queries. 

### Fetching Workspace Records on Mount
Instead of reading from `localStorage`, fetch records dynamically:

```typescript
useEffect(() => {
  async function loadInitialData() {
    // 1. Fetch workspaces
    const { data: wsData } = await supabase
      .from('workspaces')
      .select('*');
    if (wsData) setWorkspaces(wsData);

    // 2. Fetch inventory
    const { data: prodData } = await supabase
      .from('products')
      .select('*');
    if (prodData) setInventory(prodData);

    // 3. Fetch customers
    const { data: custData } = await supabase
      .from('customers')
      .select('*');
    if (custData) setCustomers(custData);

    // 4. Fetch orders (with order items)
    const { data: ordData } = await supabase
      .from('orders')
      .select('*, order_items(*)');
    if (ordData) {
      // Map back to the local Order type
      const mappedOrders = ordData.map(o => ({
        ...o,
        items: o.order_items.map((oi: any) => ({
          productId: oi.product_id,
          quantity: oi.quantity
        }))
      }));
      setOrders(mappedOrders);
    }
  }

  if (isAuthenticated) {
    loadInitialData();
  }
}, [isAuthenticated]);
```

### Syncing Creations (e.g. Workspace)
When registering a workspace, push the record to the backend:

```typescript
const handleCreateWorkspace = async (e: React.FormEvent) => {
  e.preventDefault();
  const wsId = "WS-" + Math.floor(100 + Math.random() * 900);
  const newWs = { id: wsId, name: newWsName, niche: newWsNiche, currency: newWsCurrency };

  const { error } = await supabase
    .from('workspaces')
    .insert([newWs]);

  if (!error) {
    setWorkspaces(prev => [...prev, newWs]);
    setCurrentWorkspaceId(wsId);
  }
};
```

---

## 6. Real-Time Syncing (Optional)
To enable real-time synchronization across multiple operators, subscribe to database changes inside your main hooks:

```typescript
useEffect(() => {
  const channel = supabase
    .channel('schema-db-changes')
    .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
      console.log('Change received!', payload);
      // Trigger a state reload or merge updates here
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, []);
```
