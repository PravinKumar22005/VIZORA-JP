import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import {
  CircularProgress,
  Avatar,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
} from '@mui/material';
import { Settings, Lock, Logout, Person } from '@mui/icons-material';
import { toast } from 'react-toastify';

const DashboardWrapper = styled.div`
  min-height: 100vh;
  background-color: #212121;
  color: #e0e0e0;
`;

const Navbar = styled.nav`
  background-color: #212121;
  color: #14ffec;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 2rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
`;

const NavItem = styled.button`
  background: none;
  border: none;
  color: #14ffec;
  font-size: 1rem;
  cursor: pointer;
  margin: 0 1rem;
  transition: color 0.3s ease;

  &:hover {
    color: #0d7377;
  }
`;

const NavItems = styled.div`
  display: flex;
  gap: 1rem;
`;

const MainContent = styled.main`
  max-width: 1200px;
  margin: 0 auto;
  padding: 6rem 2rem 2rem;
`;

const Dashboard = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [userData, setUserData] = useState(null);

  useEffect(() => {
    const loadUserData = async () => {
      try {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        setUserData(user);
      } catch (error) {
        console.error('Failed to load user data:', error);
        toast.error('Failed to load user data');
      } finally {
        setIsLoading(false);
      }
    };

    loadUserData();
  }, []);

  const handleNavigation = (path) => {
    navigate(path);
  };

  if (isLoading) {
    return (
      <DashboardWrapper>
        <div
          style={{
            height: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <CircularProgress sx={{ color: '#14FFEC' }} />
        </div>
      </DashboardWrapper>
    );
  }

  return (
    <DashboardWrapper>
      {/* Navbar */}
      <Navbar>
        <h1 style={{ color: '#14FFEC', fontSize: '1.5rem' }}>Vizora AI</h1>
        <NavItems>
          <NavItem onClick={() => handleNavigation('/')}>Home</NavItem>
          <NavItem onClick={() => handleNavigation('/chatbot')}>Chatbot</NavItem>
          <NavItem onClick={() => handleNavigation('/dashboard')}>Dashboard</NavItem>
        </NavItems>
      </Navbar>

      {/* Main Content */}
      <MainContent>
        <h2
          style={{
            fontSize: '2rem',
            marginBottom: '2rem',
            color: '#14FFEC',
          }}
        >
          Dashboard
        </h2>
        {/* Add your dashboard content here */}
        <p>Welcome, {userData?.name || 'User'}!</p>
      </MainContent>
    </DashboardWrapper>
  );
};

export default Dashboard;