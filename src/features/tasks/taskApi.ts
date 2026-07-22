// Compatibility exports for encrypted Phase 14 device snapshots and queues.
// New code should import the shared KCP Flow Action contract directly.
export type {
  ActionActivity as TaskHistoryEvent,
  ActionPriority as TaskPriority,
  ActionProgress as TaskProgress,
  ActionStatus as TaskBucket,
  ActionsResponse as TasksResponse,
  KcpAction as OperationalTask
} from '../flow/actionModel';
export {
  completeAction as completeTask,
  loadAction as loadTask,
  loadActions as loadTasks,
  saveActionProgress as saveTaskProgress
} from '../flow/actionApi';
