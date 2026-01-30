let provider, signer, contract;

// --- CONFIGURATION ---
const CONTRACT_ADDRESS = "0x7fc5981bb95843Ef408d1BB2AeaA69915F397b35"; 
const USDT_TOKEN_ADDRESS = "0x3b66b1e08f55af26c8ea14a73da64b6bc8d799de"; // BSC USDT
const TESTNET_CHAIN_ID = 97; 

// --- RANK CONFIG (Star1 to Master King) ---
const RANK_DETAILS = [
    { name: "NONE", roi: "0%", targetTeam: 0, targetVolume: 0 },
    { name: "Star1", roi: "1.00%", targetTeam: 10, targetVolume: 500 },
    { name: "Star2", roi: "2.00%", targetTeam: 20, targetVolume: 1000 },
    { name: "Star3", roi: "3.00%", targetTeam: 50, targetVolume: 2500 },
    { name: "Star4", roi: "4.00%", targetTeam: 75, targetVolume: 5000 },
    { name: "Star5", roi: "5.00%", targetTeam: 100, targetVolume: 10000 },
    { name: "Kings Star", roi: "7.00%", targetTeam: 250, targetVolume: 50000 },
    { name: "Master King", roi: "7.50%", targetTeam: 250, targetVolume: 50000 }
];

// --- ABI (Full Updated for USDT Contract) ---
const CONTRACT_ABI = [
    "function register(string username, string referrerUsername) external",
    "function deposit(uint256 amount) external", 
    "function claimRewards() external",
    "function reinvestMatured() external",
    "function withdrawMaturedCapital() external",
    "function getRankName(uint8 rankId) public view returns (string)",
    "function getLevelTeamDetails(address _upline, uint256 _level) view returns (string[] names, address[] wallets, uint256[] joinDates, uint256[] activeDeps, uint256[] teamTotalDeps, uint256[] teamActiveDeps, uint256[] withdrawals)",
    "function getLiveBalance(address uA) view returns (uint256 pendingROI)",
    "function users(address) view returns (address referrer, string username, bool registered, uint256 joinDate, uint256 totalActiveDeposit, uint256 teamActiveDeposit, uint256 teamTotalDeposit, uint256 totalDeposited, uint256 totalWithdrawn, uint256 totalEarnings)",
    "function usersExtra(address) view returns (uint256 rewardsReferral, uint256 rewardsRank, uint256 reserveDailyROI, uint32 teamCount, uint32 directsCount, uint32 directsQuali, uint8 rank)",
    "function getPosition(address uA, uint256 i) view returns (tuple(uint256 amount, uint256 startTime, uint256 lastCheckpoint, uint256 endTime, uint256 earned, uint256 expectedTotalEarn, bool active) v)",
    "function getUserTotalPositions(address uA) view returns (uint256)",
    "function getUserHistory(address _user) view returns (tuple(string txType, uint256 amount, uint256 timestamp, string detail)[])"
];

const ERC20_ABI = ["function approve(address spender, uint256 amount) public returns (bool)", "function allowance(address owner, address spender) public view returns (uint256)"];

// ROI calculation (0.7% fixed)
const calculateGlobalROI = () => 0.70;

// --- 1. AUTO-FILL LOGIC ---
function checkReferralURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const refName = urlParams.get('ref');
    const refField = document.getElementById('reg-referrer');
    if (refName && refField) {
        refField.value = refName.trim();
        console.log("Referral auto-filled:", refName);
    }
}

// --- INITIALIZATION ---
async function init() {
    checkReferralURL();
    if (window.ethereum) {
        try {
            provider = new ethers.providers.Web3Provider(window.ethereum);
            const accounts = await provider.listAccounts();
            window.signer = provider.getSigner();
            signer = window.signer;
            window.contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
            contract = window.contract;

            if (accounts.length > 0) {
                if (localStorage.getItem('manualLogout') !== 'true') {
                    await setupApp(accounts[0]);
                } else {
                    updateNavbar(accounts[0]);
                }
            }
        } catch (error) { console.error("Init Error", error); }
    } else { alert("Please install MetaMask!"); }
}

