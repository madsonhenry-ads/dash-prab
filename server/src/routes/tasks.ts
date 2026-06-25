import { Router, Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { postgresService } from '../services/PostgresService';

const router = Router();

// GET /api/tasks — list all tasks
router.get('/', async (_req: Request, res: Response) => {
  try {
    if (!postgresService.isConnected()) {
      res.json({ success: true, data: [] });
      return;
    }

    const rows = await postgresService.query<any>(
      `SELECT id, title, description, status, priority, assignee,
              due_date AS "dueDate", created_at AS "createdAt", updated_at AS "updatedAt"
       FROM tasks
       ORDER BY created_at DESC`
    );

    const tasks = rows.map((t: any) => ({
      id: t.id,
      title: t.title,
      description: t.description || '',
      status: t.status,
      priority: t.priority,
      assignee: t.assignee || '',
      dueDate: t.dueDate ? (t.dueDate instanceof Date ? t.dueDate.toISOString().split('T')[0] : String(t.dueDate).split('T')[0]) : '',
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    }));

    res.json({ success: true, data: tasks });
  } catch (err: any) {
    console.error('[Tasks] Error fetching tasks:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch tasks' });
  }
});

// POST /api/tasks — create a new task
router.post('/', async (req: Request, res: Response) => {
  try {
    const { title, description, status, priority, assignee, dueDate } = req.body;
    if (!title) {
      res.status(400).json({ success: false, error: 'Title is required' });
      return;
    }

    if (!postgresService.isConnected()) {
      res.status(503).json({ success: false, error: 'PostgreSQL não conectado' });
      return;
    }

    const id = uuid();
    const rows = await postgresService.query<any>(
      `INSERT INTO tasks (id, title, description, status, priority, assignee, due_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, title, description, status, priority, assignee,
                 due_date AS "dueDate", created_at AS "createdAt", updated_at AS "updatedAt"`,
      [id, title, description || '', status || 'todo', priority || 'medium', assignee || '', dueDate || null]
    );

    const t = rows[0];
    res.json({
      success: true,
      data: {
        id: t.id,
        title: t.title,
        description: t.description || '',
        status: t.status,
        priority: t.priority,
        assignee: t.assignee || '',
        dueDate: t.dueDate ? (t.dueDate instanceof Date ? t.dueDate.toISOString().split('T')[0] : String(t.dueDate).split('T')[0]) : '',
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      },
    });
  } catch (err: any) {
    console.error('[Tasks] Error creating task:', err);
    res.status(500).json({ success: false, error: 'Failed to create task' });
  }
});

// PUT /api/tasks/:id — update a task
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, description, status, priority, assignee, dueDate } = req.body;

    if (!postgresService.isConnected()) {
      res.status(503).json({ success: false, error: 'PostgreSQL não conectado' });
      return;
    }

    const rows = await postgresService.query<any>(
      `UPDATE tasks
       SET title = COALESCE($1, title),
           description = COALESCE($2, description),
           status = COALESCE($3, status),
           priority = COALESCE($4, priority),
           assignee = COALESCE($5, assignee),
           due_date = COALESCE($6, due_date),
           updated_at = NOW()
       WHERE id = $7
       RETURNING id, title, description, status, priority, assignee,
                 due_date AS "dueDate", created_at AS "createdAt", updated_at AS "updatedAt"`,
      [title, description, status, priority, assignee, dueDate || null, id]
    );

    if (rows.length === 0) {
      res.status(404).json({ success: false, error: 'Task not found' });
      return;
    }

    const t = rows[0];
    res.json({
      success: true,
      data: {
        id: t.id,
        title: t.title,
        description: t.description || '',
        status: t.status,
        priority: t.priority,
        assignee: t.assignee || '',
        dueDate: t.dueDate ? (t.dueDate instanceof Date ? t.dueDate.toISOString().split('T')[0] : String(t.dueDate).split('T')[0]) : '',
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      },
    });
  } catch (err: any) {
    console.error('[Tasks] Error updating task:', err);
    res.status(500).json({ success: false, error: 'Failed to update task' });
  }
});

// DELETE /api/tasks/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!postgresService.isConnected()) {
      res.status(503).json({ success: false, error: 'PostgreSQL não conectado' });
      return;
    }

    const rows = await postgresService.query<any>('DELETE FROM tasks WHERE id = $1 RETURNING id', [id]);
    if (rows.length === 0) {
      res.status(404).json({ success: false, error: 'Task not found' });
      return;
    }
    res.json({ success: true });
  } catch (err: any) {
    console.error('[Tasks] Error deleting task:', err);
    res.status(500).json({ success: false, error: 'Failed to delete task' });
  }
});

export default router;