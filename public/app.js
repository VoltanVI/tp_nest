let socket;
let currentUser = null;
let messageCount = 0;
let currentRoomId = null;
let rooms = [];
let addPendingMembers = [];

const loginScreen = document.getElementById('loginScreen');
const registerScreen = document.getElementById('registerScreen');
const chatScreen = document.getElementById('chatScreen');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const messageForm = document.getElementById('messageForm');
const showRegisterLink = document.getElementById('showRegister');
const showLoginLink = document.getElementById('showLogin');
const logoutBtn = document.getElementById('logoutBtn');
const messagesWrapper = document.getElementById('messagesWrapper');
const messageInput = document.getElementById('messageInput');
const sidebarAvatar = document.getElementById('sidebarAvatar');
const sidebarUsername = document.getElementById('sidebarUsername');
const profileAvatar = document.getElementById('profileAvatar');
const profileUsername = document.getElementById('profileUsername');
const profileEmail = document.getElementById('profileEmail');
const profileUsernameInfo = document.getElementById('profileUsernameInfo');
const profileEmailInfo = document.getElementById('profileEmailInfo');
const profileId = document.getElementById('profileId');
const messageCountEl = document.getElementById('messageCount');
const memberSinceEl = document.getElementById('memberSince');
const chatView = document.getElementById('chatView');
const profileView = document.getElementById('profileView');
const navItems = document.querySelectorAll('.nav-item');
const editProfileForm = document.getElementById('editProfileForm');
const editUsername = document.getElementById('editUsername');
const editColor = document.getElementById('editColor');
const colorPreview = document.getElementById('colorPreview');
const typingIndicator = document.getElementById('typingIndicator');
const chatTitle = document.getElementById('chatTitle');
const headerRoomInfo = document.getElementById('headerRoomInfo');
const roomMembersCount = document.getElementById('roomMembersCount');
const backToGeneral = document.getElementById('backToGeneral');
const createRoomBtn = document.getElementById('createRoomBtn');
const createRoomModal = document.getElementById('createRoomModal');
const closeRoomModal = document.getElementById('closeRoomModal');
const createRoomForm = document.getElementById('createRoomForm');
const roomsList = document.getElementById('roomsList');
const addMemberBtn = document.getElementById('addMemberBtn');
const deleteRoomBtn = document.getElementById('deleteRoomBtn');
const addMemberModal = document.getElementById('addMemberModal');
const closeAddMemberModal = document.getElementById('closeAddMemberModal');
const addMemberForm = document.getElementById('addMemberForm');
const addMemberSearch = document.getElementById('addMemberSearch');
const addMemberTags = document.getElementById('addMemberTags');
const API_URL = 'http://localhost:3000';

let typingTimeout;
let isTyping = false;
let typingUsers = new Set();

document.addEventListener('DOMContentLoaded', () => {
  checkAuth();

  if (editColor) {
    editColor.addEventListener('input', (e) => {
      colorPreview.textContent = e.target.value;
    });
  }
});

function checkAuth() {
  const user = localStorage.getItem('user');
  if (user) {
    currentUser = JSON.parse(user);
    showChatScreen();
  }
}

function showScreen(screen) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  screen.classList.add('active');
}

function showChatScreen() {
  showScreen(chatScreen);
  initializeChat();
  updateUserInfo();
  updateProfileView();
  updateMessageCount();
  initializeProfileForm();
  initializeRoomUI();
}

navItems.forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    const view = item.dataset.view;

    navItems.forEach(nav => nav.classList.remove('active'));
    item.classList.add('active');

    document.querySelectorAll('.rooms-list .room-item').forEach(r => r.classList.remove('active'));

    if (view === 'chat') {
      chatView.classList.add('active');
      profileView.classList.remove('active');
      switchToGeneral();
    } else if (view === 'profile') {
      chatView.classList.remove('active');
      profileView.classList.add('active');
      updateProfileView();
    }
  });
});

showRegisterLink.addEventListener('click', (e) => {
  e.preventDefault();
  showScreen(registerScreen);
});

showLoginLink.addEventListener('click', (e) => {
  e.preventDefault();
  showScreen(loginScreen);
});

registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const username = document.getElementById('registerUsername').value.trim();
  const email = document.getElementById('registerEmail').value.trim();
  const password = document.getElementById('registerPassword').value;

  try {
    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password }),
    });

    const data = await response.json();

    if (response.ok) {
      currentUser = data.user;
      localStorage.setItem('user', JSON.stringify(currentUser));
      showToast('Compte créé avec succès !', 'success');
      showChatScreen();
      registerForm.reset();
    } else {
      showToast(data.message || 'Erreur lors de la création du compte', 'error');
    }
  } catch (error) {
    console.error('Register error:', error);
    showToast('Erreur de connexion au serveur', 'error');
  }
});

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;

  try {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();

    if (response.ok) {
      currentUser = data.user;
      localStorage.setItem('user', JSON.stringify(currentUser));
      showToast('Connexion réussie !', 'success');
      showChatScreen();
      loginForm.reset();
    } else {
      showToast(data.message || 'Identifiants incorrects', 'error');
    }
  } catch (error) {
    console.error('Login error:', error);
    showToast('Erreur de connexion au serveur', 'error');
  }
});

logoutBtn.addEventListener('click', () => {
  if (socket) {
    socket.disconnect();
  }
  localStorage.removeItem('user');
  currentUser = null;
  messageCount = 0;
  currentRoomId = null;
  rooms = [];
  messagesWrapper.innerHTML = '';
  showScreen(loginScreen);
  showToast('Déconnexion réussie', 'success');
});

function initializeChat() {
  socket = io(API_URL);

  socket.on('connect', () => {
    console.log('Connected to server');
    updateConnectionStatus(true);
    socket.emit('join', {
      username: currentUser.username,
      userColor: currentUser.color || '#1877f2'
    });
  });

  socket.on('disconnect', () => {
    console.log('Disconnected from server');
    updateConnectionStatus(false);
  });

  socket.on('newMessage', (message) => {
    const msgRoom = message.roomId || null;
    if (msgRoom === currentRoomId) {
      addMessage(message);
      if (message.username === currentUser.username) {
        messageCount++;
        updateMessageCount();
      }
    }
  });

  socket.on('getMessages', (messages) => {
    messagesWrapper.innerHTML = '';
    messageCount = messages.filter(m => m.username === currentUser.username).length;
    messages.forEach(message => addMessage(message, false));
    updateMessageCount();
    scrollToBottom();
  });

  socket.on('userTyping', (data) => {
    if (data.isTyping) {
      typingUsers.add(data.username);
    } else {
      typingUsers.delete(data.username);
    }
    updateTypingIndicator();
  });

  socket.on('reactionUpdated', (data) => {
    updateMessageReactions(data.messageId, data.reactions);
  });

  socket.on('userColorUpdated', (data) => {
    updateUserMessagesColor(data.username, data.newColor);
  });

  socket.on('roomsList', (roomsData) => {
    rooms = roomsData;
    renderRoomsList();
  });

  socket.on('roomCreated', (room) => {
    if (room && room._id) {
      rooms.push(room);
      renderRoomsList();
      showToast(`Salon "${room.name}" créé !`, 'success');
    }
  });

  socket.on('roomInvite', (room) => {
    const exists = rooms.find(r => (r._id || r.id) === (room._id || room.id));
    if (!exists) rooms.push(room);
    renderRoomsList();
    showToast(`Vous avez été invité au salon "${room.name}"`, 'success');
  });

  socket.on('roomDeleted', (data) => {
    rooms = rooms.filter(r => (r._id || r.id) !== data.roomId);
    renderRoomsList();
    if (currentRoomId === data.roomId) {
      switchToGeneral();
      showToast(`Le salon "${data.roomName}" a été supprimé`, 'error');
    }
  });

  socket.on('roomUpdated', (updatedRoom) => {
    const roomId = updatedRoom._id || updatedRoom.id;
    const idx = rooms.findIndex(r => (r._id || r.id) === roomId);
    if (idx !== -1) rooms[idx] = updatedRoom;
    renderRoomsList();
    if (currentRoomId === roomId) {
      roomMembersCount.textContent = `${updatedRoom.members.length} membre${updatedRoom.members.length > 1 ? 's' : ''}`;
    }
  });
}

function updateTypingIndicator() {
  if (typingUsers.size > 0) {
    const users = Array.from(typingUsers);
    const typingText = typingIndicator.querySelector('.typing-text');

    if (users.length === 1) {
      typingText.textContent = `${users[0]} est en train d'écrire`;
    } else if (users.length === 2) {
      typingText.textContent = `${users[0]} et ${users[1]} sont en train d'écrire`;
    } else {
      typingText.textContent = `${users.length} personnes sont en train d'écrire`;
    }

    typingIndicator.style.display = 'flex';
    scrollToBottom();
  } else {
    typingIndicator.style.display = 'none';
  }
}

