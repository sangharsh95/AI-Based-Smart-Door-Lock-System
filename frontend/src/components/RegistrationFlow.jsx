import React, { useState } from 'react';
import * as faceapi from 'face-api.js';
import axios from 'axios';

const angles = [
  { name: "Front", msg: "Look STRAIGHT at the camera" },
  { name: "Left_30", msg: "Turn head SLIGHTLY LEFT" },
  { name: "Left_60", msg: "Turn head MORE LEFT" },
  { name: "Right_30", msg: "Turn head SLIGHTLY RIGHT" },
  { name: "Right_60", msg: "Turn head MORE RIGHT" },
  { name: "Up", msg: "Look SLIGHTLY UP" },
  { name: "Down", msg: "Look SLIGHTLY DOWN" }
];

export default function RegistrationFlow({ videoRef, onCancel }) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({ name: '', mobile: '', email: '', address: '', purpose: '' });
  const [scanState, setScanState] = useState({ index: 0, text: '', tracking: '' });

  const startGuidedScan = async () => {
    if (!formData.name || !formData.mobile || !formData.email) return alert('Name, mobile, and email are required.');
    if (!/^\d{10}$/.test(formData.mobile)) return alert('Mobile number must be exactly 10 digits.');
    if (!formData.email.endsWith('@gmail.com')) return alert('Email must be a valid @gmail.com address.');
    setStep(2);
    
    let capturedBlobs = {};
    let masterEmbedding = null;
    let masterProfile = null;

    const video = videoRef.current;
    
    for (let i = 0; i < angles.length; i++) {
      const angle = angles[i];
      setScanState({ index: i, text: angle.msg, tracking: 'Please hold this position...' });
      
      // Wait 1.5 seconds to allow user to move their head
      await new Promise(r => setTimeout(r, 1500));
      
      // Try to capture face
      const blob = await captureFace(video, (trackMsg) => setScanState(prev => ({...prev, tracking: trackMsg})));
      if (blob) {
        capturedBlobs[angle.name] = blob.b64;
        
        if (angle.name === "Front") {
          masterEmbedding = Array.from(blob.descriptor);
          masterProfile = blob.b64;
        }
      } else {
        // If face lost, retry once
        setScanState(prev => ({...prev, tracking: 'Face lost! Retrying...'}));
        await new Promise(r => setTimeout(r, 1000));
        const retryBlob = await captureFace(video, () => {});
        if (retryBlob) {
          capturedBlobs[angle.name] = retryBlob.b64;
          if (angle.name === "Front") {
            masterEmbedding = Array.from(retryBlob.descriptor);
            masterProfile = retryBlob.b64;
          }
        }
      }
    }
    
    setScanState({ index: angles.length, text: "Processing...", tracking: "Uploading data to Server..." });
    
    try {
      if (!masterEmbedding) {
        alert("Registration failed! We could not detect your face clearly. Please remove any masks or sunglasses and try again.");
        onCancel();
        return;
      }

      await axios.post('http://localhost:5000/api/users/register', {
        ...formData,
        embeddings: masterEmbedding || [],
        images_json: JSON.stringify(capturedBlobs),
        profile_image: masterProfile || Object.values(capturedBlobs)[0] || ""
      });
      alert("Registration submitted! Wait for admin approval.");
      onCancel();
    } catch (err) {
      alert("Error: " + err.message);
      onCancel();
    }
  };

  const captureFace = (video, onTrack) => {
    return new Promise((resolve) => {
      let attempts = 0;
      const interval = setInterval(async () => {
        attempts++;
        if (attempts > 5) {
          clearInterval(interval);
          resolve(null); // Timeout
          return;
        }
        
        const detection = await faceapi.detectSingleFace(video, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.80 })).withFaceLandmarks().withFaceDescriptor();
        if (detection) {
          clearInterval(interval);
          
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          canvas.getContext('2d').drawImage(video, 0, 0);
          const b64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
          
          onTrack("Captured!");
          resolve({ b64, descriptor: detection.descriptor });
        } else {
          onTrack("No face detected, bring face into frame...");
        }
      }, 300);
    });
  };

  if (step === 1) {
    return (
      <div className="mt-8 bg-slate-800 p-6 rounded-xl border border-slate-700 w-full max-w-md animate-in fade-in slide-in-from-bottom-10">
        <h3 className="text-xl font-bold mb-4 text-center">New User Registration</h3>
        <input className="w-full mb-3 p-2 bg-slate-900 border border-slate-700 rounded" placeholder="Full Name" onChange={e => setFormData({...formData, name: e.target.value})} />
        <input className="w-full mb-3 p-2 bg-slate-900 border border-slate-700 rounded" placeholder="Mobile Number" onChange={e => setFormData({...formData, mobile: e.target.value})} />
        <input className="w-full mb-3 p-2 bg-slate-900 border border-slate-700 rounded" placeholder="Email (@gmail.com)" onChange={e => setFormData({...formData, email: e.target.value})} />
        <input className="w-full mb-3 p-2 bg-slate-900 border border-slate-700 rounded" placeholder="Address" onChange={e => setFormData({...formData, address: e.target.value})} />
        <input className="w-full mb-4 p-2 bg-slate-900 border border-slate-700 rounded" placeholder="Purpose of Visit" onChange={e => setFormData({...formData, purpose: e.target.value})} />
        <div className="flex space-x-3">
          <button className="flex-1 p-2 bg-slate-700 hover:bg-slate-600 rounded" onClick={onCancel}>Cancel</button>
          <button className="flex-1 p-2 bg-blue-600 hover:bg-blue-500 rounded font-bold" onClick={startGuidedScan}>Begin Scan</button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8 text-center animate-in fade-in slide-in-from-bottom-10">
      <h3 className="text-2xl font-bold text-blue-400 mb-2">{scanState.text}</h3>
      <p className="text-gray-400">{scanState.tracking}</p>
      <div className="w-full bg-slate-700 h-2 mt-4 rounded-full overflow-hidden">
        <div className="bg-blue-500 h-full transition-all duration-300" style={{ width: ((scanState.index / angles.length) * 100) + '%' }}></div>
      </div>
    </div>
  );
}




