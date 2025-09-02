import axios from 'axios';

const API_URL = 'http://localhost:8000';

export const api = {
    login: async (credentials) => {
        try {
            const response = await axios.post(`${API_URL}/login`, credentials);
            console.log('Login response:', response.data);
            return response.data;
        } catch (error) {
            console.error('Login error:', error.response?.data || error);
            throw error.response?.data || { detail: 'Network error' };
        }
    },
    
    signup: async (userData) => {
        try {
            const response = await axios.post(`${API_URL}/signup`, userData);
            console.log('Signup response:', response.data);
            return response.data;
        } catch (error) {
            console.error('Signup error:', error.response?.data || error);
            throw error.response?.data || { detail: 'Network error' };
        }
    },

    changePassword: async (passwordData) => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.post(
                `${API_URL}/change-password`,
                passwordData,
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            );
            console.log('Change password response:', response.data);
            return response.data;
        } catch (error) {
            console.error('Change password error:', error.response?.data || error);
            throw error.response?.data || { detail: 'Network error' };
        }
    }
};