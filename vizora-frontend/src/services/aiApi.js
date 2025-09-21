import axios from 'axios';
const API_URL = 'http://localhost:8000';

export const aiApi = {
  ask: async (payload) => {
    const token = localStorage.getItem('token');
    const res = await axios.post(`${API_URL}/ai/ask`, payload, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return res.data; // expected { answer: string }
  }
};
