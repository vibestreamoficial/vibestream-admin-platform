const express = require('express');
const path = require('path');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const { RtcTokenBuilder, RtcRole } = require('agora-access-token');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key';

// Configuração PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Token ausente ou inválido.' });
  }

  try {
    const token = authHeader.split(' ')[1];
    const payload = jwt.verify(token, JWT_SECRET);

    const user = await getUserById(payload.id);
    if (!user) {
      return res.status(401).json({ message: 'Usuário não encontrado.' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Sessão inválida.' });
  }
};

const sanitizeUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  created_at: user.created_at,
});

function createToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

async function getUserByEmail(email) {
  const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  return result.rows[0] || null;
}

async function getUserById(id) {
  const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
  return result.rows[0] || null;
}

async function createUser({ name, email, password, role = 'user' }) {
  const hashedPassword = await bcrypt.hash(password, 10);
  const result = await pool.query(
    'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING *',
    [name, email, hashedPassword, role]
  );
  return result.rows[0];
}

async function initializeDatabase() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role VARCHAR(50) DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    `);
  } finally {
    client.release();
  }
}

async function ensureAdminUser() {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@vibestream.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123';

  const existingAdmin = await getUserByEmail(adminEmail);
  if (!existingAdmin) {
    await createUser({
      name: 'Administrador',
      email: adminEmail,
      password: adminPassword,
      role: 'admin',
    });
    console.log(`✓ Usuário admin criado: ${adminEmail}`);
  }
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'API online.' });
});

app.post('/api/register', async (req, res) => {
  const { name, email, password } = req.body || {};

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Nome, email e senha são obrigatórios.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ message: 'A senha deve ter pelo menos 6 caracteres.' });
  }

  try {
    const existingUser = await getUserByEmail(email.toLowerCase());
    if (existingUser) {
      return res.status(409).json({ message: 'Este e-mail já está cadastrado.' });
    }

    const user = await createUser({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      role: 'user',
    });

    const token = createToken(user);
    return res.status(201).json({
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao registrar usuário.', error: error.message });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ message: 'Email e senha são obrigatórios.' });
  }

  try {
    const user = await getUserByEmail(email.toLowerCase().trim());
    if (!user) {
      return res.status(401).json({ message: 'Credenciais inválidas.' });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ message: 'Credenciais inválidas.' });
    }

    const token = createToken(user);
    return res.json({ token, user: sanitizeUser(user) });
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao fazer login.', error: error.message });
  }
});

app.get('/api/me', authMiddleware, async (req, res) => {
  res.json({ user: sanitizeUser(req.user) });
});

app.post('/api/video/token', authMiddleware, async (req, res) => {
  const { channelName, uid } = req.body || {};

  if (!channelName) {
    return res.status(400).json({ message: 'Nome do canal é obrigatório.' });
  }

  const appId = process.env.AGORA_APP_ID;
  const appCertificate = process.env.AGORA_APP_CERTIFICATE;

  if (!appId || !appCertificate) {
    return res.status(500).json({
      message: 'Defina AGORA_APP_ID e AGORA_APP_CERTIFICATE no arquivo .env para habilitar a chamada de vídeo real.',
    });
  }

  const numericUid = Number(uid) || Number(req.user.id) || 0;
  const role = RtcRole.PUBLISHER;
  const expirationTimeInSeconds = 3600;
  const currentTime = Math.floor(Date.now() / 1000);
  const privilegeExpiredTs = currentTime + expirationTimeInSeconds;

  const token = RtcTokenBuilder.buildTokenWithUid(
    appId,
    appCertificate,
    channelName,
    numericUid,
    role,
    privilegeExpiredTs
  );

  return res.json({ token, appId, channelName, uid: numericUid });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

async function startServer() {
  try {
    await pool.query('SELECT NOW()');
    console.log('✓ Conectado ao PostgreSQL');
    
    await initializeDatabase();
    console.log('✓ Banco de dados inicializado');
    
    await ensureAdminUser();

    app.listen(PORT, () => {
      console.log(`✓ Servidor rodando em porta ${PORT}`);
    });
  } catch (error) {
    console.error('✗ Erro ao iniciar o servidor:', error);
    process.exit(1);
  }
}

startServer();

process.on('SIGTERM', async () => {
  await pool.end();
  process.exit(0);
});
