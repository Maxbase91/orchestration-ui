// Who may act on each step of an approval chain.
//
// Every functional role used to collapse to one of six switchable personas, so
// a step naming "Category Manager" resolved to the same person whatever was
// being bought — and the review screen could name a real approver that nobody
// was able to act as. Derivation now follows the records: the category's
// managers, the contract's owner, the cost centre's owner.
//
// Pure and client-free so both the browser engine and the serverless handlers
// can use it; the caller supplies the reference data it has already read.
// Relative imports only — this module is reachable from api/.
import type { Role } from '../../config/roles.js';
import { isMyApproval } from './personal-queue.js';

/** Chain/functional role → the system role whose holders may act. */
export const CHAIN_ROLE_TO_SYSTEM_ROLE: Record<string, Role> = {
  'Budget Owner': 'service-owner',
  'Business Requestor': 'service-owner',
  'Category Manager': 'procurement-manager',
  'Procurement Manager': 'procurement-manager',
  'Procurement Lead': 'procurement-manager',
  Finance: 'procurement-manager',
  'Finance Approver': 'procurement-manager',
  'VP Procurement': 'admin',
  CFO: 'admin',
  Board: 'admin',
  Approver: 'procurement-manager',
  'New Approver': 'procurement-manager',
  'Supplier Manager': 'vendor-manager',
  'Operations Lead': 'operations-lead',
  // Owns the risk stage. Third-party risk sits with vendor management here.
  'Third-party risk': 'vendor-manager',
  Legal: 'procurement-manager',
  'Accounts Payable': 'operations-lead',
  'Procurement Ops': 'operations-lead',
};

export interface DirectoryUser {
  id: string;
  name: string;
  isOoo?: boolean;
  delegateId?: string | null;
}

/** One step of a stored approval chain. `approverId` names a person outright. */
export interface ChainStep {
  id: string;
  role: string;
  approverId?: string | null;
}

/** The reference data derivation reads, loaded by the caller. */
export interface ApprovalSources {
  /** Users responsible for this request's category, from `category_managers`. */
  categoryManagerIds: string[];
  /** `contracts.owner_id` for a call-off. */
  contractOwnerId?: string | null;
  /** `cost_centres.owner` — a name, not an id, and empty on every seeded row. */
  costCentreOwnerName?: string | null;
  usersById: Map<string, DirectoryUser>;
}

export interface DerivedApproval {
  stepOrder: number;
  role: string;
  /** 'role' means any holder may act; 'person' means this entry names one. */
  assignmentMode: 'person' | 'role';
  approverId: string | null;
  approverName: string;
  /** Set when the named approver is out of office and has a delegate. */
  delegatedTo: string | null;
}

function findByName(users: Map<string, DirectoryUser>, name: string): DirectoryUser | undefined {
  const wanted = name.trim().toLowerCase();
  if (!wanted) return undefined;
  for (const user of users.values()) if (user.name.trim().toLowerCase() === wanted) return user;
  return undefined;
}

/**
 * Resolve one person to an entry, following out-of-office delegation.
 *
 * The delegate is recorded rather than substituted: the entry still shows who
 * was asked, and `delegated_to` says who may act in their place. Replacing the
 * approver outright would erase the fact that the original person was the one
 * accountable.
 */
function person(user: DirectoryUser, step: ChainStep, order: number): DerivedApproval {
  const delegate = user.isOoo && user.delegateId ? user.delegateId : null;
  return {
    stepOrder: order,
    role: step.role,
    assignmentMode: 'person',
    approverId: user.id,
    approverName: user.name,
    delegatedTo: delegate,
  };
}

/** An entry any holder of the role may act on. */
function byRole(step: ChainStep, order: number, label?: string): DerivedApproval {
  return {
    stepOrder: order,
    role: step.role,
    assignmentMode: 'role',
    approverId: null,
    approverName: label ?? `Any ${step.role}`,
    delegatedTo: null,
  };
}

