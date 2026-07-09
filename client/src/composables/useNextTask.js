import { api } from '../api';

// GET /tasks?status=todo is already ordered by quadrant then due_date (server-side),
// so the first result is the app's best suggestion — 🔴 before 🟠 before 🟡 before ⚪.
export async function getNextTask(excludeId) {
  const todos = await api.get('/tasks?status=todo');
  return todos.find((t) => t.id !== excludeId) || null;
}
