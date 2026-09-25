// The catalogue basket — what a requester has added on the Catalogue page and
// not yet ordered. Per person, because the role switcher changes who is asking
// and one person's basket must not follow them into another's session; kept in
// the browser, because an unplaced basket is a convenience, not a record. The
// order it becomes is written by the governed checkout (ADR-0009).
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { BasketLine } from '@/lib/procurement/catalogue-basket';

interface CatalogueBasketState {
  baskets: Record<string, BasketLine[]>;
  add: (userId: string, itemId: string, quantity?: number) => void;
  setQuantity: (userId: string, itemId: string, quantity: number) => void;
  remove: (userId: string, itemId: string) => void;
  clear: (userId: string) => void;
}

export const useCatalogueBasketStore = create<CatalogueBasketState>()(
  persist(
    (set) => ({
      baskets: {},
      add: (userId, itemId, quantity = 1) => set((state) => {
        const lines = state.baskets[userId] ?? [];
        const existing = lines.find((line) => line.itemId === itemId);
        const next = existing
          ? lines.map((line) => (line.itemId === itemId ? { ...line, quantity: line.quantity + quantity } : line))
          : [...lines, { itemId, quantity }];
        return { baskets: { ...state.baskets, [userId]: next } };
      }),
      setQuantity: (userId, itemId, quantity) => set((state) => {
        const lines = state.baskets[userId] ?? [];
        // Zero removes the line rather than keeping an order for nothing.
        const next = quantity > 0
          ? lines.map((line) => (line.itemId === itemId ? { ...line, quantity } : line))
          : lines.filter((line) => line.itemId !== itemId);
        return { baskets: { ...state.baskets, [userId]: next } };
      }),
      remove: (userId, itemId) => set((state) => ({
        baskets: { ...state.baskets, [userId]: (state.baskets[userId] ?? []).filter((line) => line.itemId !== itemId) },
      })),
      clear: (userId) => set((state) => ({ baskets: { ...state.baskets, [userId]: [] } })),
    }),
    { name: 'catalogue-basket' },
  ),
);

const NONE: BasketLine[] = [];

/** One person's basket. */
export function useBasket(userId: string): BasketLine[] {
  return useCatalogueBasketStore((state) => state.baskets[userId] ?? NONE);
}