/**
 * A call-off is spend against somebody's contract, so its owner approves it.
 *
 * The stored chains are banded by value and know nothing about the route, so
 * this step is prepended where the route calls for it rather than duplicating
 * every chain. It comes first: there is no point asking finance to approve a
 * draw-down the contract owner has not accepted.
 */
export function withContractOwnerStep(steps: ChainStep[], route: string | null | undefined): ChainStep[] {
  if (route !== 'contract-call-off') return steps;
  if (steps.some((step) => step.role === 'Contract Owner')) return steps;
  return [{ id: 'contract-owner', role: 'Contract Owner' }, ...steps];
}

/**
 * A supplier chosen outside the category's preferred list is the category
 * manager's to agree to (when Decisioning thresholds say so).
 *
 * Added the way the contract owner is: the value-banded chains know nothing of
 * the supplier choice. A chain that already asks the category manager is left
 * alone — one approval from them covers both questions, and the reason is on
 * the request beside the supplier for them to read.
 */
export function withSupplierOverrideStep(steps: ChainStep[], supplierOverride: boolean | null | undefined): ChainStep[] {
  if (!supplierOverride) return steps;
  if (steps.some((step) => step.role === 'Category Manager')) return steps;
  return [{ id: 'supplier-override', role: 'Category Manager' }, ...steps];
}

/**
 * Turn a chain's steps into the approval entries a request needs.
 *
 * A step resolves to a person when the records name one — an admin-configured
 * approver, the single manager of the category, the contract's owner. Where
 * several people hold the responsibility, or where the record that would name
 * one is empty, the step stays open to the role and the first holder to respond
 * decides. Falling back to the role is deliberate: inventing a named approver
 * from an empty `cost_centres.owner` would put a person's name against a
 * decision nobody assigned them.
 */
export function deriveApprovals(
  steps: ChainStep[],
  sources: ApprovalSources,
): DerivedApproval[] {
  return steps.map((step, index) => {
    const order = index + 1;

    // 1. The chain names someone outright.
    if (step.approverId) {
      const named = sources.usersById.get(step.approverId);
      if (named) return person(named, step, order);
    }

    // 2. The category's managers own demand in that category.
    if (step.role === 'Category Manager') {
      const managers = sources.categoryManagerIds
        .map((id) => sources.usersById.get(id))
        .filter((user): user is DirectoryUser => Boolean(user));
      if (managers.length === 1) return person(managers[0], step, order);
      if (managers.length > 1) {
        return byRole(step, order, `Category Manager — ${managers.map((m) => m.name).join(' or ')}`);
      }
    }

    // 3. A call-off is the contract owner's to approve.
    if (step.role === 'Contract Owner' && sources.contractOwnerId) {
      const owner = sources.usersById.get(sources.contractOwnerId);
      if (owner) return person(owner, step, order);
    }

    // 4. The budget sits with whoever owns the cost centre — a name on the
    //    reference row, which is empty on every seeded centre today, so this
    //    usually falls through to the role rather than naming nobody.
    if (step.role === 'Budget Owner' && sources.costCentreOwnerName) {
      const owner = findByName(sources.usersById, sources.costCentreOwnerName);
      if (owner) return person(owner, step, order);
    }

    return byRole(step, order);
  });
}

/**
 * May this user act on this entry?
 *
 * A person-assigned entry is theirs, or their delegate's. A role-assigned entry
 * belongs to whoever holds the role — first response decides. The header
 * Approve button used to ignore all of this and offer itself to any persona
 * whenever a request sat in the approval stage.
 */
export function canActOnApproval(
  entry: { assignmentMode?: string | null; approverId?: string | null; delegatedTo?: string | null; role?: string | null; status?: string | null },
  user: { id: string; role: Role },
): boolean {
  if (entry.status && entry.status !== 'pending') return false;
  if (entry.assignmentMode === 'role') {
    const required = entry.role ? CHAIN_ROLE_TO_SYSTEM_ROLE[entry.role] : undefined;
    return required ? user.role === required : false;
  }
  return isMyApproval(entry, user.id);
}
