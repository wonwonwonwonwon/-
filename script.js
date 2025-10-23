// ========================================
// Firebase SDK (Script Module)
// ========================================

// Firebase SDK 가져오기
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, setLogLevel } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Firestore 로깅 활성화 (디버깅용)
// setLogLevel('debug');

// ========================================================================
// 중요: Firebase 구성
// GitHub Pages 등 외부 환경에 배포할 때는
// 이 부분에 실제 Firebase 프로젝트의 구성 객체를 붙여넣어야 합니다.
// (Firebase 콘솔 -> 프로젝트 설정 -> 일반 -> '내 앱'에서 확인)
// ========================================================================
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};
// ========================================================================

// 앱 ID (Firestore 경로에 사용됩니다. Canvas 환경과 동일하게 유지하거나 고유 ID 사용)
const appId = 'default-reading-map';

// Firebase 앱, Firestore, Auth 초기화
let app, db, auth;
let userId;

// Firebase 초기화 및 인증을 수행하는 비동기 함수
async function initializeFirebase() {
    try {
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);

        // Firebase 인증 (외부 환경이므로 익명 로그인만 사용)
        await signInAnonymously(auth);
        console.log("Signed in anonymously.");
        
        userId = auth.currentUser?.uid || crypto.randomUUID();
        console.log("User ID:", userId);
        
        // Firebase 초기화 성공 시 앱 로직 시작
        initializeAppLogic();

    } catch (e) {
        console.error("Firebase initialization failed:", e);
        // 페이지에 오류 메시지 표시
        document.body.innerHTML = `<div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
            <strong class="font-bold">Firebase 연결 실패!</strong>
            <span class="block sm:inline">서비스에 연결할 수 없습니다. 설정을 확인해주세요.</span>
        </div>`;
    }
}

// Firestore 컬렉션 경로 (공용 데이터)
const collectionPath = `/artifacts/${appId}/public/data/reading_map_responses`;

// Firestore 저장 함수
async function saveReadingResponse(data) {
    if (!db) {
        console.error("Firestore is not initialized.");
        return;
    }
    const responsesCollection = collection(db, collectionPath);
    try {
        const docRef = await addDoc(responsesCollection, {
            ...data,
            userId: userId,
            createdAt: new Date().toISOString() // 타임스탬프
        });
        console.log("Document written with ID: ", docRef.id);
        return docRef.id;
    } catch (e) {
        console.error("Error adding document: ", e);
    }
}

// Firestore 모든 데이터 가져오기 함수
async function getAllResponses() {
    if (!db) {
        console.error("Firestore is not initialized.");
        return [];
    }
    const responsesCollection = collection(db, collectionPath);
    try {
        const querySnapshot = await getDocs(responsesCollection);
        const responses = [];
        querySnapshot.forEach((doc) => {
            responses.push(doc.data());
        });
        console.log("Fetched all responses:", responses.length);
        return responses;
    } catch (e) {
        console.error("Error fetching documents: ", e);
        return [];
    }
}


// ========================================
// App Logic (General Script)
// ========================================

