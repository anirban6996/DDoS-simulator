import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Shield, Activity, Server, Users, Play, Square, ShieldCheck, TrendingUp, Cpu, AlertOctagon, AlertTriangle, Zap, Clock, Globe, Power, ArrowDownUp } from 'lucide-react';

const App = () => {
  // --- State ---
  const [isAttacking, setIsAttacking] = useState(false);
  const [isLegitActive, setIsLegitActive] = useState(true); 
  const [mitigationEnabled, setMitigationEnabled] = useState(false);
  
  // Sliders (0-100 scale)
  const [attackIntensity, setAttackIntensity] = useState(50); 
  const [legitIntensity, setLegitIntensity] = useState(30); 

  const [attackType, setAttackType] = useState('volumetric'); // volumetric (udp), application (http)
  const [scalingMode, setScalingMode] = useState('off'); // 'off', 'standard', 'ultra'

  const [serverHealth, setServerHealth] = useState(100); 
  const [serverLoad, setServerLoad] = useState(0); 
  const [serverLatency, setServerLatency] = useState(24); 
  const [packets, setPackets] = useState([]);
  const [wafIntegrity, setWafIntegrity] = useState(100); 

  const [stats, setStats] = useState({
    totalRequests: 0,
    blockedRequests: 0,
    droppedLegitimate: 0,
    successfulLegitimate: 0,
    currentRPS: 0,
    currentLegitRPS: 0,
    currentAttackRPS: 0
  });
  const [serverStatus, setServerStatus] = useState('ONLINE');

  // Refs
  const requestRef = useRef();
  const packetsRef = useRef([]);
  const serverRef = useRef({ health: 100, latency: 24 });
  
  // Constants
  const SERVER_X = 50;
  const SERVER_Y = 50;
  const PACKET_SPEED_BASE = 0.5; 
  const VISUAL_PARTICLE_LIMIT = 80; 
  
  // --- REAL WORLD DATA CORE ---
  
  const CAPACITIES = {
    off: 50000,        // Single optimized NGINX/Apache server
    standard: 500000,  // Enterprise Load Balancer / Small Cluster
    ultra: 10000000    // Global Anycast Edge Network (Cloudflare/AWS scale)
  };

  const calculateAttackTraffic = (intensity) => {
    const minRPS = 1000;
    const maxRPS = 20000000;
    const logMin = Math.log(minRPS);
    const logMax = Math.log(maxRPS);
    const scale = (logMax - logMin) / 100;
    const rps = Math.exp(logMin + scale * intensity);
    return Math.floor(rps); 
  };

  // --- Animation Loop ---
  const updateGame = useCallback(() => {
    const currentPackets = packetsRef.current;
    let newPackets = [];
    
    const maxCapacity = CAPACITIES[scalingMode];

    // --- 1. Traffic Generation ---
    
    const legitFactor = isLegitActive ? (legitIntensity / 100) * 0.6 : 0; 
    const rawLegitRate = maxCapacity * legitFactor;
    
    let rawAttackRate = 0;
    if (isAttacking) {
        rawAttackRate = calculateAttackTraffic(attackIntensity);
    }

    // Calculate Total RPS for display
    const currentRPS = rawLegitRate + rawAttackRate;

    // --- 2. Visual Spawning ---
    const canSpawnVisual = currentPackets.length < VISUAL_PARTICLE_LIMIT;
    if (canSpawnVisual) {
        const legitProb = Math.min(0.5, rawLegitRate / 100000); 
        const attackProb = Math.min(0.5, rawAttackRate / 100000);

        if (rawLegitRate > 0 && Math.random() < (0.05 + legitProb)) {
            const startSide = Math.random() > 0.5 ? 'left' : 'top'; 
            newPackets.push(createPacket('legit', startSide, 'standard'));
        }
        if (rawAttackRate > 0 && Math.random() < (0.05 + attackProb)) {
            const sides = ['right', 'bottom', 'top-right'];
            const side = sides[Math.floor(Math.random() * sides.length)];
            newPackets.push(createPacket('attack', side, attackType));
        }
    }

    // --- 3. Mitigation Logic ---
    let allowedAttack = rawAttackRate;
    let blockedAttack = 0;
    let currentWafEfficiency = 1.0;

    if (mitigationEnabled) {
        const baseEff = attackType === 'volumetric' ? 0.99 : 0.90;
        const saturationRatio = rawAttackRate / maxCapacity;
        const saturationPenalty = Math.max(0, (saturationRatio - 5) * 0.02);
        
        currentWafEfficiency = Math.max(0.5, baseEff - saturationPenalty);
        blockedAttack = rawAttackRate * currentWafEfficiency;
        allowedAttack = rawAttackRate - blockedAttack;
    }
    setWafIntegrity(Math.floor(currentWafEfficiency * 100));

    // --- 4. CORE EQUILIBRIUM MATH ---
    const attackWeight = attackType === 'application' ? 4.0 : 1.0;
    const totalDemand = rawLegitRate + (allowedAttack * attackWeight);
    const loadRatio = totalDemand / maxCapacity;
    const loadPct = loadRatio * 100;

    // Availability
    let targetAvailability = 100;
    if (loadRatio > 1.0) {
        targetAvailability = (1.0 / loadRatio) * 100;
    }

    // Latency
    let targetLatency = 24; 
    if (loadRatio > 0.8) {
        const congestion = Math.max(0, loadRatio - 0.8);
        targetLatency = 24 + (Math.pow(congestion * 10, 2.5) * 10);
    }
    targetLatency = Math.min(9999, targetLatency);

    // Inertia
    const healthInertia = 0.1; 
    const latencyInertia = 0.05;

    serverRef.current.health += (targetAvailability - serverRef.current.health) * healthInertia;
    serverRef.current.latency += (targetLatency - serverRef.current.latency) * latencyInertia;

    // --- 5. Physics ---
    const activePackets = [];
    [...currentPackets, ...newPackets].forEach(pkt => {
      const dx = SERVER_X - pkt.x;
      const dy = SERVER_Y - pkt.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      let speed = PACKET_SPEED_BASE;
      if (isAttacking && attackIntensity > 70) speed *= 1.5; 
      
      if (distance > 2) {
        pkt.x += (dx / distance) * speed;
        pkt.y += (dy / distance) * speed;
        activePackets.push(pkt);
      }
    });

    // Stats Logic
    const dropRate = 1.0 - (serverRef.current.health / 100);
    const legitDrops = rawLegitRate * dropRate;
    const legitSuccess = rawLegitRate - legitDrops;

    packetsRef.current = activePackets;
    setServerHealth(serverRef.current.health);
    setServerLatency(serverRef.current.latency);
    setServerLoad(loadPct); 
    setPackets(activePackets);
    
    setStats(prev => ({
      totalRequests: prev.totalRequests + Math.floor((totalDemand + blockedAttack) / 60), 
      blockedRequests: prev.blockedRequests + Math.floor(blockedAttack / 60),
      droppedLegitimate: prev.droppedLegitimate + Math.floor(legitDrops / 60),
      successfulLegitimate: prev.successfulLegitimate + Math.floor(legitSuccess / 60),
      currentRPS: Math.floor(currentRPS),
      currentLegitRPS: Math.floor(rawLegitRate),
      currentAttackRPS: Math.floor(rawAttackRate)
    }));

    const h = serverRef.current.health;
    if (h < 5) setServerStatus('OFFLINE');
    else if (h < 60) setServerStatus('CRITICAL'); 
    else if (serverRef.current.latency > 500) setServerStatus('DEGRADED');
    else setServerStatus('ONLINE');

    requestRef.current = requestAnimationFrame(updateGame);
  }, [isAttacking, isLegitActive, mitigationEnabled, attackIntensity, legitIntensity, attackType, scalingMode]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(updateGame);
    return () => cancelAnimationFrame(requestRef.current);
  }, [updateGame]);

  const createPacket = (type, side, subType) => {
    let startX, startY;
    switch(side) {
      case 'left': startX = -5; startY = Math.random() * 100; break;
      case 'right': startX = 105; startY = Math.random() * 100; break;
      case 'top': startX = Math.random() * 100; startY = -5; break;
      case 'bottom': startX = Math.random() * 100; startY = 105; break;
      case 'top-right': startX = 100; startY = 0; break;
      default: startX = 0; startY = 0;
    }
    return { id: Math.random(), x: startX, y: startY, type, subType };
  };

  const formatNumber = (val) => {
    if (val >= 1000000) return (val / 1000000).toFixed(1) + 'M';
    if (val >= 1000) return (val / 1000).toFixed(0) + 'k';
    return Math.floor(val).toLocaleString();
  };

  const getStatusColor = () => {
    if (serverStatus === 'OFFLINE') return 'text-red-600 border-red-600 bg-red-950';
    if (serverStatus === 'CRITICAL') return 'text-orange-500 border-orange-500 bg-orange-950';
    if (serverStatus === 'DEGRADED') return 'text-yellow-400 border-yellow-400 bg-yellow-950';
    return 'text-emerald-400 border-emerald-400 bg-emerald-950';
  };

  const getIntensityColor = (val) => {
    if (val < 30) return 'bg-emerald-500';
    if (val < 70) return 'bg-yellow-500';
    return 'bg-red-600';
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans p-2 md:p-4 flex flex-col overflow-hidden">
      
      {/* Grid Background */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.15]" 
           style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, #1e293b 2px, transparent 2.5px)', backgroundSize: '24px 24px' }}>
      </div>

      {/* Header */}
      <header className="relative z-10 mb-4 flex flex-col md:flex-row justify-between items-center bg-slate-900/80 backdrop-blur-md p-3 rounded-xl border border-slate-800 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-950 rounded-lg border border-blue-800 shadow-[0_0_15px_rgba(59,130,246,0.3)]">
            <Activity className="text-blue-400 w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg md:text-xl font-bold text-white tracking-tight flex items-center gap-2">
              DDoS Simulator <span className="text-blue-500 font-mono text-sm bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">v6.2</span>
            </h1>
          </div>
        </div>
        
        <div className={`flex items-center gap-2 px-3 py-1 rounded border ${getStatusColor()} transition-all duration-300 shadow-lg`}>
            <div className={`w-2 h-2 rounded-full animate-pulse ${serverStatus === 'OFFLINE' ? 'bg-red-500' : 'bg-current'}`} />
            <span className="font-mono font-bold text-xs tracking-widest">{serverStatus}</span>
        </div>
      </header>

      {/* Main Content */}
      <div className="relative z-10 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* Left Controls */}
        <div className="lg:col-span-3 space-y-4">
          
          {/* Attacker Panel */}
          <div className={`bg-slate-900/90 backdrop-blur border p-4 rounded-xl shadow-xl relative overflow-hidden transition-all duration-300 ${isAttacking ? 'border-red-500/50 shadow-red-900/20' : 'border-slate-800'}`}>
            <div className={`absolute top-0 left-0 w-1 h-full transition-colors duration-300 ${isAttacking ? 'bg-red-500' : 'bg-red-500/30'}`}></div>
            <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
              <AlertOctagon className={`w-4 h-4 ${isAttacking ? 'text-red-400 animate-pulse' : 'text-red-400/70'}`} /> Threat Actor
            </h2>

            <button 
              onClick={() => setIsAttacking(!isAttacking)}
              className={`w-full py-3 rounded-lg font-bold text-xs uppercase tracking-wide transition-all duration-300 flex items-center justify-center gap-2 shadow-lg mb-4 ${
                isAttacking 
                  ? 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-red-900/50 border border-red-500' 
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
              }`}
            >
              {isAttacking ? <Square className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}
              {isAttacking ? 'Terminate Attack' : 'Initiate Attack'}
            </button>

            <div className="mb-4">
              <div className="flex justify-between text-[10px] mb-1 font-mono">
                <span className="text-slate-400">BOTNET SIZE</span>
                <span className={attackIntensity > 80 ? 'text-red-400 font-bold' : 'text-blue-400'}>
                    {formatNumber(calculateAttackTraffic(attackIntensity))} <span className="text-[9px] text-slate-500">RPS</span>
                </span>
              </div>
              <input 
                type="range" min="1" max="100" value={attackIntensity} 
                onChange={(e) => setAttackIntensity(parseInt(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500 border border-slate-700"
              />
              <div className="mt-1 h-1 w-full rounded-full overflow-hidden bg-slate-950 border border-slate-800">
                 <div className={`h-full transition-all duration-300 ${getIntensityColor(attackIntensity)}`} style={{width: `${attackIntensity}%`}}></div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
               <button onClick={() => setAttackType('volumetric')} className={`p-2 rounded border text-[10px] font-bold transition-all ${attackType === 'volumetric' ? 'bg-red-500/20 border-red-500 text-red-400' : 'bg-slate-800 border-slate-700 text-slate-500 hover:bg-slate-700'}`}>L3/L4 VOLUMETRIC</button>
               <button onClick={() => setAttackType('application')} className={`p-2 rounded border text-[10px] font-bold transition-all ${attackType === 'application' ? 'bg-purple-500/20 border-purple-500 text-purple-400' : 'bg-slate-800 border-slate-700 text-slate-500 hover:bg-slate-700'}`}>L7 APPLICATION</button>
            </div>
          </div>

          {/* Legit Traffic */}
          <div className={`bg-slate-900/90 backdrop-blur border p-4 rounded-xl shadow-xl relative overflow-hidden transition-all duration-300 ${isLegitActive ? 'border-emerald-500/50 shadow-emerald-900/20' : 'border-slate-800'}`}>
            <div className={`absolute top-0 left-0 w-1 h-full transition-colors duration-300 ${isLegitActive ? 'bg-emerald-500' : 'bg-emerald-500/30'}`}></div>
            <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Users className={`w-4 h-4 ${isLegitActive ? 'text-emerald-400' : 'text-emerald-400/70'}`} /> Real Users
            </h2>
            
            <button 
              onClick={() => setIsLegitActive(!isLegitActive)}
              className={`w-full py-3 rounded-lg font-bold text-xs uppercase tracking-wide transition-all duration-300 flex items-center justify-center gap-2 shadow-lg mb-4 ${
                isLegitActive 
                  ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-emerald-900/50 border border-emerald-500' 
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
              }`}
            >
              {isLegitActive ? <Square className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}
              {isLegitActive ? 'Stop User Traffic' : 'Start User Traffic'}
            </button>

            <div className="mb-2">
              <div className="flex justify-between text-[10px] mb-1 font-mono">
                <span className="text-slate-400">ACTIVE USERS</span>
                <span className="text-emerald-400">
                    {legitIntensity}% <span className="text-[9px] text-slate-500">load</span>
                </span>
              </div>
              <input 
                type="range" min="1" max="100" value={legitIntensity} 
                onChange={(e) => setLegitIntensity(parseInt(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500 border border-slate-700"
              />
            </div>
          </div>

          {/* Defenses */}
          <div className={`bg-slate-900/90 backdrop-blur border p-4 rounded-xl shadow-xl relative overflow-hidden transition-all duration-300 ${mitigationEnabled ? 'border-blue-500/50 shadow-blue-900/20' : 'border-slate-800'}`}>
            <div className={`absolute top-0 left-0 w-1 h-full transition-colors duration-300 ${mitigationEnabled ? 'bg-blue-500' : 'bg-blue-500/30'}`}></div>
            <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Shield className={`w-4 h-4 ${mitigationEnabled ? 'text-blue-400' : 'text-blue-400/70'}`} /> Defense Layers
            </h2>

            <div className="space-y-3">
              <div className="flex items-center justify-between bg-slate-800/50 p-2 rounded-lg border border-slate-700 hover:border-slate-600 transition-colors">
                <div className="flex items-center gap-2">
                   <ShieldCheck className={`w-4 h-4 ${mitigationEnabled ? 'text-blue-400' : 'text-slate-600'}`} />
                   <div><div className="text-xs font-bold text-slate-200">WAF</div><div className="text-[9px] text-slate-500">Scrubbing Center</div></div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={mitigationEnabled} onChange={() => setMitigationEnabled(!mitigationEnabled)} />
                  <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
              {mitigationEnabled && (
                <div className="px-1 mb-2 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex justify-between text-[9px] text-slate-400 mb-1"><span>FILTRATION EFFICIENCY</span><span>{wafIntegrity}%</span></div>
                  <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden"><div className={`h-full transition-all duration-500 ${wafIntegrity < 40 ? 'bg-red-500' : 'bg-blue-500'}`} style={{width: `${wafIntegrity}%`}} /></div>
                </div>
              )}

              <div className="bg-slate-800/50 p-2 rounded-lg border border-slate-700 mt-2">
                 <div className="flex items-center gap-2 mb-2">
                    <Globe className={`w-4 h-4 ${scalingMode !== 'off' ? 'text-emerald-400' : 'text-slate-600'}`} />
                    <div><div className="text-xs font-bold text-slate-200">Infrastructure</div><div className="text-[9px] text-slate-500">Scale</div></div>
                 </div>
                 <div className="grid grid-cols-3 gap-1">
                    <button onClick={() => setScalingMode('off')} className={`text-[8px] uppercase py-2 rounded font-bold border transition-all ${scalingMode === 'off' ? 'bg-slate-600 text-white border-slate-500 shadow-inner' : 'bg-slate-900 text-slate-500 border-slate-800 hover:bg-slate-800'}`}>Single VPS</button>
                    <button onClick={() => setScalingMode('standard')} className={`text-[8px] uppercase py-2 rounded font-bold border transition-all ${scalingMode === 'standard' ? 'bg-emerald-600 text-white border-emerald-500 shadow-inner' : 'bg-slate-900 text-slate-500 border-slate-800 hover:bg-slate-800'}`}>Cluster</button>
                    <button onClick={() => setScalingMode('ultra')} className={`text-[8px] uppercase py-2 rounded font-bold border transition-all ${scalingMode === 'ultra' ? 'bg-purple-600 text-white border-purple-500 shadow-inner' : 'bg-slate-900 text-slate-500 border-slate-800 hover:bg-slate-800'}`}>Edge Net</button>
                 </div>
                 <div className="text-[9px] text-slate-400 mt-2 flex justify-between">
                    <span>Cap: {formatNumber(CAPACITIES[scalingMode])} RPS</span>
                 </div>
              </div>
            </div>
          </div>
        </div>

        {/* Center Visualizer */}
        <div className="lg:col-span-6 relative bg-slate-950 rounded-2xl border border-slate-800 shadow-2xl overflow-hidden h-[500px] lg:h-auto">
           <div className="absolute inset-0" style={{backgroundImage: 'linear-gradient(0deg, transparent 24%, rgba(30, 41, 59, .3) 25%, rgba(30, 41, 59, .3) 26%, transparent 27%, transparent 74%, rgba(30, 41, 59, .3) 75%, rgba(30, 41, 59, .3) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(30, 41, 59, .3) 25%, rgba(30, 41, 59, .3) 26%, transparent 27%, transparent 74%, rgba(30, 41, 59, .3) 75%, rgba(30, 41, 59, .3) 76%, transparent 77%, transparent)', backgroundSize: '50px 50px'}}></div>
           
           <div className="absolute top-4 left-4 flex flex-col gap-1">
              <div className="flex items-center gap-2 text-[10px] font-mono text-emerald-500/70">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span> LIVE PACKET FEED
              </div>
              <div className="flex gap-3 mt-1">
                 <div className="flex items-center gap-1 text-[9px] text-slate-400"><div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>Legit</div>
                 <div className="flex items-center gap-1 text-[9px] text-slate-400"><div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>Malicious</div>
              </div>
           </div>

           {packets.map(pkt => (
             <div key={pkt.id} className={`absolute transform -translate-x-1/2 -translate-y-1/2 transition-none will-change-transform
                 ${pkt.type === 'legit' ? 'rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.6)]' : ''}
                 ${pkt.type === 'attack' ? 'rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]' : ''}`}
               style={{ left: `${pkt.x}%`, top: `${pkt.y}%`, width: '4px', height: '4px' }}
             />
           ))}

           <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center justify-center pointer-events-none">
              {mitigationEnabled && (
                 <div className={`absolute w-48 h-48 rounded-full border border-blue-500/30 animate-[spin_5s_linear_infinite] ${wafIntegrity < 50 ? 'border-red-500/30' : ''}`}>
                    <div className="absolute top-0 left-1/2 w-2 h-2 bg-blue-500 rounded-full -translate-x-1/2 -translate-y-1/2 shadow-[0_0_15px_#3b82f6]"></div>
                 </div>
              )}
              
              {scalingMode === 'standard' && <div className="absolute w-60 h-60 rounded-full border border-dashed border-emerald-500/20 animate-[spin_20s_linear_infinite_reverse]"></div>}
              {scalingMode === 'ultra' && (
                 <>
                    <div className="absolute w-60 h-60 rounded-full border border-dashed border-purple-500/30 animate-[spin_10s_linear_infinite_reverse]"></div>
                    <div className="absolute w-72 h-72 rounded-full border-2 border-dotted border-purple-500/10 animate-[spin_15s_linear_infinite]"></div>
                 </>
              )}

              <div className={`relative transition-all duration-300 drop-shadow-2xl ${serverStatus === 'OFFLINE' ? 'grayscale opacity-50 scale-90' : serverLoad > 100 ? 'scale-110' : 'scale-100'}`}>
                 {serverStatus === 'OFFLINE' ? (
                   <AlertTriangle className="w-24 h-24 text-red-500" strokeWidth={1.5} />
                 ) : (
                   <div className="relative flex items-center justify-center">
                       <div className={`absolute inset-0 rounded-full blur-xl opacity-50 ${serverLoad > 90 ? 'bg-red-500' : 'bg-blue-500'} transition-colors duration-300`}></div>
                       <div className="relative w-24 h-24 bg-slate-900 rounded-xl border-2 border-slate-700 flex items-center justify-center shadow-2xl overflow-hidden">
                            <div className="absolute inset-0 opacity-20" style={{backgroundImage: 'linear-gradient(#334155 1px, transparent 1px), linear-gradient(90deg, #334155 1px, transparent 1px)', backgroundSize: '8px 8px'}}></div>
                            <Cpu className={`w-12 h-12 z-10 transition-all duration-300 ${serverLoad > 90 ? 'text-red-400 animate-pulse' : 'text-blue-400'}`} strokeWidth={1.5} />
                       </div>
                   </div>
                 )}
                 <div className={`absolute -bottom-4 left-1/2 -translate-x-1/2 w-20 h-1 rounded-full ${serverStatus === 'ONLINE' ? 'bg-emerald-500 shadow-emerald-500/50' : serverStatus === 'DEGRADED' ? 'bg-yellow-500' : 'bg-red-600 shadow-red-600/50'}`}></div>
              </div>
              <div className="mt-8 px-3 py-1 bg-slate-900/60 backdrop-blur rounded-full text-[10px] font-mono text-slate-400 border border-slate-800/50 text-center">
                <div>ORIGIN SERVER</div>
                <div className="text-[9px] text-slate-500">192.168.1.100</div>
              </div>
           </div>

           {serverLoad > 100 && serverStatus !== 'OFFLINE' && <div className="absolute inset-0 bg-red-500/10 z-0 animate-pulse pointer-events-none"></div>}
        </div>

        {/* Right Metrics */}
        <div className="lg:col-span-3 space-y-4">
          
          {/* NEW CARD: Live Traffic */}
          <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl shadow-lg">
              <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold text-slate-400 uppercase">Incoming Traffic</h3>
                  <ArrowDownUp className="w-4 h-4 text-slate-500" />
              </div>
              <div className="text-3xl font-mono font-bold text-white flex items-baseline gap-2">
                  {formatNumber(stats.currentRPS)} <span className="text-sm text-slate-500 font-sans font-normal">req/s</span>
              </div>
              {/* Ratio Bar */}
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mt-3 flex">
                  <div className="h-full bg-emerald-500 transition-all duration-300" style={{width: `${(stats.currentLegitRPS / (stats.currentRPS || 1)) * 100}%`}}></div>
                  <div className="h-full bg-red-500 transition-all duration-300" style={{width: `${(stats.currentAttackRPS / (stats.currentRPS || 1)) * 100}%`}}></div>
              </div>
              <div className="flex justify-between text-[9px] text-slate-500 mt-1 font-mono">
                  <span className="text-emerald-500">{formatNumber(stats.currentLegitRPS)} Legit</span>
                  <span className="text-red-500">{formatNumber(stats.currentAttackRPS)} Attack</span>
              </div>
          </div>

          {/* Availability / Health */}
          <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl shadow-lg">
             <div className="flex items-center justify-between mb-4"><h3 className="text-xs font-bold text-slate-400 uppercase">Service Availability</h3><Activity className="w-4 h-4 text-slate-500" /></div>
             <div className="relative w-full h-24 bg-slate-950 rounded-lg overflow-hidden border border-slate-800 flex items-end px-1">
                {Array.from({length: 15}).map((_, i) => <div key={i} className="flex-1 mx-[1px] bg-emerald-900/40 rounded-t-sm transition-all duration-300" style={{height: `${Math.min(100, Math.max(10, serverHealth - (Math.random()*10)))}%`, opacity: serverHealth/100 }}></div>)}
                <div className="absolute inset-0 flex items-center justify-center"><span className={`text-3xl font-bold ${serverHealth < 60 ? 'text-red-500' : serverHealth < 90 ? 'text-yellow-500' : 'text-white'}`}>{Math.round(serverHealth)}%</span></div>
             </div>
             <div className="text-[9px] text-slate-500 mt-2 text-center">Reqs Served / Total Demand</div>
          </div>

          {/* Load & Latency */}
          <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl shadow-lg">
             <div className="flex items-center justify-between mb-4"><h3 className="text-xs font-bold text-slate-400 uppercase">Network State</h3><Clock className="w-4 h-4 text-slate-500" /></div>
             
             <div className="mb-4">
                <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-400">Latency</span>
                    <span className={`${serverLatency > 200 ? 'text-red-400' : 'text-emerald-400'}`}>{Math.round(serverLatency)} ms</span>
                </div>
                <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                    <div className={`h-full transition-all duration-300 ${serverLatency > 200 ? 'bg-red-500' : 'bg-emerald-500'}`} style={{width: `${Math.min(100, (serverLatency/1000)*100)}%`}}></div>
                </div>
             </div>

             <div>
                <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-400">Load Saturation</span>
                    <span className={`${serverLoad > 100 ? 'text-red-400' : 'text-blue-400'}`}>{Math.round(serverLoad)}%</span>
                </div>
                <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                    <div className={`h-full transition-all duration-300 ${serverLoad > 100 ? 'bg-red-500' : 'bg-blue-500'}`} style={{width: `${Math.min(100, serverLoad)}%`}}></div>
                </div>
             </div>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
             <div className="bg-slate-800/50 border border-slate-700 p-2 rounded-lg text-center"><div className="text-[9px] text-slate-500 uppercase mb-1">Blocked</div><div className="text-sm font-mono text-blue-400">{formatNumber(stats.blockedRequests)}</div></div>
             <div className="bg-slate-800/50 border border-slate-700 p-2 rounded-lg text-center"><div className="text-[9px] text-slate-500 uppercase mb-1">Dropped</div><div className="text-sm font-mono text-red-400">{formatNumber(stats.droppedLegitimate)}</div></div>
             <div className="bg-slate-800/50 border border-slate-700 p-2 rounded-lg text-center col-span-2"><div className="text-[9px] text-slate-500 uppercase mb-1">Total Requests</div><div className="text-lg font-mono text-white">{formatNumber(stats.totalRequests)}</div></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;