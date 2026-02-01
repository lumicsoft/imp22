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

// ROI calculation (0.9% fixed)
const calculateGlobalROI = () => 0.90;

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
// --- INITIALIZATION (Silent & Manual) ---
async function init() {
    checkReferralURL();
    
    const bscTestnetRPC = "https://data-seed-prebsc-1-s1.binance.org:8545/";
    const savedAddr = localStorage.getItem('userAddress');
    const isIndexPage = window.location.pathname.endsWith('index.html') || window.location.pathname === '/';

    try {
        if (window.ethereum) {
            // Sirf provider setup karo, wallet se permission abhi MAT maango
            provider = new ethers.providers.Web3Provider(window.ethereum, "any");
            
            // Background mein contract object ready rakho (without signer for now)
            window.contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
            contract = window.contract;

            // --- CONDITION START ---
            if (isIndexPage) {
                // AGAR INDEX PAGE HAI: 
                // Kuch mat karo. Na login, na redirect. Chup-chaap read-only data dikhao agar savedAddr hai.
                if (savedAddr) {
                    await setupReadOnly(bscTestnetRPC, savedAddr);
                }
            } else {
                // AGAR DASHBOARD/HISTORY PAGE HAI:
                // Yahan automatic setup hone do taaki user ko bar-bar button na dabana pade
                const accounts = await window.ethereum.request({ method: 'eth_accounts' });
                if (accounts.length > 0) {
                    const address = accounts[0];
                    localStorage.setItem('userAddress', address);
                    signer = provider.getSigner();
                    window.signer = signer;
                    window.contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
                    contract = window.contract;
                    await setupApp(address);
                } else if (savedAddr) {
                    await setupReadOnly(bscTestnetRPC, savedAddr);
                }
            }
            // --- CONDITION END ---

            // Listeners (Ye zaroori hain background mein)
            window.ethereum.on('chainChanged', () => window.location.reload());
            window.ethereum.on('accountsChanged', (accs) => {
                if (accs.length === 0) localStorage.removeItem('userAddress');
                else localStorage.setItem('userAddress', accs[0]);
                window.location.reload();
            });

        } else {
            // No Wallet - Simple Read Only
            await setupReadOnly(bscTestnetRPC, savedAddr);
        }
    } catch (error) { 
        console.error("Init Error:", error);
        if (savedAddr) await setupReadOnly(bscTestnetRPC, savedAddr);
    }
}
// Trust Wallet Special: Forcefully data dikhane ke liye
// Trust Wallet Special: Backup data loader
async function setupReadOnly(rpcUrl, forcedAddress = null) {
    console.log("Mode: RPC/Memory Data Loading...");
    try {
        const tempProvider = new ethers.providers.JsonRpcProvider(rpcUrl);
        
        // Provider aur Contract ko set karein taaki functions crash na hon
        provider = tempProvider; 
        window.contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, tempProvider);
        contract = window.contract;
        
        // Address priority: 1. Jo function ko diya gaya 2. Jo memory mein hai
        const addressToUse = forcedAddress || localStorage.getItem('userAddress');
        
        if (addressToUse && addressToUse !== "undefined" && addressToUse !== null) {
            await setupApp(addressToUse);
        }
    } catch (e) {
        console.error("RPC Setup Failed:", e);
    }
}

