const appRoot = document.getElementById('app');

const state = {
  token: localStorage.getItem('vibestream_token') || '',
  user: null,
  view: 'video',
  authMode: 'login',
};

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };

  if (state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }

  const response = await fetch(path, { ...options, headers });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || 'Erro na requisição.');
  }

  return data;
}

async function loadCurrentUser() {
  if (!state.token) {
    renderAuth();
    return;
  }

  try {
    const response = await api('/api/me');
    state.user = response.user;
    renderApp();
  } catch (error) {
    localStorage.removeItem('vibestream_token');
    state.token = '';
    state.user = null;
    renderAuth(error.message);
  }
}

async function handleAuthSubmit(event) {
  event.preventDefault();

  const form = event.target;
  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());

  const endpoint = state.authMode === 'login' ? '/api/login' : '/api/register';

  try {
    const response = await api(endpoint, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    state.token = response.token;
    localStorage.setItem('vibestream_token', response.token);
    state.user = response.user;
    renderApp();
  } catch (error) {
    showAuthMessage(error.message, 'error');
  }
}

function showAuthMessage(message, type = 'error') {
  const existing = document.getElementById('auth-message');
  if (existing) {
    existing.remove();
  }

  const el = document.createElement('div');
  el.id = 'auth-message';
  el.className = type === 'error' ? 'alert' : 'alert success';
  el.textContent = message;

  const target = document.querySelector('.auth-card');
  if (target) {
    target.insertBefore(el, target.querySelector('.form-grid'));
  }
}

function renderAuth(message) {
  appRoot.innerHTML = `
    <div class="auth-shell">
      <div class="auth-card">
        <h1>VibeStream</h1>
        <div class="auth-subtitle">Chamadas privadas em tempo real.</div>

        <div class="auth-tabs">
          <button class="tab-button ${state.authMode === 'login' ? 'active' : ''}" data-auth-tab="login">Entrar</button>
          <button class="tab-button ${state.authMode === 'register' ? 'active' : ''}" data-auth-tab="register">Cadastrar</button>
        </div>

        <form class="form-grid" id="auth-form">
          ${state.authMode === 'register' ? `
            <label>
              Nome completo
              <input type="text" name="name" placeholder="Seu nome" required />
            </label>
          ` : ''}

          <label>
            E-mail
            <input type="email" name="email" placeholder="seu@email.com" required />
          </label>

          <label>
            Senha
            <input type="password" name="password" placeholder="Sua senha" required />
          </label>

          <button type="submit" class="primary-button">${state.authMode === 'login' ? 'Entrar' : 'Criar conta'}</button>
        </form>
      </div>
    </div>
  `;

  const form = document.getElementById('auth-form');
  form.addEventListener('submit', handleAuthSubmit);

  document.querySelectorAll('[data-auth-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      state.authMode = button.dataset.authTab;
      renderAuth();
    });
  });

  if (message) {
    showAuthMessage(message, 'error');
  }
}

function handleLogout() {
  state.token = '';
  state.user = null;
  localStorage.removeItem('vibestream_token');
  renderAuth();
}

function renderApp() {
  if (!state.user) {
    renderAuth();
    return;
  }

  appRoot.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="brand">
          <div class="brand-mark">V</div>
          <span>VibeStream</span>
        </div>

        <nav class="nav">
          <button class="${state.view === 'video' ? 'active' : ''}" data-view="video">Vídeo privado</button>
        </nav>
      </aside>

      <main class="main-panel">
        <div class="topbar">
          <div>
            <h2 style="margin:0;">Olá, ${state.user.name}</h2>
          </div>

          <div class="user-box">
            <div class="user-avatar">${state.user.name.charAt(0).toUpperCase()}</div>
            <div>
              <div>${state.user.name}</div>
              <small style="color: var(--muted);">Usuário</small>
            </div>
            <button class="secondary-button" id="logout-btn">Sair</button>
          </div>
        </div>

        <div class="card">
          <h3 style="margin-top:0;">Sala de vídeo privada</h3>
          <div class="call-box">
            <div class="video-stage">
              <video id="remote-video" autoplay playsinline></video>
              <video id="local-video" autoplay playsinline muted></video>
              <div class="video-placeholder" id="video-placeholder">
                <strong>Conecte-se à sala privada</strong>
                <p>Use um nome de canal e inicie uma chamada real com Agora.</p>
              </div>
            </div>

            <div>
              <label>
                Nome da sala
                <input type="text" id="channel-name" placeholder="ex: consultorio-01" />
              </label>

              <div class="form-inline">
                <button class="primary-button" id="join-call" style="width:100%;">Entrar na chamada</button>
              </div>

              <div class="form-inline">
                <button class="secondary-button" id="leave-call" style="width:100%;">Encerrar</button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  `;

  bindViewActions();

  const logoutButton = document.getElementById('logout-btn');
  logoutButton.addEventListener('click', handleLogout);

  bindVideoActions();
}

function bindViewActions() {
  document.querySelectorAll('[data-view]').forEach((button) => {
    button.addEventListener('click', () => {
      state.view = button.dataset.view;
      renderApp();
    });
  });
}

let agoraClient = null;
let agoraLocalTrack = null;

async function joinPrivateCall() {
  const channelName = document.getElementById('channel-name').value.trim();
  if (!channelName) {
    alert('Informe o nome da sala.');
    return;
  }

  try {
    const response = await api('/api/video/token', {
      method: 'POST',
      body: JSON.stringify({ channelName, uid: Number(String(Date.now()).slice(-6)) }),
    });

    const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
    agoraClient = client;

    client.on('user-published', async (user, mediaType) => {
      await client.subscribe(user, mediaType);
      if (mediaType === 'video') {
        const remoteVideo = document.getElementById('remote-video');
        remoteVideo.srcObject = user.videoTrack.getMediaStream();
        remoteVideo.style.display = 'block';
        document.getElementById('video-placeholder').style.display = 'none';
      }
    });

    client.on('user-left', () => {
      const remoteVideo = document.getElementById('remote-video');
      remoteVideo.style.display = 'none';
      document.getElementById('video-placeholder').style.display = 'block';
    });

    const uid = Number(response.uid);
    await client.join(response.appId, channelName, response.token, uid);

    const [microphoneTrack, cameraTrack] = await AgoraRTC.createMicrophoneAndCameraTracks();
    agoraLocalTrack = { microphoneTrack, cameraTrack };

    await client.publish([microphoneTrack, cameraTrack]);

    const localVideo = document.getElementById('local-video');
    localVideo.srcObject = cameraTrack.getMediaStream();
    document.getElementById('video-placeholder').style.display = 'none';
  } catch (error) {
    alert(error.message || 'Não foi possível iniciar a chamada.');
  }
}

function leavePrivateCall() {
  if (agoraClient) {
    agoraClient.leave();
    agoraClient = null;
  }

  if (agoraLocalTrack) {
    agoraLocalTrack.microphoneTrack.close();
    agoraLocalTrack.cameraTrack.close();
    agoraLocalTrack = null;
  }

  const remoteVideo = document.getElementById('remote-video');
  const localVideo = document.getElementById('local-video');
  remoteVideo.srcObject = null;
  localVideo.srcObject = null;
  remoteVideo.style.display = 'none';
  document.getElementById('video-placeholder').style.display = 'block';
}

function bindVideoActions() {
  document.getElementById('join-call').addEventListener('click', joinPrivateCall);
  document.getElementById('leave-call').addEventListener('click', leavePrivateCall);
}

loadCurrentUser();