// --- CORE LOGIC ---
window.handleDeposit = async function() {
    const amountInput = document.getElementById('deposit-amount');
    const depositBtn = document.getElementById('deposit-btn');
    if (!amountInput || !amountInput.value || amountInput.value < 10) return alert("Min 10 USDT required!");
    
    const amountInWei = ethers.utils.parseUnits(amountInput.value.toString(), 18);
    const usdt = new ethers.Contract(USDT_TOKEN_ADDRESS, ERC20_ABI, signer);

    try {
        depositBtn.disabled = true;
        depositBtn.innerText = "APPROVING...";
        
        // Approve Check
        const allowance = await usdt.allowance(await signer.getAddress(), CONTRACT_ADDRESS);
        if (allowance.lt(amountInWei)) {
           const txApp = await usdt.approve(CONTRACT_ADDRESS, amountInWei);
            await txApp.wait();
        }

        depositBtn.innerText = "SIGNING...";
        const tx = await contract.deposit(amountInWei);
        depositBtn.innerText = "DEPOSITING...";
        await tx.wait();
        location.reload(); 
    } catch (err) {
        alert("Error: " + (err.reason || err.message));
        depositBtn.innerText = "DEPOSIT NOW";
        depositBtn.disabled = false;
    }
}

window.handleClaim = async function() {
    try {
        const tx = await contract.claimRewards();
        await tx.wait();
        location.reload();
    } catch (err) { alert("Claim failed: " + (err.reason || err.message)); }
}

window.handleCompoundDaily = async function() {
    try {
        const tx = await contract.reinvestMatured();
        await tx.wait();
        location.reload();
    } catch (err) { alert("Reinvest failed: " + (err.reason || err.message)); }
}

window.handleCapitalWithdraw = async function() {
    if (!confirm("Are you sure? This will withdraw matured capital.")) return;
    try {
        const tx = await contract.withdrawMaturedCapital();
        await tx.wait();
        location.reload();
    } catch (err) { alert("Failed: " + (err.reason || err.message)); }
}

window.handleLogin = async function() {
    try {
        if (!window.ethereum) return alert("Please install MetaMask!");
        const accounts = await provider.send("eth_requestAccounts", []);
        if (accounts.length === 0) return;
        const userAddress = accounts[0]; 
        signer = provider.getSigner();
        contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
        localStorage.removeItem('manualLogout');
        const userData = await contract.users(userAddress);

        if (userData.registered === true) {
            if(typeof showLogoutIcon === "function") showLogoutIcon(userAddress);
            window.location.href = "index1.html";
        } else {
            alert("Not registered!");
            window.location.href = "register.html";
        }
    } catch (err) { alert("Login failed!"); }
}

window.handleRegister = async function() {
    const userField = document.getElementById('reg-username');
    const refField = document.getElementById('reg-referrer');
    if (!userField || !refField) return;
    try {
        const tx = await contract.register(userField.value.trim(), refField.value.trim());
        await tx.wait();
        localStorage.removeItem('manualLogout'); 
        window.location.href = "index1.html";
    } catch (err) { alert("Error: " + (err.reason || err.message)); }
}

window.handleLogout = function() {
    if (confirm("Disconnect?")) {
        localStorage.setItem('manualLogout', 'true');
        window.location.href = "index.html";
    }
}

function showLogoutIcon(address) {
    const btn = document.getElementById('connect-btn');
    const logout = document.getElementById('logout-icon-btn');
    if (btn) btn.innerText = address.substring(0, 6) + "..." + address.substring(38);
    if (logout) logout.style.display = 'flex'; 
}

