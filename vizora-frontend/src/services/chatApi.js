  import axios from 'axios';
const API_URL = 'http://localhost:8000';

export const chatApi = {
  // Create a new chat
  createChat: async (title) => {
    const token = localStorage.getItem('token');
    const response = await axios.post(
      `${API_URL}/chats`,
      { title },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  },

  // Permanently delete a chat by ID (Recycle Bin)
  deleteChat: async (chatId) => {
    const token = localStorage.getItem('token');
    const response = await axios.delete(`${API_URL}/chats/${chatId}/permanent`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  },


  // List all chats for the user
  listChats: async () => {
    const token = localStorage.getItem('token');
    const response = await axios.get(`${API_URL}/chats`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  },

  // List deleted chats for the user (for recycle bin)
  listDeletedChats: async () => {
    const token = localStorage.getItem('token');
    const response = await axios.get(`${API_URL}/chats/deleted`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  },

  // Add a message to a chat
  addMessage: async (chatId, text, sender) => {
    const token = localStorage.getItem('token');
    const response = await axios.post(
      `${API_URL}/chats/${chatId}/messages`,
      { text, sender },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  },

  // Get all messages for a chat
  getMessages: async (chatId) => {
    const token = localStorage.getItem('token');
    const response = await axios.get(`${API_URL}/chats/${chatId}/messages`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  },

  // Upload a file to a chat
  uploadFile: async (chatId, file) => {
    const token = localStorage.getItem('token');
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`${API_URL}/chats/${chatId}/files`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    });
    if (!response.ok) throw new Error('File upload failed');
    return await response.json();
  },

  // List files for a chat
  listFiles: async (chatId) => {
    const token = localStorage.getItem('token');
    const response = await axios.get(`${API_URL}/chats/${chatId}/files`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  },

  // Soft delete a chat by ID (set is_active=0)
  softDeleteChat: async (chatId) => {
    const token = localStorage.getItem('token');
    const response = await axios.patch(
      `${API_URL}/chats/${chatId}`,
      { is_active: 0 },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  },

  // Restore a chat by ID (set is_active=1)
  restoreChat: async (chatId) => {
    const token = localStorage.getItem('token');
    const response = await axios.patch(
      `${API_URL}/chats/${chatId}`,
      { is_active: 1 },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  }
}