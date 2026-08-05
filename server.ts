import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { requireAuth, AuthRequest } from './src/middleware/auth.ts';
import { getOrCreateUser } from './src/db/users.ts';
import {
  getAllEmployees,
  createEmployee,
  createEmployeesBatch,
  updateEmployee,
  deleteEmployee,
  getAllLeaveRecords,
  createLeaveRecord,
  deleteLeaveRecord,
  getAllAuditLogs,
  createAuditLog,
  resetDemoDataInDb,
  clearAllDataInDb,
} from './src/db/queries.ts';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', database: 'Cloud SQL (PostgreSQL)' });
  });

  // User Auth Sync route
  app.post('/api/auth/sync', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const dbUser = await getOrCreateUser(req.user.uid, req.user.email || '', req.user.name);
      res.json(dbUser);
    } catch (error: any) {
      console.error('Error syncing auth user:', error);
      res.status(500).json({ error: error.message || 'Failed to sync user' });
    }
  });

  // Employees API
  app.get('/api/employees', async (req, res) => {
    try {
      const data = await getAllEmployees();
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch employees' });
    }
  });

  app.post('/api/employees', async (req, res) => {
    try {
      const newEmp = await createEmployee(req.body);
      res.status(201).json(newEmp);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to create employee' });
    }
  });

  app.post('/api/employees/batch', async (req, res) => {
    try {
      const employeesList = req.body;
      if (!Array.isArray(employeesList)) {
        return res.status(400).json({ error: 'Expected an array of employees' });
      }
      const saved = await createEmployeesBatch(employeesList);
      res.status(201).json(saved);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to batch import employees' });
    }
  });

  app.patch('/api/employees/:id', async (req, res) => {
    try {
      const updated = await updateEmployee(req.params.id, req.body);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to update employee' });
    }
  });

  app.delete('/api/employees/:id', async (req, res) => {
    try {
      await deleteEmployee(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to delete employee' });
    }
  });

  // Leave Records API
  app.get('/api/leave-records', async (req, res) => {
    try {
      const data = await getAllLeaveRecords();
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch leave records' });
    }
  });

  app.post('/api/leave-records', async (req, res) => {
    try {
      const newLeave = await createLeaveRecord(req.body);
      res.status(201).json(newLeave);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to create leave record' });
    }
  });

  app.delete('/api/leave-records/:id', async (req, res) => {
    try {
      await deleteLeaveRecord(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to delete leave record' });
    }
  });

  // Audit Logs API
  app.get('/api/audit-logs', async (req, res) => {
    try {
      const data = await getAllAuditLogs();
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch audit logs' });
    }
  });

  app.post('/api/audit-logs', async (req, res) => {
    try {
      const newLog = await createAuditLog(req.body);
      res.status(201).json(newLog);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to create audit log' });
    }
  });

  // Reset/Clear Data
  app.post('/api/reset-demo', async (req, res) => {
    try {
      await resetDemoDataInDb();
      res.json({ status: 'ok' });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to reset demo data' });
    }
  });

  app.post('/api/clear-data', async (req, res) => {
    try {
      await clearAllDataInDb();
      res.json({ status: 'ok' });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to clear data' });
    }
  });

  // Vite Dev Server / Static Serve
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
