document.addEventListener('DOMContentLoaded', () => {
    const API_URL = '/api/get-user-info';

    // DOM 요소
    const form = document.getElementById('add-player-form');
    const riotIdTagInput = document.getElementById('riot-id-tag');
    const addBtn = document.getElementById('add-btn');
    const errorMessage = document.getElementById('error-message');
    const playerCountSpan = document.getElementById('player-count');
    const playerQueueDiv = document.getElementById('player-queue');
    const clearQueueBtn = document.getElementById('clear-queue-btn');
    const resultContainer = document.getElementById('result-container');
    const team1Div = document.getElementById('team-1');
    const team2Div = document.getElementById('team-2');
    const resetBtn = document.getElementById('reset-btn');
    const swapBtn = document.getElementById('swap-btn');

    // 상태 변수
    let playerQueue = JSON.parse(sessionStorage.getItem('playerQueue')) || [];
    let team1 = [], team2 = [];
    let selectedPlayer1 = null, selectedPlayer2 = null;

    // --- 티어 점수 계산 ---
    const getTierScore = (player) => {
        if (!player.league || player.league === 'Unranked') return 0;
        const tierValues = { 'IRON': 0, 'BRONZE': 1000, 'SILVER': 2000, 'GOLD': 3000, 'PLATINUM': 4000, 'EMERALD': 5000, 'DIAMOND': 6000, 'MASTER': 7000, 'GRANDMASTER': 8000, 'CHALLENGER': 9000 };
        const rankValues = { 'IV': 0, 'III': 100, 'II': 200, 'I': 300 };
        const parts = player.league.split(' ');
        const tier = parts[0].toUpperCase();
        const rank = parts[1];
        const lp = parseInt(parts[3]) || 0;
        return (tierValues[tier] || 0) + (rankValues[rank] || 0) + lp;
    };

    // --- UI 렌더링 ---
    const renderQueue = () => {
        playerQueueDiv.innerHTML = '';
        playerQueue.forEach(p => playerQueueDiv.appendChild(createPlayerCard(p, 'queue')));
        playerCountSpan.textContent = playerQueue.length;
        const isQueueFull = playerQueue.length >= 10;
        addBtn.disabled = isQueueFull;
        riotIdTagInput.disabled = isQueueFull;
        clearQueueBtn.style.display = playerQueue.length > 0 ? 'inline-block' : 'none';
    };

    const createPlayerCard = (player, type = 'result') => {
        const card = document.createElement('div');
        card.className = `player-card ${type}-card`;
        card.dataset.riotId = player.riotId; // 교체 로직을 위해 ID 저장
        const tier = player.league.split(' ')[0].toLowerCase();
        if (tier) card.classList.add(`tier-${tier}`);

        const deleteBtnHTML = type === 'queue' ? `<button class="delete-player-btn" data-riot-id="${player.riotId}">×</button>` : '';
        
        card.innerHTML = `
            ${deleteBtnHTML}
            <img src="${player.profileIconLink}" alt="${player.riotId} icon" class="player-icon">
            <div class="player-info">
                <div class="player-name">${player.riotId}</div>
                <div class="player-tier">${player.league}</div>
            </div>
        `;
        return card;
    };

    const renderTeams = () => {
        team1Div.innerHTML = '';
        team2Div.innerHTML = '';
        team1.forEach(p => team1Div.appendChild(createPlayerCard(p, 'result')));
        team2.forEach(p => team2Div.appendChild(createPlayerCard(p, 'result')));
    };

    // --- 이벤트 처리 ---
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fullId = riotIdTagInput.value.trim();
        const parts = fullId.split('#');
        if (parts.length !== 2 || !parts[0] || !parts[1]) {
            errorMessage.textContent = 'Riot ID#Tag 형식으로 올바르게 입력해주세요.';
            return;
        }
        const [riotId, tagLine] = parts;

        addBtn.disabled = true;
        addBtn.textContent = '조회 중...';
        errorMessage.textContent = '';

        try {
            const response = await fetch(`${API_URL}?riot_id=${riotId}&tag_line=${tagLine}`);
            const data = await response.json();
            if (data.error) throw new Error(data.error);
            if (playerQueue.some(p => p.riotId.toLowerCase() === data.riotId.toLowerCase())) throw new Error('이미 추가된 플레이어입니다.');

            playerQueue.push(data);
            sessionStorage.setItem('playerQueue', JSON.stringify(playerQueue));
            renderQueue();
            form.reset();
            riotIdTagInput.focus();

            if (playerQueue.length === 10) generateTeams();
        } catch (error) {
            errorMessage.textContent = error.message;
        } finally {
            addBtn.disabled = playerQueue.length >= 10;
            addBtn.textContent = '플레이어 추가';
        }
    });

    playerQueueDiv.addEventListener('click', (e) => {
        if (e.target.classList.contains('delete-player-btn')) {
            const riotIdToDelete = e.target.dataset.riotId;
            playerQueue = playerQueue.filter(p => p.riotId !== riotIdToDelete);
            sessionStorage.setItem('playerQueue', JSON.stringify(playerQueue));
            renderQueue();
            if (playerQueue.length < 10) {
                resultContainer.classList.add('hidden');
                riotIdTagInput.disabled = false;
            }
        }
    });

    clearQueueBtn.addEventListener('click', () => {
        playerQueue = [];
        sessionStorage.removeItem('playerQueue');
        renderQueue();
        resultContainer.classList.add('hidden');
        riotIdTagInput.disabled = false;
        errorMessage.textContent = '';
    });

    resetBtn.addEventListener('click', () => clearQueueBtn.click());

    // --- 팀 교체 로직 ---
    const handlePlayerSelect = (e, teamNum) => {
        const card = e.target.closest('.player-card');
        if (!card) return;

        const riotId = card.dataset.riotId;

        if (teamNum === 1) {
            // 이미 선택된 플레이어를 다시 클릭하면 선택 해제
            if (selectedPlayer1 && selectedPlayer1.riotId === riotId) {
                selectedPlayer1 = null;
                card.classList.remove('selected');
            } else {
                // 기존에 선택된 카드의 하이라이트 제거
                const currentSelectedCard = team1Div.querySelector('.selected');
                if (currentSelectedCard) currentSelectedCard.classList.remove('selected');
                // 새로 플레이어 선택
                selectedPlayer1 = team1.find(p => p.riotId === riotId);
                card.classList.add('selected');
            }
        } else { // teamNum === 2
            if (selectedPlayer2 && selectedPlayer2.riotId === riotId) {
                selectedPlayer2 = null;
                card.classList.remove('selected');
            } else {
                const currentSelectedCard = team2Div.querySelector('.selected');
                if (currentSelectedCard) currentSelectedCard.classList.remove('selected');
                selectedPlayer2 = team2.find(p => p.riotId === riotId);
                card.classList.add('selected');
            }
        }
        
        // 두 팀 모두 플레이어가 선택되었을 때만 교체 버튼 표시
        swapBtn.classList.toggle('hidden', !(selectedPlayer1 && selectedPlayer2));
    };

    team1Div.addEventListener('click', (e) => handlePlayerSelect(e, 1));
    team2Div.addEventListener('click', (e) => handlePlayerSelect(e, 2));

    swapBtn.addEventListener('click', () => {
        if (!selectedPlayer1 || !selectedPlayer2) return;

        const index1 = team1.findIndex(p => p.riotId === selectedPlayer1.riotId);
        const index2 = team2.findIndex(p => p.riotId === selectedPlayer2.riotId);

        // Swap
        [team1[index1], team2[index2]] = [team2[index2], team1[index1]];

        // 선택 상태 초기화 및 UI 다시 그리기
        selectedPlayer1 = null;
        selectedPlayer2 = null;
        swapBtn.classList.add('hidden');
        renderTeams();
    });

    // --- 팀 생성 ---
    const generateTeams = () => {
        const sortedPlayers = [...playerQueue].sort((a, b) => getTierScore(b) - getTierScore(a));
        team1 = [];
        team2 = [];
        const distributionPattern = [0, 1, 1, 0, 0, 1, 1, 0, 0, 1];
        sortedPlayers.forEach((player, index) => {
            if (distributionPattern[index] === 0) team1.push(player);
            else team2.push(player);
        });
        renderTeams();
        resultContainer.classList.remove('hidden');
    };

    // --- 페이지 초기화 ---
    renderQueue();
    if (playerQueue.length === 10) {
        generateTeams();
    }
});
