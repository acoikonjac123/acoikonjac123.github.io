/**
 * Codeforces 提交记录查看器 - 核心逻辑
 * 支持标签筛选、难度筛选、用户排序
 */

// ==================== 配置 ====================
// 👇 在这里修改你要监控的用户列表
const USER_LIST = [
    'tourist',
    'jiangly',
    'Benq',
    'Petr',
    'Egor',
    'Radewoosh',
    'ecnerwala',
    'scott_wu',
    'mnbvmar',
    'ainta'
];

// ==================== 全局状态 ====================
const state = {
    data: null,
    isFetching: false,
    tagFilters: [],
    sortOrder: 'desc'
};

// ==================== DOM 引用 ====================
const DOM = {
    userListDisplay: document.getElementById('userListDisplay'),
    fetchBtn: document.getElementById('fetchBtn'),
    statusText: document.getElementById('statusText'),
    progressBar: document.getElementById('fetchProgress'),
    progressFill: document.getElementById('progressFill'),
    progressText: document.getElementById('progressText'),
    uploadArea: document.getElementById('uploadArea'),
    fileInput: document.getElementById('fileInput'),
    dataContainer: document.getElementById('dataContainer'),
    dataDisplay: document.getElementById('dataDisplay'),
    emptyState: document.getElementById('emptyState'),
    loadingState: document.getElementById('loadingState'),
    loadingText: document.getElementById('loadingText'),
    searchInput: document.getElementById('searchInput'),
    filterUser: document.getElementById('filterUser'),
    filterRating: document.getElementById('filterRating'),
    tagInput: document.getElementById('tagInput'),
    sortOrder: document.getElementById('sortOrder'),
    filterInfo: document.getElementById('filterInfo'),
    totalUsers: document.getElementById('totalUsers'),
    totalSubmissions: document.getElementById('totalSubmissions'),
    totalProblems: document.getElementById('totalProblems')
};

// ==================== 初始化 ====================
function init() {
    renderUserTags();
    setupEventListeners();
    console.log('📊 Codeforces 提交记录查看器已加载');
    console.log(`📋 监控用户: ${USER_LIST.join(', ')}`);
}

// ==================== 渲染用户标签 ====================
function renderUserTags() {
    DOM.userListDisplay.innerHTML = USER_LIST.map(name => 
        `<span class="user-tag">${name}</span>`
    ).join('');
}

// ==================== 事件监听 ====================
function setupEventListeners() {
    // 文件上传
    DOM.fileInput.addEventListener('change', function(e) {
        if (this.files.length > 0) {
            loadJSONFile(this.files[0]);
        }
    });

    // 拖拽上传
    DOM.uploadArea.addEventListener('dragover', function(e) {
        e.preventDefault();
        this.classList.add('dragover');
    });
    DOM.uploadArea.addEventListener('dragleave', function(e) {
        e.preventDefault();
        this.classList.remove('dragover');
    });
    DOM.uploadArea.addEventListener('drop', function(e) {
        e.preventDefault();
        this.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0 && files[0].name.endsWith('.json')) {
            loadJSONFile(files[0]);
        } else {
            alert('请上传 JSON 文件');
        }
    });
    DOM.uploadArea.addEventListener('click', function(e) {
        if (e.target.tagName !== 'BUTTON' && e.target.tagName !== 'INPUT') {
            DOM.fileInput.click();
        }
    });

    // 搜索和过滤
    DOM.searchInput.addEventListener('input', applyFilters);
    DOM.filterUser.addEventListener('change', applyFilters);
    DOM.filterRating.addEventListener('change', applyFilters);
    DOM.sortOrder.addEventListener('change', applyFilters);
    
    // 回车触发标签筛选
    DOM.tagInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            applyTagFilter();
        }
    });
}

// ==================== 标签筛选 ====================
function applyTagFilter() {
    const input = DOM.tagInput.value.trim();
    if (input) {
        state.tagFilters = input.split(',').map(t => t.trim().toLowerCase()).filter(t => t);
    } else {
        state.tagFilters = [];
    }
    applyFilters();
}

function clearTagFilter() {
    DOM.tagInput.value = '';
    state.tagFilters = [];
    applyFilters();
}

// ==================== API 抓取 ====================

