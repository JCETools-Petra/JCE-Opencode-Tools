# Skill: React
# Loaded on-demand when working with React, JSX, TSX components

## Hooks Patterns

### State & Effects
```tsx
// useState: prefer functional updates for state derived from previous
const [count, setCount] = useState(0);
setCount(prev => prev + 1); // NOT setCount(count + 1) in async contexts

// useEffect: cleanup is mandatory for subscriptions/timers
useEffect(() => {
  const controller = new AbortController();
  fetch(url, { signal: controller.signal }).then(setData);
  return () => controller.abort();
}, [url]);

// useRef: mutable container that doesn't trigger re-renders
const renderCount = useRef(0);
renderCount.current++; // silent mutation, no re-render
```

### Memoization (use sparingly — profile first)
```tsx
// useCallback: stabilize function identity for child props
const handleClick = useCallback((id: string) => {
  setItems(prev => prev.filter(item => item.id !== id));
}, []); // no deps needed when using functional updater

// useMemo: expensive computations only
const sorted = useMemo(() => items.toSorted((a, b) => a.name.localeCompare(b.name)), [items]);
```

### Custom Hooks
```tsx
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
```

## React 19 Features

```tsx
// use() — read promises and context in render
function UserProfile({ userPromise }: { userPromise: Promise<User> }) {
  const user = use(userPromise); // suspends until resolved
  return <h1>{user.name}</h1>;
}

// Actions — async transitions with automatic pending state
function UpdateForm() {
  const [optimisticName, setOptimisticName] = useOptimistic(name);
  async function updateAction(formData: FormData) {
    setOptimisticName(formData.get('name') as string);
    await updateNameOnServer(formData);
  }
  return (
    <form action={updateAction}>
      <input name="name" />
      <p>Current: {optimisticName}</p>
    </form>
  );
}

// useFormStatus — access parent form state from child
function SubmitButton() {
  const { pending } = useFormStatus();
  return <button disabled={pending}>{pending ? 'Saving...' : 'Save'}</button>;
}
```

## Component Composition

```tsx
// Compound components over prop drilling
function Tabs({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(0);
  return <TabsContext.Provider value={{ active, setActive }}>{children}</TabsContext.Provider>;
}
Tabs.List = TabList;
Tabs.Panel = TabPanel;

// Render props for flexible rendering
<DataTable data={users} renderRow={(user) => <UserRow key={user.id} user={user} />} />

// Suspense + ErrorBoundary composition
<ErrorBoundary fallback={<ErrorUI />}>
  <Suspense fallback={<Skeleton />}>
    <AsyncComponent />
  </Suspense>
</ErrorBoundary>
```

## Server Components (RSC)

```tsx
// Server Component (default in App Router) — no 'use client'
async function ProductList() {
  const products = await db.products.findMany(); // direct DB access
  return <ul>{products.map(p => <ProductCard key={p.id} product={p} />)}</ul>;
}

// Client Component — interactive, has state/effects
'use client';
function AddToCart({ productId }: { productId: string }) {
  const [qty, setQty] = useState(1);
  return <button onClick={() => addToCart(productId, qty)}>Add {qty}</button>;
}
```

## Performance

```tsx
// React.memo — skip re-render when props unchanged
const ExpensiveList = memo(function ExpensiveList({ items }: { items: Item[] }) {
  return items.map(item => <ExpensiveRow key={item.id} item={item} />);
});

// lazy + Suspense for code splitting
const HeavyChart = lazy(() => import('./HeavyChart'));
<Suspense fallback={<ChartSkeleton />}><HeavyChart data={data} /></Suspense>

// startTransition — mark non-urgent updates
function Search() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value); // urgent: update input
    startTransition(() => setResults(search(e.target.value))); // non-urgent
  };
}
```

## State Management

```tsx
// useReducer for complex state logic
const [state, dispatch] = useReducer(reducer, { items: [], loading: false });

// Zustand — minimal, no providers
const useStore = create<Store>((set) => ({
  bears: 0,
  increase: () => set((s) => ({ bears: s.bears + 1 })),
}));

// Jotai — atomic, bottom-up
const countAtom = atom(0);
const doubleAtom = atom((get) => get(countAtom) * 2);
```

## Forms

```tsx
// React Hook Form — performant, minimal re-renders
const { register, handleSubmit, formState: { errors } } = useForm<FormData>();
<form onSubmit={handleSubmit(onSubmit)}>
  <input {...register('email', { required: true, pattern: /^\S+@\S+$/ })} />
  {errors.email && <span>Valid email required</span>}
</form>
```

## Testing

```tsx
// React Testing Library — test behavior, not implementation
import { render, screen, userEvent } from '@testing-library/react';

test('submits form with user data', async () => {
  const onSubmit = vi.fn();
  render(<UserForm onSubmit={onSubmit} />);
  await userEvent.type(screen.getByLabelText(/name/i), 'Alice');
  await userEvent.click(screen.getByRole('button', { name: /submit/i }));
  expect(onSubmit).toHaveBeenCalledWith({ name: 'Alice' });
});
// NEVER: enzyme, shallow rendering, snapshot-only tests, testing implementation details
```

## Anti-Patterns to Avoid

```tsx
// BAD: useEffect for derived state
useEffect(() => { setFullName(first + ' ' + last); }, [first, last]);
// GOOD: compute during render
const fullName = `${first} ${last}`;

// BAD: object/array literals in JSX props (new ref every render)
<Child style={{ color: 'red' }} />
// GOOD: hoist or memoize
const style = useMemo(() => ({ color: 'red' }), []);

// BAD: index as key for dynamic lists
items.map((item, i) => <Item key={i} />)
// GOOD: stable unique id
items.map(item => <Item key={item.id} />)

// BAD: prop drilling through 5+ levels — use context or composition
// BAD: giant useEffect doing multiple unrelated things — split into separate effects
// BAD: fetching in useEffect without cleanup — use a data fetching library (TanStack Query, SWR)
```
