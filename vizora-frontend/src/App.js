import { Routes, Route } from 'react-router-dom';
import HomePage from './components/HomePage';
import Dashboard from './components/Dashboard/Dashboard';
import ChangePassword from './components/Auth/ChangePassword';
import ProtectedRoute from './components/ProtectedRoute';
import WelcomeGuard from './components/Auth/WelcomeGuard'; // Import the new guard
import Chatbot from './components/Chatbot/Chatbot';
function App() {
  // const shouldPlayVideo = localStorage.getItem('playWelcomeVideo') === 'true'; // This line is removed

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      
      {/* Use the new WelcomeGuard component for the /welcome route */}
      <Route 
        path="/welcome" 
        element={<WelcomeGuard />} 
      />

      <Route 
        path="/dashboard" 
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/Chatbot" 
        element={
          <ProtectedRoute>
            <Chatbot />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/change-password" 
        element={
          <ProtectedRoute>
            <ChangePassword />
          </ProtectedRoute>
        } 
      />
    </Routes>
  );
}

export default App;