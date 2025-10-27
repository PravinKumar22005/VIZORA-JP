import axios from 'axios';
const API_URL = 'http://localhost:8000';

const dashboardApi = {
  // Upload a CSV/Excel file as a dashboard
  uploadDashboardFile: async (file) => {
    const token = localStorage.getItem('token');
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`${API_URL}/dashboard/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`
        // Do NOT set Content-Type; browser will set it for FormData
      },
      body: formData
    });
    if (!response.ok) {
      throw new Error('File upload failed');
    }
    return await response.json();
  },
  // Permanently delete a dashboard by ID
  deleteDashboard: async (dashboardId) => {
    const token = localStorage.getItem('token');
    const response = await axios.delete(`${API_URL}/dashboard/${dashboardId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  },

  // Create a new dashboard (session)
  createDashboard: async (dashboardJson, dashboardName) => {
    const token = localStorage.getItem('token');
    const response = await axios.post(
      `${API_URL}/dashboard`,
      { dashboard_json: dashboardJson, dashboard_name: dashboardName },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  },

  // Get all dashboards for the current user
  getMyDashboards: async () => {
    const token = localStorage.getItem('token');
    const response = await axios.get(`${API_URL}/dashboard`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  },

  // Get a single dashboard by ID
  getDashboard: async (dashboardId) => {
    const token = localStorage.getItem('token');
    const response = await axios.get(`${API_URL}/dashboard/${dashboardId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  },

  // Update a dashboard by ID
  updateDashboard: async (dashboardId, dashboardJson, dashboardName) => {
    const token = localStorage.getItem('token');
    const response = await axios.put(
      `${API_URL}/dashboard/${dashboardId}`,
      { dashboard_json: dashboardJson, dashboard_name: dashboardName },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  },


  // Soft delete a dashboard by ID (set is_active=0)
  softDeleteDashboard: async (dashboardId) => {
    const token = localStorage.getItem('token');
    const response = await axios.patch(
      `${API_URL}/dashboard/${dashboardId}`,
      { is_active: 0 },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  },

  // Restore a dashboard by ID (set is_active=1)
  restoreDashboard: async (dashboardId) => {
    const token = localStorage.getItem('token');
    const response = await axios.patch(
      `${API_URL}/dashboard/${dashboardId}`,
      { is_active: 1 },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  },

  // Share a dashboard
  shareDashboard: async (dashboardJson) => {
    const token = localStorage.getItem('token');
    const response = await axios.post(
      `${API_URL}/dashboard/share`,
      { dashboard_json: dashboardJson },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  },

  // Get a shared dashboard by code
  getSharedDashboard: async (code) => {
    const response = await axios.get(`${API_URL}/dashboard/shared/${code}`);
    return response.data;
  },

  // Get all dashboards shared by the current user
  getMySharedDashboards: async () => {
    const token = localStorage.getItem('token');
    const response = await axios.get(`${API_URL}/dashboard/my-shared`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  },

  // Delete a shared dashboard by code
  deleteSharedDashboard: async (code) => {
    const token = localStorage.getItem('token');
    const response = await axios.delete(`${API_URL}/dashboard/shared/${code}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  },

  // Log an activity
  logActivity: async (action, details) => {
    const token = localStorage.getItem('token');
    const response = await axios.post(
      `${API_URL}/dashboard/activity`,
      { action, details },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  },

  // Get activity logs for the current user
  getMyActivityLogs: async () => {
    const token = localStorage.getItem('token');
    const response = await axios.get(`${API_URL}/dashboard/activity`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  }

};

export { dashboardApi };
