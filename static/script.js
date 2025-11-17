document.addEventListener('DOMContentLoaded', () => {
    const API_URL = '/api/get-user-info';

    // DOM 요소
    const form = document.getElementById('add-player-form');
    const riotIdInput = document.getElementById('riot-id');
    const tagLineInput = document.getElementById('tag-line');
    const addBtn = document.getElementById('add-btn');
    const errorMessage = document.getElementById('error-message');
    
    const playerCountSpan = document.getElementById('player-count');
    const playerQueueDiv = document.getElementById('player-queue');
    
    const resultContainer = document.getElementById('result-container');
    const team1Div = document.getElementById('team-1');
    const team2Div = document.getElementById('team-2');
    const resetBtn = document.getElementById('reset-btn');

    // 플레이어 대기열 (세션 스토리지에서 로드)
    let playerQueue = JSON.parse(sessionStorage.getItem('playerQueue')) || [];

    // UI 렌더링 함수
    const renderQueue = () => {
        playerQueueDiv.innerHTML = '';
        playerQueue.forEach(player => {
            const card = createPlayerCard(player, 'queue');
            playerQueueDiv.appendChild(card);
        });
        playerCountSpan.textContent = playerQueue.length;
        
        if (playerQueue.length >= 10) {
            addBtn.disabled = true;
            riotIdInput.disabled = true;
            tagLineInput.disabled = true;
        }
    };

    const createPlayerCard = (player, type = 'result') => {
        const card = document.createElement('div');
        card.className = `player-card ${type}-card`;
        
        // 티어 정보 파싱 및 클래스 추가
        const tier = player.league.split(' ')[0].toLowerCase();
        if (tier) {
            card.classList.add(`tier-${tier}`);
        }

        card.innerHTML = `
            <img src="${player.profileIconLink}" alt="${player.riotId} icon" class="player-icon">
            <div class="player-info">
                <div class="player-name">${player.riotId}</div>
                <div class="player-tier">${player.league}</div>
            </div>
        `;
        return card;
    };

    // 폼 제출 이벤트 처리
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const riotId = riotIdInput.value.trim();
        const tagLine = tagLineInput.value.trim();

        if (!riotId || !tagLine) return;

        addBtn.disabled = true;
        addBtn.textContent = '조회 중...';
        errorMessage.textContent = '';

        try {
            const response = await fetch(`${API_URL}?riot_id=${riotId}&tag_line=${tagLine}`);
            const data = await response.json();

            if (data.error) {
                throw new Error(data.error);
            }
            
            if (playerQueue.some(p => p.riotId === data.riotId)) {
                throw new Error('이미 추가된 플레이어입니다.');
            }

            playerQueue.push(data);
            sessionStorage.setItem('playerQueue', JSON.stringify(playerQueue));
            renderQueue();
            
            form.reset();
            riotIdInput.focus();

            if (playerQueue.length === 10) {
                generateTeams();
            }

        } catch (error) {
            errorMessage.textContent = error.message;
        } finally {
            addBtn.disabled = false;
            addBtn.textContent = '플레이어 추가';
        }
    });

    // 팀 생성 및 결과 표시
    const generateTeams = () => {
        const shuffledQueue = [...playerQueue].sort(() => 0.5 - Math.random());
        
        const team1 = shuffledQueue.slice(0, 5);
        const team2 = shuffledQueue.slice(5, 10);

        team1Div.innerHTML = '';
        team2Div.innerHTML = '';

        team1.forEach(player => team1Div.appendChild(createPlayerCard(player, 'result')));
        team2.forEach(player => team2Div.appendChild(createPlayerCard(player, 'result')));

        resultContainer.classList.remove('hidden');
    };

    // 다시 시작 버튼
    resetBtn.addEventListener('click', () => {
        playerQueue = [];
        sessionStorage.removeItem('playerQueue');
        
        renderQueue();
        resultContainer.classList.add('hidden');
        
        addBtn.disabled = false;
        riotIdInput.disabled = false;
        tagLineInput.disabled = false;
        errorMessage.textContent = '';
    });

    // 페이지 로드 시 초기 렌더링
    renderQueue();
});