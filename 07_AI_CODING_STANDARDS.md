# lectio — ai coding standards

**Version:** 1.0  
**Applies to:** All AI-assisted code generation for the Lectio project  
**Last Updated:** 2026-03-28

---

## purpose

This document defines the rules, constraints, and quality bar for any code generated for Lectio — whether by a human engineer, an AI coding assistant (Copilot, Claude, Cursor, etc.), or an automated pipeline. All generated code must be reviewed against this document before it is committed.

---

## 1. general principles

| principle | rule |
|---|---|
| **Correctness over speed** | Never generate code that works in the happy path but ignores error states, edge cases, or type safety. A slower, correct implementation is always preferred. |
| **Clarity over cleverness** | Code is read far more than it is written. Avoid one-liners that require deciphering. Prefer readable variable names and explicit logic. |
| **Small files** | Files must not exceed ~200 lines. If a file is growing beyond this, split it. A component file should contain one component. A service file should contain one service. |
| **No business logic in controllers** | NestJS controllers are routing-only. All logic lives in services. |
| **No magic numbers** | Every hardcoded value must be a named constant or a token. No raw hex colours, no raw pixel values, no raw timeouts. |
| **Every function has a comment** | JSDoc-style comment above every exported function, hook, and method. Describe what it does, its inputs, and its return value. |

---

## 2. typescript rules

```typescript
// ✅ CORRECT — explicit types everywhere
async function getBookByUsfm(usfmCode: string): Promise<BookDto> { ... }

// ❌ WRONG — implicit any
async function getBook(code) { ... }
```

- **Strict mode** is enabled in all tsconfig files. `strict: true` is non-negotiable.
- **No `any`** — ever. If you don't know the type, use `unknown` and narrow it.
- **No non-null assertion (`!`)** without a comment explaining why it is safe.
- **Explicit return types** on all functions that return non-trivial types.
- **Interfaces over type aliases** for domain objects (easier to extend and mock).
- **Enums are banned** — use `const` objects with `as const` or union types instead.

```typescript
// ✅ CORRECT
const Testament = { OT: 'OT', NT: 'NT' } as const;
type Testament = typeof Testament[keyof typeof Testament];

// ❌ WRONG
enum Testament { OT = 'OT', NT = 'NT' }
```

---

## 3. nestjs rules

### 3.1 module structure

Every feature is a self-contained module. A module contains exactly:

```
feature/
  feature.module.ts      — registers controller, service, exports service
  feature.controller.ts  — routes ONLY, no logic
  feature.service.ts     — all business logic
  feature.types.ts       — DTOs and internal types for this module
  feature.service.spec.ts — unit tests
```

### 3.2 controller rules

```typescript
// ✅ CORRECT — controller is routing only
@Get('books/:usfmCode')
async getBook(@Param('usfmCode') usfmCode: string): Promise<BookDto> {
  return this.bibleService.getBookByUsfm(usfmCode);
}

// ❌ WRONG — business logic in controller
@Get('books/:usfmCode')
async getBook(@Param('usfmCode') usfmCode: string) {
  const { data, error } = await this.db.from('books').eq('usfm_code', usfmCode.toUpperCase()).single();
  if (error) throw new NotFoundException();
  return { id: data.id, usfmCode: data.usfm_code };
}
```

### 3.3 service rules

- All database calls live in services, never in controllers or modules.
- Services never import from other services directly unless explicitly exported from a module.
- All private mapper functions (`toBookDto`, `toVerseDto`) live at the bottom of the service file.
- Error handling uses NestJS built-in exceptions (`NotFoundException`, `BadRequestException`), not generic `Error`.

### 3.4 dto validation

Use `class-validator` decorators on all incoming DTOs. The global `ValidationPipe` handles rejection.

```typescript
export class MarkVersesReadDto {
  @IsArray()
  @IsInt({ each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  verseIds: number[];
}
```

---

## 4. next.js rules

### 4.1 server vs client components

