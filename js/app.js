// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCCmNMhbz1G35de_AkkebVW53xAZc1kYwI",
    authDomain: "pinomaro-managing.firebaseapp.com",
    projectId: "pinomaro-managing",
    storageBucket: "pinomaro-managing.firebasestorage.app",
    messagingSenderId: "619245174856",
    appId: "1:619245174856:web:b008494174a47c77b0d87d",
    measurementId: "G-CSTVB7S3FL"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// Global state
let currentUser = null;
let idealsData = [];
let currentEditingIdeal = null;
let dailyResetTimer = null;
let authListenerSet = false;

// Completed visions tracker
window.completedVisions = new Set();

// Collections
const IDEALS_COLLECTION = 'ideals';
const DAILY_VISIONS_COLLECTION = 'daily_visions';

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    await initializeAuth();
    setupEventListeners();
    startDailyResetTimer();
    hideLoading();
});

// Update sync status based on network changes
window.addEventListener('online', () => {
    updateSyncStatus('syncing');
    if (!currentUser) {
        initializeAuth();
    } else {
        loadAllData();
    }
});
window.addEventListener('offline', () => updateSyncStatus('offline'));

// Authentication
async function initializeAuth() {
    if (!authListenerSet) {
        await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

        auth.onAuthStateChanged(async (user) => {
            if (user) {
                currentUser = user;
                console.log('User authenticated:', user.uid);
                window.updateAuthUI && window.updateAuthUI(user);
            　　 if (!user.isAnonymous) {
                    await ensureUserDocument(user);
                }
                loadAllData();
                setupRealtimeSync();
                updateSyncStatus('synced');
            } else {
                currentUser = null;
                window.updateAuthUI && window.updateAuthUI(null);
                console.log('User not authenticated');
                try {
                    await auth.signInAnonymously();
                } catch (error) {
                    console.error('Authentication error:', error);
                    if (error.code === 'auth/network-request-failed') {
                        updateSyncStatus('offline');
                        showToast('ネットワークに接続できませんでした', 'error');
                    } else if (error.code === 'auth/unauthorized-domain') {
                        updateSyncStatus('error');
                        showToast('認証エラー: 許可されていないドメインです', 'error');
                    } else if (error.code === 'auth/admin-restricted-operation' || error.code === 'auth/operation-not-allowed') {
                        updateSyncStatus('error');
                        showToast('匿名認証が無効です。Googleでログインしてください', 'error');
                    } else {
                        updateSyncStatus('error');
                        showToast('認証エラーが発生しました', 'error');
                    }
                }
            }
        });
        authListenerSet = true;
    }
}

