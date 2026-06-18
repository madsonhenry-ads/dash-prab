import { Router, Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { postgresService } from '../services/PostgresService';

const router = Router();

// GET /api/tools — list expenses with optional period filter and summary
router.get('/', async (_req: Request, res: Response) => {
  try {
    const period = (_req.query.period as string) || 'all';

    if (!postgresService.isConnected()) {
      res.json({ success: true, data: { total: 0, daily: 0, weekly: 0, monthly: 0, entries: [] } });
      return;
    }

    let dateFilter = '';
    switch (period) {
      case 'daily':
        dateFilter = "AND date = CURRENT_DATE";
        break;
      case 'weekly':
        dateFilter = "AND date >= CURRENT_DATE - INTERVAL '7 days'";
        break;
      case 'monthly':
        dateFilter = "AND date >= DATE_TRUNC('month', CURRENT_DATE)";
        break;
      default:
        dateFilter = '';
    }

    const rows = await postgresService.query<any>(
      `SELECT id, name, value, date, type, recurring_day AS "recurringDay", notes, created_at AS "createdAt", updated_at AS "updatedAt"
       FROM tools_expenses
       WHERE 1=1 ${dateFilter}
       ORDER BY date DESC, created_at DESC`
    );

    const allEntries = rows.map((e: any) => ({
      id: e.id,
      name: e.name,
      value: parseFloat(e.value),
      date: e.date instanceof Date ? e.date.toISOString().split('T')[0] : String(e.date).split('T')[0],
      type: e.type,
      recurringDay: e.recurringDay ?? undefined,
      notes: e.notes ?? undefined,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    }));

    // Compute projected totals considering recurring expenses
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const todayStr = now.toISOString().split('T')[0];
    const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString().split('T')[0];
    const monthStart = new Date(currentYear, currentMonth, 1).toISOString().split('T')[0];

    let total = 0;
    let dailyTotal = 0;
    let weeklyTotal = 0;
    let monthlyTotal = 0;

    for (const entry of allEntries) {
      if (entry.type === 'recurring') {
        const monthlyProjection = entry.value;
        total += monthlyProjection;
        monthlyTotal += monthlyProjection;

        if (entry.recurringDay) {
          const lastDay = new Date(currentYear, currentMonth + 1, 0).getDate();
          const projectedDate = new Date(currentYear, currentMonth, Math.min(entry.recurringDay, lastDay));
          const projectedStr = projectedDate.toISOString().split('T')[0];
          if (projectedStr === todayStr) dailyTotal += entry.value;
          if (projectedStr >= weekAgo && projectedStr <= todayStr) weeklyTotal += entry.value;
        }
      } else {
        total += entry.value;
        if (entry.date === todayStr) dailyTotal += entry.value;
        if (entry.date >= weekAgo && entry.date <= todayStr) weeklyTotal += entry.value;
        if (entry.date >= monthStart && entry.date <= todayStr) monthlyTotal += entry.value;
      }
    }

    res.json({
      success: true,
      data: {
        total: Math.round(total * 100) / 100,
        daily: Math.round(dailyTotal * 100) / 100,
        weekly: Math.round(weeklyTotal * 100) / 100,
        monthly: Math.round(monthlyTotal * 100) / 100,
        entries: allEntries,
      },
    });
  } catch (err: any) {
    console.error('[Tools] Error fetching expenses:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch expenses' });
  }
});

// POST /api/tools — create a new expense
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, value, date, type, recurringDay, notes } = req.body;
    if (!name || value == null || !date || !type) {
      res.status(400).json({ success: false, error: 'Missing required fields: name, value, date, type' });
      return;
    }
    if (!['occasional', 'recurring'].includes(type)) {
      res.status(400).json({ success: false, error: 'Type must be "occasional" or "recurring"' });
      return;
    }

    if (!postgresService.isConnected()) {
      res.status(503).json({ success: false, error: 'PostgreSQL não conectado' });
      return;
    }

    const id = uuid();
    const rows = await postgresService.query<any>(
      `INSERT INTO tools_expenses (id, name, value, date, type, recurring_day, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, name, value, date, type, recurring_day AS "recurringDay", notes, created_at AS "createdAt", updated_at AS "updatedAt"`,
      [id, name, value, date, type, type === 'recurring' ? recurringDay : null, notes || null]
    );

    const entry = rows[0];
    res.json({
      success: true,
      data: {
        id: entry.id,
        name: entry.name,
        value: parseFloat(entry.value),
        date: entry.date instanceof Date ? entry.date.toISOString().split('T')[0] : String(entry.date).split('T')[0],
        type: entry.type,
        recurringDay: entry.recurringDay ?? undefined,
        notes: entry.notes ?? undefined,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
      },
    });
  } catch (err: any) {
    console.error('[Tools] Error creating expense:', err);
    res.status(500).json({ success: false, error: 'Failed to create expense' });
  }
});

// DELETE /api/tools/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!postgresService.isConnected()) {
      res.status(503).json({ success: false, error: 'PostgreSQL não conectado' });
      return;
    }

    const rows = await postgresService.query<any>('DELETE FROM tools_expenses WHERE id = $1 RETURNING id', [id]);
    if (rows.length === 0) {
      res.status(404).json({ success: false, error: 'Expense not found' });
      return;
    }
    res.json({ success: true });
  } catch (err: any) {
    console.error('[Tools] Error deleting expense:', err);
    res.status(500).json({ success: false, error: 'Failed to delete expense' });
  }
});

export default router;