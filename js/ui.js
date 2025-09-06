// UI Controller Module
let activeTab = 'ideals';
let questInputCount = 0;
let visionInputCount = 0;

// Setup event listeners
function setupEventListeners() {
    // Tab navigation
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            switchTab(e.target.dataset.tab);
        });
    });
    
    // Add ideal button
    document.getElementById('addIdealBtn').addEventListener('click', openAddIdealModal);

    // User menu (sign in/out)
    document.getElementById('userMenuBtn').addEventListener('click', () => {
        window.app.handleUserMenu();
    });
    
    // Modal controls
    document.getElementById('cancelModalBtn').addEventListener('click', closeIdealModal);
    document.getElementById('idealModal').addEventListener('click', (e) => {
        if (e.target.id === 'idealModal') closeIdealModal();
    });
    
    // Form submission
    document.getElementById('idealForm').addEventListener('submit', handleIdealSubmit);
    
    // Add quest/vision buttons
    document.getElementById('addQuestBtn').addEventListener('click', addQuestInput);
    document.getElementById('addVisionBtn').addEventListener('click', addVisionInput);
    
    // Detail modal controls
    document.getElementById('closeDetailBtn').addEventListener('click', closeDetailModal);
    document.getElementById('idealDetailModal').addEventListener('click', (e) => {
        if (e.target.id === 'idealDetailModal') closeDetailModal();
    });
    document.getElementById('editIdealBtn').addEventListener('click', editCurrentIdeal);
    document.getElementById('deleteIdealBtn').addEventListener('click', deleteCurrentIdeal);
    document.getElementById('achievementToggle').addEventListener('click', toggleAchievement);
}

// Tab switching
function switchTab(tabName) {
    activeTab = tabName;
    
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active', 'border-indigo-600', 'text-indigo-600');
        if (btn.dataset.tab === tabName) {
            btn.classList.add('active', 'border-indigo-600', 'text-indigo-600');
        }
    });
    
    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.add('hidden');
    });
    document.getElementById(`${tabName}-tab`).classList.remove('hidden');
    
    // Render appropriate content
    switch (tabName) {
        case 'ideals':
            renderIdealsTab();
            break;
        case 'quests':
            renderQuestsTab();
            break;
        case 'visions':
            renderVisionsTab();
            break;
    }
}

// Render Ideals Tab
function renderIdealsTab() {
    const activeIdeals = window.app.idealsData.filter(i => !i.achieved);
    const achievedIdeals = window.app.idealsData.filter(i => i.achieved);
    
    // Render active ideals
    const activeGrid = document.getElementById('activeIdealsGrid');
    activeGrid.innerHTML = '';
    
    activeIdeals.forEach(ideal => {
        const progress = window.app.calculateIdealProgress(ideal);
        const card = createIdealCard(ideal, progress);
        activeGrid.appendChild(card);
    });
    
    // Render achieved ideals
    const achievedSection = document.getElementById('achievedSection');
    const achievedGrid = document.getElementById('achievedIdealsGrid');
    
    if (achievedIdeals.length > 0) {
        achievedSection.classList.remove('hidden');
        achievedGrid.innerHTML = '';
        
        achievedIdeals.forEach(ideal => {
            const card = createIdealCard(ideal, 100, true);
            achievedGrid.appendChild(card);
        });
    } else {
        achievedSection.classList.add('hidden');
    }
}