messageInput.addEventListener('input', () => {
  if (!socket) return;

  if (!isTyping) {
    isTyping = true;
    socket.emit('typing', { isTyping: true, roomId: currentRoomId });
  }

  clearTimeout(typingTimeout);

  typingTimeout = setTimeout(() => {
    isTyping = false;
    socket.emit('typing', { isTyping: false, roomId: currentRoomId });
  }, 10000);
});

messageForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const message = messageInput.value.trim();

  if (message && socket) {
    socket.emit('sendMessage', { content: message, roomId: currentRoomId });
    messageInput.value = '';

    clearTimeout(typingTimeout);
    if (isTyping) {
      isTyping = false;
      socket.emit('typing', { isTyping: false, roomId: currentRoomId });
    }
  }
});

function addMessage(message, scroll = true) {
  const messageDiv = document.createElement('div');
  const isOwn = message.username === currentUser.username;
  messageDiv.className = `message ${isOwn ? 'own' : ''}`;
  messageDiv.dataset.messageId = message._id;

  const avatar = getInitials(message.username);
  const time = formatTime(new Date(message.createdAt));
  const userColor = message.userColor || '#1877f2';
  const reactionsHtml = renderReactions(message.reactions || [], message._id);

  messageDiv.innerHTML = `
    <div class="message-avatar" style="background: ${userColor};">${avatar}</div>
    <div class="message-content">
      <div class="message-header">
        <span class="message-username">${escapeHtml(message.username)}</span>
        <span class="message-time">${time}</span>
      </div>
      <div class="message-bubble" style="background: ${userColor}; color: white;">
        ${escapeHtml(message.content)}
        <div class="message-actions">
          <button class="reaction-btn" onclick="addReaction('${message._id}', '👍')" title="J'aime">👍</button>
          <button class="reaction-btn" onclick="addReaction('${message._id}', '❤️')" title="J'adore">❤️</button>
          <button class="reaction-btn" onclick="addReaction('${message._id}', '😂')" title="Drôle">😂</button>
          <button class="reaction-btn" onclick="addReaction('${message._id}', '😮')" title="Surpris">😮</button>
          <button class="reaction-btn" onclick="addReaction('${message._id}', '🎉')" title="Célébration">🎉</button>
        </div>
      </div>
      ${reactionsHtml}
    </div>
  `;

  messagesWrapper.appendChild(messageDiv);

  if (scroll) {
    scrollToBottom();
  }
}

function renderReactions(reactions, messageId) {
  if (!reactions || reactions.length === 0) {
    return '<div class="message-reactions"></div>';
  }

  const reactionsHtml = reactions.map(reaction => {
    const userReacted = reaction.users.includes(currentUser.username);
    const usersList = reaction.users.join(', ');

    return `
      <div class="reaction-item ${userReacted ? 'user-reacted' : ''}" onclick="addReaction('${messageId}', '${reaction.emoji}')">
        <span class="reaction-emoji">${reaction.emoji}</span>
        <span class="reaction-count">${reaction.users.length}</span>
        <div class="reaction-tooltip">${usersList}</div>
      </div>
    `;
  }).join('');

  return `<div class="message-reactions">${reactionsHtml}</div>`;
}

function addReaction(messageId, emoji) {
  if (socket) {
    socket.emit('toggleReaction', { messageId, emoji });
  }
}

function updateMessageReactions(messageId, reactions) {
  const messageDiv = document.querySelector(`[data-message-id="${messageId}"]`);
  if (messageDiv) {
    const reactionsContainer = messageDiv.querySelector('.message-reactions');
    if (reactionsContainer) {
      reactionsContainer.outerHTML = renderReactions(reactions, messageId);
    }
  }
}

function updateUserMessagesColor(username, newColor) {
  const messages = document.querySelectorAll('.message');
  messages.forEach(messageDiv => {
    const usernameElement = messageDiv.querySelector('.message-username');
    if (usernameElement && usernameElement.textContent === username) {
      const avatar = messageDiv.querySelector('.message-avatar');
      const bubble = messageDiv.querySelector('.message-bubble');

      if (avatar) avatar.style.background = newColor;
      if (bubble) bubble.style.background = newColor;
    }
  });
}