// Create/update user profile document for authenticated users
async function ensureUserDocument(user) {
    try {
        await db.collection('users').doc(user.uid).set({
            email: user.email || null,
            lastLogin: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    } catch (error) {
        console.error('Failed to save user profile:', error);
    }
}

// Load all data
async function loadAllData() {
    if (!currentUser) return;
    try {
        await loadIdeals();
        await checkAndResetDailyVisions();
        renderActiveView();
    } catch (error) {
        console.error('Error loading data:', error);
    }
}

// Load ideals from Firestore
async function loadIdeals() {
    if (!currentUser) return;
    try {
        const snapshot = await db.collection(IDEALS_COLLECTION)
            .where('userId', '==', currentUser.uid)
            .orderBy('createdAt', 'desc')
            .get();

        idealsData = [];
        snapshot.forEach(doc => {
            idealsData.push({ id: doc.id, ...doc.data() });
        });

        console.log('Loaded ideals:', idealsData.length);
    } catch (error) {
        console.error('Error loading ideals:', error);
        throw error;
    }
}

// Setup realtime sync
function setupRealtimeSync() {
    if (!currentUser) return;
    // Listen to ideals collection changes
    db.collection(IDEALS_COLLECTION)
        .where('userId', '==', currentUser.uid)
        .onSnapshot((snapshot) => {
            const changes = snapshot.docChanges();
            changes.forEach((change) => {
                const data = { id: change.doc.id, ...change.doc.data() };
                
                if (change.type === 'added') {
                    // Check if already exists in local data
                    const exists = idealsData.find(i => i.id === data.id);
                    if (!exists) {
                        idealsData.unshift(data);
                    }
                } else if (change.type === 'modified') {
                    const index = idealsData.findIndex(i => i.id === data.id);
                    if (index !== -1) {
                        idealsData[index] = data;
                    }
                } else if (change.type === 'removed') {
                    idealsData = idealsData.filter(i => i.id !== data.id);
                }
            });
            
            if (changes.length > 0) {
                renderActiveView();
                updateSyncStatus('synced');
            }
        }, (error) => {
            console.error('Realtime sync error:', error);
            updateSyncStatus('error');
        });
}

// Save ideal to Firestore
async function saveIdeal(idealData) {
    if (!currentUser) {
        showToast('ログインが必要です', 'error');
        updateSyncStatus('error');
        return false;
    }
    try {
        updateSyncStatus('syncing');

        const dataToSave = {
            ...idealData,
            userId: currentUser.uid,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (idealData.id) {
            // Update existing
            await db.collection(IDEALS_COLLECTION).doc(idealData.id).update(dataToSave);
            showToast('理想を更新しました', 'success');
        } else {
            // Create new
            dataToSave.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            dataToSave.achieved = false;
            await db.collection(IDEALS_COLLECTION).add(dataToSave);
            showToast('新しい理想を追加しました', 'success');
        }

        updateSyncStatus('synced');
        return true;
    } catch (error) {
        console.error('Error saving ideal:', error);
        if (error.code === 'permission-denied') {
            showToast('権限がありません。ログインしてください', 'error');
        } else {
            showToast('保存に失敗しました', 'error');
        }
        updateSyncStatus('error');
        return false;
    }
}

// Delete ideal
async function deleteIdeal(idealId) {
    if (!currentUser) {
        showToast('ログインが必要です', 'error');
        updateSyncStatus('error');
        return false;
    }
    try {
        updateSyncStatus('syncing');
        await db.collection(IDEALS_COLLECTION).doc(idealId).delete();
        showToast('理想を削除しました', 'success');
        updateSyncStatus('synced');
        return true;
    } catch (error) {
        console.error('Error deleting ideal:', error);
        if (error.code === 'permission-denied') {
            showToast('権限がありません。ログインしてください', 'error');
        } else {
            showToast('削除に失敗しました', 'error');
        }
        updateSyncStatus('error');
        return false;
    }
}

// Update quest progress
async function updateQuestProgress(idealId, questIndex, newValue) {
    if (!currentUser) {
        showToast('ログインが必要です', 'error');
        updateSyncStatus('error');
        return false;
    }
    try {
        updateSyncStatus('syncing');

        const ideal = idealsData.find(i => i.id === idealId);
        if (!ideal) return false;

        ideal.quests[questIndex].current = newValue;

        // Check if quest is completed
        if (ideal.quests[questIndex].current >= ideal.quests[questIndex].target) {
            ideal.quests[questIndex].completed = true;
            showToast(`クエスト「${ideal.quests[questIndex].title}」を達成しました！`, 'success');
        } else {
            ideal.quests[questIndex].completed = false;
        }

        await db.collection(IDEALS_COLLECTION).doc(idealId).update({
            quests: ideal.quests,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        updateSyncStatus('synced');
        return true;
    } catch (error) {
        console.error('Error updating quest:', error);
        if (error.code === 'permission-denied') {
            showToast('権限がありません。ログインしてください', 'error');
        } else {
            showToast('クエストの更新に失敗しました', 'error');
        }
        updateSyncStatus('error');
        return false;
    }
}

// Toggle ideal achievement
async function toggleIdealAchievement(idealId, achieved) {
    if (!currentUser) {
        showToast('ログインが必要です', 'error');
        updateSyncStatus('error');
        return false;
    }
    try {
        updateSyncStatus('syncing');

        await db.collection(IDEALS_COLLECTION).doc(idealId).update({
            achieved: achieved,
            achievedAt: achieved ? firebase.firestore.FieldValue.serverTimestamp() : null,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        showToast(achieved ? '理想を実現済みにしました！' : '理想を未実現に戻しました', 'success');
        updateSyncStatus('synced');
        return true;
    } catch (error) {
        console.error('Error toggling achievement:', error);
        if (error.code === 'permission-denied') {
            showToast('権限がありません。ログインしてください', 'error');
        } else {
            showToast('更新に失敗しました', 'error');
        }
        updateSyncStatus('error');
        return false;
    }
}

// Daily visions management
async function checkAndResetDailyVisions() {
    if (!currentUser) return;
    try {
        const today = new Date().toDateString();
        const lastResetKey = `lastDailyReset_${currentUser.uid}`;
        const lastReset = localStorage.getItem(lastResetKey);

        if (lastReset !== today) {
            // Reset all daily vision checks
            await resetDailyVisions();
            localStorage.setItem(lastResetKey, today);
        }

        // Load today's vision status
        await loadDailyVisions();
    } catch (error) {
        console.error('Error checking daily visions:', error);
    }
}

async function resetDailyVisions() {
    if (!currentUser) return;
    try {
        // Get all daily vision documents for current user
        const snapshot = await db.collection(DAILY_VISIONS_COLLECTION)
            .where('userId', '==', currentUser.uid)
            .where('date', '<', new Date().toDateString())
            .get();

        // Delete old records
        const batch = db.batch();
        snapshot.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();

        console.log('Daily visions reset completed');
    } catch (error) {
        console.error('Error resetting daily visions:', error);
    }
}

async function loadDailyVisions() {
    if (!currentUser) {
        window.completedVisions = new Set();
        return;
    }
    try {
        const today = new Date().toDateString();
        const snapshot = await db.collection(DAILY_VISIONS_COLLECTION)
            .where('userId', '==', currentUser.uid)
            .where('date', '==', today)
            .get();

        const completedVisions = new Set();
        snapshot.forEach(doc => {
            const data = doc.data();
            completedVisions.add(`${data.idealId}_${data.visionIndex}`);
        });

        window.completedVisions = completedVisions;
    } catch (error) {
        console.error('Error loading daily visions:', error);
        window.completedVisions = new Set();
    }
}

async function toggleVisionDaily(idealId, visionIndex, completed) {
    if (!currentUser) {
        showToast('ログインが必要です', 'error');
        updateSyncStatus('error');
        return false;
    }
    try {
        updateSyncStatus('syncing');
        const today = new Date().toDateString();
        const visionKey = `${idealId}_${visionIndex}`;

            if (!window.completedVisions) {
            window.completedVisions = new Set();
        }

        if (completed) {
            // Add to completed
            await db.collection(DAILY_VISIONS_COLLECTION).add({
                userId: currentUser.uid,
                idealId: idealId,
                visionIndex: visionIndex,
                date: today,
                completedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            window.completedVisions.add(visionKey);
        } else {
            // Remove from completed
            const snapshot = await db.collection(DAILY_VISIONS_COLLECTION)
                .where('userId', '==', currentUser.uid)
                .where('idealId', '==', idealId)
                .where('visionIndex', '==', visionIndex)
                .where('date', '==', today)
                .get();

            const batch = db.batch();
            snapshot.forEach(doc => {
                batch.delete(doc.ref);
            });
            await batch.commit();
            window.completedVisions.delete(visionKey);
        }

        updateSyncStatus('synced');
        return true;
    } catch (error) {
        console.error('Error toggling vision:', error);
        if (error.code === 'permission-denied') {
            showToast('権限がありません。ログインしてください', 'error');
        } else {
            showToast('更新に失敗しました', 'error');
        }
        updateSyncStatus('error');
        return false;
    }
}

async function deleteVision(idealId, visionIndex) {
    if (!currentUser) {
        showToast('ログインが必要です', 'error');
        updateSyncStatus('error');
        return false;
    }
    try {
        updateSyncStatus('syncing');

        const ideal = idealsData.find(i => i.id === idealId);
        if (!ideal) return false;

        // Remove vision from array
        ideal.visions.splice(visionIndex, 1);

        await db.collection(IDEALS_COLLECTION).doc(idealId).update({
            visions: ideal.visions,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        showToast('絵になる姿を削除しました', 'success');
        updateSyncStatus('synced');
        return true;
    } catch (error) {
        console.error('Error deleting vision:', error);
        if (error.code === 'permission-denied') {
            showToast('権限がありません。ログインしてください', 'error');
        } else {
            showToast('削除に失敗しました', 'error');
        }
        updateSyncStatus('error');
        return false;
    }
}

// Daily reset timer
function startDailyResetTimer() {
    const checkReset = () => {
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        
        const msUntilMidnight = tomorrow - now;
        
        setTimeout(() => {
            checkAndResetDailyVisions();
            renderActiveView();
            startDailyResetTimer(); // Restart timer
        }, msUntilMidnight);
    };
    
    checkReset();
}

// Utility functions
function calculateIdealProgress(ideal) {
    if (!ideal.quests || ideal.quests.length === 0) return 0;
    
    const totalProgress = ideal.quests.reduce((sum, quest) => {
        const progress = Math.min((quest.current / quest.target) * 100, 100);
        return sum + progress;
    }, 0);
    
    return Math.round(totalProgress / ideal.quests.length);
}

function updateSyncStatus(status) {
    const syncStatus = document.getElementById('syncStatus');
    if (!syncStatus) return;
    
    switch (status) {
        case 'syncing':
            syncStatus.innerHTML = '<i class="fas fa-sync-alt animate-spin"></i> 同期中...';
            syncStatus.className = 'text-sm text-gray-500';
            break;
        case 'synced':
            syncStatus.innerHTML = '<i class="fas fa-check-circle"></i> 同期済み';
            syncStatus.className = 'text-sm text-green-500';
            break;
        case 'error':
            syncStatus.innerHTML = '<i class="fas fa-exclamation-circle"></i> 同期エラー';
            syncStatus.className = 'text-sm text-red-500';
            break;
        case 'offline':
            syncStatus.innerHTML = '<i class="fas fa-wifi-slash"></i> オフライン';
            syncStatus.className = 'text-sm text-gray-500';
            break;
    }
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    
    toastMessage.textContent = message;
    
    // Set color based on type
    toast.className = 'fixed bottom-4 left-4 px-6 py-3 rounded-lg shadow-lg transform transition-transform z-50';
    switch (type) {
        case 'success':
            toast.classList.add('bg-green-600', 'text-white');
            break;
        case 'error':
            toast.classList.add('bg-red-600', 'text-white');
            break;
        default:
            toast.classList.add('bg-gray-800', 'text-white');
    }
    
    // Show toast
    toast.classList.remove('translate-y-full');
    toast.classList.add('translate-y-0');
    
    // Hide after 3 seconds
    setTimeout(() => {
        toast.classList.remove('translate-y-0');
        toast.classList.add('translate-y-full');
    }, 3000);
}

function showLoading() {
    document.getElementById('loadingOverlay').classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loadingOverlay').classList.add('hidden');
}

function renderActiveView() {
    const activeBtn = document.querySelector('.tab-btn.active');
    if (!activeBtn || !window.renderIdealsTab) return;

    const activeTab = activeBtn.dataset.tab;

    switch (activeTab) {
        case 'ideals':
            window.renderIdealsTab();
            break;
        case 'quests':
            window.renderQuestsTab();
            break;
        case 'visions':
            window.renderVisionsTab();
            break;
    }
}

async function handleUserMenu() {
    if (auth.currentUser && !auth.currentUser.isAnonymous) {
        try {
            await auth.signOut();
            showToast('ログアウトしました', 'success');
        } catch (error) {
            console.error('Sign-out error:', error);
            showToast('ログアウトに失敗しました', 'error');
        }
    } else {
        const provider = new firebase.auth.GoogleAuthProvider();
        try {
            await auth.signInWithPopup(provider);
            showToast('Googleでログインしました', 'success');
        } catch (error) {
            console.error('Google sign-in error:', error);
            if (error.code === 'auth/unauthorized-domain') {
                showToast('認証エラー: ドメインが許可されていません', 'error');
            } else if (error.code === 'auth/operation-not-allowed') {
                showToast('Googleログインが無効化されています', 'error');
            } else {
                showToast('Googleログインに失敗しました', 'error');
            }
        }
    }
}

// Export functions for UI module
// Use getters so the latest state is always exposed to the UI layer
window.app = {
    get idealsData() {
        return idealsData;
    },
    get currentUser() {
        return currentUser;
    },
    saveIdeal,
    deleteIdeal,
    updateQuestProgress,
    toggleIdealAchievement,
    toggleVisionDaily,
    deleteVision,
    calculateIdealProgress,
    showToast,
    showLoading,
    hideLoading,
    renderActiveView,
    handleUserMenu
};