// --- APP SETUP ---
async function setupApp(address) {
    const { chainId } = await provider.getNetwork();
    if (chainId !== TESTNET_CHAIN_ID) { alert("Switch to BSC Mainnet!"); return; }
    const userData = await contract.users(address);
    const path = window.location.pathname;

    if (!userData.registered) {
        if (!path.includes('register.html') && !path.includes('login.html')) {
            window.location.href = "register.html"; 
            return; 
        }
    } else {
        if (path.includes('register.html') || path.includes('login.html') || path.endsWith('/') || path.endsWith('index.html')) {
            window.location.href = "index1.html";
            return;
        }
    }

    updateNavbar(address);
    showLogoutIcon(address); 

    if (path.includes('index1.html')) {
        fetchAllData(address);
        start8HourCountdown(); 
    }
    if (path.includes('leadership.html')) fetchLeadershipData(address);
    if (path.includes('history.html')) window.showHistory('deposit');
}

// --- HISTORY LOGIC ---
window.showHistory = async function(type) {
    const container = document.getElementById('history-container');
    if(!container) return;
    container.innerHTML = `<div class="p-10 text-center text-yellow-500 italic">Syncing...</div>`;
    const logs = await window.fetchBlockchainHistory(type);
    if (logs.length === 0) {
        container.innerHTML = `<div class="p-10 text-center text-gray-500">No data.</div>`;
        return;
    }
    container.innerHTML = logs.map(item => `
        <div class="bg-white/5 border border-white/10 rounded-2xl p-4 mb-4 flex justify-between items-center">
            <div>
                <h4 class="font-bold ${item.color}">${item.type}</h4>
                <p class="text-xs text-gray-400">${item.date} | ${item.time}</p>
            </div>
            <div class="text-right">
                <span class="text-lg font-black text-white">${item.amount}</span>
            </div>
        </div>
    `).join('');
}

window.fetchBlockchainHistory = async function(type) {
    try {
        const address = await signer.getAddress();
        const rawHistory = await contract.getUserHistory(address);
        return rawHistory.map(item => {
            const txType = item.txType.toUpperCase();
            const dt = new Date(item.timestamp.toNumber() * 1000);
            return {
                type: txType, amount: format(item.amount), date: dt.toLocaleDateString(),
                time: dt.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
                ts: item.timestamp.toNumber(), color: 'text-cyan-400'
            };
        }).sort((a,b) => b.ts - a.ts);
    } catch (e) { return []; }
}

// --- DATA FETCHING ---
async function fetchAllData(address) {
    try {
        // 1. Contract se saara data fetch karna
        const [user, extra, live] = await Promise.all([
            contract.users(address), 
            contract.usersExtra(address), 
            contract.getLiveBalance(address)
        ]);

        // --- USER PROFILE & ADDRESS ---
        // Pehle username nahi dikh raha tha, ab yahan se dikhega
        updateText('username-display', user.username || "USER"); 
        updateText('user-address', address.substring(0, 6) + "..." + address.substring(38));

        // --- DASHBOARD GRID BOXES ---
        updateText('total-deposit', format(user.totalDeposited));
        updateText('active-deposit', format(user.totalActiveDeposit));
        updateText('total-earned', format(user.totalEarnings));
        updateText('total-withdrawn', format(user.totalWithdrawn));
        
        // Naye IDs jo aapne grid mein add kiye hain
        updateText('level-earning', format(extra.rewardsReferral)); 
        updateText('rank-earning', format(extra.rewardsRank)); 

        // --- COMPOUND POWER SECTION ---
        const pendingROI = parseFloat(format(live));
        const reserveDaily = parseFloat(format(extra.reserveDailyROI));
        const currentProfit = (pendingROI + reserveDaily).toFixed(4);

        // Circle ke andar active capital dikhana
        updateText('active-deposit-cp', format(user.totalActiveDeposit));
        // Daily percentage (Dashboard par fix 5-6% dikhaya hai, par calculation 0.7% per cycle hai)
        const activeAmt = parseFloat(format(user.totalActiveDeposit));
        updateText('projected-return', (activeAmt * 0.007).toFixed(4));

        // --- WITHDRAWABLE & CAPITAL SECTION ---
        const networkIncome = parseFloat(format(extra.rewardsReferral)) + parseFloat(format(extra.rewardsRank));
        const totalWithdrawable = (pendingROI + reserveDaily + networkIncome).toFixed(4);
        
        updateText('compounding-balance', currentProfit); // Sirf trading profit
    
        updateText('withdrawable', totalWithdrawable);    // Total (Profit + Referral)
        updateText('cap-balance', format(user.totalActiveDeposit)); // Available Capital

        // --- RANK & STATUS ---
        const rankName = await contract.getRankName(extra.rank);
        updateText('rank-display', rankName);

        // Status Auto-Update logic
        const statusText = document.getElementById('main-status-text');
        const statusBadge = document.getElementById('status-badge');
        if (activeAmt > 0) {
            if(statusText) { statusText.innerText = "ACTIVE"; statusText.className = "text-xs font-black orbitron text-green-500"; }
            if(statusBadge) { 
                statusBadge.innerHTML = "● Active Status"; 
                statusBadge.className = "px-4 py-1 rounded-full bg-green-500/20 text-green-500 text-[10px] font-black border border-green-500/30 uppercase"; 
            }
        } else {
            if(statusText) { statusText.innerText = "INACTIVE"; statusText.className = "text-xs font-black orbitron text-red-500"; }
        }

        // --- REFERRAL URL ---
        const baseUrl = window.location.origin + window.location.pathname.replace('index1.html', 'register.html');
        const refField = document.getElementById('refURL');
        if(refField) refField.value = `${baseUrl}?ref=${user.username}`;

    } catch (err) { 
        console.error("Data Sync Error:", err); 
    }
}