async function fetchFromAPI() {
    if (state.isFetching) return;
    if (USER_LIST.length === 0) {
        setStatus('❌ 用户列表为空', 'error');
        return;
    }

    state.isFetching = true;
    DOM.fetchBtn.disabled = true;
    showLoading(true, '正在抓取数据，请稍候...');
    setStatus('⏳ 正在抓取...', 'loading');
    showProgress(true);

    const results = {};
    let completed = 0;
    const total = USER_LIST.length;

    try {
        for (const handle of USER_LIST) {
            updateProgress(completed, total, handle);
            
            const submissions = await fetchUserSubmissions(handle);
            if (submissions.length > 0) {
                results[handle] = submissions;
            }
            
            completed++;
            if (completed < total) {
                await sleep(1200);
            }
        }

        state.data = results;
        updateProgress(total, total, '完成！');
        setStatus(`✅ 抓取完成 (${Object.keys(results).length}/${total} 个用户)`, 'success');
        
        applyFilters();
        updateUI(results);
        showDataContainer(true);
        showLoading(false);
        showProgress(false);

    } catch (error) {
        console.error('抓取失败:', error);
        setStatus(`❌ 抓取失败: ${error.message}`, 'error');
        showLoading(false);
        showProgress(false);
    } finally {
        state.isFetching = false;
        DOM.fetchBtn.disabled = false;
    }
}

async function fetchUserSubmissions(handle) {
    const url = `https://codeforces.com/api/user.status?handle=${handle}`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.status !== 'OK') {
            console.warn(`用户 ${handle}: ${data.comment || '未知错误'}`);
            return [];
        }

        const acSubmissions = data.result
            .filter(sub => sub.verdict === 'OK')
            .map(sub => ({
                problemId: `${sub.problem.contestId}${sub.problem.index}`,
                problemName: sub.problem.name,
                contestId: sub.problem.contestId,
                problemIndex: sub.problem.index,
                rating: sub.problem.rating || null,
                tags: sub.problem.tags || [],
                submissionId: sub.id,
                language: sub.programmingLanguage,
                submissionTime: new Date(sub.creationTimeSeconds * 1000).toISOString(),
                codeUrl: `https://codeforces.com/contest/${sub.problem.contestId}/submission/${sub.id}`,
                problemUrl: `https://codeforces.com/problemset/problem/${sub.problem.contestId}/${sub.problem.index}`
            }));

        console.log(`✅ ${handle}: ${acSubmissions.length} 条 AC 记录`);
        return acSubmissions;

    } catch (error) {
        console.error(`❌ ${handle}: 请求失败`, error);
        return [];
    }
}

// ==================== 加载 JSON 文件 ====================
function loadJSONFile(file) {
    showLoading(true, '正在解析文件...');
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            state.data = data;
            applyFilters();
            updateUI(data);
            showDataContainer(true);
            showLoading(false);
            setStatus(`✅ 已加载 ${Object.keys(data).length} 个用户的数据`, 'success');
        } catch (error) {
            alert('❌ JSON 解析失败，请检查文件格式');
            console.error('解析错误:', error);
            showLoading(false);
        }
    };
    reader.readAsText(file);
}

// ==================== 加载示例数据 ====================
function loadSampleData() {
    const sampleData = generateSampleData();
    state.data = sampleData;
    applyFilters();
    updateUI(sampleData);
    showDataContainer(true);
    setStatus('📂 已加载示例数据', 'success');
}

function generateSampleData() {
    const data = {};
    const tags = ['dp', 'math', 'greedy', 'graph', 'data structures', 'sorting', 'binary search'];
    const ratings = [800, 1000, 1200, 1400, 1600, 1800, 2000, 2200, 2400];
    
    USER_LIST.slice(0, 5).forEach((handle, idx) => {
        data[handle] = [];
        const count = Math.floor(Math.random() * 50) + 10;
        for (let i = 0; i < count; i++) {
            const rating = ratings[Math.floor(Math.random() * ratings.length)];
            const tagCount = Math.floor(Math.random() * 3) + 1;
            const subTags = [];
            for (let j = 0; j < tagCount; j++) {
                subTags.push(tags[Math.floor(Math.random() * tags.length)]);
            }
            data[handle].push({
                problemId: `${1000 + i}${String.fromCharCode(65 + i % 26)}`,
                problemName: `Problem ${i + 1}`,
                contestId: 1000 + i,
                problemIndex: String.fromCharCode(65 + i % 26),
                rating: rating,
                tags: subTags,
                submissionId: 100000000 + i,
                language: ['C++17', 'Python 3', 'Java', 'C++20'][Math.floor(Math.random() * 4)],
                submissionTime: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
                codeUrl: `#`,
                problemUrl: `#`
            });
        }
    });
    return data;
}

