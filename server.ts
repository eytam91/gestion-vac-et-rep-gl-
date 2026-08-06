import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { requireAuth, verifyAuthToken, AuthRequest } from './src/middleware/auth.ts';
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
import { db } from './src/db/index.ts';
import { users } from './src/db/schema.ts';
import { eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { createServer as createHttpServer } from 'http';
import { Server as IOServer } from 'socket.io';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-for-dev';

async function seedUsers() {
  const defaultUsers = [
    { username: 'admin', role: 'ADMIN', name: 'Administrateur', pass: 'admin123' },
    { username: 'user1', role: 'HR Manager', name: 'Utilisateur 1', pass: 'user123' },
    { username: 'user2', role: 'HR Manager', name: 'Utilisateur 2', pass: 'user123' },
    { username: 'user3', role: 'HR Manager', name: 'Utilisateur 3', pass: 'user123' },
    { username: 'user4', role: 'HR Manager', name: 'Utilisateur 4', pass: 'user123' },
  ];

  for (const u of defaultUsers) {
    const email = `${u.username}@local.app`;
    try {
      const existingDbUser = await db.select().from(users).where(eq(users.email, email)).limit(1);
      const uid = `local-${u.username}`;
      const hashed = await bcrypt.hash(u.pass, 10);

      if (existingDbUser.length === 0) {
        await db.insert(users).values({
          uid,
          email,
          name: u.name,
          role: u.role,
          password: hashed,
        });
        console.log(`Created DB user ${u.username}`);
      } else {
        const stored = existingDbUser[0].password || '';
        // If stored looks like bcrypt hash, compare; else re-hash
        const isHashed = typeof stored === 'string' && stored.startsWith('$2');
        if (isHashed) {
          const match = await bcrypt.compare(u.pass, stored);
          if (!match) {
            await db.update(users).set({ password: hashed }).where(eq(users.email, email));
            console.log(`Updated DB user password for ${u.username}`);
          }
        } else {
          // plaintext stored or empty — replace with hash
          await db.update(users).set({ password: hashed }).where(eq(users.email, email));
          console.log(`Hashed and updated DB user password for ${u.username}`);
        }
      }
    } catch (error) {
      console.error(`Failed to seed user ${u.username}`, error);
    }
  }
}

async function startServer() {
  await seedUsers();
  const app = express();
  const PORT = parseInt(process.env.PORT || '3000', 10);

  app.use(express.json());

  // create HTTP server and Socket.IO for realtime
  const httpServer = createHttpServer(app);
  const io = new IOServer(httpServer, {
    cors: { origin: process.env.REALTIME_WS_ALLOWED_ORIGINS || '*', methods: ['GET', 'POST'] },
  });

  // simple socket auth using same JWT verification
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Unauthorized'));
      const user = await verifyAuthToken(token);
      (socket as any).data = { user };
      next();
    } catch (err) {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    console.log('Realtime client connected');
    socket.on('disconnect', () => console.log('Realtime client disconnected'));
  });

  // helper to broadcast changes
  const broadcast = (payload: any) => {
    try {
      io.emit('realtime', payload);
    } catch (e) {
      console.error('Failed to broadcast realtime event:', e);
    }
  };

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', database: 'Cloud SQL (PostgreSQL)' });
  });

  // User Auth Sync route (kept for compatibility but no Firebase sync)
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

  // User Custom Login route
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      const existingUser = await db.select().from(users).where(eq(users.email, email)).limit(1);

      if (existingUser.length === 0) {
        return res.status(401).json({ error: 'Identifiants incorrects.' });
      }

      const stored = existingUser[0].password || '';
      const isHashed = typeof stored === 'string' && stored.startsWith('$2');
      let ok = false;
      if (isHashed) {
        ok = await bcrypt.compare(password, stored);
      } else {
        // legacy plaintext — compare directly and re-hash
        ok = password === stored;
        if (ok) {
          const hashed = await bcrypt.hash(password, 10);
          await db.update(users).set({ password: hashed }).where(eq(users.email, email));
        }
      }

      if (!ok) return res.status(401).json({ error: 'Identifiants incorrects.' });

      const customToken = jwt.sign({ uid: existingUser[0].uid, email: existingUser[0].email, name: existingUser[0].name, role: existingUser[0].role }, JWT_SECRET, { expiresIn: '7d' });
      res.json({ token: customToken, user: { uid: existingUser[0].uid, email: existingUser[0].email, name: existingUser[0].name, role: existingUser[0].role } });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to login' });
    }
  });

  // Users API (Admin only)
  app.get('/api/users', requireAuth, async (req: AuthRequest, res) => {
    try {
      const allUsers = await db.select().from(users);
      res.json(allUsers.map(u => ({ uid: u.uid, email: u.email, name: u.name, role: u.role })));
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch users' });
    }
  });

  app.post('/api/users', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { username, name, role, pass } = req.body;
      const email = `${username.toLowerCase().trim()}@local.app`;
      const uid = `local-${username.toLowerCase().trim()}`;
      const hashed = await bcrypt.hash(pass, 10);

      const newDbUser = await db.insert(users).values({
        uid,
        email,
        name,
        role: role || 'HR Manager',
        password: hashed,
      }).returning();

      const out = newDbUser[0];
      res.status(201).json({ uid: out.uid, email: out.email, name: out.name, role: out.role });
      broadcast({ table: 'users', op: 'INSERT', id: out.uid, row: { uid: out.uid, email: out.email, name: out.name, role: out.role } });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to create user' });
    }
  });

  app.delete('/api/users/:uid', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.params.uid;
      await db.delete(users).where(eq(users.uid, uid));
      res.status(204).send();
      broadcast({ table: 'users', op: 'DELETE', id: uid });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to delete user' });
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
      broadcast({ table: 'employees', op: 'INSERT', id: newEmp.id, row: newEmp });
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
      // broadcast the batch inserts/updates
      for (const r of saved) {
        broadcast({ table: 'employees', op: 'UPSERT', id: r.id, row: r });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to batch import employees' });
    }
  });

  app.patch('/api/employees/:id', async (req, res) => {
    try {
      const updated = await updateEmployee(req.params.id, req.body);
      res.json(updated);
      broadcast({ table: 'employees', op: 'UPDATE', id: updated.id, row: updated });
    } catch (error: any) {
      if (error && error.message && error.message.includes('Conflict')) {
        return res.status(409).json({ error: 'Conflict: resource was updated by another client', latest: error.latest || null });
      }
      res.status(500).json({ error: error.message || 'Failed to update employee' });
    }
  });

  app.delete('/api/employees/:id', async (req, res) => {
    try {
      await deleteEmployee(req.params.id);
      res.status(204).send();
      broadcast({ table: 'employees', op: 'DELETE', id: req.params.id });
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
      broadcast({ table: 'leave_records', op: 'INSERT', id: newLeave.id, row: newLeave });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to create leave record' });
    }
  });

  app.delete('/api/leave-records/:id', async (req, res) => {
    try {
      await deleteLeaveRecord(req.params.id);
      res.status(204).send();
      broadcast({ table: 'leave_records', op: 'DELETE', id: req.params.id });
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
      broadcast({ table: 'audit_logs', op: 'INSERT', id: newLog.id, row: newLog });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to create audit log' });
    }
  });

  // Reset/Clear Data
  app.post('/api/reset-demo', async (req, res) => {
    try {
      await resetDemoDataInDb();
      res.json({ status: 'ok' });
      broadcast({ table: 'employees', op: 'RESET' });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to reset demo data' });
    }
  });

  app.post('/api/clear-data', async (req, res) => {
    try {
      await clearAllDataInDb();
      res.json({ status: 'ok' });
      broadcast({ table: 'employees', op: 'CLEAR' });
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

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
