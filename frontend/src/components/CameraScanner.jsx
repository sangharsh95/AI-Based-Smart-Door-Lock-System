import React, { useEffect, useRef, useState } from 'react';
import * as faceapi from 'face-api.js';
import axios from 'axios';
import RegistrationFlow from './RegistrationFlow';

export default function CameraScanner() {
  const videoRef = useRef();
  const [status, setStatus] = useState("Loading AI Models...");
  const [borderColor, setBorderColor] = useState('border-white/50');
  const [mode, setMode] = useState('scan');
  const [showOtp, setShowOtp] = useState(false);
  const [otpInput, setOtpInput] = useState("");
  
  const isProcessing = useRef(false);
  const modeRef = useRef('scan');
  const streamRef = useRef(null);
  const intervalRef = useRef(null);

  const speak = (text) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  };

  const sessionRef = useRef({
    active: false,
    user_id: null,
    user_name: '',
    confidence: 0,
    eyesClosedOnce: false,
    panicMode: false,
    waitingForOtp: false
  });

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    const loadModels = async () => {
      try {
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri('/models'),
          faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
          faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
          faceapi.nets.faceExpressionNet.loadFromUri('/models')
        ]);
        setStatus("Starting Camera...");
        startVideo();
      } catch (e) {
        setStatus("Error loading models.");
        console.error(e);
      }
    };
    
    loadModels();

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startVideo = () => {
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } })
      .then((stream) => {
        streamRef.current = stream;
        let video = videoRef.current;
        video.srcObject = stream;
        video.play();
        setStatus('Scanning for faces...\n(Please remove masks or sunglasses)');
      })
      .catch((err) => {
        console.error(err);
        setStatus("Camera Error: " + err.message);
      });
  };

  const calculateEAR = (eye) => {
    const dist = (p1, p2) => Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
    const p1_p4 = dist(eye[0], eye[3]);
    const p2_p6 = dist(eye[1], eye[5]);
    const p3_p5 = dist(eye[2], eye[4]);
    return (p2_p6 + p3_p5) / (2.0 * p1_p4);
  };

  const handleVideoPlay = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    intervalRef.current = setInterval(async () => {
      if (isProcessing.current || modeRef.current !== 'scan' || sessionRef.current.waitingForOtp) return;
      
      const video = videoRef.current;
      if (!video || video.videoWidth === 0) return;

      isProcessing.current = true;

      try {
        const detection = await faceapi.detectSingleFace(video)
          .withFaceLandmarks()
          .withFaceExpressions()
          .withFaceDescriptor();
        
        if (detection) {
          if (detection.expressions.fearful > 0.6 || detection.expressions.angry > 0.6) {
            sessionRef.current.panicMode = true;
          }

          if (sessionRef.current.active && !sessionRef.current.waitingForOtp) {
            const landmarks = detection.landmarks.positions;
            const leftEye = landmarks.slice(36, 42);
            const rightEye = landmarks.slice(42, 48);
            
            const leftEAR = calculateEAR(leftEye);
            const rightEAR = calculateEAR(rightEye);
            const avgEAR = (leftEAR + rightEAR) / 2.0;

            if (avgEAR < 0.27) {
              sessionRef.current.eyesClosedOnce = true;
              setStatus(`Eyes Closed! Now open them...`);
            } else if (avgEAR >= 0.27 && sessionRef.current.eyesClosedOnce) {
              clearInterval(intervalRef.current);
              
              if (sessionRef.current.panicMode) {
                await axios.post('http://localhost:5000/api/verify/unlock', {
                  user_id: sessionRef.current.user_id,
                  confidence: sessionRef.current.confidence,
                  panic: true
                });
                setBorderColor('border-green-500');
                setStatus(`ACCESS GRANTED\n(System secretly alarmed)`);
                speak('Access granted. Welcome back.');
                setTimeout(() => fullReset(), 4000);
                return;
              }

              await axios.post('http://localhost:5000/api/verify/init-otp', {
                user_id: sessionRef.current.user_id
              });
              
              sessionRef.current.waitingForOtp = true;
              setShowOtp(true);
              setStatus(`OTP sent to registered email/phone.`);
              speak('Blink verified. Please enter the two factor authentication code.');
              return;
            } else {
              setStatus(`Hi ${sessionRef.current.user_name}!\nPlease CLOSE YOUR EYES for 1 second to prove you are real.`);
            }
            
            isProcessing.current = false;
            return;
          }

          if (!sessionRef.current.active) {
            const descriptor = Array.from(detection.descriptor);
            const response = await axios.post('http://localhost:5000/api/verify', {
              embedding: descriptor
            });
            
            const result = response.data;
            
            if (result.access === "Granted") {
              setBorderColor('border-blue-400');
              setStatus(`Hi ${result.user_name}!\nPlease CLOSE YOUR EYES for 1 second to prove you are real.`);
              speak(`Hello ${result.user_name}, please close your eyes for one second to verify liveness.`);
              sessionRef.current = {
                active: true,
                user_id: result.user_id,
                user_name: result.user_name,
                confidence: result.confidence,
                eyesClosedOnce: false,
                panicMode: sessionRef.current.panicMode,
                waitingForOtp: false
              };
            } else if (result.access.includes("Denied")) {
              setBorderColor('border-red-500');
              if (result.access === "Denied - Unknown") {
                setStatus("Face not recognized.");
                speak('Warning. Face not recognized. Please register.');
                setMode('register');
              } else if (result.access === "Denied - Unapproved") {
                setStatus(`Hi ${result.user_name}, please wait until approval.`);
                speak(`Hello ${result.user_name}, your account is pending admin approval.`);
                setTimeout(() => fullReset(), 3000);
              } else if (result.access === "Denied - Expired") {
                setStatus(`SESSION EXPIRED: ${result.user_name}`);
                speak('Access denied. Your schedule has expired.');
                setTimeout(() => fullReset(), 3000);
              } else {
                setStatus(result.access);
                setTimeout(() => fullReset(), 3000);
              }
            }
          }
        } else {
          if (sessionRef.current.active && !sessionRef.current.waitingForOtp) {
            setStatus("Face lost. Please stay in frame.");
            sessionRef.current.active = false;
            sessionRef.current.eyesClosedOnce = false;
            setBorderColor('border-white/50');
          }
        }
        isProcessing.current = false;
      } catch (err) {
        console.error(err);
        isProcessing.current = false;
      }
    }, 400); 
  };

  const handleOtpSubmit = async () => {
    try {
      const res = await axios.post('http://localhost:5000/api/verify/unlock', {
        user_id: sessionRef.current.user_id,
        confidence: sessionRef.current.confidence,
        otp: otpInput
      });

      if (res.data.success) {
        setShowOtp(false);
        setBorderColor('border-green-500');
        setStatus(`ACCESS GRANTED!\nWelcome back, ${sessionRef.current.user_name}`);
        speak(`Access granted. Welcome back ${sessionRef.current.user_name}.`);
        setTimeout(() => fullReset(), 4000);
      } else {
        alert(res.data.error);
        speak('Invalid authentication code.');
      }
    } catch (e) {
      alert("Verification failed.");
    }
  };

  const fullReset = () => {
    setShowOtp(false);
    setOtpInput("");
    setBorderColor('border-white/50');
    setStatus('Scanning for faces...\n(Please remove masks or sunglasses)');
    sessionRef.current = { active: false, panicMode: false, waitingForOtp: false };
    isProcessing.current = false;
    handleVideoPlay();
  };

  return (
    <div className="flex flex-col items-center justify-center py-10 px-4 relative">
      <div className="text-center mb-6">
        <h2 className="text-3xl font-bold text-white mb-2">SmartLock</h2>
        <p className="text-blue-400 whitespace-pre-wrap font-mono">{status}</p>
      </div>

      <div className={`relative w-[320px] h-[320px] rounded-full overflow-hidden border-8 ${borderColor} shadow-[0_0_50px_rgba(59,130,246,0.3)] transition-colors duration-500`}>
        <video 
          ref={videoRef} 
          onPlay={handleVideoPlay} 
          autoPlay 
          playsInline 
          muted 
          className="absolute top-1/2 left-1/2 min-w-full min-h-full w-auto h-auto -translate-x-1/2 -translate-y-1/2 object-cover transform scale-x-[-1]" 
        />
        {sessionRef.current.panicMode && !showOtp && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-red-600 text-white text-[10px] px-2 py-1 rounded font-bold animate-pulse">
            THREAT DETECTED
          </div>
        )}
      </div>

      {showOtp && (
        <div className="absolute inset-0 bg-slate-900/95 flex flex-col items-center justify-center z-10 animate-in fade-in">
          <h3 className="text-xl font-bold mb-2">2-Factor Authentication</h3>
          <p className="text-sm text-slate-400 mb-6 text-center">Enter the 6-digit code sent to your device<br/>(Check the Backend Terminal for Demo)</p>
          <input 
            type="text" 
            maxLength="6"
            className="text-center text-3xl tracking-widest p-4 bg-slate-800 border-2 border-blue-500 rounded-xl mb-4 w-64 text-white font-mono"
            value={otpInput}
            onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
          />
          <div className="flex space-x-4">
            <button onClick={fullReset} className="px-6 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg font-bold">Cancel</button>
            <button onClick={handleOtpSubmit} className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold">Verify & Unlock</button>
          </div>
        </div>
      )}

      {mode === 'register' && (
        <div className="absolute inset-0 bg-slate-900/80 z-20 flex flex-col items-center justify-end pb-10 backdrop-blur-sm">
          <RegistrationFlow 
            videoRef={videoRef} 
            onCancel={() => {
              setMode('scan');
              fullReset();
            }} 
          />
        </div>
      )}
    </div>
  );
}


