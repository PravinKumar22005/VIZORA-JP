import React, { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import HomePage from './components/HomePage';
import Dashboard from './components/Dashboard/Dashboard';
import ChangePassword from './components/Auth/ChangePassword';
import WelcomeGuard from './components/Auth/WelcomeGuard';
import Chatbot from './components/Chatbot/Chatbot';

function App() {
  // Function to get initial user data from localStorage
  const getInitialUser = () => {
    try {
      const userString = localStorage.getItem('user');
      // The token is the most important part for authentication status
      if (userString && JSON.parse(userString).token) {
        return JSON.parse(userString);
      }
      return null;
    } catch {
      return null;
    }
  };

  const [userData, setUserData] = useState(getInitialUser);

  // This function will be called by AuthPage on successful login
  const handleLoginSuccess = (loginResponse) => {
    // The login API returns { user: {...}, access_token: '...' }
    // We combine them into one object for our state.
    const fullUserData = {
      ...loginResponse.user,
      token: loginResponse.access_token
    };
    localStorage.setItem('user', JSON.stringify(fullUserData));
    setUserData(fullUserData);
  };

  // This function will be passed to components with a logout button
  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token'); // Also remove the standalone token if it exists
    setUserData(null);
  };

  return (
    <Routes>
      {/* HomePage is now the entry point and handles showing the login modal */}
      <Route 
        path="/" 
        element={<HomePage onLoginSuccess={handleLoginSuccess} />} 
      />

      {/* Welcome route for new signups */}
      <Route 
        path="/welcome" 
        element={<WelcomeGuard />} 
      />

      {/* Protected Routes */}
      <Route 
        path="/dashboard" 
        element={userData ? <Dashboard userData={userData} onLogout={handleLogout} /> : <Navigate to="/" />} 
      />
      <Route 
        path="/chatbot" 
        element={userData ? <Chatbot userData={userData} onLogout={handleLogout} /> : <Navigate to="/" />} 
      />
      <Route 
        path="/change-password" 
        element={userData ? <ChangePassword /> : <Navigate to="/" />} 
      />

      {/* Add a catch-all to redirect to home if a route doesn't exist */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default App;