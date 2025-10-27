import React, { useState } from 'react';
import styled from 'styled-components';
import { TextField, Button, CircularProgress } from '@mui/material';
import { api } from '../../services/api';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';

const PageWrapper = styled.div`
  min-height: 100vh;
  background-color: #212121;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
`;

const Container = styled.div`
  background: #2a2a2a;
  border-radius: 10px;
  box-shadow: 0 14px 28px rgba(20, 255, 236, 0.15);
  width: 400px;
  max-width: 100%;
  padding: 2rem;
`;

const Title = styled.h1`
  color: #14FFEC;
  text-align: center;
  margin-bottom: 2rem;
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const ButtonContainer = styled.div`
  display: flex;
  gap: 1rem;
  margin-top: 1rem;
`;

const ChangePassword = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    old_password: '',
    new_password: '',
    confirm_password: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.new_password !== formData.confirm_password) {
      toast.error("New passwords don't match");
      return;
    }

    setIsLoading(true);
    try {
      const user = JSON.parse(localStorage.getItem('user'));
      await api.changePassword({
        email: user.email,
        old_password: formData.old_password,
        new_password: formData.new_password
      });
      toast.success('Password updated successfully');
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PageWrapper>
      <Container>
        <Title>Change Password</Title>
        <Form onSubmit={handleSubmit}>
          <TextField
            fullWidth
            type="password"
            label="Current Password"
            value={formData.old_password}
            onChange={(e) => setFormData({...formData, old_password: e.target.value})}
            disabled={isLoading}
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
            type="password"
            label="New Password"
            value={formData.new_password}
            onChange={(e) => setFormData({...formData, new_password: e.target.value})}
            disabled={isLoading}
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
            type="password"
            label="Confirm New Password"
            value={formData.confirm_password}
            onChange={(e) => setFormData({...formData, confirm_password: e.target.value})}
            disabled={isLoading}
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
          <ButtonContainer>
            <Button
              type="button"
              fullWidth
              variant="outlined"
              onClick={() => navigate('/dashboard')}
              disabled={isLoading}
              sx={{
                color: '#14FFEC',
                borderColor: '#14FFEC',
                '&:hover': {
                  borderColor: '#0D7377',
                  backgroundColor: 'rgba(20, 255, 236, 0.1)'
                }
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              fullWidth
              variant="contained"
              disabled={isLoading}
              sx={{
                background: 'linear-gradient(45deg, #0D7377 30%, #14FFEC 90%)',
                '&:hover': {
                  background: 'linear-gradient(45deg, #14FFEC 30%, #0D7377 90%)',
                }
              }}
            >
              {isLoading ? <CircularProgress size={24} color="inherit" /> : 'Update Password'}
            </Button>
          </ButtonContainer>
        </Form>
      </Container>
    </PageWrapper>
  );
};

export default ChangePassword;