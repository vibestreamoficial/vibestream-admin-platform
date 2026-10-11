# Guia de Deploy Real - VibeStream

## Opção 1: Deploy Completo (Recomendado)

### 1. Preparar o Backend (Render)

1. Acesse [render.com](https://render.com)
2. Faça login com GitHub
3. Clique em "New +" → "Web Service"
4. Conecte seu repositório GitHub
5. Configure:
   - **Name**: `vibestream-api`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free (ou pago se quiser)

6. Clique em "Advanced" e adicione as variáveis de ambiente:
   - `NODE_ENV`: `production`
   - `JWT_SECRET`: gere uma chave forte (use: `openssl rand -hex 32`)
   - `DATABASE_URL`: será preenchida depois
   - `AGORA_APP_ID`: sua chave Agora
   - `AGORA_APP_CERTIFICATE`: seu certificado Agora
   - `ADMIN_EMAIL`: email do admin
   - `ADMIN_PASSWORD`: senha do admin (altere depois)

7. Clique em "Deploy Web Service"

### 2. Criar Banco PostgreSQL (Render)

1. No Render, clique em "New +" → "PostgreSQL"
2. Configure:
   - **Name**: `vibestream-db`
   - **Database**: `vibestream`
   - **User**: `vibestream`
   - **Region**: `Oregon` ou sua região
   - **Plan**: Free

3. Clique em "Create Database"
4. Copie a string de conexão interna (Internal Database URL)
5. Volte ao Web Service e adicione `DATABASE_URL` com essa string

### 3. Configurar Frontend (Vercel)

1. Acesse [vercel.com](https://vercel.com)
2. Faça login com GitHub
3. Clique em "Add New" → "Project"
4. Selecione seu repositório
5. Configure:
   - **Framework**: "Other"
   - **Build Command**: deixe em branco
   - **Output Directory**: `public`

6. Clique em "Deploy"

### 4. Configurar Domínio Personalizado (Opcional)

No Render:
1. Vá para seu Web Service
2. Clique em "Settings" → "Custom Domains"
3. Adicione seu domínio (ex: `api.vibestream.com`)

No Vercel:
1. Vá para seu projeto
2. Clique em "Settings" → "Domains"
3. Adicione seu domínio (ex: `vibestream.com`)

### 5. Obter Credenciais Agora

1. Acesse [agora.io](https://agora.io)
2. Crie uma conta ou faça login
3. Vá para "Console" → "Project Management"
4. Crie um novo projeto
5. Copie:
   - **App ID**
   - **App Certificate** (ative Primary Certificate)

6. Configure essas credenciais no Render

## Opção 2: Deploy Local (Desenvolvimento)

### 1. Instalar Node.js
```bash
curl https://nodejs.org | bash
```

### 2. Clonar o Repositório
```bash
git clone https://github.com/vibestreamoficial/vibestream-admin-platform.git
cd vibestream-admin-platform
```

### 3. Instalar Dependências
```bash
npm install
```

### 4. Configurar Variáveis de Ambiente
```bash
cp .env.example .env
```

Edite o arquivo `.env` e adicione:
```
PORT=3000
JWT_SECRET=sua-chave-secreta-forte-aqui
AGORA_APP_ID=seu-app-id-agora
AGORA_APP_CERTIFICATE=seu-certificado-agora
```

### 5. Iniciar o Servidor
```bash
npm start
```

Acesse: http://localhost:3000

## Opção 3: Deploy com PostgreSQL Local

### 1. Instalar PostgreSQL

**macOS:**
```bash
brew install postgresql
brew services start postgresql
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

**Windows:**
Baixe em https://www.postgresql.org/download/windows/

### 2. Criar Banco de Dados
```bash
sudo -u postgres psql

CREATE USER vibestream WITH PASSWORD 'sua-senha';
CREATE DATABASE vibestream OWNER vibestream;
\q
```

### 3. Configurar .env
```
DATABASE_URL=postgresql://vibestream:sua-senha@localhost:5432/vibestream
```

### 4. Usar server-postgres.js
```bash
node server-postgres.js
```

## Testar o Deploy

### Login
- Email: `admin@vibestream.com`
- Senha: `Admin@123` (mude depois!)

### Teste de API
```bash
# Health check
curl https://sua-api.onrender.com/api/health

# Login
curl -X POST https://sua-api.onrender.com/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@vibestream.com","password":"Admin@123"}'
```

## Troubleshooting

### Erro: "Database not found"
- Verifique se o PostgreSQL está rodando
- Confirme a DATABASE_URL está correta

### Erro: "AGORA_APP_ID não configurado"
- Adicione as variáveis no Render/Vercel
- Redeploy o serviço

### Erro: "CORS error"
- Verifique se o frontend está apontando para a API correta
- Confirme que CORS está habilitado no Express

## Próximos Passos

1. Altere a senha do admin
2. Configure um domínio personalizado
3. Adicione SSL/HTTPS (Vercel e Render fazem automaticamente)
4. Configure backups do banco de dados
5. Monitore logs e performance

## Custo Estimado

- Render Free: **$0/mês** (com limitações)
- Render Pro: **$7/mês** (backend) + **$9/mês** (PostgreSQL)
- Vercel Free: **$0/mês**
- Agora Free: **10.000 minutos/mês** grátis

**Total**: $0 - $16/mês

## Suporte

Para dúvidas:
- [Render Docs](https://render.com/docs)
- [Vercel Docs](https://vercel.com/docs)
- [Agora Docs](https://docs.agora.io/)
