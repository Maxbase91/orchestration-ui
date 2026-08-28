# Lessons

- React Query data used in a `useMemo` dependency must fall back to a module-level stable empty array. An inline `= []` changes identity on every render and can trigger a parent-update loop when the memo feeds `onUpdate`.
- A test script must declare its runner as a direct development dependency; never rely on a transitive executable surviving unrelated dependency cleanup.
- Varying a request payload does not invalidate a process-local serverless configuration cache. Integration tests that toggle cached admin state must poll through the documented TTL in both directions and include the final response status/body in a failure report.
- Dynamic intake conversations must be tested by matching the visible question to an answer, not by sending a positional answer array; question branching can otherwise put a value or critical-service answer into the wrong slot.
- UI walkthrough harnesses must treat valid funnel skips as success and propagate scenario failures through the process exit code; otherwise stale assumptions can hide broken coverage behind a green run.