async function fetchLeadershipData(address) {
    try {
        // 1. Contract se dono mapping ka data fetch karna
        const [user, extra] = await Promise.all([
            contract.users(address), 
            contract.usersExtra(address)
        ]);

        // 2. Simple Numbers mein convert karna
        const teamActiveVol = parseFloat(ethers.utils.formatUnits(user.teamActiveDeposit, 18));
        const teamTotalVol = parseFloat(ethers.utils.formatUnits(user.teamTotalDeposit, 18));
        const rankRewards = parseFloat(ethers.utils.formatUnits(extra.rewardsRank, 18));
        const teamCount = extra.teamCount; // Ye missing tha
        const directsQuali = extra.directsQuali;

        // 3. UI Elements ko update karna (Jo aapne HTML mein IDs di hain)
        updateText('team-active-deposit', teamActiveVol.toFixed(2));
        updateText('team-total-deposit', teamTotalVol.toFixed(2));
        updateText('rank-reward-available', rankRewards.toFixed(2));
        updateText('current-team-count', teamCount);
        updateText('directs-quali', directsQuali);
        updateText('current-team-volume', teamActiveVol.toFixed(0));

        // 4. Sabse Zaruri: Rank Progress Bar aur Next Target update karna
        // Ye function aapne HTML page ke script tag mein likha hai
        if (typeof updateRankUI === "function") {
            updateRankUI(extra, teamActiveVol);
        }

    } catch (err) { 
        console.error("Leadership Data Error:", err); 
    }
}
function start8HourCountdown() {
    const timerElement = document.getElementById('next-timer');
    if (!timerElement) return;
    setInterval(() => {
        const now = new Date();
        const eightHoursInMs = 8 * 60 * 60 * 1000;
        const nextTarget = Math.ceil(now.getTime() / eightHoursInMs) * eightHoursInMs;
        const diff = nextTarget - now.getTime();
        const h = Math.floor(diff / 3600000).toString().padStart(2, '0');
        const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
        const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
        timerElement.innerText = `${h}:${m}:${s}`;
    }, 1000);
}

// --- UTILS ---
const format = (val) => {
    try { return parseFloat(ethers.utils.formatUnits(val, 18)).toFixed(2); }
    catch { return "0.00"; }
};


const updateText = (id, val) => { 
    const elements = document.querySelectorAll(`[id="${id}"]`); 
    if(elements.length > 0) {
        elements.forEach(el => {
            el.innerText = val; 
        });
    }
};

function updateNavbar(addr) {
    const btn = document.getElementById('connect-btn');
    if(btn) btn.innerText = addr.substring(0,6) + "..." + addr.substring(38);
}

window.addEventListener('load', init);







