import axios from 'axios';
const API_URL = 'http://localhost:8000';

export const tableQueryApi = {
  run: async ({ sql, file_ids }) => {
    const token = localStorage.getItem('token');
    const payload = { sql };
    if (file_ids && file_ids.length === 1) {
      payload.file_id = file_ids[0];
    } else if (file_ids && file_ids.length > 1) {
      payload.file_ids = file_ids; // backend expects either file_id or file_ids
    }
    const res = await axios.post(`${API_URL}/table/query`, payload, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return res.data; // expects { columns: [], rows: [] }
  }
};