// Create ideal card
function createIdealCard(ideal, progress, isAchieved = false) {
    const card = document.createElement('div');
    card.className = `bg-white rounded-xl shadow-lg hover:shadow-xl transition-all cursor-pointer p-6 ${isAchieved ? 'opacity-75' : ''} animate__animated animate__fadeIn`;
    
    card.innerHTML = `
        <div class="flex justify-between items-start mb-4">
            <h3 class="text-lg font-semibold text-gray-800 flex-1">${escapeHtml(ideal.title)}</h3>
            ${isAchieved ? '<i class="fas fa-check-circle text-green-500 text-xl"></i>' : ''}
        </div>
        
        <div class="space-y-3">
            <div class="flex items-center text-sm text-gray-600">
                <i class="fas fa-tasks mr-2 text-indigo-500"></i>
                <span>${ideal.quests?.length || 0} クエスト</span>
            </div>
            <div class="flex items-center text-sm text-gray-600">
                <i class="fas fa-image mr-2 text-purple-500"></i>
                <span>${ideal.visions?.length || 0} 絵になる姿</span>
            </div>
        </div>
        
        <div class="mt-4">
            <div class="flex justify-between text-sm text-gray-600 mb-1">
                <span>達成率</span>
                <span class="font-semibold">${progress}%</span>
            </div>
            <div class="w-full bg-gray-200 rounded-full h-2">
                <div class="bg-gradient-to-r from-indigo-500 to-purple-500 h-2 rounded-full transition-all"
                     style="width: ${progress}%"></div>
            </div>
        </div>
    `;
    
    card.addEventListener('click', () => openIdealDetail(ideal));
    return card;
}

// Render Quests Tab
function renderQuestsTab() {
    const activeQuestsList = document.getElementById('activeQuestsList');
    const completedQuestsList = document.getElementById('completedQuestsList');
    
    activeQuestsList.innerHTML = '';
    completedQuestsList.innerHTML = '';
    
    window.app.idealsData.forEach(ideal => {
        if (!ideal.quests) return;
        
        ideal.quests.forEach((quest, index) => {
            const questElement = createQuestElement(ideal, quest, index);
            
            if (quest.completed) {
                completedQuestsList.appendChild(questElement);
            } else {
                activeQuestsList.appendChild(questElement);
            }
        });
    });
    
    if (activeQuestsList.children.length === 0) {
        activeQuestsList.innerHTML = '<p class="text-gray-500 text-center py-4">進行中のクエストはありません</p>';
    }
    
    if (completedQuestsList.children.length === 0) {
        completedQuestsList.innerHTML = '<p class="text-gray-500 text-center py-4">達成したクエストはまだありません</p>';
    }
}

// Create quest element
function createQuestElement(ideal, quest, index) {
    const element = document.createElement('div');
    element.className = `flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors ${quest.completed ? 'opacity-75' : ''}`;
    
    const progress = Math.min((quest.current / quest.target) * 100, 100);
    
    element.innerHTML = `
        <div class="flex-1">
            <div class="font-medium text-gray-800">${escapeHtml(quest.title)}</div>
            <div class="text-sm text-gray-500 mt-1">
                <i class="fas fa-lightbulb mr-1"></i>${escapeHtml(ideal.title)}
            </div>
            <div class="mt-2">
                <div class="w-full bg-gray-200 rounded-full h-1.5">
                    <div class="bg-gradient-to-r from-blue-500 to-indigo-500 h-1.5 rounded-full transition-all"
                         style="width: ${progress}%"></div>
                </div>
            </div>
        </div>
        
        <div class="flex items-center space-x-3 ml-4">
            <button class="quest-minus px-3 py-1 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                    data-ideal="${ideal.id}" data-quest="${index}">
                <i class="fas fa-minus"></i>
            </button>
            <div class="text-center min-w-[80px]">
                <div class="text-lg font-semibold text-gray-800">${quest.current}</div>
                <div class="text-xs text-gray-500">/ ${quest.target} ${escapeHtml(quest.unit)}</div>
            </div>
            <button class="quest-plus px-3 py-1 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 transition-colors"
                    data-ideal="${ideal.id}" data-quest="${index}">
                <i class="fas fa-plus"></i>
            </button>
        </div>
    `;
    
    // Add event listeners
    element.querySelector('.quest-minus').addEventListener('click', (e) => {
        e.stopPropagation();
        updateQuest(ideal.id, index, Math.max(0, quest.current - 1));
    });
    
    element.querySelector('.quest-plus').addEventListener('click', (e) => {
        e.stopPropagation();
        updateQuest(ideal.id, index, Math.min(quest.target, quest.current + 1));
    });
    
    return element;
}