// --- CORE LOGIC ---
window.handleDeposit = async function() {
    const amountInput = document.getElementById('deposit-amount');
    const depositBtn = document.getElementById('deposit-btn');
    
    if (!amountInput || !amountInput.value || amountInput.value < 10) {
        return alert("Min 10 USDT required!");
    }

    try {
        // --- MULTI-MODE CHECK (Fix for "Cannot read property") ---
        let activeSigner = window.signer || signer;
        let activeContract = window.contract || contract;

        // Agar signer nahi hai (RPC mode), toh wallet connect karwao
        if (!activeSigner || !window.ethereum) {
            if (!window.ethereum) return alert("Please use Trust Wallet or MetaMask browser!");
            
            const tempProvider = new ethers.providers.Web3Provider(window.ethereum, "any");
            await tempProvider.send("eth_requestAccounts", []);
            activeSigner = tempProvider.getSigner();
            activeContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, activeSigner);
            
            // Global variables bhi update kar dein taaki aage problem na aaye
            window.signer = activeSigner;
            window.contract = activeContract;
        }

        depositBtn.disabled = true;
        depositBtn.innerText = "APPROVING...";

        const amountInWei = ethers.utils.parseUnits(amountInput.value.toString(), 18);
        const userAddress = await activeSigner.getAddress();
        
        // USDT Contract with Active Signer
        const usdt = new ethers.Contract(USDT_TOKEN_ADDRESS, ERC20_ABI, activeSigner);

        // 1. Approve Check
        const allowance = await usdt.allowance(userAddress, CONTRACT_ADDRESS);
        if (allowance.lt(amountInWei)) {
            const txApp = await usdt.approve(CONTRACT_ADDRESS, amountInWei);
            await txApp.wait();
        }

        // 2. Deposit
        depositBtn.innerText = "SIGNING...";
        const tx = await activeContract.deposit(amountInWei);
        
        depositBtn.innerText = "DEPOSITING...";
        await tx.wait();
        
        alert("Deposit Successful!");
        location.reload(); 

    } catch (err) {
        console.error("Deposit Error:", err);
        alert("Error: " + (err.reason || err.message || "Transaction Failed"));
        depositBtn.innerText = "DEPOSIT NOW";
        depositBtn.disabled = false;
    }
}

window.handleClaim = async function() {
    const claimBtn = event.target; // Jo button click hua hai
    const originalText = claimBtn.innerText;

    try {
        // --- MULTI-MODE CHECK (Wallet Connection Check) ---
        let activeSigner = window.signer || signer;
        let activeContract = window.contract || contract;

        // Agar signer nahi hai, toh pehle wallet jagao
        if (!activeSigner || !window.ethereum) {
            if (!window.ethereum) return alert("Please use Trust Wallet or MetaMask browser!");
            
            const tempProvider = new ethers.providers.Web3Provider(window.ethereum, "any");
            await tempProvider.send("eth_requestAccounts", []);
            activeSigner = tempProvider.getSigner();
            activeContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, activeSigner);
            
            window.signer = activeSigner;
            window.contract = activeContract;
        }

        // UI Updates
        claimBtn.disabled = true;
        claimBtn.innerText = "SIGNING...";

        // --- TRANSACTION ---
        const tx = await activeContract.claimRewards();
        
        claimBtn.innerText = "CLAIMING...";
        console.log("Claim tx sent:", tx.hash);
        
        await tx.wait();
        
        alert("Rewards Claimed Successfully!");
        location.reload(); 

    } catch (err) {
        console.error("Claim Error:", err);
        alert("Claim failed: " + (err.reason || err.message || "User rejected or error occurred"));
        
        // Reset Button on Error
        claimBtn.innerText = originalText;
        claimBtn.disabled = false;
    }
}
window.handleCompoundDaily = async function() {
    // Button ko pehchano taaki animation dikha sakein
    const compoundBtn = event.target;
    const originalText = compoundBtn.innerText;

    try {
        // --- MULTI-MODE CHECK (Fix for RPC/Trust Wallet Delay) ---
        let activeSigner = window.signer || signer;
        let activeContract = window.contract || contract;

        // Agar signer missing hai, toh wallet connect request bhejo
        if (!activeSigner || !window.ethereum) {
            if (!window.ethereum) return alert("Please use Trust Wallet or MetaMask browser!");
            
            const tempProvider = new ethers.providers.Web3Provider(window.ethereum, "any");
            await tempProvider.send("eth_requestAccounts", []);
            activeSigner = tempProvider.getSigner();
            activeContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, activeSigner);
            
            // Global variables update taaki agli baar connect na karna pade
            window.signer = activeSigner;
            window.contract = activeContract;
        }

        // UI Updates - User ko busy rakho
        compoundBtn.disabled = true;
        compoundBtn.innerText = "WAITING...";

        // --- TRANSACTION: Reinvest Matured ---
        console.log("Starting Reinvestment...");
        const tx = await activeContract.reinvestMatured();
        
        compoundBtn.innerText = "REINVESTING...";
        await tx.wait();
        
        alert("Reinvestment Successful!");
        location.reload(); 

    } catch (err) {
        console.error("Compound Error:", err);
        // User ko clear error dikhao
        alert("Reinvest failed: " + (err.reason || err.message || "Transaction Rejected"));
        
        // Error par button ko wapas normal karo
        compoundBtn.innerText = originalText;
        compoundBtn.disabled = false;
    }
}

