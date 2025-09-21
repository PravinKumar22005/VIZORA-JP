import axios from 'axios';

const API_URL = 'http://localhost:8000';

export const shareChat = async (chatId) => {
  const token = localStorage.getItem('token');
  const res = await axios.post(
    `${API_URL}/chats/${chatId}/share`,
    {},
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return res.data;
};

export const getSharedChat = async (shareCode) => {
  const token = localStorage.getItem('token');
  const res = await axios.get(
    `${API_URL}/chats/shared/${shareCode}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return res.data;
};
