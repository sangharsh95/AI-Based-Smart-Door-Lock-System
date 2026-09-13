import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import AdminLogin from './AdminLogin';

export default function AdminDashboard() {
  const [token, setToken] = useState(localStorage.getItem('adminToken'));
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [modalUser, setModalUser] = useState(null);
  const [panicMode, setPanicMode] = useState(false);
  const audioRef = useRef(new Audio('https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg'));

  const fetchData = async () => {
    try {
      const uRes = await axios.get('http://localhost:5000/api/users/list', { headers: { Authorization: 'Bearer ' + token } });
      setUsers(uRes.data);
      const lRes = await axios.get('http://localhost:5000/api/logs', { headers: { Authorization: 'Bearer ' + token } });
      setLogs(lRes.data);
    } catch (e) {
      if (e.response && e.response.status === 401) {
        localStorage.removeItem('adminToken');
        setToken(null);
      }
    }
  };

  useEffect(() => {
    if (!token) return;
    fetchData();

    // WEB SOCKET CONNECTION
    const socket = io('http://localhost:5000');
    
    socket.on('new_user', (user) => {
      setUsers(prev => [user, ...prev]);
    });

    socket.on('user_updated', (user) => {
      setUsers(prev => prev.map(u => u._id === user._id ? user : u));
    });

    socket.on('user_deleted', (id) => {
      setUsers(prev => prev.filter(u => u._id !== id));
    });

    socket.on('new_log', (log) => {
      setLogs(prev => [log, ...prev].slice(0, 50));
    });

    socket.on('panic_alarm', () => {
      setPanicMode(true);
      audioRef.current.loop = true;
      audioRef.current.play().catch(e => console.log('Audio blocked by browser'));
    });

    return () => socket.disconnect();
  }, [token]);

  const handleApprove = async () => {
    if (!modalUser) return;
    try {
      await axios.put(`http://localhost:5000/api/users/${modalUser._id}/approve`, {
        name: modalUser.newName,
        expires_in_minutes: modalUser.expiry,
        allowed_start_time: modalUser.startTime,
        allowed_end_time: modalUser.endTime
      }, { headers: { Authorization: 'Bearer ' + token } });
      setModalUser(null);
    } catch (e) {
      if(e.response && e.response.status === 401) { localStorage.removeItem('adminToken'); setToken(null); } else { alert(e.message); }
    }
  };

  const handleDelete = async (id) => {
    if(window.confirm('Delete user permanently?')) {
      await axios.delete(`http://localhost:5000/api/users/${id}`, { headers: { Authorization: 'Bearer ' + token } });
    }
  };

  const dismissPanic = () => {
    setPanicMode(false);
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
  };

  if (!token) return <AdminLogin onLogin={setToken} />;

  // Chart Data Prep
  const pieData = [
    { name: 'Granted', value: logs.filter(l => l.access_status.includes('Granted')).length, color: '#22c55e' },
    { name: 'Denied', value: logs.filter(l => l.access_status.includes('Denied')).length, color: '#ef4444' }
  ];

  // Group logs by hour for Area chart
  const areaDataMap = {};
  logs.forEach(l => {
    const hour = new Date(l.createdAt).getHours() + ':00';
    areaDataMap[hour] = (areaDataMap[hour] || 0) + 1;
  });
  const areaData = Object.keys(areaDataMap).map(k => ({ time: k, accesses: areaDataMap[k] })).reverse();

  return (
    <div className={`min-h-screen py-10 px-6 transition-colors duration-500 ${panicMode ? 'bg-red-900' : 'bg-slate-900'}`}>
      {panicMode && (
        <div className="fixed top-0 left-0 right-0 bg-red-600 text-white text-center py-4 font-bold text-2xl z-50 animate-pulse flex justify-between px-10 items-center">
          <span>⚠️ PANIC ALARM TRIGGERED - SILENT DURESS DETECTED ⚠️</span>
          <button onClick={dismissPanic} className="bg-black/20 hover:bg-black/40 px-6 py-2 rounded">Dismiss</button>
        </div>
      )}

      <div className="max-w-7xl mx-auto space-y-6 mt-8">
        
        {/* Analytics Top Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 col-span-2 h-64">
            <h3 className="text-lg font-bold mb-4">Traffic Flow (Last 50 Scans)</h3>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={areaData}>
                <XAxis dataKey="time" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip contentStyle={{backgroundColor: '#1e293b', border: 'none'}} />
                <Area type="monotone" dataKey="accesses" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          
          <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 h-64 flex flex-col items-center">
            <h3 className="text-lg font-bold mb-2">Access Ratio</h3>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" stroke="none">
                  {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={{backgroundColor: '#1e293b', border: 'none'}} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex space-x-4 text-xs font-bold mt-2">
              <span className="text-green-500">■ Granted</span>
              <span className="text-red-500">■ Denied</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Users Panel */}
          <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 h-[60vh] flex flex-col">
            <h2 className="text-2xl font-bold mb-4"><button onClick={() => { localStorage.removeItem("adminToken"); setToken(null); }} className="float-right bg-red-600 px-4 py-2 rounded text-sm hover:bg-red-500">Logout</button>`n            Access Directory ({users.length})</h2>
            <div className="overflow-y-auto space-y-4">
              {users.map(u => (
                <div key={u._id} className="p-4 bg-slate-900 rounded-xl border border-slate-700 flex justify-between items-center">
                  <div className="flex items-center space-x-4">
                    {u.profile_image ? (
                      <img src={`data:image/jpeg;base64,${u.profile_image}`} className="w-12 h-12 rounded-full object-cover" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center font-bold">{u.name[0]}</div>
                    )}
                                        <div>
                      <p className="font-bold">{u.name}</p>
                      <p className="text-sm text-slate-400">{u.mobile} • {u.admin_approved ? 'Active' : 'Pending'}</p>
                      {u.admin_approved && <p className="text-xs text-blue-400">Schedule: {u.allowed_start_time} - {u.allowed_end_time}</p>}
                      
                      {/* Show the 7 captured images directly in the row */}
                      <div className="flex space-x-2 mt-3 overflow-x-auto max-w-[400px]">
                        {Object.entries(JSON.parse(u.images_json || '{}')).map(([angle, b64]) => (
                          <img key={angle} src={`data:image/jpeg;base64,${b64}`} title={angle} className="w-12 h-12 rounded object-cover border border-slate-600" />
                        ))}
                      </div>
                    </div>
                  </div>
                  <div>
                    {!u.admin_approved && (
                      <button onClick={() => setModalUser({...u, newName: u.name, expiry: 0, startTime: '00:00', endTime: '23:59'})} className="bg-blue-600 px-4 py-2 rounded text-sm hover:bg-blue-500 mr-2">Approve</button>
                    )}
                    <button onClick={() => handleDelete(u._id)} className="text-red-400 hover:text-red-300">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Logs Panel */}
          <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 h-[60vh] flex flex-col">
            <h2 className="text-2xl font-bold mb-4">Live Activity (WebSocket)</h2>
            <div className="overflow-y-auto space-y-4">
              {logs.map(l => (
                <div key={l._id} className="p-4 bg-slate-900 rounded-xl border border-slate-700">
                  <div className="flex justify-between">
                    <p className="font-bold">{l.user_name}</p>
                    <p className={`font-bold ${l.access_status.includes('Granted') ? 'text-green-400' : l.access_status.includes('PANIC') ? 'text-red-500 animate-pulse' : 'text-yellow-500'}`}>
                      {l.access_status}
                    </p>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{new Date(l.createdAt).toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

            {/* Approval Modal */}
      {modalUser && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[60]">
          <div className="bg-slate-800 p-8 rounded-xl max-w-3xl w-full border border-slate-700 max-h-[90vh] overflow-y-auto">
            <h3 className="text-2xl font-bold mb-6 text-white border-b border-slate-700 pb-4">User Registration Details</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              {/* Left Column: User Info */}
              <div className="space-y-3">
                <div><span className="text-slate-400 text-sm">Full Name:</span> <p className="font-bold text-lg">{modalUser.name}</p></div>
                <div><span className="text-slate-400 text-sm">Mobile Number:</span> <p className="font-bold">{modalUser.mobile}</p></div>
                <div><span className="text-slate-400 text-sm">Email:</span> <p className="font-bold">{modalUser.email || 'N/A'}</p></div>
                <div><span className="text-slate-400 text-sm">Address:</span> <p className="font-bold">{modalUser.address || 'N/A'}</p></div>
                <div><span className="text-slate-400 text-sm">Purpose of Visit:</span> <p className="font-bold text-blue-400">{modalUser.purpose || 'N/A'}</p></div>
              </div>

              {/* Right Column: Approval Settings */}
              <div className="bg-slate-900 p-5 rounded-lg border border-slate-700">
                <h4 className="font-bold text-blue-400 mb-4">Configure Access Policy</h4>
                
                <label className="block text-sm text-slate-400 mb-1">Confirm Name</label>
                <input 
                  value={modalUser.newName} 
                  onChange={e => setModalUser({...modalUser, newName: e.target.value})}
                  className="w-full bg-slate-800 p-2 rounded mb-4 text-white border border-slate-600"
                />
                
                <label className="block text-sm text-slate-400 mb-1">Session Expiration</label>
                <select 
                  value={modalUser.expiry}
                  onChange={e => setModalUser({...modalUser, expiry: parseInt(e.target.value)})}
                  className="w-full bg-slate-800 p-2 rounded mb-4 text-white border border-slate-600"
                >
                  <option value={0}>Never Expire (Permanent)</option>
                  <option value={60}>1 Hour</option>
                  <option value={1440}>1 Day</option>
                </select>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Start Time</label>
                    <input type="time" value={modalUser.startTime} onChange={e => setModalUser({...modalUser, startTime: e.target.value})} className="w-full bg-slate-800 p-2 rounded text-white border border-slate-600" />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">End Time</label>
                    <input type="time" value={modalUser.endTime} onChange={e => setModalUser({...modalUser, endTime: e.target.value})} className="w-full bg-slate-800 p-2 rounded text-white border border-slate-600" />
                  </div>
                </div>
              </div>
            </div>

            {/* Images Gallery */}
            <h4 className="font-bold text-slate-300 mb-3 border-t border-slate-700 pt-4">Biometric Captures (7 Angles)</h4>
            <div className="flex overflow-x-auto space-x-4 mb-6 pb-4 scrollbar-thin scrollbar-thumb-slate-600">
              {Object.entries(JSON.parse(modalUser.images_json || '{}')).map(([angle, b64]) => (
                <div key={angle} className="text-center flex-none">
                  <img src={`data:image/jpeg;base64,${b64}`} className="w-24 h-24 rounded-lg object-cover border-2 border-slate-600" />
                  <p className="text-[10px] text-slate-400 mt-2 font-mono uppercase">{angle}</p>
                </div>
              ))}
            </div>

            {/* Footer Buttons */}
            <div className="flex justify-end space-x-3 border-t border-slate-700 pt-6">
              <button onClick={() => setModalUser(null)} className="px-6 py-2 bg-slate-700 hover:bg-slate-600 rounded font-bold transition-colors">Cancel</button>
              <button onClick={handleApprove} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded font-bold transition-colors">Approve & Grant Access</button>
            </div>
          </div>
        </div>
      )}</div>
  );
}





