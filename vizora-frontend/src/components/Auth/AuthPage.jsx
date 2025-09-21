import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import styled, { keyframes, css } from 'styled-components';
import { TextField, Button, CircularProgress } from '@mui/material';
import { api } from '../../services/api';
import { useNavigate } from 'react-router-dom';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const slideRight = keyframes`
  from { transform: translateX(-100%); }
  to { transform: translateX(0); }
`;

const slideLeft = keyframes`
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
`;

const PageWrapper = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  display: flex;
  align-items: center; /* Centers vertically */
  justify-content: center; /* Centers horizontally */
  z-index: 1000;
`;

// --- FIX START ---
// Removed 'position: relative;' to allow PageWrapper's flexbox centering to work on this element.
// The absolute children will now position relative to the PageWrapper's dimensions,
// or we can make this 'Container' the positioning context if needed, but not necessary for centering itself.
// However, it's better to keep it as positioning context for its absolutely positioned children.
// The issue was more subtle: the 'min-height' and 'width' on 'Container' were making it act like
// a fixed-size block, but its internal elements were absolutely positioned relative to it.
// To center the 'Container' itself, it just needs to be a standard flex item.
const Container = styled.div`
  background: #212121;
  border-radius: 10px;
  box-shadow: 0 14px 28px rgba(20, 255, 236, 0.15);
  position: absolute; /* Changed from relative */
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%); /* This will perfectly center the Container */
  /* Keep other styles for Container */
  background: #212121;
  border-radius: 10px;
  box-shadow: 0 14px 28px rgba(20, 255, 236, 0.15);
  overflow: hidden;
  width: 768px;
  max-width: 95vw;
  min-height: 480px;
  margin: 0;
  padding: 0;
`;
// --- FIX END ---

const FormContainer = styled.div`
  /* These are already absolute and will now position relative to the new absolutely positioned Container */
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

const Form = styled.form`
  background-color: #212121;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  padding: 0 50px;
  height: 100%;
  text-align: center;
  color: #E0E0E0;
`;

const GradientOverlay = styled.div`
  /* These are already absolute and will now position relative to the new absolutely positioned Container */
  background: linear-gradient(to right, #0D7377, #14FFEC);
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
  color: #14FFEC;
  margin-bottom: 20px;
`;

const CloseButton = styled.button`
  position: absolute;
  top: 15px;
  right: 20px;
  background: none;
  border: none;
  color: #aaa;
  font-size: 2rem;
  cursor: pointer;
  z-index: 1001;
  transition: color 0.3s;
  &:hover {
    color: white;
  }
`;

