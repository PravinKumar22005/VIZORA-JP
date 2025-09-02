import React, { useState } from 'react';
import styled, { keyframes, css } from 'styled-components';
import { TextField, Button, IconButton, CircularProgress } from '@mui/material';
import { Facebook, Google, LinkedIn } from '@mui/icons-material';
import { api } from '../../services/api';
import { useNavigate } from 'react-router-dom';

const slideRight = keyframes`
  from { transform: translateX(-100%); }
  to { transform: translateX(0); }
`;

const slideLeft = keyframes`
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
`;

const Container = styled.div`
  background: white;
  border-radius: 10px;
  box-shadow: 0 14px 28px rgba(0,0,0,0.25);
  position: relative;
  overflow: hidden;
  width: 768px;
  max-width: 100%;
  min-height: 480px;
  margin: 2rem auto;
`;

const FormContainer = styled.div`
  position: absolute;
  top: 0;
  height: 100%;
  transition: all 0.6s ease-in-out;
  width: 50%;
  z-index: 2;
  opacity: 1;
  left: ${props => props.signin ? '0' : '50%'};
  ${props => !props.signin ? css`
    animation: ${slideLeft} 0.6s forwards;
  ` : css`
    animation: ${slideRight} 0.6s forwards;
  `}
`;


const SocialContainer = styled.div`
  margin: 20px 0;
  display: flex;
  gap: 1rem;
`;

const Form = styled.form`
  background-color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  padding: 0 50px;
  height: 100%;
  text-align: center;
`;

const GradientOverlay = styled.div`
  background: linear-gradient(to right, #FF4B2B, #FF416C);
  color: white;
  position: absolute;
  width: 50%;
  height: 100%;
  overflow: hidden;
  transition: transform 0.6s ease-in-out;
  z-index: 100;
  left: ${props => props.signin ? '50%' : '0'};
`;

const ErrorMessage = styled.div`
  color: red;
  margin: 10px 0;
  font-size: 0.875rem;
`;

const LoadingWrapper = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const PageTitle = styled.h1`
  color: #FF4B2B;
  margin-bottom: 20px;
`;

const AuthPage = () => {
    const navigate = useNavigate();
    const [isSignIn, setIsSignIn] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [isAnimating, setIsAnimating] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: ''
    });
    const [error, setError] = useState('');

    const handleModeSwitch = () => {
        if (isLoading || isAnimating) return;
        setIsAnimating(true);
        setIsSignIn(!isSignIn);
        setTimeout(() => {
            setIsAnimating(false);
        }, 600);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (isAnimating) return;
        setError('');
        setIsLoading(true);
        
        try {
            if (isSignIn) {
                const response = await api.login({
                    email: formData.email,
                    password: formData.password
                });
                localStorage.setItem('token', response.access_token);
                localStorage.setItem('user', JSON.stringify(response.user));
                navigate('/settings');
            } else {
                await api.signup({
                    name: formData.name,
                    email: formData.email,
                    password: formData.password
                });
                setFormData({ name: '', email: '', password: '' });
                alert('Signup successful! Please login.');
                handleModeSwitch();
            }
        } catch (err) {
            console.error('Auth error:', err);
            setError(err.detail || 'An error occurred');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Container>
            <FormContainer signin={isSignIn}>
                <Form onSubmit={handleSubmit}>
                    <PageTitle>{isSignIn ? 'Sign In' : 'Create Account'}</PageTitle>
                    <SocialContainer>
                        <IconButton color="primary"><Facebook /></IconButton>
                        <IconButton color="error"><Google /></IconButton>
                        <IconButton color="primary"><LinkedIn /></IconButton>
                    </SocialContainer>
                    <span>or use your email</span>
                    {!isSignIn && (
                        <TextField 
                            fullWidth 
                            margin="normal" 
                            label="Name" 
                            value={formData.name}
                            onChange={(e) => setFormData({...formData, name: e.target.value})}
                            disabled={isLoading || isAnimating}
                        />
                    )}
                    <TextField 
                        fullWidth 
                        margin="normal" 
                        label="Email" 
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                        disabled={isLoading || isAnimating}
                    />
                    <TextField 
                        fullWidth 
                        margin="normal" 
                        label="Password" 
                        type="password" 
                        value={formData.password}
                        onChange={(e) => setFormData({...formData, password: e.target.value})}
                        disabled={isLoading || isAnimating}
                    />
                    {error && <ErrorMessage>{error}</ErrorMessage>}
                    <Button 
                        type="submit"
                        variant="contained" 
                        disabled={isLoading || isAnimating}
                        sx={{ 
                            mt: 3, 
                            background: 'linear-gradient(45deg, #FF4B2B 30%, #FF416C 90%)',
                            borderRadius: '20px',
                            padding: '10px 45px',
                            '&:hover': {
                                background: 'linear-gradient(45deg, #FF416C 30%, #FF4B2B 90%)',
                            }
                        }}
                    >
                        {isLoading ? (
                            <LoadingWrapper>
                                <CircularProgress size={20} color="inherit" />
                                Processing...
                            </LoadingWrapper>
                        ) : (
                            isSignIn ? 'Sign In' : 'Sign Up'
                        )}
                    </Button>
                </Form>
            </FormContainer>
            <GradientOverlay signin={isSignIn}>
                <div style={{ padding: '3rem', textAlign: 'center' }}>
                    <h1>{isSignIn ? 'Hello, Friend!' : 'Welcome Back!'}</h1>
                    <p>
                        {isSignIn 
                            ? 'Enter your personal details and start journey with us' 
                            : 'To keep connected with us please login with your personal info'
                        }
                    </p>
                    <Button 
                        variant="outlined" 
                        color="inherit"
                        onClick={handleModeSwitch}
                        disabled={isLoading || isAnimating}
                        sx={{ 
                            borderRadius: '20px', 
                            padding: '10px 45px',
                            '&:hover': {
                                backgroundColor: 'rgba(255, 255, 255, 0.1)'
                            }
                        }}
                    >
                        {isSignIn ? 'Sign Up' : 'Sign In'}
                    </Button>
                </div>
            </GradientOverlay>
        </Container>
    );
};

export default AuthPage;