// Render Visions Tab
function renderVisionsTab() {
    const todayVisionsList = document.getElementById('todayVisionsList');
    const completedVisionsList = document.getElementById('completedVisionsList');
    
    todayVisionsList.innerHTML = '';
    completedVisionsList.innerHTML = '';
    
    window.app.idealsData.forEach(ideal => {
        if (!ideal.visions) return;
        
        ideal.visions.forEach((vision, index) => {
            const visionKey = `${ideal.id}_${index}`;
            const isCompleted = window.completedVisions && window.completedVisions.has(visionKey);
            const visionElement = createVisionElement(ideal, vision, index, isCompleted);
            
            if (isCompleted) {
                completedVisionsList.appendChild(visionElement);
            } else {
                todayVisionsList.appendChild(visionElement);
            }
        });
    });
    
    if (todayVisionsList.children.length === 0) {
        todayVisionsList.innerHTML = '<p class="text-gray-500 text-center py-4">今日の絵になる姿はありません</p>';
    }
    
    if (completedVisionsList.children.length === 0) {
        completedVisionsList.innerHTML = '<p class="text-gray-500 text-center py-4">今日できている姿はまだありません</p>';
    }
}

// Create vision element
function createVisionElement(ideal, vision, index, isCompleted) {
    const element = document.createElement('div');
    element.className = `flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors ${isCompleted ? 'bg-green-50' : ''}`;
    
    element.innerHTML = `
        <div class="flex items-center flex-1">
            <input type="checkbox" 
                   class="vision-checkbox w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                   data-ideal="${ideal.id}" 
                   data-vision="${index}"
                   ${isCompleted ? 'checked' : ''}>
            <div class="ml-3">
                <div class="font-medium text-gray-800">${escapeHtml(vision)}</div>
                <div class="text-sm text-gray-500 mt-1">
                    <i class="fas fa-lightbulb mr-1"></i>${escapeHtml(ideal.title)}
                </div>
            </div>
        </div>
        
        <button class="vision-delete ml-4 px-3 py-1 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                data-ideal="${ideal.id}" 
                data-vision="${index}">
            <i class="fas fa-trash"></i>
        </button>
    `;
    
    // Add event listeners
    element.querySelector('.vision-checkbox').addEventListener('change', (e) => {
        toggleVision(ideal.id, index, e.target.checked);
    });
    
    element.querySelector('.vision-delete').addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm('この絵になる姿を削除しますか？')) {
            deleteVisionItem(ideal.id, index);
        }
    });
    
    return element;
}

// Modal functions
function openAddIdealModal() {
    currentEditingIdeal = null;
    document.getElementById('modalTitle').textContent = '新しい本質的理想を追加';
    document.getElementById('idealForm').reset();
    
    // Reset containers
    document.getElementById('questsContainer').innerHTML = '';
    document.getElementById('visionsContainer').innerHTML = '';
    questInputCount = 0;
    visionInputCount = 0;
    
    // Add initial inputs
    addQuestInput();
    addVisionInput();
    
    document.getElementById('idealModal').classList.remove('hidden');
}

function openEditIdealModal(ideal) {
    currentEditingIdeal = ideal;
    document.getElementById('modalTitle').textContent = '本質的理想を編集';
    document.getElementById('idealTitle').value = ideal.title;
    
    // Reset containers
    document.getElementById('questsContainer').innerHTML = '';
    document.getElementById('visionsContainer').innerHTML = '';
    questInputCount = 0;
    visionInputCount = 0;
    
    // Load existing quests
    if (ideal.quests) {
        ideal.quests.forEach(quest => {
            addQuestInput(quest);
        });
    } else {
        addQuestInput();
    }
    
    // Load existing visions
    if (ideal.visions) {
        ideal.visions.forEach(vision => {
            addVisionInput(vision);
        });
    } else {
        addVisionInput();
    }
    
    document.getElementById('idealModal').classList.remove('hidden');
}

function closeIdealModal() {
    document.getElementById('idealModal').classList.add('hidden');
    currentEditingIdeal = null;
}

function addQuestInput(questData = null) {
    const container = document.getElementById('questsContainer');
    const inputId = questInputCount++;
    
    const questDiv = document.createElement('div');
    questDiv.className = 'flex items-center space-x-2 quest-input-group animate__animated animate__fadeIn';
    questDiv.dataset.questId = inputId;
    
    questDiv.innerHTML = `
        <input type="text" 
               class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
               placeholder="クエストタイトル" 
               name="quest-title-${inputId}"
               value="${questData ? escapeHtml(questData.title) : ''}"
               required>
        <input type="number" 
               class="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
               placeholder="目標" 
               name="quest-target-${inputId}"
               value="${questData ? questData.target : ''}"
               min="1"
               required>
        <input type="text" 
               class="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
               placeholder="単位" 
               name="quest-unit-${inputId}"
               value="${questData ? escapeHtml(questData.unit) : ''}"
               required>
        <button type="button" 
                class="px-3 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200"
                onclick="removeQuestInput(${inputId})">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    container.appendChild(questDiv);
}

function removeQuestInput(inputId) {
    const element = document.querySelector(`[data-quest-id="${inputId}"]`);
    if (element) {
        element.remove();
    }
}

function addVisionInput(visionText = '') {
    const container = document.getElementById('visionsContainer');
    const inputId = visionInputCount++;
    
    const visionDiv = document.createElement('div');
    visionDiv.className = 'flex items-center space-x-2 vision-input-group animate__animated animate__fadeIn';
    visionDiv.dataset.visionId = inputId;
    
    visionDiv.innerHTML = `
        <input type="text" 
               class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
               placeholder="絵になる姿を入力" 
               name="vision-${inputId}"
               value="${escapeHtml(visionText)}"
               required>
        <button type="button" 
                class="px-3 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200"
                onclick="removeVisionInput(${inputId})">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    container.appendChild(visionDiv);
}

function removeVisionInput(inputId) {
    const element = document.querySelector(`[data-vision-id="${inputId}"]`);
    if (element) {
        element.remove();
    }
}

// Handle form submission
async function handleIdealSubmit(e) {
    e.preventDefault();
    
    const title = document.getElementById('idealTitle').value;
    
    // Collect quests
    const quests = [];
    document.querySelectorAll('.quest-input-group').forEach(group => {
        const questId = group.dataset.questId;
        const title = document.querySelector(`[name="quest-title-${questId}"]`).value;
        const target = parseInt(document.querySelector(`[name="quest-target-${questId}"]`).value);
        const unit = document.querySelector(`[name="quest-unit-${questId}"]`).value;
        
        if (title && target && unit) {
            quests.push({
                title,
                target,
                unit,
                current: currentEditingIdeal?.quests?.find(q => q.title === title)?.current || 0,
                completed: false
            });
        }
    });
    
    // Collect visions
    const visions = [];
    document.querySelectorAll('.vision-input-group').forEach(group => {
        const visionId = group.dataset.visionId;
        const text = document.querySelector(`[name="vision-${visionId}"]`).value;
        
        if (text) {
            visions.push(text);
        }
    });
    
    const idealData = {
        title,
        quests,
        visions
    };
    
    if (currentEditingIdeal) {
        idealData.id = currentEditingIdeal.id;
        idealData.achieved = currentEditingIdeal.achieved;
    }
    
    const success = await window.app.saveIdeal(idealData);
    
    if (success) {
        closeIdealModal();
    }
}

// Detail modal functions
function openIdealDetail(ideal) {
    currentEditingIdeal = ideal;
    
    document.getElementById('detailTitle').textContent = ideal.title;
    const progress = window.app.calculateIdealProgress(ideal);
    document.getElementById('detailProgress').textContent = `進捗: ${progress}%`;
    
    // Set achievement toggle
    const toggle = document.getElementById('achievementToggle');
    if (ideal.achieved) {
        toggle.classList.add('bg-green-500');
        toggle.classList.remove('bg-gray-200');
        toggle.querySelector('span').classList.add('translate-x-5');
        toggle.querySelector('span').classList.remove('translate-x-1');
    } else {
        toggle.classList.remove('bg-green-500');
        toggle.classList.add('bg-gray-200');
        toggle.querySelector('span').classList.remove('translate-x-5');
        toggle.querySelector('span').classList.add('translate-x-1');
    }
    
    // Render quests
    const questsList = document.getElementById('detailQuestsList');
    questsList.innerHTML = '';
    
    if (ideal.quests && ideal.quests.length > 0) {
        ideal.quests.forEach(quest => {
            const questDiv = document.createElement('div');
            questDiv.className = 'flex items-center justify-between p-3 bg-gray-50 rounded-lg';
            
            const questProgress = Math.min((quest.current / quest.target) * 100, 100);
            
            questDiv.innerHTML = `
                <div class="flex-1">
                    <div class="font-medium">${escapeHtml(quest.title)}</div>
                    <div class="text-sm text-gray-500">${quest.current} / ${quest.target} ${escapeHtml(quest.unit)}</div>
                </div>
                <div class="ml-4">
                    ${quest.completed ? '<i class="fas fa-check-circle text-green-500"></i>' : `<span class="text-sm font-medium">${Math.round(questProgress)}%</span>`}
                </div>
            `;
            
            questsList.appendChild(questDiv);
        });
    } else {
        questsList.innerHTML = '<p class="text-gray-500">クエストが設定されていません</p>';
    }
    
    // Render visions
    const visionsList = document.getElementById('detailVisionsList');
    visionsList.innerHTML = '';
    
    if (ideal.visions && ideal.visions.length > 0) {
        ideal.visions.forEach((vision, index) => {
            const visionDiv = document.createElement('div');
            visionDiv.className = 'flex items-center p-3 bg-gray-50 rounded-lg';
            
            const visionKey = `${ideal.id}_${index}`;
            const isCompleted = window.completedVisions && window.completedVisions.has(visionKey);
            
            visionDiv.innerHTML = `
                <i class="fas ${isCompleted ? 'fa-check-circle text-green-500' : 'fa-circle text-gray-300'} mr-3"></i>
                <div class="flex-1">${escapeHtml(vision)}</div>
            `;
            
            visionsList.appendChild(visionDiv);
        });
    } else {
        visionsList.innerHTML = '<p class="text-gray-500">絵になる姿が設定されていません</p>';
    }
    
    document.getElementById('idealDetailModal').classList.remove('hidden');
}

function closeDetailModal() {
    document.getElementById('idealDetailModal').classList.add('hidden');
    currentEditingIdeal = null;
}

function editCurrentIdeal() {
    const ideal = currentEditingIdeal;
    closeDetailModal();
    setTimeout(() => openEditIdealModal(ideal), 100);
}

async function deleteCurrentIdeal() {
    if (!currentEditingIdeal) return;
    
    if (confirm(`「${currentEditingIdeal.title}」を削除してもよろしいですか？`)) {
        const success = await window.app.deleteIdeal(currentEditingIdeal.id);
        if (success) {
            closeDetailModal();
        }
    }
}

async function toggleAchievement() {
    if (!currentEditingIdeal) return;
    
    const toggle = document.getElementById('achievementToggle');
    const newState = !currentEditingIdeal.achieved;
    
    const success = await window.app.toggleIdealAchievement(currentEditingIdeal.id, newState);
    
    if (success) {
        currentEditingIdeal.achieved = newState;
        
        if (newState) {
            toggle.classList.add('bg-green-500');
            toggle.classList.remove('bg-gray-200');
            toggle.querySelector('span').classList.add('translate-x-5');
            toggle.querySelector('span').classList.remove('translate-x-1');
        } else {
            toggle.classList.remove('bg-green-500');
            toggle.classList.add('bg-gray-200');
            toggle.querySelector('span').classList.remove('translate-x-5');
            toggle.querySelector('span').classList.add('translate-x-1');
        }
    }
}

// Update functions
async function updateQuest(idealId, questIndex, newValue) {
    const success = await window.app.updateQuestProgress(idealId, questIndex, newValue);
    if (success) {
        renderQuestsTab();
    }
}

async function toggleVision(idealId, visionIndex, completed) {
    const success = await window.app.toggleVisionDaily(idealId, visionIndex, completed);
    if (success) {
        renderVisionsTab();
    }
}

async function deleteVisionItem(idealId, visionIndex) {
    const success = await window.app.deleteVision(idealId, visionIndex);
    if (success) {
        renderVisionsTab();
    }
}

// Utility functions
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
}

// Export functions
window.renderIdealsTab = renderIdealsTab;
window.renderQuestsTab = renderQuestsTab;
window.renderVisionsTab = renderVisionsTab;
window.removeQuestInput = removeQuestInput;
window.removeVisionInput = removeVisionInput;