// ==================== 核心过滤和排序 ====================

function applyFilters() {
    if (!state.data) {
        renderEmpty();
        return;
    }

    const searchTerm = DOM.searchInput.value;
    const filterUser = DOM.filterUser.value;
    const filterRating = DOM.filterRating.value;
    const sortOrder = DOM.sortOrder.value;
    const tagFilters = state.tagFilters;

    let filteredData = {};

    // 获取用户列表并排序
    let users = Object.keys(state.data);
    
    // 按用户过滤
    if (filterUser) {
        users = users.filter(u => u === filterUser);
    }

    // 对每个用户的数据进行过滤
    for (const handle of users) {
        let submissions = state.data[handle] || [];

        // 搜索过滤
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            submissions = submissions.filter(s =>
                s.problemName?.toLowerCase().includes(term) ||
                s.problemId?.toLowerCase().includes(term) ||
                (s.tags || []).some(t => t.toLowerCase().includes(term))
            );
        }

        // 难度过滤
        if (filterRating) {
            if (filterRating === 'unknown') {
                submissions = submissions.filter(s => !s.rating);
            } else {
                const [min, max] = filterRating.split('-').map(Number);
                submissions = submissions.filter(s => s.rating && s.rating >= min && s.rating <= max);
            }
        }

        // 标签过滤
        if (tagFilters.length > 0) {
            submissions = submissions.filter(s => {
                const subTags = (s.tags || []).map(t => t.toLowerCase());
                return tagFilters.every(tag => subTags.some(st => st.includes(tag)));
            });
        }

        if (submissions.length > 0) {
            filteredData[handle] = submissions;
        }
    }

    // 对用户进行排序
    const sortedUsers = Object.keys(filteredData).sort((a, b) => {
        const countA = filteredData[a].length;
        const countB = filteredData[b].length;
        
        if (sortOrder === 'asc') {
            return countA - countB;
        } else if (sortOrder === 'desc') {
            return countB - countA;
        } else { // 'name'
            return a.localeCompare(b);
        }
    });

    // 重建排序后的数据
    const sortedData = {};
    for (const handle of sortedUsers) {
        sortedData[handle] = filteredData[handle];
    }

    // 更新过滤信息
    updateFilterInfo(sortedData);

    // 渲染
    renderData(sortedData);
}

// ==================== 数据渲染 ====================

function renderData(data) {
    const container = DOM.dataDisplay;
    container.innerHTML = '';

    if (!data || Object.keys(data).length === 0) {
        container.innerHTML = createEmptyState('🔍', '没有匹配的记录', '尝试调整筛选条件');
        return;
    }

    let rank = 1;
    for (const [handle, submissions] of Object.entries(data)) {
        const userCard = createUserCard(handle, submissions, rank);
        container.appendChild(userCard);
        rank++;
    }
}

function createUserCard(handle, submissions, rank) {
    const card = document.createElement('div');
    card.className = 'user-card';

    const stats = calculateStats(submissions);
    const topTags = stats.topTags.slice(0, 3);

    card.innerHTML = `
        <div class="user-header">
            <div class="user-info">
                <span class="user-name">👤 ${handle}</span>
                <span class="user-rank">#${rank}</span>
                <span style="color:#666;font-size:14px;">${submissions.length} 道 AC</span>
            </div>
            <div class="user-stats">
                <span>⭐ 平均难度: <strong>${stats.avgRating}</strong></span>
                <span>💻 语言: <strong>${stats.languageCount}</strong> 种</span>
                ${topTags.length > 0 ? `<span>🏷️ ${topTags.map(([tag, count]) => `${tag}(${count})`).join(', ')}</span>` : ''}
                <button class="btn btn-outline" onclick="toggleUser(this)" style="padding:4px 12px;font-size:12px;">收起</button>
            </div>
        </div>
        <div class="table-wrapper user-content">
            <table>
                <thead>
                    <tr>
                        <th style="width:50px;">#</th>
                        <th style="width:
