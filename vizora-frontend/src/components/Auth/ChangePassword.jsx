import React, { useState } from 'react';
import styled from 'styled-components';
import { TextField, Button } from '@mui/material';
import { api } from '../../services/api';
import { useNavigate } from 'react-router-dom';
import Navbar from '../Layout/Navbar';

const Container = styled.div`
  width: 100%;
  max-width: 400px;
  margin: 2rem auto;
  padding: 2rem;
  background: white;
  border-radius: 10px;
  box-shadow: 0 14px 28px rgba(0,0,0,0.25);
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const Title = styled.h1`
  color: #FF4B2B;
  text-align: center;
  margin-bottom: 2rem;
`;

const ErrorMessage = styled.div`
  color: red;
  text-align: center;
  margin: 10px 0;
`;

const ChangePassword = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        old_password: '',
        new_password: ''
    });
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        try {
            const user = JSON.parse(localStorage.getItem('user'));
            await api.changePassword({
                email: user.email,
                old_password: formData.old_password,
                new_password: formData.new_password
            });
            alert('Password updated successfully');
            navigate('/');
        } catch (err) {
            setError(err.detail || 'An error occurred');
        }
    };

    return (
        <>
        <Navbar />
        <Container>
            <Title>Change Password</Title>
            <Form onSubmit={handleSubmit}>
                <TextField
                    fullWidth
                    type="password"
                    label="Current Password"
                    value={formData.old_password}
                    onChange={(e) => setFormData({...formData, old_password: e.target.value})}
                />
                <TextField
                    fullWidth
                    type="password"
                    label="New Password"
                    value={formData.new_password}
                    onChange={(e) => setFormData({...formData, new_password: e.target.value})}
                />
                {error && <ErrorMessage>{error}</ErrorMessage>}
                <Button
                    type="submit"
                    variant="contained"
                    sx={{
                        background: 'linear-gradient(45deg, #FF4B2B 30%, #FF416C 90%)',
                        borderRadius: '20px',
                        padding: '10px 45px'
                    }}
                >
                    Update Password
                </Button>
            </Form>
        </Container>
        </>
    );
};

export default ChangePassword;