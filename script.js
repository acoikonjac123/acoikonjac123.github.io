const USER_LIST = [
    'AC_OI-konjac',
    'Luo_Yicheng',
    'pansir3',
    'hzy_Q',
    'mengRmengX',
    'FSFWYC',
    'K.L.TONG',
    'guojingjing',
    'xiaomazai',
    'zzmbj',
    'anny1019',
    'zhaodexuan',
    'tongxh',
    'ImWuUllKnow',
    'yuhaolin',
    'xmz',
    'yangyf',
    'stone_guo',
    'Free_Code',
    'dhkman',
    'WBX0513',
    'Zdy402',
    'yzzqcl2025'
];

// 全局状态
const state = {
    data: null,
    isFetching: false,
    tagFilters: []
};

//  DOM 引用
const DOM = {
    userListDisplay: document.getElementById('userListDisplay'),
    fetchBtn: document.getElementById('fetchBtn'),
    statusText: document.getElementById('statusText'),
    progressBar: document.getElementById('fetchProgress'),
    progressFill: document.getElementById('progressFill'),
    progressText: document.getElementById('progressText'),
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

// 初始化
function init() {
    renderUserTags();
    setupEventListeners();
    console.log('📊 Codeforces 提交记录查看器已加载');
    console.log(`📋 监控用户 (${USER_LIST.length} 个): ${USER_LIST.join(', ')}`);
    setTimeout(fetchFromAPI, 500);
}

// 渲染用户标签
function renderUserTags() {
    DOM.userListDisplay.innerHTML = USER_LIST.map(name => 
        `<span class="user-tag">${name}</span>`
    ).join('');
}

// 事件监听
function setupEventListeners() {
    // 搜索和过滤
    DOM.searchInput.addEventListener('input', applyFilters);
    DOM.filterUser.addEventListener('change', applyFilters);
    DOM.filterRating.addEventListener('change', applyFilters);
    DOM.sortOrder.addEventListener('change', applyFilters);
    DOM.tagInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            applyTagFilter();
        }
    });
}

// 标签筛选
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

// API 抓取
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

// 核心过滤和排序
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

    // 获取用户列表
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