function updateUserInfo() {
  const initials = getInitials(currentUser.username);
  const userColor = currentUser.color || '#1877f2';

  sidebarAvatar.textContent = initials;
  sidebarAvatar.style.background = userColor;
  sidebarUsername.textContent = currentUser.username;
}

function updateProfileView() {
  const initials = getInitials(currentUser.username);
  const userColor = currentUser.color || '#1877f2';

  profileAvatar.textContent = initials;
  profileAvatar.style.background = userColor;
  profileUsername.textContent = currentUser.username;
  profileEmail.textContent = currentUser.email;
  profileUsernameInfo.textContent = currentUser.username;
  profileEmailInfo.textContent = currentUser.email;
  profileId.textContent = `#${currentUser.id}`;

  if (editUsername) editUsername.value = currentUser.username;
  if (editColor && colorPreview) {
    editColor.value = userColor;
    colorPreview.textContent = userColor;
  }

  const memberDate = new Date();
  memberSinceEl.textContent = memberDate.toLocaleDateString('fr-FR', {
    month: 'short',
    year: 'numeric'
  });
}

function updateMessageCount() {
  if (messageCountEl) messageCountEl.textContent = messageCount;
}

function getInitials(username) {
  return username.charAt(0).toUpperCase();
}

function formatTime(date) {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function scrollToBottom() {
  const container = document.getElementById('messagesContainer');
  if (container) container.scrollTop = container.scrollHeight;
}

function updateConnectionStatus(connected) {
  const statusDot = document.querySelector('.status-dot');
  const statusText = document.querySelector('#connectionStatus');

  if (statusDot && statusText) {
    if (connected) {
      statusDot.style.background = 'var(--secondary)';
      statusText.childNodes[2].textContent = ' Connecté';
    } else {
      statusDot.style.background = '#dc2626';
      statusText.childNodes[2].textContent = ' Déconnecté';
    }
  }
}

function initializeProfileForm() {
  if (!editProfileForm) return;

  editProfileForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const updateData = {};

    if (editUsername.value && editUsername.value.trim() !== currentUser.username) {
      updateData.username = editUsername.value.trim();
    }

    if (editColor.value && editColor.value !== currentUser.color) {
      updateData.color = editColor.value;
    }

    if (Object.keys(updateData).length === 0) {
      showToast('Aucune modification à enregistrer', 'info');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/users/${currentUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      const data = await response.json();

      if (response.ok) {
        currentUser = data.user;
        localStorage.setItem('user', JSON.stringify(currentUser));
        updateUserInfo();
        updateProfileView();

        if (socket && updateData.color) {
          socket.disconnect();
          initializeChat();
        }

        showToast('Profil mis à jour avec succès !', 'success');
      } else {
        showToast(data.message || 'Erreur lors de la mise à jour', 'error');
      }
    } catch (error) {
      console.error('Update error:', error);
      showToast('Erreur de connexion au serveur', 'error');
    }
  });
}

// --- Rooms ---

