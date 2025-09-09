import React, { useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';

const VideoWrapper = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: #000;
  z-index: 9999;
  display: flex;
  justify-content: center;
  align-items: center;
`;

const VideoPlayer = styled.video`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const SkipButton = styled.button`
  position: absolute;
  bottom: 40px;
  right: 40px;
  background-color: rgba(0, 0, 0, 0.5);
  color: white;
  border: 1px solid white;
  padding: 10px 20px;
  border-radius: 20px;
  cursor: pointer;
  font-size: 1rem;
  transition: all 0.3s ease;

  &:hover {
    background-color: rgba(255, 255, 255, 0.2);
  }
`;

const WelcomeVideo = () => {
  const navigate = useNavigate();
  const videoRef = useRef(null);

  const handleVideoEnd = useCallback(() => {
    localStorage.removeItem('playWelcomeVideo');
    navigate('/Chatbot');
  }, [navigate]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.play().catch(error => {
        console.error("Video autoplay was prevented:", error);
        handleVideoEnd();
      });
    }
  }, [handleVideoEnd]);

  return (
    <VideoWrapper>
      <VideoPlayer 
        ref={videoRef}
        src="/welcome.mp4" 
        playsInline
        onEnded={handleVideoEnd} 
      />
      <SkipButton onClick={handleVideoEnd}>
        Skip to Dashboard
      </SkipButton>
    </VideoWrapper>
  );
};

export default WelcomeVideo;