// DOMContentLoaded 대신 Firebase 초기화 후 이 함수를 호출합니다.
function initializeAppLogic() {
    
    // 페이지 요소
    const pages = {
        start: document.getElementById('start-page'),
        survey: document.getElementById('survey-page'),
        loading: document.getElementById('loading-page'),
        report: document.getElementById('report-page')
    };

    const startBtn = document.getElementById('start-btn');
    const submitBtn = document.getElementById('submit-btn');
    const retryBtn = document.getElementById('retry-btn');
    const errorMessage = document.getElementById('error-message');
    
    let userData = {}; // 사용자 응답 저장 객체
    let chartInstances = {}; // 차트 인스턴스 저장

    // --- 페이지 네비게이션 ---

    function showPage(pageId) {
        Object.values(pages).forEach(page => page.classList.remove('active'));
        pages[pageId].classList.add('active');
    }

    // --- 이벤트 리스너 ---

    startBtn.addEventListener('click', () => {
        showPage('survey');
        window.scrollTo(0, 0); // 페이지 상단으로 스크롤
    });

    submitBtn.addEventListener('click', async () => {
        if (validateAndSaveAllAnswers()) { // 전체 검증 함수로 변경
            showPage('loading');
            
            // Firebase에 데이터 저장 (전역 window 대신 직접 호출)
            await saveReadingResponse(userData);
            
            // 모든 데이터 가져오기 (전역 window 대신 직접 호출)
            let allResponses = await getAllResponses();

            // 1.5초 딜레이 (로딩 애니메이션 보여주기용)
            setTimeout(() => {
                generateReport(allResponses);
                showPage('report');
            }, 1500);
        }
    });

    retryBtn.addEventListener('click', () => {
        // 재설정
        userData = {};
        // 모든 차트 파괴
        Object.values(chartInstances).forEach(chart => chart.destroy());
        chartInstances = {};
        // 모든 선택 해제
        document.querySelectorAll('.choice-btn.selected').forEach(btn => btn.classList.remove('selected'));
        document.getElementById('q1-nickname').value = '';
        document.getElementById('q7-book-title').value = '';
        document.getElementById('q7-book-reason').value = '';
        // 시작 페이지로 이동
        showPage('start');
    });

    // --- 선택 버튼 (라디오/체크박스) 로직 ---

    // 라디오 버튼처럼 동작하는 그룹 (Q2, Q3, Q4, Q6)
    ['#q2-age', '#q3-frequency', '#q4-purpose', '#q6-format'].forEach(groupId => {
        document.querySelector(groupId)?.addEventListener('click', (e) => {
            const btn = e.target.closest('.choice-btn');
            if (!btn) return;
            
            // 같은 그룹 내 다른 버튼 선택 해제
            document.querySelectorAll(`${groupId} .choice-btn`).forEach(b => b.classList.remove('selected'));
            // 현재 버튼 선택
            btn.classList.add('selected');
        });
    });

    // 체크박스처럼 동작하는 그룹 (Q5 - 장르, 최대 3개)
    const genreContainer = document.getElementById('q5-genre');
    const genreCountEl = document.getElementById('genre-count');
    const MAX_GENRES = 3;

    genreContainer.addEventListener('click', (e) => {
        const btn = e.target.closest('.choice-btn');
        if (!btn) return;

        const selectedGenres = genreContainer.querySelectorAll('.choice-btn.selected').length;
        
        if (btn.classList.contains('selected')) {
            // 선택 해제
            btn.classList.remove('selected');
        } else {
            // 새로 선택 (최대 3개)
            if (selectedGenres < MAX_GENRES) {
                btn.classList.add('selected');
            }
        }
        
        // 카운트 업데이트
        const newCount = genreContainer.querySelectorAll('.choice-btn.selected').length;
        genreCountEl.textContent = `선택한 개수: ${newCount} / ${MAX_GENRES}`;
        
        // 3개 찼을 때 경고 (선택되지 않은 버튼 비활성화 느낌)
        if (newCount >= MAX_GENRES) {
            genreContainer.querySelectorAll('.choice-btn:not(.selected)').forEach(b => b.classList.add('opacity-50', 'cursor-not-allowed'));
        } else {
            genreContainer.querySelectorAll('.choice-btn').forEach(b => b.classList.remove('opacity-50', 'cursor-not-allowed'));
        }
    });

    // --- 유효성 검사 및 데이터 저장 ---

    function validateAndSaveAllAnswers() {
        let isValid = true;
        userData = {}; // 데이터 객체 초기화
        errorMessage.classList.add('hidden'); // 에러 메시지 초기화

        // Q1: 닉네임
        const nickname = document.getElementById('q1-nickname').value.trim();
        if (nickname) {
            userData.nickname = nickname;
        } else {
            showError("Q1. 닉네임을 입력해주세요.");
            isValid = false;
        }

        // Q2: 나이
        const ageSelected = document.querySelector('#q2-age .choice-btn.selected');
        if (ageSelected && isValid) {
            userData.age = ageSelected.dataset.value;
        } else if (isValid) {
            showError("Q2. 나이대를 선택해주세요.");
            isValid = false;
        }

        // Q3: 빈도
        const freqSelected = document.querySelector('#q3-frequency .choice-btn.selected');
        if (freqSelected && isValid) {
            userData.frequency = freqSelected.dataset.value;
        } else if (isValid) {
            showError("Q3. 독서 빈도를 선택해주세요.");
            isValid = false;
        }

        // Q4: 목적
        const purposeSelected = document.querySelector('#q4-purpose .choice-btn.selected');
        if (purposeSelected && isValid) {
            userData.purpose = purposeSelected.dataset.value;
        } else if (isValid) {
            showError("Q4. 독서 목적을 선택해주세요.");
            isValid = false;
        }

        // Q5: 장르
        const selectedGenres = Array.from(document.querySelectorAll('#q5-genre .choice-btn.selected'))
                                    .map(btn => btn.dataset.value);
        if (selectedGenres.length > 0 && isValid) {
            userData.genres = selectedGenres;
        } else if (isValid) {
            showError("Q5. 선호 분야를 1개 이상 선택해주세요.");
            isValid = false;
        }
        
        // Q6: 형식
        const formatSelected = document.querySelector('#q6-format .choice-btn.selected');
        if (formatSelected && isValid) {
            userData.format = formatSelected.dataset.value;
        } else if (isValid) {
            showError("Q6. 독서 형식을 선택해주세요.");
            isValid = false;
        }

        // Q7: 인생책 (선택 사항)
        if (isValid) {
            userData.bookTitle = document.getElementById('q7-book-title').value.trim();
            userData.bookReason = document.getElementById('q7-book-reason').value.trim();
        }

        if (!isValid) {
            // 유효성 검사 실패 시 에러 메시지 영역으로 스크롤
            errorMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        return isValid;
    }
    
    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.classList.remove('hidden');
    }


    // --- 리포트 생성 ---

    function generateReport(allResponses) {
        console.log("Generating report with data:", allResponses);
        const totalCount = allResponses.length;

        // 1. 기본 정보 설정
        document.getElementById('report-nickname').textContent = userData.nickname;
        document.getElementById('total-participants').textContent = totalCount;
        document.getElementById('my-frequency').textContent = userData.frequency;

        // 데이터 집계
        const ageFreqData = { '10대': {}, '20대': {}, '30대': {}, '40대 이상': {} };
        const formatData = { '종이책': 0, '전자책': 0, '종이책 + 전자책': 0, '기타': 0 };
        const genreData = {};
        const freqData = { '월 1회 미만': 0, '월 1~2회': 0, '월 3~4회': 0, '주 1회 이상': 0 };
        const bookBoardData = [];

        const freqLabels = ['월 1회 미만', '월 1~2회', '월 3~4회', '주 1회 이상'];
        const ageLabels = ['10대', '20대', '30대', '40대 이상'];
        
        // ageFreqData 초기화
        ageLabels.forEach(age => {
            freqLabels.forEach(freq => {
                ageFreqData[age][freq] = 0;
            });
        });

        allResponses.forEach(res => {
            // 세대별 빈도
            if (res.age && res.frequency && ageFreqData[res.age] && ageFreqData[res.age].hasOwnProperty(res.frequency)) {
                ageFreqData[res.age][res.frequency]++;
            }
            // 형식
            if (res.format && formatData.hasOwnProperty(res.format)) {
                formatData[res.format]++;
            }
            // 빈도
            if (res.frequency && freqData.hasOwnProperty(res.frequency)) {
                freqData[res.frequency]++;
            }
            // 장르 (배열)
            if (res.genres && Array.isArray(res.genres)) {
                res.genres.forEach(genre => {
                    genreData[genre] = (genreData[genre] || 0) + 1;
                });
            }
            // 인생책
            if (res.bookTitle) {
                bookBoardData.push({
                    nickname: res.nickname || '익명',
                    title: res.bookTitle,
                    reason: res.bookReason || ''
                });
            }
        });

        // --- 차트 생성 ---
        
        // 기존 차트 파괴 (다시하기 대비)
        Object.values(chartInstances).forEach(chart => chart.destroy());
        chartInstances = {};

        // 1. 나의 독서 빈도 vs 전체 (막대)
        const freqCtx = document.getElementById('chart-my-freq').getContext('2d');
        const myFreqColors = freqLabels.map(label => 
            label === userData.frequency ? 'rgba(59, 130, 246, 1)' : 'rgba(209, 213, 219, 1)'
        );
        chartInstances.myFreq = new Chart(freqCtx, {
            type: 'bar',
            data: {
                labels: freqLabels,
                datasets: [{
                    label: '전체 응답자 수',
                    data: freqLabels.map(label => freqData[label]),
                    backgroundColor: myFreqColors,
                    borderColor: myFreqColors,
                    borderWidth: 1
                }]
            },
            options: {
                indexAxis: 'y', // 가로 막대
                responsive: true,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) label += ': ';
                                if (context.parsed.x !== null) label += context.parsed.x + '명';
                                return label;
                            }
                        }
                    }
                },
                scales: {
                    x: { beginAtZero: true, title: { display: true, text: '응답자 수 (명)' } },
                }
            }
        });
        
        // 2. 세대별 독서 빈도 (그룹 막대)
        const ageFreqCtx = document.getElementById('chart-age-freq').getContext('2d');
        const ageColors = ['rgba(255, 99, 132, 0.7)', 'rgba(54, 162, 235, 0.7)', 'rgba(255, 206, 86, 0.7)', 'rgba(75, 192, 192, 0.7)'];
        chartInstances.ageFreq = new Chart(ageFreqCtx, {
            type: 'bar',
            data: {
                labels: freqLabels, // x축: 빈도
                datasets: ageLabels.map((age, i) => ({
                    label: age,
                    data: freqLabels.map(freq => ageFreqData[age][freq] || 0), // 각 빈도에 해당하는 세대별 데이터
                    backgroundColor: ageColors[i],
                }))
            },
            options: {
                responsive: true,
                plugins: { legend: { position: 'top' } },
                scales: {
                    x: { title: { display: true, text: '독서 빈도' } },
                    y: { beginAtZero: true, title: { display: true, text: '응답자 수 (명)' } }
                }
            }
        });

        // 3. 독서 형식 선호도 (파이)
        const formatCtx = document.getElementById('chart-format').getContext('2d');
        chartInstances.format = new Chart(formatCtx, {
            type: 'pie',
            data: {
                labels: Object.keys(formatData),
                datasets: [{
                    data: Object.values(formatData),
                    backgroundColor: ['rgba(255, 99, 132, 0.7)', 'rgba(54, 162, 235, 0.7)', 'rgba(255, 206, 86, 0.7)', 'rgba(75, 192, 192, 0.7)'],
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom' } }
            }
        });

        // 4. 장르별 인기 순위 (가로 막대)
        const sortedGenres = Object.entries(genreData).sort(([,a], [,b]) => b - a);
        const genreLabels = sortedGenres.map(item => item[0]);
        const genreValues = sortedGenres.map(item => item[1]);
        
        const genreCtx = document.getElementById('chart-genre').getContext('2d');
        chartInstances.genre = new Chart(genreCtx, {
            type: 'bar',
            data: {
                labels: genreLabels,
                datasets: [{
                    label: '선택 수',
                    data: genreValues,
                    backgroundColor: 'rgba(107, 114, 128, 0.7)',
                }]
            },
            options: {
                indexAxis: 'y', // 가로 막대
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { beginAtZero: true },
                }
            }
        });

        // 5. 인생책 게시판
        const bookBoardEl = document.getElementById('book-board');
        bookBoardEl.innerHTML = ''; // 초기화
        
        if (bookBoardData.length === 0) {
            bookBoardEl.innerHTML = '<p class="text-gray-500 text-center">아직 등록된 인생책이 없습니다.</p>';
        } else {
            // 최신순으로 정렬 (Firestore에 저장된 데이터는 순서가 보장되지 않을 수 있으나, 여기서는 그냥 추가)
            bookBoardData.reverse().forEach(book => {
                const bookEl = document.createElement('div');
                bookEl.className = 'bg-white p-4 rounded-lg shadow';
                bookEl.innerHTML = `
                    <h3 class="font-bold text-lg text-blue-700">${book.title} 
                        <span class="text-sm font-normal text-gray-500">(by. ${book.nickname})</span>
                    </h3>
                    <p class="text-gray-700 mt-2 whitespace-pre-wrap">${book.reason}</p>
                `;
                bookBoardEl.appendChild(bookEl);
            });
        }
    }

    // --- 초기화 ---
    showPage('start'); // 앱 로드 시 시작 페이지 표시
}

// Firebase 초기화를 시작합니다.
initializeFirebase();

