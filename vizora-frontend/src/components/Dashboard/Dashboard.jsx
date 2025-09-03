import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import logo from '../../assets/logo.jpg';
import styled from 'styled-components';
import { 
  IconButton, 
  Menu, 
  MenuItem, 
  ListItemIcon, 
  ListItemText,
  Avatar,
  Divider,
  CircularProgress
} from '@mui/material';
import {
  Settings,
  Lock,
  Logout,
  Person
} from '@mui/icons-material';
import { toast } from 'react-toastify';

const DashboardWrapper = styled.div`
  min-height: 100vh;
  background-color: #212121;
  color: #E0E0E0;
`;

const Header = styled.header`
  background: #000000;
  backdrop-filter: blur(8px);
  border-bottom: 1px solid rgba(20, 255, 236, 0.1);
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
`;

const HeaderContent = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 1rem 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const Logo = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: #14FFEC;
  font-size: 1.5rem;
  font-weight: bold;
  cursor: pointer;
  &:hover {
    text-shadow: 0 0 10px rgba(20, 255, 236, 0.5);
  }
`;

// This is the corrected UserSection style
const UserSection = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
`;

const UserName = styled.span`
  color: #E0E0E0;
  font-weight: 500;
`;

const StyledMenu = styled(Menu)`
  .MuiPaper-root {
    background-color: #2a2a2a;
    border: 1px solid rgba(20, 255, 236, 0.1);
    min-width: 200px;
    
    .MuiMenuItem-root {
      color: #E0E0E0;
      
      &:hover {
        background-color: rgba(20, 255, 236, 0.1);
      }
      
      .MuiListItemIcon-root {
        color: #14FFEC;
      }
    }
  }
`;

const MainContent = styled.main`
  max-width: 1200px;
  margin: 0 auto;
  padding: 6rem 2rem 2rem;
`;

const Dashboard = () => {
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userData, setUserData] = useState(null);

  useEffect(() => {
    const loadUserData = async () => {
      try {
        await new Promise(resolve => setTimeout(resolve, 1000));
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

  const handleProfileMenu = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleCloseMenu = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    handleCloseMenu();
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    toast.success('Logged out successfully');
    navigate('/');
  };

  const handleChangePassword = () => {
    handleCloseMenu();
    navigate('/change-password');
  };

  const handleProfile = () => {
    handleCloseMenu();
    toast.info('Profile page coming soon');
  };

  const handleSettings = () => {
    handleCloseMenu();
    toast.info('Settings page coming soon');
  };

  if (isLoading) {
    return (
      <DashboardWrapper>
        <div style={{ 
          height: '100vh', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center' 
        }}>
          <CircularProgress sx={{ color: '#14FFEC' }} />
        </div>
      </DashboardWrapper>
    );
  }

  return (
    <DashboardWrapper>
      <Header>
        <HeaderContent>
          {/* This is the corrected Logo section */}
          <Logo onClick={() => navigate('/dashboard')}>
            <img src={logo} alt="Vizora Logo" style={{ height: '32px' }} />
            <span>Vizora</span>
          </Logo>
          <UserSection>
            <UserName>{userData?.name || 'User'}</UserName>
            <IconButton onClick={handleProfileMenu}>
              <Avatar 
                sx={{ 
                  bgcolor: '#0D7377',
                  color: '#14FFEC',
                  width: 35,
                  height: 35,
                  fontSize: '1rem',
                  border: '2px solid #14FFEC'
                }}
              >
                {(userData?.name?.[0] || 'U').toUpperCase()}
              </Avatar>
            </IconButton>

            <StyledMenu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleCloseMenu}
              anchorOrigin={{
                vertical: 'bottom',
                horizontal: 'right',
              }}
              transformOrigin={{
                vertical: 'top',
                horizontal: 'right',
              }}
            >
              <MenuItem onClick={handleProfile}>
                <ListItemIcon>
                  <Person fontSize="small" />
                </ListItemIcon>
                <ListItemText>Profile</ListItemText>
              </MenuItem>
              <MenuItem onClick={handleSettings}>
                <ListItemIcon>
                  <Settings fontSize="small" />
                </ListItemIcon>
                <ListItemText>Settings</ListItemText>
              </MenuItem>
              <MenuItem onClick={handleChangePassword}>
                <ListItemIcon>
                  <Lock fontSize="small" />
                </ListItemIcon>
                <ListItemText>Change Password</ListItemText>
              </MenuItem>
              <Divider sx={{ borderColor: 'rgba(20, 255, 236, 0.1)' }} />
              <MenuItem onClick={handleLogout}>
                <ListItemIcon>
                  <Logout fontSize="small" />
                </ListItemIcon>
                <ListItemText>Logout</ListItemText>
              </MenuItem>
            </StyledMenu>
          </UserSection>
        </HeaderContent>
      </Header>

      <MainContent>
        <h2 style={{ 
          fontSize: '2rem', 
          marginBottom: '2rem',
          color: '#14FFEC' 
        }}>
          Dashboard
        </h2>
        {/* Add your dashboard content here */}
      </MainContent>
    </DashboardWrapper>
  );
};

export default Dashboard;