window.handleCapitalWithdraw = async function() {
    // 1. Pehle user se confirm karwao
    if (!confirm("Are you sure? This will withdraw your matured capital to your wallet.")) return;

    // Button ko pehchano animation ke liye
    const withdrawBtn = event.target;
    const originalText = withdrawBtn.innerText;

    try {
        // --- MULTI-MODE CHECK (Wallet Jagane ke liye) ---
        let activeSigner = window.signer || signer;
        let activeContract = window.contract || contract;

        if (!activeSigner || !window.ethereum) {
            if (!window.ethereum) return alert("Please use Trust Wallet or MetaMask browser!");
            
            const tempProvider = new ethers.providers.Web3Provider(window.ethereum, "any");
            await tempProvider.send("eth_requestAccounts", []);
            activeSigner = tempProvider.getSigner();
            activeContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, activeSigner);
            
            window.signer = activeSigner;
            window.contract = activeContract;
        }

        // 2. UI Updates - User ko busy rakho
        withdrawBtn.disabled = true;
        withdrawBtn.innerText = "CONFIRMING...";

        // --- TRANSACTION: Withdraw Capital ---
        console.log("Withdrawing Capital...");
        const tx = await activeContract.withdrawMaturedCapital();
        
        withdrawBtn.innerText = "WITHDRAWING...";
        await tx.wait();
        
        alert("Capital Withdrawn Successfully!");
        location.reload(); 

    } catch (err) {
        console.error("Withdraw Error:", err);
        alert("Withdraw failed: " + (err.reason || err.message || "Transaction Rejected"));
        
        // Error par button reset
        withdrawBtn.innerText = originalText;
        withdrawBtn.disabled = false;
    }
}
window.handleLogin = async function() {
    try {
        if (!window.ethereum) return alert("Please install Trust Wallet or MetaMask!");

        // 1. Connection Request
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        if (accounts.length === 0) return;
        const userAddress = accounts[0]; 

        // 2. Fresh Provider aur Contract setup (Trust Wallet ke liye zaroori)
        const tempProvider = new ethers.providers.Web3Provider(window.ethereum, "any");
        const { chainId } = await tempProvider.getNetwork();

        // Check if on BSC Testnet (97)
        if (chainId !== TESTNET_CHAIN_ID) {
            alert("Please switch your wallet to BSC Testnet (Chain 97)!");
            return;
        }

        const tempSigner = tempProvider.getSigner();
        const tempContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, tempSigner);

        // Global variables ko update karein taaki logout na dikhaye
        provider = tempProvider;
        signer = tempSigner;
        contract = tempContract;

        // 3. Registeration Check
        const userData = await contract.users(userAddress);

        if (userData.registered === true) {
            // LocalStorage updates
            localStorage.setItem('userAddress', userAddress);
            localStorage.removeItem('manualLogout');
            
            // UI Update (Optional but good)
            if(typeof showLogoutIcon === "function") showLogoutIcon(userAddress);
            
            // 4. Smooth Redirect
            // Refresh ka jhanjhat khatam, seedha dashboard par bhejein
            window.location.href = "index1.html";
        } else {
            alert("Aap registered nahi hain! Redirecting to Registration...");
            window.location.href = "register.html";
        }
    } catch (err) { 
        console.error("Login Error:", err);
        alert("Login failed! Make sure your wallet is connected to BSC Testnet."); 
    }
}
window.handleRegister = async function() {
    const userField = document.getElementById('reg-username');
    const refField = document.getElementById('reg-referrer');
    const regBtn = event.target; // Button ko pakadne ke liye
    
    if (!userField || !refField) return;

    const username = userField.value.trim();
    const referrer = refField.value.trim();

    if (!username || !referrer) {
        alert("Username and Referrer are required!");
        return;
    }

    try {
        // --- STEP 1: WALLET & SIGNER CHECK ---
        let activeSigner = window.signer || signer;
        let activeContract = window.contract || contract;

        if (!activeSigner || !window.ethereum) {
            if (!window.ethereum) return alert("Please use Trust Wallet/MetaMask browser!");
            
            const tempProvider = new ethers.providers.Web3Provider(window.ethereum, "any");
            await tempProvider.send("eth_requestAccounts", []);
            activeSigner = tempProvider.getSigner();
            activeContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, activeSigner);
            
            window.signer = activeSigner;
            window.contract = activeContract;
        }

        // --- STEP 2: NETWORK AUTO-SWITCH (BSC Testnet: 97) ---
        const network = await activeSigner.provider.getNetwork();
        if (network.chainId !== 97) {
            try {
                await window.ethereum.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: '0x61' }], // 0x61 = 97
                });
            } catch (switchError) {
                alert("Please switch your wallet to BSC Testnet manually!");
                return;
            }
        }

        // UI Update
        regBtn.disabled = true;
        regBtn.innerText = "CHECKING...";

        // --- STEP 3: TRANSACTION WITH MANUAL GAS ---
        console.log("Registering username:", username);
        
        // Manual gas limit for Trust Wallet stability
        const tx = await activeContract.register(username, referrer, {
            gasLimit: 500000 
        });

        regBtn.innerText = "CONFIRMING...";
        console.log("Tx Hash:", tx.hash);

        await tx.wait();
        
        // Success: Clear memory and move to dashboard
        localStorage.removeItem('manualLogout');
        localStorage.setItem('userAddress', await activeSigner.getAddress()); // Save for other pages
        
        alert("Registration Successful!");
        window.location.href = "index1.html";

    } catch (err) { 
        console.error("Register Error:", err);
        regBtn.disabled = false;
        regBtn.innerText = "REGISTER NOW";

        if (err.code === 4001 || err.message.includes("user rejected")) {
            alert("Transaction rejected by user.");
        } else {
            alert("Error: " + (err.reason || "Username might be taken or balance is low."));
        }
    }
}
window.handleLogout = function() {
    if (confirm("Disconnect and Logout?")) {
        // 1. Saara local storage saaf karein (Sabse zaroori fix)
        localStorage.clear(); 
        
        // 2. Manual logout flag set karein (taaki auto-login na ho)
        localStorage.setItem('manualLogout', 'true');
        
        // 3. Login page par bhej dein
        window.location.href = "index.html"; 
    }
}