const AuthPage = ({ onClose, onLoginSuccess }) => {
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
  const [validationErrors, setValidationErrors] = useState({
    name: '',
    email: '',
    password: ''
  });

  const handleModeSwitch = () => {
    if (isLoading || isAnimating) return;
    setIsAnimating(true);
    setIsSignIn(!isSignIn);
    setFormData({ name: '', email: '', password: '' });
    setError('');
    setValidationErrors({ name: '', email: '', password: '' });
    setTimeout(() => {
      setIsAnimating(false);
    }, 600);
  };

  const validateForm = () => {
    const errors = {};
    if (!isSignIn && !formData.name?.trim()) {
      errors.name = 'Name is required';
    }
    if (!formData.email?.trim()) {
      errors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S/.test(formData.email)) {
      errors.email = 'Invalid email format';
    }
    if (!formData.password) {
      errors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isAnimating || !validateForm()) return;

    setError('');
    setIsLoading(true);

    try {
      if (isSignIn) {
        const response = await api.login({
          email: formData.email,
          password: formData.password
        });
        onLoginSuccess(response);
        toast.success('Successfully logged in!');
        setTimeout(() => navigate('/chatbot'), 100); 
      } else {
        const response = await api.signup({
          name: formData.name,
          email: formData.email,
          password: formData.password
        });
        onLoginSuccess(response);
        localStorage.setItem('playWelcomeVideo', 'true');
        toast.success('Account created successfully!');
        setTimeout(() => navigate('/welcome'), 100);
      }
    } catch (err) {
      console.error('Auth error:', err);
      const errorMessage = err.response?.data?.message || err.message || 'An error occurred';
      toast.error(errorMessage);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return ReactDOM.createPortal(
    <PageWrapper onClick={onClose}>
      <Container onClick={(e) => e.stopPropagation()}>
        <CloseButton onClick={onClose}>&times;</CloseButton>
        <FormContainer $signin={isSignIn}>
          <Form onSubmit={handleSubmit}>
            <PageTitle>{isSignIn ? 'Sign In' : 'Create Account'}</PageTitle>

            {!isSignIn && (
              <TextField
                fullWidth
                margin="normal"
                label="Name"
                value={formData.name}
                error={!!validationErrors.name}
                helperText={validationErrors.name}
                onChange={(e) => {
                  setFormData({ ...formData, name: e.target.value });
                  setValidationErrors({ ...validationErrors, name: '' });
                }}
                disabled={isLoading || isAnimating}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: '#E0E0E0',
                    '& fieldset': { borderColor: '#0D7377' },
                    '&:hover fieldset': { borderColor: '#14FFEC' },
                    '&.Mui-focused fieldset': { borderColor: '#14FFEC' }
                  },
                  '& .MuiInputLabel-root': {
                    color: '#0D7377',
                    '&.Mui-focused': { color: '#14FFEC' }
                  }
                }}
              />
            )}

            <TextField
              fullWidth
              margin="normal"
              label="Email"
              type="email"
              value={formData.email}
              error={!!validationErrors.email}
              helperText={validationErrors.email}
              onChange={(e) => {
                setFormData({ ...formData, email: e.target.value });
                setValidationErrors({ ...validationErrors, email: '' });
              }}
              disabled={isLoading || isAnimating}
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: '#E0E0E0',
                  '& fieldset': { borderColor: '#0D7377' },
                  '&:hover fieldset': { borderColor: '#14FFEC' },
                  '&.Mui-focused fieldset': { borderColor: '#14FFEC' }
                },
                '& .MuiInputLabel-root': {
                  color: '#0D7377',
                  '&.Mui-focused': { color: '#14FFEC' }
                }
              }}
            />

            <TextField
              fullWidth
              margin="normal"
              label="Password"
              type="password"
              value={formData.password}
              error={!!validationErrors.password}
              helperText={validationErrors.password}
              onChange={(e) => {
                setFormData({ ...formData, password: e.target.value });
                setValidationErrors({ ...validationErrors, password: '' });
              }}
              disabled={isLoading || isAnimating}
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: '#E0E0E0',
                  '& fieldset': { borderColor: '#0D7377' },
                  '&:hover fieldset': { borderColor: '#14FFEC' },
                  '&.Mui-focused fieldset': { borderColor: '#14FFEC' }
                },
                '& .MuiInputLabel-root': {
                  color: '#0D7377',
                  '&.Mui-focused': { color: '#14FFEC' }
                }
              }}
            />

            {error && <ErrorMessage>{error}</ErrorMessage>}

            <Button
              type="submit"
              fullWidth
              variant="contained"
              disabled={isLoading || isAnimating}
              sx={{
                mt: 3,
                background: 'linear-gradient(45deg, #0D7377 30%, #14FFEC 90%)',
                borderRadius: '20px',
                padding: '10px 45px',
                '&:hover': {
                  background: 'linear-gradient(45deg, #14FFEC 30%, #0D7377 90%)',
                }
              }}
            >
              {isLoading ? (
                <LoadingWrapper>
                  <CircularProgress size={20} color="inherit" />
                  <span>Processing...</span>
                </LoadingWrapper>
              ) : (
                isSignIn ? 'Sign In' : 'Sign Up'
              )}
            </Button>
          </Form>
        </FormContainer>

        <GradientOverlay $signin={isSignIn}>
          <div style={{ 
            padding: '3rem', 
            textAlign: 'center',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            <h1 style={{ 
              fontSize: '2rem', 
              marginBottom: '1rem',
              color: 'white'
            }}>
              {isSignIn ? 'Hello, Friend!' : 'Welcome Back!'}
            </h1>
            <p style={{ 
              color: 'white',
              marginBottom: '2rem',
              maxWidth: '80%',
              lineHeight: '1.5'
            }}>
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
                borderColor: 'white',
                color: 'white',
                borderRadius: '20px',
                padding: '10px 45px',
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  borderColor: 'white'
                }
              }}
            >
              {isSignIn ? 'Sign Up' : 'Sign In'}
            </Button>
          </div>
        </GradientOverlay>
      </Container>

      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="dark"
      />
    </PageWrapper>,
    document.getElementById('modal-root')
  );
};

export default AuthPage;