import React from 'react';
import { Navigate } from 'react-router-dom';
import WelcomeVideo from './WelcomeVideo';

const WelcomeGuard = () => {
    const shouldPlayVideo = localStorage.getItem('playWelcomeVideo') === 'true';

    // If the flag is set, show the video.
    if (shouldPlayVideo) {
        return <WelcomeVideo />;
    } 
    
    // Otherwise, redirect to the dashboard.
    return <Navigate to="/dashboard" replace />;
};

export default WelcomeGuard;