function initializeRoomUI() {
  createRoomBtn.addEventListener('click', () => {
    createRoomForm.reset();
    createRoomModal.style.display = 'flex';
  });

  closeRoomModal.addEventListener('click', () => {
    createRoomModal.style.display = 'none';
  });

  createRoomModal.addEventListener('click', (e) => {
    if (e.target === createRoomModal) createRoomModal.style.display = 'none';
  });

  createRoomForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const roomName = document.getElementById('roomName').value.trim();
    if (!roomName) return;

    socket.emit('createRoom', { name: roomName, members: [] }, (response) => {
      if (response && !response.success) {
        showToast(response.error || 'Erreur lors de la création du salon', 'error');
      }
    });
    createRoomModal.style.display = 'none';
  });

  backToGeneral.addEventListener('click', (e) => {
    e.preventDefault();
    switchToGeneral();
  });

  deleteRoomBtn.addEventListener('click', () => {
    if (!currentRoomId) return;
    const room = rooms.find(r => (r._id || r.id) === currentRoomId);
    const name = room ? room.name : 'ce salon';
    if (confirm(`Supprimer le salon "${name}" et tous ses messages ?`)) {
      socket.emit('deleteRoom', { roomId: currentRoomId });
    }
  });

  addMemberBtn.addEventListener('click', () => {
    if (!currentRoomId) return;
    addPendingMembers = [];
    renderAddMemberTags();
    addMemberForm.reset();
    addMemberModal.style.display = 'flex';
  });

  closeAddMemberModal.addEventListener('click', () => {
    addMemberModal.style.display = 'none';
  });

  addMemberModal.addEventListener('click', (e) => {
    if (e.target === addMemberModal) addMemberModal.style.display = 'none';
  });

  addMemberSearch.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const username = addMemberSearch.value.trim();
      const room = rooms.find(r => (r._id || r.id) === currentRoomId);
      const existingMembers = room ? room.members.map(m => m.username) : [];

      if (!username) return;
      if (existingMembers.includes(username)) {
        showToast('Ce membre fait déjà partie du salon', 'info');
      } else if (addPendingMembers.includes(username)) {
        showToast('Ce membre est déjà dans la liste', 'info');
      } else {
        addPendingMembers.push(username);
        renderAddMemberTags();
        addMemberSearch.value = '';
      }
    }
  });

  addMemberForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!currentRoomId) return;

    const typed = addMemberSearch.value.trim();
    if (typed) {
      const room = rooms.find(r => (r._id || r.id) === currentRoomId);
      const existingMembers = room ? room.members.map(m => m.username) : [];
      if (!existingMembers.includes(typed) && !addPendingMembers.includes(typed)) {
        addPendingMembers.push(typed);
        addMemberSearch.value = '';
      }
    }

    if (addPendingMembers.length === 0) return;

    const historyAccess = document.getElementById('addMemberHistoryAccess').checked;
    const members = addPendingMembers.map(username => ({
      username,
      hasHistoryAccess: historyAccess,
    }));

    socket.emit('addMembers', { roomId: currentRoomId, members }, (response) => {
      if (response && !response.success) {
        showToast(response.error || 'Erreur lors de l\'ajout', 'error');
      } else {
        showToast('Membres ajoutés !', 'success');
      }
    });
    addMemberModal.style.display = 'none';
  });
}


function renderAddMemberTags() {
  addMemberTags.innerHTML = addPendingMembers.map(username => `
    <span class="member-tag">
      ${escapeHtml(username)}
      <button type="button" class="remove-member" onclick="removeAddPendingMember('${escapeHtml(username)}')">&times;</button>
    </span>
  `).join('');
}

function removeAddPendingMember(username) {
  addPendingMembers = addPendingMembers.filter(m => m !== username);
  renderAddMemberTags();
}

function renderRoomsList() {
  roomsList.innerHTML = rooms.map(room => {
    const isActive = currentRoomId === (room._id || room.id);
    const membersCount = room.members ? room.members.length : 0;
    const roomId = room._id || room.id;
    return `
      <div class="room-item ${isActive ? 'active' : ''}" data-room-id="${roomId}" onclick="switchToRoom('${roomId}')">
        <div class="room-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        </div>
        <div class="room-info">
          <span class="room-name">${escapeHtml(room.name)}</span>
          <span class="room-meta">${membersCount} membre${membersCount > 1 ? 's' : ''}</span>
        </div>
      </div>
    `;
  }).join('');
}

function switchToRoom(roomId) {
  currentRoomId = roomId;
  const room = rooms.find(r => (r._id || r.id) === roomId);

  navItems.forEach(nav => nav.classList.remove('active'));
  document.querySelectorAll('.room-item').forEach(r => r.classList.remove('active'));
  const activeRoom = document.querySelector(`[data-room-id="${roomId}"]`);
  if (activeRoom) activeRoom.classList.add('active');

  chatView.classList.add('active');
  profileView.classList.remove('active');

  if (room) {
    chatTitle.textContent = room.name;
    roomMembersCount.textContent = `${room.members.length} membre${room.members.length > 1 ? 's' : ''}`;
    headerRoomInfo.style.display = 'flex';

    const isCreator = room.creator === currentUser.username;
    addMemberBtn.style.display = isCreator ? 'inline-flex' : 'none';
    deleteRoomBtn.style.display = isCreator ? 'inline-flex' : 'none';
  }

  messagesWrapper.innerHTML = '';
  typingUsers.clear();
  updateTypingIndicator();
  socket.emit('joinRoom', { roomId });
}

function switchToGeneral() {
  currentRoomId = null;

  document.querySelectorAll('.room-item').forEach(r => r.classList.remove('active'));

  chatTitle.textContent = 'Chat Général';
  headerRoomInfo.style.display = 'none';

  messagesWrapper.innerHTML = '';
  typingUsers.clear();
  updateTypingIndicator();
  socket.emit('getMessages', {});
}

function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type} show`;

  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}
