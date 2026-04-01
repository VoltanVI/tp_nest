let socket;
let currentUser = null;
let messageCount = 0;

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
}

navItems.forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    const view = item.dataset.view;
    
    navItems.forEach(nav => nav.classList.remove('active'));
    item.classList.add('active');
    
    if (view === 'chat') {
      chatView.classList.add('active');
      profileView.classList.remove('active');
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
      headers: {
        'Content-Type': 'application/json',
      },
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
      headers: {
        'Content-Type': 'application/json',
      },
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
    socket.emit('getMessages');
  });
  
  socket.on('disconnect', () => {
    console.log('Disconnected from server');
    updateConnectionStatus(false);
  });
  
  socket.on('newMessage', (message) => {
    addMessage(message);
    if (message.username === currentUser.username) {
      messageCount++;
      updateMessageCount();
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
    socket.emit('typing', { isTyping: true });
  }
  
  clearTimeout(typingTimeout);
  
  typingTimeout = setTimeout(() => {
    isTyping = false;
    socket.emit('typing', { isTyping: false });
  }, 10000);
});

messageForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const message = messageInput.value.trim();
  
  if (message && socket) {
    socket.emit('sendMessage', { content: message });
    messageInput.value = '';
    
    clearTimeout(typingTimeout);
    if (isTyping) {
      isTyping = false;
      socket.emit('typing', { isTyping: false });
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
      
      if (avatar) {
        avatar.style.background = newColor;
      }
      if (bubble) {
        bubble.style.background = newColor;
      }
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
  
  if (editUsername) {
    editUsername.value = currentUser.username;
  }
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
  if (messageCountEl) {
    messageCountEl.textContent = messageCount;
  }
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
  if (container) {
    container.scrollTop = container.scrollHeight;
  }
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
  if (!editProfileForm) {
    console.log('Formulaire de profil non trouvé');
    return;
  }
  
  console.log('Initialisation du formulaire de profil');
  
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
        headers: {
          'Content-Type': 'application/json',
        },
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

function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type} show`;
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}
