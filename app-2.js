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

// Authentication
async function initializeAuth() {
    try {
        // Sign in anonymously for now - can be extended to support user accounts
        await auth.signInAnonymously();
        
        auth.onAuthStateChanged((user) => {
            if (user) {
                currentUser = user;
                console.log('User authenticated:', user.uid);
                loadAllData();
                setupRealtimeSync();
                updateSyncStatus('synced');
            } else {
                console.log('User not authenticated');
                updateSyncStatus('offline');
            }
        });
    } catch (error) {
        console.error('Authentication error:', error);
        showToast('認証エラーが発生しました', 'error');
    }
}

// Load all data
async function loadAllData() {
    try {
        await loadIdeals();
        await checkAndResetDailyVisions();
        renderActiveView();
    } catch (error) {
        console.error('Error loading data:', error);
        showToast('データの読み込みに失敗しました', 'error');
    }
}

// Load ideals from Firestore
async function loadIdeals() {
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
            const docRef = await db.collection(IDEALS_COLLECTION).add(dataToSave);
            showToast('新しい理想を追加しました', 'success');
        }
        
        updateSyncStatus('synced');
        return true;
    } catch (error) {
        console.error('Error saving ideal:', error);
        showToast('保存に失敗しました', 'error');
        updateSyncStatus('error');
        return false;
    }
}

// Delete ideal
async function deleteIdeal(idealId) {
    try {
        updateSyncStatus('syncing');
        await db.collection(IDEALS_COLLECTION).doc(idealId).delete();
        showToast('理想を削除しました', 'success');
        updateSyncStatus('synced');
        return true;
    } catch (error) {
        console.error('Error deleting ideal:', error);
        showToast('削除に失敗しました', 'error');
        updateSyncStatus('error');
        return false;
    }
}

// Update quest progress
async function updateQuestProgress(idealId, questIndex, newValue) {
    try {
        updateSyncStatus('syncing');
        
        const ideal = idealsData.find(i => i.id === idealId);
        if (!ideal) return;
        
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
        showToast('クエストの更新に失敗しました', 'error');
        updateSyncStatus('error');
        return false;
    }
}

// Toggle ideal achievement
async function toggleIdealAchievement(idealId, achieved) {
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
        showToast('更新に失敗しました', 'error');
        updateSyncStatus('error');
        return false;
    }
}

// Daily visions management
async function checkAndResetDailyVisions() {
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
    try {
        updateSyncStatus('syncing');
        const today = new Date().toDateString();
        const visionKey = `${idealId}_${visionIndex}`;
        
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
        showToast('更新に失敗しました', 'error');
        updateSyncStatus('error');
        return false;
    }
}

async function deleteVision(idealId, visionIndex) {
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
        showToast('削除に失敗しました', 'error');
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
    const activeTab = document.querySelector('.tab-btn.active').dataset.tab;
    
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

// Export functions for UI module
window.app = {
    idealsData,
    currentUser,
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
    renderActiveView
};