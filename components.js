document.addEventListener("DOMContentLoaded", function () {
    // 1. Instant Page Check
    const path = window.location.pathname;
    const isAuthPage = document.getElementById('auth-page') || path.includes('register.html') || path.includes('login.html');
    if (isAuthPage) return;

    // 2. Fast UI Injection (Bina wait kiye)
   // 2. Fast UI Injection (Desktop Nav updated with Logout)
    const navHTML = `
        <nav class="fixed top-0 left-0 w-full z-[100] bg-black/40 backdrop-blur-md border-b border-white/5">
            <div class="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
                <div class="flex items-center gap-2 cursor-pointer" onclick="location.href='index1.html'">
                    <div class="w-8 h-8 bg-yellow-500 rounded-lg flex items-center justify-center shadow-lg shadow-yellow-500/20">
                        <i data-lucide="zap" class="text-black w-5 h-5"></i>
                    </div>
                    <span class="text-lg font-black orbitron tracking-tighter uppercase text-white">
                        PRO <span class="text-yellow-500">MAX</span>
                    </span>
                </div>
                
                <div class="hidden md:flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/10">
                    <button onclick="location.href='index1.html'" class="px-4 py-2 rounded-lg text-[11px] font-bold orbitron uppercase transition-all ${path.includes('index1.html') ? 'bg-yellow-500 text-black' : 'text-gray-400 hover:text-white'}">Dashboard</button>
                    <button onclick="location.href='deposits.html'" class="px-4 py-2 rounded-lg text-[11px] font-bold orbitron uppercase transition-all ${path.includes('deposits.html') ? 'bg-yellow-500 text-black' : 'text-gray-400 hover:text-white'}">Position</button>
                    <button onclick="location.href='referral.html'" class="px-4 py-2 rounded-lg text-[11px] font-bold orbitron uppercase transition-all ${path.includes('referral.html') ? 'bg-yellow-500 text-black' : 'text-gray-400 hover:text-white'}">Referral</button>
                    <button onclick="location.href='leadership.html'" class="px-4 py-2 rounded-lg text-[11px] font-bold orbitron uppercase transition-all ${path.includes('leadership.html') ? 'bg-yellow-500 text-black' : 'text-gray-400 hover:text-white'}">Leadership</button>
                    <button onclick="location.href='history.html'" class="px-4 py-2 rounded-lg text-[11px] font-bold orbitron uppercase transition-all ${path.includes('history.html') ? 'bg-yellow-500 text-black' : 'text-gray-400 hover:text-white'}">History</button>
                </div>
                
                <div class="flex items-center gap-2">
                    <button id="connect-btn" onclick="handleLogin()" class="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-[10px] font-bold orbitron hover:bg-white/10 transition-all text-white">
                        CONNECT
                    </button>
                    <button onclick="handleLogout()" class="w-9 h-9 flex items-center justify-center bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 hover:bg-red-500 hover:text-white transition-all">
                        <i data-lucide="log-out" class="w-4 h-4"></i>
                    </button>
                </div>
            </div>
        </nav>
        <div class="h-20"></div>
    `;
    const mobileNavHTML = `
        <div class="fixed bottom-6 left-4 right-4 md:hidden z-[10000]">
            <div class="bg-black/80 backdrop-blur-2xl border border-white/10 rounded-2xl flex justify-around items-center p-3 shadow-2xl">
                <a href="index1.html" class="flex flex-col items-center gap-1 ${path.includes('index1.html') ? 'text-yellow-500' : 'text-gray-500'}">
                    <i data-lucide="layout-dashboard" class="w-5 h-5"></i>
                    <span class="text-[8px] font-bold orbitron">Home</span>
                </a>
                <a href="deposits.html" class="flex flex-col items-center gap-1 ${path.includes('deposits.html') ? 'text-yellow-500' : 'text-gray-500'}">
                    <i data-lucide="layers" class="w-5 h-5"></i>
                    <span class="text-[8px] font-bold orbitron">Stake</span>
                </a>
                <a href="referral.html" class="flex flex-col items-center gap-1 ${path.includes('referral.html') ? 'text-yellow-500' : 'text-gray-500'}">
                    <i data-lucide="users" class="w-5 h-5"></i>
                    <span class="text-[8px] font-bold orbitron">Team</span>
                </a>
                <a href="leadership.html" class="flex flex-col items-center gap-1 ${path.includes('leadership.html') ? 'text-yellow-500' : 'text-gray-500'}">
                    <i data-lucide="award" class="w-5 h-5"></i>
                    <span class="text-[8px] font-bold orbitron">Rank</span>
                </a>
            </div>
        </div>
    `;

    // Direct injection
    document.body.insertAdjacentHTML('afterbegin', navHTML);
    document.body.insertAdjacentHTML('beforeend', mobileNavHTML);
    
    // Initial Icon Load
    if (window.lucide) window.lucide.createIcons();

    // 3. Background Wallet Check (Slow task moved here)
    checkWalletSilently();
});

async function checkWalletSilently() {
    if (window.ethereum) {
        try {
            const accounts = await window.ethereum.request({ method: 'eth_accounts' });
            if (accounts.length > 0) {
                const addr = accounts[0];
                const btn = document.getElementById('connect-btn');
                if (btn) btn.innerText = addr.substring(0, 6) + "..." + addr.substring(38);
            }
        } catch (err) {
            console.log("Silent wallet check failed");
        }
    }
}
