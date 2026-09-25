// The shared question route (question-route.ts), bound to the browser: the
// catalogue and the configured categories from their queries, and the status
// and policy lookups for the person asking. The Home box and the assistant
// both route through this, so a question gets the same answer in either.
import { useAuthStore } from '@/stores/auth-store';
import { useCatalogueItems } from '@/lib/db/hooks/use-catalogue-items';
import { useProcurementCategories } from '@/lib/db/hooks/use-procurement-categories';
import { DEFAULT_CATEGORY_TAXONOMY } from '@/data/category-taxonomy';
import { answerStatusQuestion } from './status-lookup';
import { answerPolicyQuestion } from './policy-lookup';
import { routeQuestion, type QuestionRoute, type QuestionRouteOptions } from './question-route';

export function useQuestionRoute(): (query: string, options?: QuestionRouteOptions) => Promise<QuestionRoute> {
  const currentUser = useAuthStore((s) => s.currentUser);
  const currentRole = useAuthStore((s) => s.currentRole);
  const { data: catalogueItems = [] } = useCatalogueItems();
  const { data: stored = [] } = useProcurementCategories();
  // The configured categories, else the seed — the same fallback intake uses,
  // so an empty store classifies as it always did.
  const categories = stored.length > 0 ? stored : DEFAULT_CATEGORY_TAXONOMY;
  const catalogueEligibleCategories = categories.filter((c) => c.catalogueEligible).map((c) => c.id);

  return (query, options) => routeQuestion(
    query,
    { catalogueItems, catalogueEligibleCategories, categories },
    {
      status: (q, question) => answerStatusQuestion(q, { userId: currentUser.id, role: currentRole }, question),
      policy: answerPolicyQuestion,
    },
    options,
  );
}