// 数据渲染
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
                <span>平均难度: <strong>${stats.avgRating}</strong></span>
                <span>语言: <strong>${stats.languageCount}</strong> 种</span>
                ${topTags.length > 0 ? `<span>🏷️ ${topTags.map(([tag, count]) => `${tag}(${count})`).join(', ')}</span>` : ''}
                <button class="btn btn-outline" onclick="toggleUser(this)" style="padding:4px 12px;font-size:12px;">收起</button>
            </div>
        </div>
        <div class="table-wrapper user-content">
            <table>
                <thead>
                    <tr>
                        <th style="width:50px;">#</th>
                        <th style="width:100px;">题目ID</th>
                        <th>题目名称</th>
                        <th style="width:80px;">难度</th>
                        <th style="width:130px;">语言</th>
                        <th style="width:150px;">提交时间</th>
                        <th>标签</th>
                    </tr>
                </thead>
                <tbody>
                    ${submissions.map((sub, idx) => `
                        <tr>
                            <td>${idx + 1}</td>
                            <td><a href="${sub.problemUrl || sub.codeUrl || '#'}" target="_blank" class="problem-link">${sub.problemId || 'N/A'}</a></td>
                            <td>${sub.problemName || 'N/A'}</td>
                            <td><span class="rating-badge ${getRatingClass(sub.rating)}">${sub.rating || 'N/A'}</span></td>
                            <td><span class="language-tag">${sub.language || 'N/A'}</span></td>
                            <td>${sub.submissionTime ? sub.submissionTime.slice(0, 16) : 'N/A'}</td>
                            <td>${(sub.tags || []).map(t => {
                                const isHighlighted = state.tagFilters.some(filter => t.toLowerCase().includes(filter));
                                return `<span class="tag ${isHighlighted ? 'tag-highlight' : ''}">${t}</span>`;
                            }).join('')}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
    return card;
}

function calculateStats(submissions) {
    const ratings = submissions.map(s => s.rating).filter(r => r);
    const avgRating = ratings.length > 0 ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(0) : 'N/A';
    const languages = new Set(submissions.map(s => s.language));
    const tags = submissions.flatMap(s => s.tags || []);
    const tagCount = {};
    tags.forEach(t => { tagCount[t] = (tagCount[t] || 0) + 1; });
    const topTags = Object.entries(tagCount).sort((a, b) => b[1] - a[1]);
    return { avgRating, languageCount: languages.size, topTags };
}

function getRatingClass(rating) {
    if (!rating) return 'rating-unknown';
    if (rating <= 1199) return 'rating-800-1199';
    if (rating <= 1599) return 'rating-1200-1599';
    if (rating <= 1999) return 'rating-1600-1999';
    if (rating <= 2399) return 'rating-2000-2399';
    return 'rating-2400-3500';
}

function createEmptyState(icon, title, description) {
    return `
        <div class="empty-state">
            <div class="icon">${icon}</div>
            <h3>${title}</h3>
            <p>${description}</p>
        </div>
    `;
}

function renderEmpty() {
    DOM.dataDisplay.innerHTML = createEmptyState('📭', '没有数据', '请点击"抓取数据"获取提交记录');
}

function updateUI(data) {
    let totalSubs = 0;
    const allProblems = new Set();
    const users = Object.keys(data);

    for (const [handle, submissions] of Object.entries(data)) {
        totalSubs += submissions.length;
        for (const sub of submissions) {
            if (sub.problemId) allProblems.add(sub.problemId);
        }
    }
    DOM.totalUsers.textContent = users.length;
    DOM.totalSubmissions.textContent = totalSubs;
    DOM.totalProblems.textContent = allProblems.size;
    const select = DOM.filterUser;
    select.innerHTML = '<option value="">所有用户</option>';
    for (const handle of users.sort()) {
        const option = document.createElement('option');
        option.value = handle;
        option.textContent = handle;
        select.appendChild(option);
    }
}

function updateFilterInfo(data) {
    const userCount = Object.keys(data).length;
    const totalSubs = Object.values(data).reduce((sum, subs) => sum + subs.length, 0);
    let info = `显示 ${userCount} 个用户，${totalSubs} 条记录`;
    if (state.tagFilters.length > 0) {
        info += `，标签筛选: ${state.tagFilters.map(t => `<span class="filter-tag-badge">${t}</span>`).join(' ')}`;
    }
    DOM.filterInfo.innerHTML = info;
}

function showDataContainer(show) {
    if (show) {
        DOM.dataContainer.classList.remove('hidden');
        DOM.emptyState.classList.add('hidden');
    } else {
        DOM.dataContainer.classList.add('hidden');
        DOM.emptyState.classList.remove('hidden');
    }
}

function showLoading(show, text = '正在加载数据...') {
    if (show) {
        DOM.loadingState.classList.remove('hidden');
        DOM.loadingText.textContent = text;
    } else {
        DOM.loadingState.classList.add('hidden');
    }
}

function showProgress(show) {
    if (show) {
        DOM.progressBar.classList.remove('hidden');
    } else {
        DOM.progressBar.classList.add('hidden');
        DOM.progressFill.style.width = '0%';
        DOM.progressText.textContent = '';
    }
}

function updateProgress(current, total, text) {
    const percent = total > 0 ? (current / total * 100) : 0;
    DOM.progressFill.style.width = `${Math.min(percent, 100)}%`;
    DOM.progressText.textContent = `${current}/${total} ${text}`;
}

function setStatus(text, type = '') {
    DOM.statusText.textContent = text;
    DOM.statusText.className = 'status-text' + (type ? ` ${type}` : '');
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function toggleUser(btn) {
    const content = btn.closest('.user-header').nextElementSibling;
    if (content.style.display === 'none') {
        content.style.display = 'block';
        btn.textContent = '收起';
    } else {
        content.style.display = 'none';
        btn.textContent = '展开';
    }
}

function toggleAllUsers() {
    const contents = document.querySelectorAll('.user-content');
    if (contents.length === 0) return;
    
    const visible = contents[0]?.style.display !== 'none';
    contents.forEach(c => {
        c.style.display = visible ? 'none' : 'block';
    });
    
    const btns = document.querySelectorAll('.user-header .btn-outline');
    btns.forEach(b => {
        b.textContent = visible ? '展开' : '收起';
    });
}

function clearData() {
    if (state.data && Object.keys(state.data).length > 0) {
        if (!confirm('确定要清除所有数据吗？')) return;
    }
    state.data = null;
    state.tagFilters = [];
    DOM.tagInput.value = '';
    DOM.searchInput.value = '';
    DOM.filterUser.value = '';
    DOM.filterRating.value = '';
    DOM.dataDisplay.innerHTML = '';
    showDataContainer(false);
    updateUI({});
    setStatus('🗑️ 数据已清除', '');
    DOM.filterInfo.textContent = '显示所有用户';
}

// 导出功能
function exportToJSON() {
    if (!state.data) {
        alert('没有数据可导出');
        return;
    }
    const json = JSON.stringify(state.data, null, 2);
    downloadFile(json, 'codeforces_submissions.json', 'application/json');
    setStatus('💾 JSON 导出成功', 'success');
}

function exportToCSV() {
    if (!state.data) {
        alert('没有数据可导出');
        return;
    }

    let rows = [['用户', '题目ID', '题目名称', '难度', '语言', '提交时间', '标签', '提交链接'].join(',')];
    for (const [handle, submissions] of Object.entries(state.data)) {
        for (const sub of submissions) {
            const tags = (sub.tags || []).join('; ');
            rows.push([
                handle,
                sub.problemId || '',
                `"${(sub.problemName || '').replace(/"/g, '""')}"`,
                sub.rating || 'N/A',
                `"${(sub.language || '').replace(/"/g, '""')}"`,
                sub.submissionTime ? sub.submissionTime.slice(0, 16) : '',
                `"${tags}"`,
                sub.problemUrl || sub.codeUrl || ''
            ].join(','));
        }
    }
    const csv = rows.join('\n');
    downloadFile(csv, 'codeforces_submissions_export.csv', 'text/csv');
    setStatus('📊 CSV 导出成功', 'success');
}

