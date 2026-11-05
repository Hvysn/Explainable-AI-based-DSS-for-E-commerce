import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, Clock, Layers, TrendingDown, Wallet, Sparkles, Box, Plus, 
  Send, Bot, CheckCircle, Lock, Users, Settings, LogOut, Check, Key
} from 'lucide-react';
import { authApi } from './api';

const INITIAL_ORDERS = [
  {
    id: 'ORD-84219',
    name: 'Anouk Embroidered A-Line Kurti',
    sku: 'SKU_1003 · Size M + L',
    warehouse: 'South Hub · Chennai',
    eta: 'Today, 6–8 PM',
    payment: 'COD',
    p_return: 0.91,
    risk: 'red',
    tag: 'Bracket Size Shopping',
    is_bracket: true,
    base_loss: 364.0,
    action_cost: 5.0,
    net_savings: 195.2,
    intro: 'High-risk bracket purchase detected: Customer ordered both Size M and Size L with intent to return one under COD in Tier-2 area.',
    reasons: [
      ['Bracket shopping confirmed', 'Two adjacent sizes (M & L) in cart. Probability of returning 1 item exceeds 89%.', 'Cart anomaly'],
      ['SKU sizing inconsistency reported', 'DistilBERT review analysis flagged: "Chest measurement runs tight; order one size up".', 'Flipkart reviews'],
      ['Cash on Delivery in Tier-2 area', 'COD orders in this pincode have a historical RTO rate 2.4x above prepaid baseline.', 'Customer behavior']
    ],
    shap: [
      { label: 'Bracket Shopping (Adjacent Sizes)', val: 45, type: 'red' },
      { label: 'SKU NLP Sizing Discrepancy', val: 26, type: 'red' },
      { label: 'COD Payment Method in Tier-2', val: 18, type: 'red' },
      { label: 'Repeat Customer History', val: -5, type: 'green' }
    ],
    recommendation: 'Send WhatsApp size confirmation (Net ROI: ₹195.20)'
  },
  {
    id: 'ORD-84226',
    name: 'Roadster High-Rise Washed Jeans',
    sku: 'SKU_1020 · Size 30 + 32',
    warehouse: 'South Hub · Chennai',
    eta: 'Tomorrow, 10 AM–1 PM',
    payment: 'COD',
    p_return: 0.84,
    risk: 'red',
    tag: 'Bracket Denim Sizes',
    is_bracket: true,
    base_loss: 336.0,
    action_cost: 5.0,
    net_savings: 179.8,
    intro: 'Bracket shopping detected on denim apparel. Heavyweight parcel with ₹420 return freight overhead.',
    reasons: [
      ['Duplicate parent style in cart', 'Customer added waist sizes 30 and 32 to cart.', 'Cart anomaly'],
      ['High customer past return ratio', 'Customer has returned 3 of last 5 apparel purchases.', 'Customer profile']
    ],
    shap: [
      { label: 'Bracket Waist Sizing (30 & 32)', val: 48, type: 'red' },
      { label: 'Customer Past Return Ratio (60%)', val: 24, type: 'red' },
      { label: 'COD Payment Surcharge', val: 12, type: 'red' }
    ],
    recommendation: 'WhatsApp size prompt before boxing'
  },
  {
    id: 'ORD-84231',
    name: 'Highlander Slim Fit Cotton Shirt',
    sku: 'SKU_1024 · Size L',
    warehouse: 'South Hub · Chennai',
    eta: 'Tomorrow, 2–5 PM',
    payment: 'COD',
    p_return: 0.68,
    risk: 'amber',
    tag: 'SKU Defect Warning',
    is_bracket: false,
    base_loss: 272.0,
    action_cost: 35.0,
    net_savings: 141.8,
    intro: 'DistilBERT aspect mining indicates this specific batch has reported zipper/stitching flaws in 62% of negative reviews.',
    reasons: [
      ['SKU fabric & stitching defect alert', 'Customer reviews frequently cite "seams came undone".', 'Flipkart reviews'],
      ['COD in Tier-3 pin code', 'Higher refusal-at-doorstep probability if garment arrives damaged.', 'Logistics risk']
    ],
    shap: [
      { label: 'SKU NLP Stitching Flaw Flag', val: 38, type: 'red' },
      { label: 'COD Payment Method', val: 16, type: 'red' },
      { label: 'High Account Age (>400 days)', val: -8, type: 'green' }
    ],
    recommendation: 'Execute ₹35 Pre-Shipment QC Inspection'
  },
  {
    id: 'ORD-84237',
    name: 'Athena Floral Print Midi Dress',
    sku: 'SKU_1015 · Size M',
    warehouse: 'South Hub · Chennai',
    eta: 'Today, 8–10 PM',
    payment: 'PREPAID',
    p_return: 0.22,
    risk: 'green',
    tag: 'Low Risk',
    is_bracket: false,
    base_loss: 88.0,
    action_cost: 0.0,
    net_savings: 0.0,
    intro: 'Order details and customer history are consistent. Paid via UPI with zero size bracket indicators.',
    reasons: [
      ['Prepaid transaction via UPI', 'Prepaid orders have 72% lower return-to-origin likelihood.', 'Payment gateway'],
      ['Zero size ambiguity in cart', 'Single item selected with matching past purchase size.', 'Ingress checks']
    ],
    shap: [
      { label: 'Prepaid UPI Payment', val: -18, type: 'green' },
      { label: 'Low Customer Historical Returns (<5%)', val: -14, type: 'green' }
    ],
    recommendation: 'Proceed with direct dispatch'
  }
];

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  const [authView, setAuthView] = useState('LOGIN'); // LOGIN, REGISTER, CHALLENGE
  const [pendingChallenge, setPendingChallenge] = useState(null);
  const [loginId, setLoginId] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [challengeAnswer, setChallengeAnswer] = useState('');
  const [authError, setAuthError] = useState('');
  const [authBusy, setAuthBusy] = useState(false);

  // Teammate Self-Registration State
  const [regCode, setRegCode] = useState('');
  const [regName, setRegName] = useState('');
  const [regId, setRegId] = useState('');
  const [regPass, setRegPass] = useState('');
  const [regQ, setRegQ] = useState('');
  const [regAns, setRegAns] = useState('');

  // Modals
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showMobMenu, setShowMobMenu] = useState(false);
  const [creatorPinVerified, setCreatorPinVerified] = useState(false);
  const [creatorPinInput, setCreatorPinInput] = useState('');
  const [creatorPinError, setCreatorPinError] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [team, setTeam] = useState([]);
  const [teamError, setTeamError] = useState('');

  // Settings
  const [settingsCurrentPass, setSettingsCurrentPass] = useState('');
  const [settingsPass, setSettingsPass] = useState('');
  const [settingsQ, setSettingsQ] = useState('');
  const [settingsAns, setSettingsAns] = useState('');
  const [settingsError, setSettingsError] = useState('');
  const [settingsBusy, setSettingsBusy] = useState(false);

  // Orders & Dashboard
  const [orders, setOrders] = useState(INITIAL_ORDERS);
  const [selectedOrder, setSelectedOrder] = useState(INITIAL_ORDERS[0]);
  const [view, setView] = useState('DASHBOARD');
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [toastMsg, setToastMsg] = useState('');
  const [totalSavings, setTotalSavings] = useState(1845.0);

  useEffect(() => {
    let cancelled = false;
    authApi
      .me()
      .then((data) => {
        if (!cancelled) setCurrentUser(data.user);
      })
      .catch(() => {
        if (!cancelled) setCurrentUser(null);
      })
      .finally(() => {
        if (!cancelled) setAuthReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2800);
  };

  const resetAuthForm = () => {
    setLoginId('');
    setLoginPass('');
    setChallengeAnswer('');
    setPendingChallenge(null);
    setAuthError('');
  };

  const handleSessionExpired = () => {
    setCurrentUser(null);
    setAuthView('LOGIN');
    resetAuthForm();
    showToast('Your session expired. Please sign in again.');
  };

  // STEP 1: Verify credentials server-side, receive a 2FA challenge token.
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthBusy(true);
    try {
      const data = await authApi.step1({
        userId: loginId.trim().toLowerCase(),
        password: loginPass
      });
      setPendingChallenge(data);
      setLoginPass('');
      setAuthView('CHALLENGE');
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setAuthBusy(false);
    }
  };

  // STEP 2: Verify the 2FA answer and receive the session cookie.
  const handleChallengeSubmit = async (e) => {
    e.preventDefault();
    if (!pendingChallenge) {
      setAuthView('LOGIN');
      return;
    }
    setAuthError('');
    setAuthBusy(true);
    try {
      const data = await authApi.step2({
        challengeToken: pendingChallenge.challengeToken,
        answer: challengeAnswer
      });
      setCurrentUser(data.user);
      setChallengeAnswer('');
      setPendingChallenge(null);
      setAuthView('DONE');
      showToast(`Identity verified! Logged in as ${data.user.fullName}`);
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setAuthBusy(false);
    }
  };

  // Teammate Self-Registration Submit
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthBusy(true);
    try {
      const data = await authApi.register({
        inviteCode: regCode.trim(),
        fullName: regName.trim(),
        userId: regId.trim().toLowerCase(),
        password: regPass,
        question: regQ.trim(),
        answer: regAns.trim()
      });
      setCurrentUser(data.user);
      setAuthView('DONE');
      showToast(`Welcome to South Hub, ${data.user.fullName}!`);
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setAuthBusy(false);
    }
  };

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch (_) {
      /* clear the local session even if the server call fails */
    }
    setCurrentUser(null);
    setAuthView('LOGIN');
    resetAuthForm();
    setShowMobMenu(false);
    showToast('Securely logged out.');
  };

  const handleSaveSecurity = async (e) => {
    e.preventDefault();
    setSettingsError('');

    const payload = { currentPassword: settingsCurrentPass };
    if (settingsPass.trim()) payload.newPassword = settingsPass.trim();
    if (settingsQ.trim()) payload.question = settingsQ.trim();
    if (settingsAns.trim()) payload.answer = settingsAns.trim().toLowerCase();

    if (!payload.newPassword && !payload.question && !payload.answer) {
      setSettingsError('Enter a new password or updated challenge details.');
      return;
    }

    setSettingsBusy(true);
    try {
      const data = await authApi.updateSecurity(payload);
      setCurrentUser(data.user);
      setShowSettingsModal(false);
      setSettingsCurrentPass('');
      setSettingsPass('');
      setSettingsQ('');
      setSettingsAns('');
      showToast('Your password & 2FA security challenge updated!');
    } catch (err) {
      if (err.status === 401) {
        setSettingsError('Current password is incorrect.');
      } else {
        setSettingsError(err.message);
      }
    } finally {
      setSettingsBusy(false);
    }
  };

  const openTeamModal = async () => {
    setShowTeamModal(true);
    setTeamError('');
    setCreatorPinVerified(false);
    setCreatorPinInput('');
    setCreatorPinError('');
    setInviteCode('');
    try {
      const data = await authApi.team();
      setTeam(data.team || []);
    } catch (err) {
      if (err.status === 401) handleSessionExpired();
      else setTeamError(err.message);
    }
  };

  const handleVerifyCreator = async () => {
    setCreatorPinError('');
    try {
      const data = await authApi.verifyCreator({ creatorPin: creatorPinInput });
      setCreatorPinVerified(true);
      setInviteCode(data.inviteCode);
      setCreatorPinInput('');
      showToast('Creator verified! Invite key unlocked.');
    } catch (err) {
      setCreatorPinError(err.message);
    }
  };

  const applyIntervention = () => {
    if (!selectedOrder) return;
    if (selectedOrder.risk !== 'green') {
      setTotalSavings(s => s + selectedOrder.net_savings);
    }
    const updated = {
      ...selectedOrder,
      risk: 'green',
      p_return: 0.12,
      tag: 'Intervention completed',
      recommendation: 'Proceed with dispatch'
    };
    setOrders(orders.map(o => o.id === updated.id ? updated : o));
    setSelectedOrder(updated);
    showToast(`Action recorded! +₹${Math.round(selectedOrder.net_savings)} savings added.`);
  };

  const simulateIngress = () => {
    const idNum = Math.floor(84250 + Math.random() * 400);
    const newOrd = {
      id: `ORD-${idNum}`,
      name: 'Anouk Ethnic Printed Kurti',
      sku: 'SKU_1004 · Size S + M',
      warehouse: 'South Hub · Chennai',
      eta: 'Today, 9 PM',
      payment: 'COD',
      p_return: 0.89,
      risk: 'red',
      tag: 'Live Ingress · Bracket Order',
      is_bracket: true,
      base_loss: 356.0,
      action_cost: 5.0,
      net_savings: 190.8,
      intro: '⚡ Ingested in 18ms. TreeSHAP diagnosed bracket sizing anomaly under COD.',
      reasons: [
        ['Real-time bracket detection', 'Customer added two adjacent sizes of the same kurti style.', 'FastAPI Ingress'],
        ['Sizing inconsistency in reviews', 'DistilBERT sentiment analysis indicates kurti runs small.', 'Flipkart reviews']
      ],
      shap: [
        { label: 'Bracket Sizing Anomaly (S + M)', val: 46, type: 'red' },
        { label: 'SKU Size Defect Vector', val: 25, type: 'red' },
        { label: 'COD Payment Mode', val: 18, type: 'red' }
      ],
      recommendation: 'Hold dispatch for WhatsApp size verification'
    };
    setOrders([newOrd, ...orders]);
    setSelectedOrder(newOrd);
    showToast(`⚡ Live Ingress: Order ${newOrd.id} arrived (<50ms). Red risk flagged.`);
  };

  const filteredOrders = orders.filter(o => 
    (filter === 'all' || o.risk === filter) &&
    (`${o.id} ${o.name} ${o.sku} ${o.tag}`.toLowerCase().includes(search.toLowerCase()))
  );

  if (!authReady) {
    return (
      <div id="app">
        <div className="login-screen">
          <div className="login-card" style={{textAlign:'center'}}>
            <div className="logo-slot">
              <div className="logo-placeholder">JHJ</div>
              <div><strong>JHJ eCommerce<br/>DSS System</strong><small>Verifying secure session…</small></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="app">
      {/* AUTHENTICATION OVERLAY */}
      {!currentUser && (
        <div className="login-screen">
          <div className="login-card">
            <div className="logo-slot">
              <div className="logo-placeholder">JHJ</div>
              <div><strong>JHJ eCommerce<br/>DSS System</strong><small>Warehouse intelligence</small></div>
            </div>

            {authView === 'LOGIN' && (
              <form onSubmit={handleLoginSubmit}>
                <div className="auth-step-pill">Step 1 of 2 · Credential Check</div>
                <h2>Secure Terminal Login</h2>
                <p className="login-sub">Enter your authorized User ID to access the South Hub terminal.</p>

                <div className="field">
                  <label>User ID</label>
                  <input 
                    type="text" 
                    value={loginId} 
                    onChange={e => setLoginId(e.target.value)} 
                    placeholder="e.g. hv@jhj or your custom ID" 
                    required 
                  />
                </div>

                <div className="field">
                  <label>Password</label>
                  <input 
                    type="password" 
                    value={loginPass} 
                    onChange={e => setLoginPass(e.target.value)} 
                    placeholder="Enter password" 
                    required 
                  />
                </div>

                <button type="submit" className="primary-btn login-submit" disabled={authBusy}>
                  {authBusy ? 'Verifying…' : 'Verify Credentials →'}
                </button>
                {authError && <div className="login-error">{authError}</div>}

                <div style={{marginTop:16,paddingTop:12,borderTop:'1px solid var(--line)',textAlign:'center'}}>
                  <button type="button" onClick={() => { setAuthView('REGISTER'); setAuthError(''); }} style={{border:0,background:'transparent',color:'#2563eb',fontSize:11,fontWeight:750}}>
                    Have a Team Invite Code? Register Your Account Here →
                  </button>
                </div>
              </form>
            )}

            {authView === 'REGISTER' && (
              <form onSubmit={handleRegisterSubmit}>
                <div className="auth-step-pill" style={{background:'#fef3c7',color:'#b45309'}}>🎉 Teammate Account Creation</div>
                <h2>Register Your Profile</h2>
                <p className="login-sub">Enter the Creator's Invite Code to set your own User ID, Password, and 2FA Challenge.</p>

                <div className="field">
                  <label>Team Invite Code (From Hemavarshini)</label>
                  <input 
                    type="password" 
                    value={regCode} 
                    onChange={e => setRegCode(e.target.value)} 
                    placeholder="Enter the invite code from your Creator"
                    required 
                  />
                </div>

                <div className="reg-grid-2" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                  <div className="field">
                    <label>Full Name</label>
                    <input 
                      type="text" 
                      value={regName} 
                      onChange={e => setRegName(e.target.value)} 
                      placeholder="e.g. Jayanth S" 
                      required 
                    />
                  </div>
                  <div className="field">
                    <label>Choose User ID</label>
                    <input 
                      type="text" 
                      value={regId} 
                      onChange={e => setRegId(e.target.value)} 
                      placeholder="e.g. jayanth@jhj" 
                      required 
                    />
                  </div>
                </div>

                <div className="field">
                  <label>Choose Password</label>
                  <input 
                    type="password" 
                    value={regPass} 
                    onChange={e => setRegPass(e.target.value)} 
                    placeholder="Create secret password" 
                    required 
                  />
                </div>

                <div className="field">
                  <label>Your Personal Security Question</label>
                  <input 
                    type="text" 
                    value={regQ} 
                    onChange={e => setRegQ(e.target.value)} 
                    placeholder="e.g. who is your spirit animal" 
                    required 
                  />
                </div>

                <div className="field">
                  <label>Your Secret Answer (Masked in dots)</label>
                  <input 
                    type="password" 
                    value={regAns} 
                    onChange={e => setRegAns(e.target.value)} 
                    placeholder="Enter answer (masked in dots)" 
                    required 
                  />
                </div>

                <button type="submit" className="primary-btn login-submit" disabled={authBusy}>
                  {authBusy ? 'Creating account…' : 'Create Account & Unlock Terminal 🚀'}
                </button>
                <button type="button" className="secondary-btn" style={{width:'100%',marginTop:8}} onClick={() => setAuthView('LOGIN')}>
                  ← Back to Sign In
                </button>
                {authError && <div className="login-error">{authError}</div>}
              </form>
            )}

            {authView === 'CHALLENGE' && (
              <form onSubmit={handleChallengeSubmit}>
                <div className="auth-step-pill">Step 2 of 2 · Two-Factor Challenge</div>
                <h2>Identity Verification</h2>
                <p className="login-sub">Hello {pendingChallenge?.fullName}. Please answer your security challenge.</p>

                <div className="field">
                  <label style={{color:'#2563eb',fontWeight:800,fontSize:11}}>{pendingChallenge?.question}</label>
                  <input 
                    type="password" 
                    value={challengeAnswer} 
                    onChange={e => setChallengeAnswer(e.target.value)} 
                    placeholder="Enter answer (masked in dots)" 
                    required 
                    autoFocus 
                  />
                </div>

                <button type="submit" className="primary-btn login-submit" disabled={authBusy}>
                  {authBusy ? 'Verifying…' : 'Complete 2FA Sign-In 🔓'}
                </button>
                <button type="button" className="secondary-btn" style={{width:'100%',marginTop:10}} onClick={() => { setAuthView('LOGIN'); setPendingChallenge(null); setAuthError(''); }}>
                  ← Change User ID
                </button>
                {authError && <div className="login-error">{authError}</div>}
              </form>
            )}
          </div>
        </div>
      )}

      {/* DASHBOARD SHELL */}
      <div className="shell">
        <aside className="sidebar">
          <div className="logo-slot">
            <div className="logo-placeholder">JHJ</div>
            <div><strong>JHJ eCommerce<br/>DSS System</strong><small>Warehouse intelligence</small></div>
          </div>
          <div className="workspace"><small>Workspace</small><strong>South Hub · Chennai</strong></div>

          <div className="nav-label">Workspace</div>
          <nav className="nav">
            <button className={view === 'DASHBOARD' && filter === 'all' ? 'active' : ''} onClick={() => { setView('DASHBOARD'); setFilter('all'); }}>
              Order overview
            </button>
            <button className="nav-item-red" onClick={() => { setView('DASHBOARD'); setFilter('red'); }}>
              Needs attention <span className="count">{orders.filter(o => o.risk === 'red').length}</span>
            </button>
            <button className="nav-item-green" onClick={() => { setView('DASHBOARD'); setFilter('green'); }}>
              Ready to fulfil
            </button>
          </nav>

          <div className="nav-label">Manage</div>
          <nav className="nav">
            <button onClick={() => {
              if (currentUser) {
                setSettingsCurrentPass('');
                setSettingsPass('');
                setSettingsQ('');
                setSettingsAns('');
                setSettingsError('');
                setShowSettingsModal(true);
              }
            }}>
              <Settings size={15}/> My Security &amp; 2FA
            </button>
            <button onClick={openTeamModal}>
              <Users size={15}/> Invite Teammates
            </button>
          </nav>

          <div className="side-bottom">
            <div className="profile">
              <div className="avatar">{currentUser?.avatar || 'HV'}</div>
              <div style={{minWidth:0}}>
                <strong>{currentUser?.fullName || 'Hemavarshini Y'}</strong>
                <small>{currentUser?.role || 'Creator / Admin'}</small>
              </div>
              <button className="icon-btn" style={{marginLeft:'auto'}} onClick={handleLogout} title="Sign Out">
                <LogOut size={15}/>
              </button>
            </div>
          </div>
        </aside>

        <main className="main">
          <header className="topbar">
            <div className="topbar-left">
              <div className="top-brand">
                <div className="top-logo-slot">JHJ</div>
                <div className="top-brand-name">JHJ <span>eCommerce DSS</span></div>
              </div>
              <div className="breadcrumb">South Hub · Chennai / <b>{view === 'DASHBOARD' ? 'Order overview' : 'Order investigation'}</b></div>
            </div>
            <div className="top-actions">
              <div className="warehouse-pill"><span></span>South Hub · Active (18ms)</div>
              <button className="topbar-user-pill" onClick={() => setShowMobMenu(true)} title="My Profile & Security">
                {currentUser?.avatar || 'HV'}
              </button>
            </div>
          </header>

          <div className="content">
            {view === 'DASHBOARD' ? (
              <>
                <div className="greeting">
                  <div>
                    <div className="eyebrow">JHJ · Intelligent Reverse Logistics Platform</div>
                    <h1>Welcome back, {currentUser?.fullName?.split(' ')[0] || 'Hemavarshini'} 👋</h1>
                    <p className="subtitle">Real-time pre-dispatch return interception powered by XAI TreeSHAP.</p>
                  </div>
                  <div className="date-chip">Tuesday, 3 November · Shift overview</div>
                </div>

                <div className="summary">
                  <div className="summary-card card-queue" onClick={() => setFilter('all')} title="Click to view all orders">
                    <div className="summary-icon" style={{background:'#eaf2ff',color:'#2459b8'}}><Box size={18}/></div>
                    <div><div className="label">Orders in queue</div><div className="value">{String(orders.length).padStart(2,'0')}</div></div>
                  </div>
                  <div className="summary-card card-needs-attention" onClick={() => setFilter('red')} title="Click to filter orders needing attention">
                    <div className="summary-icon" style={{background:'#fff0ef',color:'#d94b4b'}}><ShieldAlert size={18}/></div>
                    <div><div className="label">Needs attention</div><div className="value">{String(orders.filter(o => o.risk === 'red').length).padStart(2,'0')}</div></div>
                  </div>
                  <div className="summary-card card-ready-fulfil" onClick={() => setFilter('green')} title="Click to filter orders ready to fulfil">
                    <div className="summary-icon" style={{background:'#e9f8f0',color:'#178b58'}}><CheckCircle size={18}/></div>
                    <div><div className="label">Ready to fulfil</div><div className="value">{String(orders.filter(o => o.risk === 'green').length).padStart(2,'0')}</div></div>
                  </div>
                  <div className="summary-card card-savings" style={{background:'linear-gradient(135deg,#ffffff,#f0fdf4)',borderColor:'#bbf7d0'}} title="Total net savings realized">
                    <div className="summary-icon" style={{background:'#dcfce7',color:'#15803d'}}><Wallet size={18}/></div>
                    <div><div className="label" style={{color:'#15803d',fontWeight:700}}>Net Realized Savings</div><div className="value" style={{color:'#166534'}}>₹{Math.round(totalSavings).toLocaleString()}</div></div>
                  </div>
                </div>

                <section className="queue-panel">
                  <div className="panel-head">
                    <div>
                      <h2>Pre-dispatch order queue</h2>
                      <p>Prioritised by return probability and unit-economics cost recovery.</p>
                    </div>
                    <div className="search-wrap">
                      <input 
                        placeholder="Search product or order..." 
                        value={search} 
                        onChange={e => setSearch(e.target.value)} 
                      />
                      <button className="simulate-btn" onClick={simulateIngress}>
                        <Plus size={14}/> ⚡ Ingress
                      </button>
                    </div>
                  </div>

                  <div className="filters">
                    {['all', 'red', 'amber', 'green'].map(f => (
                      <button 
                        key={f} 
                        data-filter={f}
                        className={`filter filter-${f} ${filter === f ? 'active' : ''}`}
                        onClick={() => setFilter(f)}
                      >
                        {f === 'all' ? 'All orders' : f === 'red' ? '🔴 Needs attention' : f === 'amber' ? '🟡 Review' : '🟢 Ready to fulfil'}
                      </button>
                    ))}
                  </div>

                  <div className="queue-list">
                    {filteredOrders.map(o => (
                      <div key={o.id} className={`order-row risk-${o.risk}`} onClick={() => { setSelectedOrder(o); setView('DETAIL'); }}>
                        <div className="product-cell">
                          <div className="product-thumb"><Box size={24} color="#3b82f6"/></div>
                          <div>
                            <div className="product-name">{o.name}</div>
                            <div className="product-meta"><b>{o.id}</b> · {o.sku} · <span style={{color:'#2563eb',fontWeight:700}}>{o.payment}</span></div>
                            <div className="mob-order-sub">
                              <span className="mob-prob" style={{color: o.risk === 'red' ? '#dc2626' : o.risk === 'green' ? '#168653' : '#d97706'}}>
                                P(ret): <b>{Math.round(o.p_return * 100)}%</b>
                              </span>
                              {o.net_savings > 0 && <span className="mob-save">+₹{Math.round(o.net_savings)}</span>}
                            </div>
                          </div>
                        </div>
                        <div className="warehouse-col">
                          <div className="cell-label">Warehouse</div>
                          <div className="cell-value">{o.warehouse}</div>
                          <div className="cell-sub">{o.eta}</div>
                        </div>
                        <div className="transport-col">
                          <div className="cell-label">Risk Diagnosis</div>
                          <div className="cell-value">{o.tag}</div>
                          <div className="cell-sub">P(return): <b>{Math.round(o.p_return * 100)}%</b></div>
                        </div>
                        <div className="risk-col">
                          <span className={`rag ${o.risk}`}><i></i>{o.risk === 'red' ? 'Needs attention' : o.risk === 'amber' ? 'Review suggested' : 'Ready to fulfil'}</span>
                        </div>
                        <div className="open-link">
                          {o.net_savings > 0 && <span style={{display:'block',color:'#168653',fontSize:10}}>+₹{Math.round(o.net_savings)}</span>}
                          View details →
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </>
            ) : (
              /* DETAIL VIEW */
              <div>
                <button className="back-btn" onClick={() => setView('DASHBOARD')}>← Back to order queue</button>
                <div className="detail-heading">
                  <div>
                    <div className="eyebrow">Order root-cause investigation</div>
                    <h1>{selectedOrder.id} · {selectedOrder.name}</h1>
                    <p className="subtitle">Evaluate XAI TreeSHAP attributions and execute targeted physical interventions.</p>
                  </div>
                  <span className={`rag ${selectedOrder.risk}`}><i></i>{selectedOrder.risk.toUpperCase()} RISK ({Math.round(selectedOrder.p_return * 100)}%)</span>
                </div>

                <div className="detail-layout">
                  <div>
                    <section className="card">
                      <h3 className="card-title">Product &amp; order information</h3>
                      <div className="info-grid">
                        <div className="info-item"><label>Order type</label><strong>{selectedOrder.is_bracket ? 'Bracket Size Purchase' : 'Standard'}</strong></div>
                        <div className="info-item"><label>Payment method</label><strong>{selectedOrder.payment}</strong></div>
                        <div className="info-item"><label>Return probability</label><strong>{Math.round(selectedOrder.p_return * 100)}% (XGBoost)</strong></div>
                        <div className="info-item"><label>Fulfilment location</label><strong>{selectedOrder.warehouse}</strong></div>
                      </div>
                    </section>

                    <section className="card" style={{marginTop:17}}>
                      <h3 className="card-title">Targeted mitigation &amp; unit economics</h3>
                      <div className="economics-box">
                        <div className="economics-grid">
                          <div className="economics-metric"><small>Baseline Loss</small><strong style={{color:'var(--red)'}}>₹{selectedOrder.base_loss.toFixed(2)}</strong></div>
                          <div className="economics-metric"><small>Intervention Cost</small><strong style={{color:'#2459b8'}}>₹{selectedOrder.action_cost.toFixed(2)}</strong></div>
                          <div className="economics-metric"><small>Net Savings</small><strong style={{color:'var(--green)'}}>+₹{selectedOrder.net_savings.toFixed(2)}</strong></div>
                        </div>
                      </div>

                      <div className="action-bar">
                        <button className="primary-btn" onClick={applyIntervention}>Execute Action &amp; Clear for Dispatch</button>
                      </div>
                      {selectedOrder.risk === 'green' && (
                        <div className="success-banner" style={{marginTop:14}}>
                          ✓ Proactive action recorded! Return risk reduced to 12%. Net savings secured.
                        </div>
                      )}
                    </section>
                  </div>

                  <div>
                    <section className="card explain-card">
                      <h3 className="card-title">TreeSHAP Root Cause Explanation</h3>
                      <div className="explain-intro">{selectedOrder.intro}</div>
                      
                      <div className="shap-section">
                        <div className="shap-title"><span>Feature Attribution</span><small>Shapley Values</small></div>
                        {selectedOrder.shap?.map((s, idx) => (
                          <div key={idx} className="shap-row">
                            <div className="shap-meta">
                              <span>{s.label}</span>
                              <span style={{color: s.val > 0 ? '#d94b4b' : '#178b58'}}>{s.val > 0 ? '+' : ''}{s.val}%</span>
                            </div>
                            <div className="shap-track">
                              <div className={`shap-bar ${s.val > 0 ? 'red' : 'green'}`} style={{width: `${Math.min(100, Math.abs(s.val) * 2)}%`}} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* TEAM INVITATION MODAL */}
      {showTeamModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-head">
              <h3>Team Access &amp; Member Roster</h3>
              <button className="icon-btn" onClick={() => setShowTeamModal(false)}>×</button>
            </div>

            <div className="team-list">
              {team.map(u => (
                <div key={u.userId} className="team-item">
                  <div>
                    <strong>{u.fullName}</strong>
                    <span style={{fontSize:10,color:'var(--muted)',display:'block'}}>User ID: <b>{u.userId}</b></span>
                  </div>
                  <span className={`role-badge ${u.isCreator ? 'role-creator' : 'role-member'}`}>
                    {u.isCreator ? '👑 Creator' : '✓ Active Member'}
                  </span>
                </div>
              ))}
              {team.length === 0 && !teamError && (
                <div style={{fontSize:11,color:'var(--muted)',padding:8}}>Loading team roster…</div>
              )}
            </div>
            {teamError && <div className="login-error" style={{textAlign:'left'}}>{teamError}</div>}

            {!creatorPinVerified ? (
              <div className="auth-gate-box">
                <strong>🔒 Creator Master PIN Required to View Invite Key</strong>
                <p>Enter your PIN to unlock the Team Invite Code. Only the Creator account can perform this action.</p>
                <div style={{display:'flex',gap:8}}>
                  <input 
                    type="password" 
                    placeholder="Creator Master PIN"
                    value={creatorPinInput} 
                    onChange={e => setCreatorPinInput(e.target.value)} 
                  />
                  <button className="primary-btn" onClick={handleVerifyCreator}>Verify</button>
                </div>
                {creatorPinError && <div className="login-error" style={{textAlign:'left'}}>{creatorPinError}</div>}
              </div>
            ) : (
              <div style={{background:'#f0fdf4',border:'1.5px solid #86efac',borderRadius:14,padding:18}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <strong style={{fontSize:13,color:'#166534'}}>✓ Active Team Invite Code:</strong>
                  <span className="role-badge role-creator">Creator Authorization</span>
                </div>
                <div style={{margin:'12px 0',background:'#fff',border:'1px dashed #22c55e',padding:12,borderRadius:10,textAlign:'center'}}>
                  <span style={{fontSize:18,fontFamily:'monospace',fontWeight:900,color:'#15803d',letterSpacing:2}}>{inviteCode || '—'}</span>
                </div>
                <p style={{fontSize:11,color:'#15803d',margin:'0 0 10px',lineHeight:1.5}}>
                  Share this code with your teammates. They click <em>"Have a Team Invite Code? Register Your Account Here"</em> on the sign-in page and choose their own credentials.
                </p>
                <button className="primary-btn" style={{width:'100%'}} disabled={!inviteCode} onClick={() => {
                  if (!inviteCode) return;
                  navigator.clipboard.writeText(inviteCode);
                  showToast('Invite code copied to clipboard!');
                }}>
                  Copy Invite Code to Clipboard
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MY SECURITY SETTINGS MODAL */}
      {showSettingsModal && (
        <div className="modal-overlay">
          <div className="modal-card" style={{maxWidth:480}}>
            <div className="modal-head">
              <h3>My Security &amp; 2FA Settings</h3>
              <button className="icon-btn" onClick={() => setShowSettingsModal(false)}>×</button>
            </div>
            <form onSubmit={handleSaveSecurity}>
              <div className="field">
                <label>My User ID</label>
                <input type="text" value={currentUser?.userId} disabled style={{background:'#f3f4f6',color:'#6b7280'}} />
              </div>
              <div className="field">
                <label>Current Password (required)</label>
                <input
                  type="password"
                  value={settingsCurrentPass}
                  onChange={e => setSettingsCurrentPass(e.target.value)}
                  placeholder="Confirm your current password"
                  autoComplete="current-password"
                  required
                />
              </div>
              <div className="field">
                <label>New Password (optional)</label>
                <input
                  type="password"
                  value={settingsPass}
                  onChange={e => setSettingsPass(e.target.value)}
                  placeholder="Leave blank to keep current"
                  autoComplete="new-password"
                />
              </div>
              <div className="field">
                <label>New 2FA Challenge Question (optional)</label>
                <input
                  type="text"
                  value={settingsQ}
                  onChange={e => setSettingsQ(e.target.value)}
                  placeholder="Leave blank to keep current"
                />
              </div>
              <div className="field">
                <label>New Secret Answer (optional, masked)</label>
                <input
                  type="password"
                  value={settingsAns}
                  onChange={e => setSettingsAns(e.target.value)}
                  placeholder="Leave blank to keep current"
                />
              </div>
              {settingsError && <div className="login-error">{settingsError}</div>}
              <button type="submit" className="primary-btn" style={{width:'100%',marginTop:14}} disabled={settingsBusy}>
                {settingsBusy ? 'Saving…' : 'Save Updates ✓'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      {currentUser && (
        <nav className="mobile-bottom-nav">
          <button 
            className={`mob-nav-btn ${view === 'DASHBOARD' && filter === 'all' ? 'active' : ''}`}
            onClick={() => { setView('DASHBOARD'); setFilter('all'); }}
          >
            <Box size={18}/>
            <span>Overview</span>
          </button>
          <button 
            className={`mob-nav-btn mob-red ${filter === 'red' ? 'active' : ''}`}
            onClick={() => { setView('DASHBOARD'); setFilter('red'); }}
          >
            <div style={{position:'relative',display:'inline-block'}}>
              <ShieldAlert size={18}/>
              <span className="mob-badge">{orders.filter(o => o.risk === 'red').length}</span>
            </div>
            <span>Attention</span>
          </button>
          <button 
            className={`mob-nav-btn mob-green ${filter === 'green' ? 'active' : ''}`}
            onClick={() => { setView('DASHBOARD'); setFilter('green'); }}
          >
            <CheckCircle size={18}/>
            <span>Ready</span>
          </button>
          <button 
            className="mob-nav-btn"
            onClick={openTeamModal}
          >
            <Users size={18}/>
            <span>Team</span>
          </button>
          <button 
            className="mob-nav-btn"
            onClick={() => setShowMobMenu(true)}
          >
            <div className="mob-avatar">{currentUser?.avatar || 'HV'}</div>
            <span>Account</span>
          </button>
        </nav>
      )}

      {/* MOBILE PROFILE & SECURITY BOTTOM SHEET */}
      {showMobMenu && (
        <div className="modal-overlay" onClick={() => setShowMobMenu(false)}>
          <div className="modal-card" style={{maxWidth:400}} onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                <div className="avatar">{currentUser?.avatar || 'HV'}</div>
                <div>
                  <strong style={{fontSize:13,display:'block'}}>{currentUser?.fullName || 'Hemavarshini Y'}</strong>
                  <small style={{color:'var(--muted)'}}>{currentUser?.role || 'Creator / Admin'}</small>
                </div>
              </div>
              <button className="icon-btn" onClick={() => setShowMobMenu(false)}>×</button>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:9,marginTop:10}}>
              <button 
                className="secondary-btn" 
                style={{textAlign:'left',display:'flex',alignItems:'center',gap:10,padding:'12px 14px'}}
                onClick={() => {
                  setShowMobMenu(false);
                  setSettingsCurrentPass('');
                  setSettingsPass('');
                  setSettingsQ('');
                  setSettingsAns('');
                  setSettingsError('');
                  setShowSettingsModal(true);
                }}
              >
                <Settings size={16}/>
                <span>Update Password &amp; 2FA Challenge</span>
              </button>
              <button 
                className="secondary-btn" 
                style={{textAlign:'left',display:'flex',alignItems:'center',gap:10,padding:'12px 14px'}}
                onClick={() => {
                  setShowMobMenu(false);
                  openTeamModal();
                }}
              >
                <Users size={16}/>
                <span>Invite Teammates (Jayanth / Jeyashree)</span>
              </button>
              <button 
                className="primary-btn" 
                style={{background:'#dc2626',borderColor:'#b91c1c',marginTop:4,padding:12}}
                onClick={() => {
                  setShowMobMenu(false);
                  handleLogout();
                }}
              >
                🚪 Secure Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {toastMsg && <div className="toast show">{toastMsg}</div>}
    </div>
  );
}