function showLogoutIcon(address) {
    const btn = document.getElementById('connect-btn');
    const logout = document.getElementById('logout-icon-btn');
    if (btn) btn.innerText = address.substring(0, 6) + "..." + address.substring(38);
    if (logout) logout.style.display = 'flex'; 
}

async function setupApp(address) {
    if (!address || address === "undefined") return;
    
    // Sabse pehle address ko browser ki memory (LocalStorage) mein save karo
    localStorage.setItem('userAddress', address);
    // Trust Wallet timing fix: thoda delay taaki provider ready ho jaye
    const network = await provider.getNetwork();
    if (network.chainId !== TESTNET_CHAIN_ID) { 
        alert("Please switch your wallet to BSC Testnet (Chain 97)!"); 
        return; 
    }

    const activeContract = window.contract || contract;
    const userData = await activeContract.users(address);
    const path = window.location.pathname;

    // Registration Logic
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

    // Page-specific data loading with small delay for stability
    if (path.includes('index1.html')) {
        setTimeout(() => fetchAllData(address), 300);
        start8HourCountdown(); 
    }
    if (path.includes('leadership.html')) {
        setTimeout(() => fetchLeadershipData(address), 300);
    }
    if (path.includes('history.html')) {
        setTimeout(() => window.showHistory('deposit'), 300);
    }
}

// --- HISTORY LOGIC ---
window.showHistory = async function(category) {
    const container = document.getElementById('history-container');
    if(!container) return;
    
    // UI Feedback: Loading state
    container.innerHTML = `<div class="p-10 text-center text-yellow-500 italic animate-pulse">Fetching ${category.toUpperCase()} Records...</div>`;
    
    // Category mapping: Kaunsa button dabane par kya dikhna chahiye
    const typeMap = {
        'deposit': ['DEPOSIT'],
        'compounding': ['REINVEST'],
        'withdrawal': ['WITHDRAW', 'PRINCIPAL_WITHDRAW'],
        'income': ['ROI_INCOME', 'LEVEL_INCOME', 'RANK_INCOME']
    };

    const allowedTypes = typeMap[category] || [];
    const logs = await window.fetchBlockchainHistory(allowedTypes);

    if (logs.length === 0) {
        container.innerHTML = `<div class="p-10 text-center text-gray-500">No ${category} records found.</div>`;
        return;
    }

    container.innerHTML = logs.map(item => `
        <div class="bg-white/5 border border-white/10 rounded-2xl p-4 mb-4 flex justify-between items-center hover:bg-white/10 transition-all">
            <div>
                <h4 class="font-bold ${item.color}">${item.type.replace('_', ' ')}</h4>
                <p class="text-[10px] text-gray-400 uppercase tracking-widest">${item.detail}</p>
                <p class="text-[10px] text-gray-500 mt-1">${item.date} | ${item.time}</p>
            </div>
            <div class="text-right">
                <span class="text-lg font-black text-white">${item.amount}</span>
                <p class="text-[10px] text-gray-500 font-bold">USDT</p>
            </div>
        </div>
    `).join('');
}