function exportToMarkdown() {
    if (!state.data) {
        alert('没有数据可导出');
        return;
    }
    let md = '# Codeforces 提交记录\n\n';
    md += `导出时间: ${new Date().toLocaleString()}\n\n`;
    for (const [handle, submissions] of Object.entries(state.data)) {
        md += `## 👤 ${handle}\n\n`;
        md += `共 ${submissions.length} 道 AC 题目\n\n`;
        if (submissions.length === 0) continue;

        md += '| # | 题目ID | 题目名称 | 难度 | 语言 | 提交时间 |\n';
        md += '|---|--------|---------|------|------|----------|\n';
        const display = submissions.slice(0, 50);
        display.forEach((sub, idx) => {
            md += `| ${idx+1} | ${sub.problemId || ''} | ${sub.problemName || ''} | ${sub.rating || 'N/A'} | ${sub.language || ''} | ${sub.submissionTime ? sub.submissionTime.slice(0,16) : ''} |\n`;
        });
        if (submissions.length > 50) {
            md += `\n*... 还有 ${submissions.length - 50} 条记录*\n`;
        }
        md += '\n---\n\n';
    }
    downloadFile(md, 'codeforces_submissions_export.md', 'text/markdown');
    setStatus('📝 Markdown 导出成功', 'success');
}

function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
}

init();
