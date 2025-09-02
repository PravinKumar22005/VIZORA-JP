import React from 'react';
import { AppBar, Toolbar, Typography, Button, IconButton } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { Settings, ExitToApp } from '@mui/icons-material';

const StyledAppBar = styled(AppBar)`
  background: linear-gradient(45deg, #FF4B2B 30%, #FF416C 90%);
`;

const Logo = styled(Typography)`
  flex-grow: 1;
  cursor: pointer;
`;

const Navbar = () => {
    const navigate = useNavigate();
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/');
    };

    const handleSettings = () => {
        navigate('/settings');
    };

    return (
        <StyledAppBar position="static">
            <Toolbar>
                <Logo variant="h6" onClick={() => navigate('/dashboard')}>
                    Vizora AI
                </Logo>
                <Typography variant="subtitle1" sx={{ mr: 2 }}>
                    Welcome, {user.name}
                </Typography>
                <IconButton color="inherit" onClick={handleSettings}>
                    <Settings />
                </IconButton>
                <Button 
                    color="inherit" 
                    onClick={handleLogout}
                    startIcon={<ExitToApp />}
                >
                    Logout
                </Button>
            </Toolbar>
        </StyledAppBar>
    );
};

export default Navbar;