- **Default to Server Components.** Only add `'use client'` when the component needs interactivity (onClick, useState, useEffect, browser APIs).
- **Never call the API from a Server Component directly** — use the NestJS API via `fetch` with `cache: 'no-store'` for dynamic data, or React Query in Client Components.
- **Page files are Server Components.** Data-fetching happens at the page level and is passed down as props or via React Query prefetching.

```typescript
// ✅ CORRECT — page is a server component
export default async function ReadPage() {
  const today = await fetchTodayServerSide(); // server-side fetch
  return <TodayCard initialData={today} />;   // passes to client component
}

// ✅ CORRECT — interactive component is a client component
'use client';
export function TodayCard({ initialData }) {
  const { data } = useQuery({ ... initialData });
  ...
}
```

### 4.2 component rules

- One component per file.
- Component files live in `components/` with subdirectory by concern (`ui/`, `reader/`, `modals/`, etc.).
- Props interfaces are defined at the top of the component file.
- No inline styles with raw values — all inline styles must use CSS custom properties.
- No Tailwind classes — Lectio uses CSS custom properties (token system), not utility classes.

```tsx
// ✅ CORRECT — uses tokens
<div style={{ background: 'var(--color-bg-surface)', borderRadius: 'var(--radius-xl)' }}>

// ❌ WRONG — hardcoded values
<div style={{ background: '#f4f3f0', borderRadius: '16px' }}>

// ❌ WRONG — tailwind classes
<div className="bg-stone-100 rounded-2xl">
```

### 4.3 hook rules

- One hook per file in `hooks/`.
- Hooks do not contain JSX.
- Hooks that call the API use `useQuery` or `useMutation` from React Query — never raw `fetch` or `useEffect`.
- Optimistic updates must implement `onMutate` (update cache) and `onError` (roll back cache).

```typescript
// ✅ CORRECT — optimistic update pattern
export function useVerseRead() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (verseIds: number[]) => api.markVersesRead(verseIds),
    
    onMutate: async (verseIds) => {
      // cancel in-flight queries
      await queryClient.cancelQueries({ queryKey: ['progress', 'summary'] });
      // snapshot previous value
      const previous = queryClient.getQueryData(['verse-reads']);
      // optimistically update
      queryClient.setQueryData(['verse-reads'], (old: Set<number>) => {
        const next = new Set(old);
        verseIds.forEach(id => next.add(id));
        return next;
      });
      return { previous };
    },
    
    onError: (_err, _vars, context) => {
      // roll back on failure
      queryClient.setQueryData(['verse-reads'], context?.previous);
    },
    
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['progress'] });
    },
  });
}
```

---

## 5. design token rules

These rules are absolute. There are no exceptions.

| rule | enforcement |
|---|---|
| All colours from `var(--color-*)` | Lint rule: no hex literals in `*.tsx`, `*.css` files |
| All font families from `var(--font-*)` | Lint rule: no `font-family` string literals in component files |
| All spacing from `var(--space-*)` | Preferred; px values allowed only for sub-4px micro-spacing |
| All border radii from `var(--radius-*)` | Required |
| All shadows from `var(--shadow-*)` | Required |
| `text-transform: lowercase` via `<Text>` component | Never add it manually to a component |

---

## 6. database interaction rules

- All database calls go through the Supabase client injected via `@InjectSupabase()`.
- Never construct raw SQL strings. Use the Supabase JS query builder.
- All inserts to `verse_reads` must use upsert with `{ onConflict: 'user_id,verse_id', ignoreDuplicates: true }`.
- Never expose `global_order` in API responses — it is an internal implementation detail.
- Never store derived state (completion %, streak, continue position) in the database. Always compute from `verse_reads`.

```typescript
// ✅ CORRECT — upsert, ignores duplicates
await this.db
  .from('verse_reads')
  .upsert(rows, { onConflict: 'user_id,verse_id', ignoreDuplicates: true });

// ❌ WRONG — will throw on duplicate
await this.db.from('verse_reads').insert(rows);
```

---

## 7. testing rules

See `08_TESTING_GUIDELINES.md` for full testing standards. Summary:

- Every service file has a `.spec.ts` file.
- Services are tested with a mock Supabase client — never a real database.
- All pure utility functions (verseRange.ts, jwLink.ts) have 100% branch coverage.
- React Query hooks are tested with `@testing-library/react` + `renderHook`.
- Controllers are not unit tested — they are covered by integration/e2e tests.

---

## 8. comments standard

Every exported function, hook, class method, and type must have a JSDoc comment.

```typescript
/**
 * Returns the first unread verse in a range, by verse ID order.
 *
 * @param readVerseIds - Set of verse IDs the user has read
 * @param range - The inclusive verse range to check within
 * @returns The first unread verse ID, or null if all verses are read
 */
export function firstUnreadInRange(
  readVerseIds: Set<number>,
  range: Range,
): number | null { ... }
```

Comments must describe **what and why**, not **how**. The code itself explains how.

```typescript
// ✅ CORRECT — explains why
// use upsert to safely handle the case where a user marks the same verse
// read twice (e.g. re-opening the app after a crash mid-sync)
await this.db.from('verse_reads').upsert(...);

// ❌ WRONG — restates the code
// insert into verse_reads table
await this.db.from('verse_reads').insert(...);
```

---

## 9. file naming conventions

| type | convention | example |
|---|---|---|
| React components | PascalCase | `ChapterTile.tsx` |
| Hooks | camelCase, `use` prefix | `useVerseRead.ts` |
| Utility libraries | camelCase | `verseRange.ts`, `jwLink.ts` |
| NestJS services | camelCase, `.service.ts` | `bible.service.ts` |
| NestJS controllers | camelCase, `.controller.ts` | `bible.controller.ts` |
| NestJS modules | camelCase, `.module.ts` | `bible.module.ts` |
| Type files | camelCase, `.types.ts` | `bible.types.ts` |
| Test files | same as source, `.spec.ts` | `bible.service.spec.ts` |
| Storybook stories | same as component, `.stories.tsx` | `ChapterTile.stories.tsx` |
| Migrations | `NNN_description.sql` | `001_initial_schema.sql` |

---

## 10. git commit standards

Format: `type(scope): description`

| type | when to use |
|---|---|
| `feat` | New feature |
| `fix` | Bug fix |
| `chore` | Build, dependencies, config |
| `test` | Adding or fixing tests |
| `docs` | Documentation only |
| `refactor` | Code restructure, no behaviour change |
| `style` | Formatting, token fixes, no logic change |

Examples:
```
feat(progress): add batch verse read endpoint
fix(reader): prevent text selection on long-press
test(verseRange): add subtractRanges edge case coverage
chore(deps): upgrade @supabase/supabase-js to 2.44.0
```

---

## 11. what ai assistants must never generate

| prohibited | reason |
|---|---|
| Hardcoded hex colour values in component files | Violates token system |
| `any` type without explicit comment | Breaks type safety |
| Business logic in NestJS controllers | Architecture violation |
| `verse_reads` insert without upsert | Will throw on re-mark |
| "mark day complete" that does not write verse_reads | Violates source-of-truth rule |
| Streak/completion stored in the database | Violates derived-state rule |
| Gamification language or animations | Product rule R3 |
| Pressure language ("you're behind", "you missed") | Product rule R4 |
| Tailwind classes in component files | Token-only rule |
| Raw `fetch` inside hooks (use React Query) | Architecture rule |

---

## 12. code review checklist

Before any PR is merged, verify:

- [ ] No hardcoded colours, fonts, or spacing values
- [ ] All new functions have JSDoc comments
- [ ] File is ≤ 200 lines
- [ ] NestJS controller contains no logic (routing only)
- [ ] verse_reads inserts use upsert semantics
- [ ] New components have a Storybook story
- [ ] New hooks have a unit test
- [ ] No `any` types without justification comment
- [ ] No Tailwind classes
- [ ] Product rules R1–R7 are not violated

---

## 13. version history

| version | date | notes |
|---|---|---|
| 1.0 | 2026-03-28 | Initial draft |