window.fetchBlockchainHistory = async function(allowedTypes) {
    try {
        // --- TRUST WALLET FIX ---
        // Signer ka wait karne ke bajaye seedha localStorage se address lo
        let address = localStorage.getItem('userAddress');
        
        // Agar memory khali hai, tabhi signer se pucho (Backup)
        if (!address && window.signer) {
            address = await window.signer.getAddress();
        }

        if (!address || address === "undefined") {
            console.log("History Error: No address found yet");
            return [];
        }

        // Contract bhi active wala use karein
        const activeContract = window.contract || contract;
        if (!activeContract) return [];

        const rawHistory = await activeContract.getUserHistory(address);
        
        // Blockchain se aayi array ko filter aur format karna
        return rawHistory
            .filter(item => {
                const txType = item.txType.toUpperCase();
                return allowedTypes.includes(txType);
            }) 
            .map(item => {
                const txType = item.txType.toUpperCase();
                const dt = new Date(item.timestamp.toNumber() * 1000);
                
                // Income ke liye alag color, baaki ke liye cyan/red
                let colorClass = 'text-cyan-400';
                if(txType.includes('INCOME')) colorClass = 'text-green-400';
                if(txType.includes('WITHDRAW')) colorClass = 'text-red-400';

                return {
                    type: txType,
                    amount: format(item.amount),
                    detail: item.detail,
                    date: dt.toLocaleDateString(),
                    time: dt.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
                    ts: item.timestamp.toNumber(),
                    color: colorClass
                };
            })
            .sort((a,b) => b.ts - a.ts); // Newest transactions first
    } catch (e) { 
        console.error("History Fetch Error:", e);
        return []; 
    }
}
async function fetchAllData(address) {
    try {
        // --- TRUST WALLET CONNECTION FIX ---
        // Agar main 'contract' object khali hai, toh read-only use karein
        const activeContract = window.contract || contract;
        
        if (!activeContract) {
            console.error("Contract not ready yet!");
            return;
        }

        // 1. Contract se data fetch karna (SAME LOGIC)
        const [user, extra, live] = await Promise.all([
            activeContract.users(address), 
            activeContract.usersExtra(address), 
            activeContract.getLiveBalance(address)
        ]);

        // --- DASHBOARD BASIC DATA ---
        updateText('username-display', user.username || "USER"); 
        updateText('user-address', address.substring(0, 6) + "..." + address.substring(38));
        updateText('total-deposit', format(user.totalDeposited));
        updateText('active-deposit', format(user.totalActiveDeposit));
        updateText('total-earned', format(user.totalEarnings));
        updateText('total-withdrawn', format(user.totalWithdrawn));
        
        // Income breakdown display
        updateText('level-earning', format(extra.rewardsReferral)); 
        updateText('rank-earning', format(extra.rewardsRank)); 

        // --- THE ULTIMATE FIX ---
        const totalWithdrawable = parseFloat(format(live));
        const activeAmt = parseFloat(format(user.totalActiveDeposit));

        // UI Updates - Direct live value use (SAME LOGIC)
        updateText('withdrawable', totalWithdrawable.toFixed(2));    
        updateText('compounding-balance', totalWithdrawable.toFixed(2));
        updateText('cap-balance', format(user.totalActiveDeposit));
        updateText('active-deposit-cp', format(user.totalActiveDeposit));

        // Daily ROI Projection (0.9%)
        updateText('projected-return', (activeAmt * 0.009).toFixed(2));

        // --- RANK & STATUS ---
        // getRankName ko bhi activeContract se call kar rahe hain (Fix for Trust Wallet)
        const rankName = await activeContract.getRankName(extra.rank);
        updateText('rank-display', rankName);

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
            if(statusBadge) {
                statusBadge.innerHTML = "● Inactive";
                statusBadge.className = "px-4 py-1 rounded-full bg-red-500/20 text-red-500 text-[10px] font-black border border-red-500/30 uppercase";
            }
        }

        // --- REFERRAL URL ---
        const baseUrl = window.location.origin + window.location.pathname.replace('index1.html', 'register.html');
        const refField = document.getElementById('refURL');
        if(refField) refField.value = `${baseUrl}?ref=${user.username}`;

    } catch (err) { 
        console.error("Data Sync Error:", err); 
    }
}
// --- LEADERSHIP DATA (Corrected for RPC Mode) ---
async function fetchLeadershipData(address) {
    try {
        const activeContract = window.contract || contract;
        if (!activeContract) return;

        const [user, extra] = await Promise.all([
            activeContract.users(address), 
            activeContract.usersExtra(address)
        ]);

        const teamActiveVol = parseFloat(ethers.utils.formatUnits(user.teamActiveDeposit, 18));
        const teamTotalVol = parseFloat(ethers.utils.formatUnits(user.teamTotalDeposit, 18));
        const rankRewards = parseFloat(ethers.utils.formatUnits(extra.rewardsRank, 18));

        updateText('team-active-deposit', teamActiveVol.toFixed(2));
        updateText('team-total-deposit', teamTotalVol.toFixed(2));
        updateText('rank-reward-available', rankRewards.toFixed(2));
        updateText('current-team-count', extra.teamCount);
        updateText('directs-quali', extra.directsQuali);
        updateText('current-team-volume', teamActiveVol.toFixed(0));

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
























